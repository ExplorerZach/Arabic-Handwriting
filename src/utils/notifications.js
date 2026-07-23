import { isTauri } from './env';

const LAST_REMINDER_KEY = 'last_daily_reminder';

export async function maybeSendReminder(t) {
  if (!isTauri) return;
  const today = new Date().toISOString().split('T')[0];
  const last = localStorage.getItem(LAST_REMINDER_KEY);
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
  localStorage.setItem(LAST_REMINDER_KEY, today);
}
