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
