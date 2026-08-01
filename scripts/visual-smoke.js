#!/usr/bin/env node
/**
 * Host-Chrome visual smoke (NO MCP — plain Node + playwright-core).
 *
 * The containerized Playwright MCP cannot reach this app (Chrome's Private
 * Network Access blocks host.docker.internal from a non-secure context; request
 * interception deadlocks the service worker + driver). This is the sanctioned
 * flow: drive the HOST's own Chrome (Edge fallback) against `npm run dev` /
 * `npm run preview` with playwright-core.
 *
 * playwright-core is loaded from an absolute path OUTSIDE the repo so it never
 * becomes a dependency (NODE_PATH doesn't work for ESM). Override the location
 * with PLAYWRIGHT_CORE_PATH. Repo is ESM, so we use createRequire.
 *
 * smoke scope (no flake): load → draw one stroke → locale→ar (dir=rtl flip) →
 * dark-mode toggle → screenshots to a temp dir. Exit 0 on PASS, 1 on FAIL.
 *
 * Usage:
 *   npm run visual                      # against http://localhost:5173
 *   npm run visual -- --url http://localhost:4173   # vite preview
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);

const PLAYWRIGHT_CORE_PATH =
  process.env.PLAYWRIGHT_CORE_PATH ??
  'C:/Users/Admin/AppData/Local/Temp/opencode/node_modules/playwright-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

// Temp output only — never into the repo (overrideable for tooling/tests).
const OUT_DIR = process.env.VISUAL_OUT_DIR ?? join(tmpdir(), 'visual-smoke');

const urlArgIndex = process.argv.indexOf('--url');
const URL = urlArgIndex !== -1 ? process.argv[urlArgIndex + 1] : 'http://localhost:5173';

const results = [];
const record = (name, pass, detail = '') => results.push({ name, pass, detail });

const isFavicon = url => /favicon/i.test(url);

async function main() {
  // Resolve playwright-core from its absolute path (never a repo dependency).
  let chromium;
  try {
    const entry = resolve(PLAYWRIGHT_CORE_PATH, 'index.js');
    if (!existsSync(entry)) throw new Error(`index.js not found at ${entry}`);
    chromium = require(entry).chromium;
  } catch (err) {
    console.error(
      `[visual] cannot load playwright-core from ${PLAYWRIGHT_CORE_PATH}\n` +
        `         set PLAYWRIGHT_CORE_PATH to the install dir. ${err.message}`,
    );
    return 1;
  }

  // Host browser: Chrome, fall back to Edge, else fail clearly.
  const executablePath = existsSync(CHROME) ? CHROME : existsSync(EDGE) ? EDGE : null;
  if (!executablePath) {
    console.error(
      '[visual] no host Chrome or Edge found — install one or set ' +
        'PLAYWRIGHT_CHROME_PATH / PLAYWRIGHT_EDGE_PATH.',
    );
    return 1;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ executablePath, headless: true });
  let page;
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      // Exercises the prefers-color-scheme blocks in download.html.
      colorScheme: 'dark',
    });
    // Seed state so we land on the practice UI with no login gate. Keep seeds
    // minimal — a fresh localStorage otherwise.
    await context.addInitScript(() => {
      localStorage.setItem('app_darkMode', 'true');
    });

    page = await context.newPage();
    const problems = [];
    // Known dev-only noise — dev-CSP blocked third-party traffic the production
    // build doesn't make + the browser note that a meta-delivered CSP
    // frame-ancestors directive is ignored. Substring allowlist on the entry:
    // keeps the no-errors check strict for every other console/page/request error.
    const KNOWN_DEV_NOISE = ['va.vercel-scripts.com', 'api.github.com', 'frame-ancestors'];
    const isKnownDevNoise = text => KNOWN_DEV_NOISE.some(n => text.includes(n));
    page.on('pageerror', err => {
      if (!isKnownDevNoise(err.message)) problems.push(`pageerror: ${err.message}`);
    });
    page.on('console', msg => {
      if (msg.type() === 'error' && !isKnownDevNoise(msg.text())) {
        problems.push(`console.error: ${msg.text()}`);
      }
    });
    // NOTE: never use page.route() / request interception here — it deadlocks
    // the service worker + driver (documented). This is a pass-through page.
    page.on('requestfailed', req => {
      const url = req.url();
      if (!isFavicon(url) && !isKnownDevNoise(url)) {
        problems.push(`requestfailed: ${url} ${req.failure()?.errorText ?? ''}`);
      }
    });

    // ── 1. Load ───────────────────────────────────────────────────────────
    try {
      await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (err) {
      console.error(
        `[visual] could not reach ${URL}\n` +
          '         start a server first: `npm run dev` (from the MAIN ' +
          `checkout) or \`npm run preview\`. ${err.message}`,
      );
      return 1;
    }
    await page.waitForSelector('#main-canvas', { state: 'visible', timeout: 15000 });
    // Let the initial paper background render so the baseline is stable.
    await page.waitForTimeout(250);

    // ── 2. Console / page errors after load ───────────────────────────────
    record(
      'App loaded with no console/page errors',
      problems.length === 0,
      problems.length ? problems.join(' | ') : '',
    );

    // ── 3. Draw one stroke on the practice canvas ─────────────────────────
    const canvas = page.locator('#main-canvas');
    const before = await canvas.evaluate(el => el.toDataURL());
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(120);
    const after = await canvas.evaluate(el => el.toDataURL());
    record('Drew a stroke on the practice canvas', before !== after, 'canvas pixels changed');

    // ── 4. Dark-mode toggle (seeded dark, verify the flip) ────────────────
    record(
      'Dark mode applied on load',
      await page.$eval('html', el => el.hasAttribute('data-theme')),
      'data-theme="dark" from seed',
    );
    // The dark/locale toggles live in the Settings panel — open it first.
    await page.click('button[aria-label="Open settings"]');
    await page.waitForSelector('#settings-panel');
    await page.click('button[aria-label="Toggle dark mode"]');
    const themeOff = await page.$eval('html', el => el.hasAttribute('data-theme'));
    record(
      'Dark mode toggle flips data-theme off',
      !themeOff,
      `light after toggle (data-theme removed=${!themeOff})`,
    );
    await page.click('button[aria-label="Toggle dark mode"]');
    const themeOn = await page.$eval('html', el => el.hasAttribute('data-theme'));
    record('Dark mode toggle restores data-theme', themeOn, 'dark after second toggle');

    // ── 5. Locale → ar flips dir=rtl ──────────────────────────────────────
    await page.click('button[aria-label="Switch language"]');
    const dir = await page.$eval('html', el => el.getAttribute('dir'));
    const lang = await page.$eval('html', el => el.getAttribute('lang'));
    record('Locale → ar flips dir=rtl', dir === 'rtl' && lang === 'ar', `dir=${dir}, lang=${lang}`);

    // ── 6. Screenshots to temp dir ────────────────────────────────────────
    await page.screenshot({ path: join(OUT_DIR, '01-loaded.png') });
    await page.screenshot({ path: join(OUT_DIR, '02-stroke.png') });
    await page.screenshot({ path: join(OUT_DIR, '03-ar-dark.png') });
  } finally {
    await browser.close();
  }

  return 0;
}

async function run() {
  const exitCode = await main();
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass);
  console.log(
    `\n[visual] host browser checks (${URL}) — playwright-core from ${PLAYWRIGHT_CORE_PATH}`,
  );
  for (const r of results) {
    console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  if (exitCode !== 0) {
    // setup/load failed (e.g. dead port) — main() already printed the details
    console.log(`[visual] NOT RUN — setup or load failed (exit ${exitCode})`);
    return exitCode;
  }
  console.log(`\n[visual] ${passed}/${results.length} checks passed — screenshots → ${OUT_DIR}`);
  if (failed.length > 0) {
    console.log(`[visual] FAIL (${failed.map(f => f.name).join('; ')})`);
    return 1;
  }
  console.log('[visual] PASS');
  return 0;
}

run()
  .then(code => {
    process.exitCode = code;
  })
  .catch(err => {
    console.error(`[visual] unexpected error: ${err.message}`);
    console.error(err.stack || '');
    process.exitCode = 1;
  });
