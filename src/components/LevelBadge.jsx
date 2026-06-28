import { getLevelInfo } from "../utils/xp";
import styles from "../styles/practiceStyles";

/**
 * Compact header badge: level number + progress bar to the next level.
 * Reads the current total XP from the xp module and derives level info
 * on each render (cheap — pure arithmetic). Re-renders whenever the
 * parent re-renders (the parent bumps `progressVersion` on every XP award).
 */
export default function LevelBadge({ totalXp, label, t }) {
  const info = getLevelInfo(totalXp);
  const pct = Math.max(0, Math.min(1, info.progressPct));
  const ariaLabel = `${label || ""} ${info.level} · ${t("xpToNext").replace("{n}", String(info.xpForNextLevel - info.xpIntoLevel))}`;

  return (
    <div
      className="btn-gear"
      style={styles.levelBadge}
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      <span style={styles.levelBadgeIcon} aria-hidden="true">✦</span>
      <span style={styles.levelBadgeNum}>
        {t("xpLevelShort")} {info.level}
      </span>
      <span style={styles.levelBadgeBar} aria-hidden="true">
        <span
          style={{ ...styles.levelBadgeBarFill, width: `${pct * 100}%` }}
        />
      </span>
    </div>
  );
}
