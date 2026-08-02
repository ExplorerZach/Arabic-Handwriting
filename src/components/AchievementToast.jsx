/**
 * Floating "Achievement unlocked" toast. Rendered only while `unlock` is
 * non-null; the useAchievements hook auto-clears it after ~2.5s. Unlike the
 * XP toast (a decorative "+N" that's aria-hidden), this is a real
 * announcement: role="status" + aria-live="polite" so screen readers hear
 * it, and it renders nothing under reduced motion so readers aren't
 * interrupted.
 *
 * `unlock.key` changes per unlock so React remounts the element and the CSS
 * animation (.ach-toast / @keyframes achPop) replays from the start.
 */
export default function AchievementToast({ unlock, t, reduceMotion }) {
  if (!unlock || reduceMotion) return null;
  return (
    <div key={unlock.key} className="ach-toast" role="status" aria-live="polite">
      <span className="ach-toast-icon" aria-hidden="true">
        {unlock.def.icon}
      </span>
      <span className="ach-toast-text">
        {t('achUnlockedToast').replace('{name}', t(unlock.def.nameKey))}
      </span>
    </div>
  );
}
