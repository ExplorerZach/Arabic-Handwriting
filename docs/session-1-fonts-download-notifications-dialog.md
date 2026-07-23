# Session 1 — Fonts, Download Page, Notifications, Native Dialog

(Tasks: #1 Bundle fonts, #6 Download page, #10 Notifications, #11 Native save dialog)

---

## Project context

- React 19 + Vite 8 PWA deployed to Vercel (writearabic.app)
- Tauri 2 added as dual build target (single codebase, web + desktop)
- `src-tauri/` already compiles (`npm run tauri dev` works)
- Runtime detection: `src/utils/env.js` exports `isTauri` (checks `window.__TAURI_INTERNALS__`)
- `npm run build` = web; `npm run tauri build` = native binaries
- Read AGENTS.md at root for conventions before starting

## Key files

- `index.html` — Google Fonts CDN links (Amiri + Scheherazade New)
- `src/styles/global.css` — CSS vars, this is where @font-face goes
- `src-tauri/tauri.conf.json` — CSP (currently allows fonts.googleapis.com / fonts.gstatic.com)
- `vercel.json` — web CSP headers
- `src/components/LoginScreen.jsx` — login screen, where download link goes
- `src/components/PracticeView.jsx` — saveDrawing at ~line 1186, shareDrawing at ~1201
- `src/locales/index.js` — all UI strings, add new keys to both `en` and `ar`
- `src-tauri/Cargo.toml` — Rust deps
- `src-tauri/src/lib.rs` — plugin registration
- `src-tauri/capabilities/default.json` — plugin permissions

---

## Task A — Bundle fonts locally

Download Amiri (400, 700, 400 italic) and Scheherazade New (400, 700) as .woff2 files from Google Fonts. Place in `public/fonts/`. Add `@font-face` declarations at the top of `src/styles/global.css`. Remove the Google Fonts `<link>` tags from `index.html` (keep the preconnects). Update both CSPs — `tauri.conf.json` and `vercel.json` — to remove googleapis/gstatic entries since fonts are local. Verify fonts render correctly in both web (`npm run dev`) and dark mode.

## Task B — Web download page

Since this is a SPA with no router, keep it simple:

1. Add locale keys to `src/locales/index.js` (in both `en` and `ar`):
   - `downloadTitle`: "Get the Desktop App"
   - `downloadDesc`: "Download for Windows, macOS, or Linux. The web version always stays free."
   - `downloadWindows`: "Windows"
   - `downloadMacOS`: "macOS"
   - `downloadLinux`: "Linux"

2. In `LoginScreen.jsx`, add a small footer area below the card with a link or button labeled `t('downloadTitle')`. Style it subtly — small text, muted color, inline style object from `loginStyles.js`. On click, it shows a simple modal/expandable section with OS-specific download links pointing to `https://github.com/YOUR_USERNAME/arabic-handwriting/releases/latest` (use `YOUR_USERNAME` placeholder). Keep the web-first feel — don't make it pushy.

3. Create `public/download.html` — a standalone HTML page (no React) accessible at `writearabic.app/download`. Basic HTML with the same CSS vars, Arabic font stack, OS-specific download buttons. Include:
   - App name + tagline
   - Three download buttons (Windows .msi, macOS .dmg, Linux .AppImage)
   - "Also available on the web at writearabic.app"
   - Dark/light mode via `prefers-color-scheme` media query
   - Link to GitHub Releases

## Task C — Notification plugin

1. Run `npm run tauri add notification` for automatic setup (Cargo.toml, npm, capabilities).

2. Create `src/utils/notifications.js`:

```js
import { isTauri } from './env';
import { getItem, setItem } from './storage';  // use localStorage for now if storage.js doesn't exist yet

// If storage.js doesn't exist yet, use localStorage directly:
const getItem = (k) => localStorage.getItem(k);
const setItem = (k, v) => localStorage.setItem(k, v);

const LAST_REMINDER_KEY = 'last_daily_reminder';

export async function maybeSendReminder(t) {
  if (!isTauri) return;
  const today = new Date().toISOString().split('T')[0];
  const last = getItem(LAST_REMINDER_KEY);
  if (last === today) return;

  const { isPermissionGranted, sendNotification, requestPermission } =
    await import('@tauri-apps/plugin-notification');

  let permitted = await isPermissionGranted();
  if (!permitted) {
    const result = await requestPermission();
    permitted = result === 'granted';
  }
  if (!permitted) return;

  await sendNotification({
    title: t?.('notifReminderTitle') ?? 'Arabic Script Practice',
    body: t?.('notifReminderBody') ?? "Don't forget your daily practice!",
  });
  setItem(LAST_REMINDER_KEY, today);
}
```

3. Add locale keys to `src/locales/index.js`:
   - `notifReminderTitle`: "Arabic Script Practice" / "مكتبة الخط"
   - `notifReminderBody`: "Don't forget your daily practice! 5 minutes keeps your streaks alive." / Arabic translation

4. Call `maybeSendReminder` from `src/App.jsx` on mount (in a `useEffect`). Also set a 6-hour `setInterval` for periodic checks. Both guarded with `isTauri`.

## Task D — Native file save dialog

1. Run `npm run tauri add dialog` and `npm run tauri add fs` for automatic setup.

2. In `src/components/PracticeView.jsx`, update `saveDrawing` (line ~1186):

```js
const saveDrawing = useCallback(async () => {
  if (!strokesRef.current.length) return;
  const dataURL = exportForSave();
  const name = practiceMode === "words"
    ? `arabic-${currentWord?.roman ?? "word"}`
    : `arabic-${letter.name.toLowerCase()}-${activeForm}`;

  if (isTauri) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const filePath = await save({
      defaultPath: `${name}.png`,
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    });
    if (!filePath) return;
    const res = await fetch(dataURL);
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();
    await writeFile(filePath, new Uint8Array(buf));
    return;
  }

  // web fallback
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = `${name}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}, [exportForSave, practiceMode, currentWord, letter.name, activeForm]);
```

3. Import `isTauri` from `'../../utils/env'` at the top of PracticeView.jsx if not already there.

4. For `shareDrawing`, keep `navigator.share` path for web; on Tauri call `saveDrawing` instead.

5. Verify: `npm run build` and `cargo check` in `src-tauri/`.

---

## Verification

When all four tasks are done, run:

```bash
npm run build        # web — must exit zero
cd src-tauri; cargo check; cd ..  # Rust — must exit zero
```
