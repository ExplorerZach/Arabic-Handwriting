# Session 3 — Updater Plugin + GitHub Actions CI

(Tasks: #4 Auto-update, #5 CI/CD pipelines)

---

## Project context

- React 19 + Vite 8 PWA deployed to Vercel (writearabic.app)
- Tauri 2 added as dual build target (single codebase, web + desktop)
- `src-tauri/` already compiles (`npm run tauri dev` works)
- Runtime detection: `src/utils/env.js` exports `isTauri` (checks `window.__TAURI_INTERNALS__`)
- `npm run build` = web; `npm run tauri build` = native binaries
- Read AGENTS.md at root for conventions before starting
- GitHub repo exists — check `git remote -v` for the correct username/org

## Key files

- `src/main.jsx` — entry point, add update check here
- `src/utils/env.js` — exports `isTauri`
- `src-tauri/tauri.conf.json` — add updater config
- `src-tauri/Cargo.toml` — Rust deps
- `src-tauri/src/lib.rs` — plugin registration
- `src-tauri/capabilities/default.json` — plugin permissions

---

## Task A — Tauri Updater plugin

### Step 1 — Install and register

```bash
npm run tauri add updater
npm run tauri add process
```

Verify `"updater:default"` and `"process:default"` appear in capabilities.

Add to `src-tauri/src/lib.rs` (before `.run()`):

```rust
.plugin(tauri_plugin_updater::Builder::default().build())
.plugin(tauri_plugin_process::init())
```

### Step 2 — Configure `tauri.conf.json`

Add a top-level `"plugins"` key:

```json
"plugins": {
  "updater": {
    "endpoints": [
      "https://github.com/YOUR_USERNAME/arabic-handwriting/releases/latest/download/latest.json"
    ],
    "pubkey": "PLACEHOLDER",
    "windows": {
      "installMode": "passive"
    }
  }
}
```

Replace `YOUR_USERNAME` with the actual GitHub username (from `git remote -v`). The `pubkey` placeholder gets replaced when the user generates a signing key (see Step 5).

### Step 3 — Create `src/utils/updater.js`

```js
import { isTauri } from './env';

let _checkedOnLaunch = false;

export async function checkForUpdatesOnLaunch() {
  if (!isTauri || _checkedOnLaunch) return;
  _checkedOnLaunch = true;
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const { relaunch } = await import('@tauri-apps/plugin-process');
    const update = await check();
    if (update) {
      await update.downloadAndInstall();
      await relaunch();
    }
  } catch (e) {
    console.error('Update check failed:', e);
  }
}
```

### Step 4 — Call from `src/main.jsx`

After app render, add:

```js
import { checkForUpdatesOnLaunch } from './utils/updater';

// Inside the hydrate().then(...) block, after render:
checkForUpdatesOnLaunch();
```

### Step 5 — Generate signing key (manual, for the user)

Add a section to AGENTS.md:

```markdown
## Updater Signing

Generate a keypair:
npx tauri signer generate -w ~/.tauri/arabic-script.key

The public key goes in `tauri.conf.json` → `plugins.updater.pubkey`.
The private key goes in GitHub Secrets as `TAURI_SIGNING_PRIVATE_KEY`.
Optionally set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if password-protected.
```

### Step 6 — Verify

```bash
npm run build        # web — must exit zero
cd src-tauri; cargo check; cd ..  # Rust — must exit zero
```

---

## Task B — GitHub Actions CI

### Step 1 — Create `.github/workflows/release.yml`

```yaml
name: Release
on:
  push:
    tags: ['v*']
  workflow_dispatch:

jobs:
  build-tauri:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: windows-latest
            target: x86_64-pc-windows-msvc
          - platform: macos-latest
            target: x86_64-apple-darwin
          - platform: macos-latest
            target: aarch64-apple-darwin
          - platform: ubuntu-latest
            target: x86_64-unknown-linux-gnu

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - uses: dtolnay/rust-toolchain@stable
        with: { targets: ${{ matrix.target }} }
      - name: Install Linux deps
        if: matrix.platform == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
      - run: npm ci
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Arabic Script Practice v__VERSION__'
          releaseBody: 'See the assets to download and install.'
          releaseDraft: true
          prerelease: false
          updaterJsonPreferNsis: true
```

### Step 2 — Create `.github/workflows/web-check.yml`

```yaml
name: Web Build Check
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run build
```

### Step 3 — Sync version fields

Update `tauri.conf.json` to match `src-tauri/Cargo.toml` version. Both should be `"0.1.0"` initially (bump together before tagging a release). Add a note in AGENTS.md:

> **Bumping versions:** Before tagging a release, increment both `tauri.conf.json > version` and `src-tauri/Cargo.toml > version` to the same value.

### Step 4 — Verify

```bash
npm run build        # web — must exit zero
cd src-tauri; cargo check; cd ..  # Rust — must exit zero
```

Review the workflow YAML files for correct indentation and make sure the `.github/workflows/` directory gets created.

---

## Post-session: user steps

Before the CI can publish signed releases, the user must:

1. Generate a signing keypair with `npx tauri signer generate`
2. Paste the public key into `tauri.conf.json` → `plugins.updater.pubkey`
3. Add the private key as `TAURI_SIGNING_PRIVATE_KEY` in GitHub Secrets (repo Settings → Secrets and variables → Actions)
4. Push a `v0.1.0` tag to trigger the first release build
