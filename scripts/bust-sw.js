import { readFileSync, writeFileSync, readdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const assetsDir = join(root, 'dist', 'assets');
let files;
try {
  files = readdirSync(assetsDir);
} catch {
  console.error('[bust-sw] dist/assets/ not found — did you run vite build?');
  process.exit(1);
}

const jsFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
const cssFile = files.find(f => f.startsWith('index-') && f.endsWith('.css'));

if (!jsFile || !cssFile) {
  console.error('[bust-sw] Could not find hashed index-*.js / index-*.css in dist/assets/');
  process.exit(1);
}

const swPath = join(root, 'public', 'sw.js');
let sw = readFileSync(swPath, 'utf8');

sw = sw.replace(
  /const CACHE = 'arabic-v(\d+)'/,
  (_, n) => `const CACHE = 'arabic-v${parseInt(n, 10) + 1}'`,
);
sw = sw.replace(/\/assets\/index-[^']+\.js/, `/assets/${jsFile}`);
sw = sw.replace(/\/assets\/index-[^']+\.css/, `/assets/${cssFile}`);

writeFileSync(swPath, sw);
copyFileSync(swPath, join(root, 'sw.js'));
copyFileSync(swPath, join(root, 'dist', 'sw.js'));

const version = sw.match(/const CACHE = '(arabic-v\d+)'/)?.[1] ?? '?';
console.log(`[bust-sw] ${version} — ${jsFile}  ${cssFile}`);
