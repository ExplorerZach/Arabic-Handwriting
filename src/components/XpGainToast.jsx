/**
 * Floating "+N XP" confirmation toast. Rendered only when `gain` is a
 * positive number; the parent clears it after a timeout. The CSS animation
 * lives in global.css (.xp-toast / @keyframes xpPop) and is suppressed by
 * the reduced-motion guard there; this component additionally renders
 * nothing when reduceMotion is on so screen readers aren't interrupted.
 *
 * `gainKey` is a changing token (e.g. Date.now()) so React remounts the
 * element on each award and the CSS animation replays from the start.
 */
export default function XpGainToast({ gain, gainKey, t, reduceMotion }) {
  if (!gain || gain <= 0 || reduceMotion) return null;
  return (
    <div key={gainKey} className="xp-toast" aria-hidden="true">
      {t("xpEarned").replace("{n}", String(gain))}
    </div>
  );
}
