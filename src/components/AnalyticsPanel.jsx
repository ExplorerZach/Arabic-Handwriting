import { useMemo } from 'react';
import { UI } from '../locales';
import {
  getStreaks,
  getScoreDistribution,
  getWeaknesses,
  getPracticeHeatmap,
  getProgressOverTime,
  getTotalSessions,
} from '../utils/analytics';
import { getXPTotal, getLevelInfo } from '../utils/xp';
import { getFreezeStatus } from '../utils/freezes';
import { ACHIEVEMENTS, getEarnedAchievements } from '../utils/achievements';
import { FORM_NAMES } from '../locales';
import styles from '../styles/practiceStyles';
import { getFontStack } from '../styles/themes';

export default function AnalyticsPanel({
  locale,
  calligraphyStyle,
  LETTERS,
  progress,
  progressVersion,
  onGoToItem,
}) {
  const t = key => UI[locale][key] ?? key;

  // All of these re-derive real data from localStorage. Cheap individually
  // but a handful of them are O(days × letters × forms) and the stats tab
  // re-renders on every unrelated PracticeView state change (pointer moves,
  // feedback flips, theme toggles). Memoize on progressVersion so they only
  // re-run when the underlying data actually changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const streaks = useMemo(() => getStreaks(), [progressVersion]);
  const scoreDist = useMemo(() => getScoreDistribution(progress), [progress]);
  const weaknesses = useMemo(() => getWeaknesses(LETTERS, progress), [LETTERS, progress]);
  const { heatmap, max: heatMax } = useMemo(
    () => getPracticeHeatmap(LETTERS, progress),
    [LETTERS, progress],
  );
  const timeline = useMemo(() => getProgressOverTime(LETTERS, progress, 30), [LETTERS, progress]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const totalSessions = useMemo(() => getTotalSessions(), [progressVersion]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const freezeStatus = useMemo(() => getFreezeStatus(), [progressVersion]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const xpTotal = useMemo(() => getXPTotal(), [progressVersion]);
  const levelInfo = useMemo(() => getLevelInfo(xpTotal), [xpTotal]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const earnedAch = useMemo(() => getEarnedAchievements(), [progressVersion]);

  const totalScoreCount = Object.values(scoreDist).reduce((a, b) => a + b, 0);
  const avgScore =
    totalScoreCount > 0
      ? Object.entries(scoreDist).reduce((sum, [k, v]) => sum + Number(k) * v, 0) / totalScoreCount
      : 0;

  // Timeline Y-axis: scale to the busiest day in the window so a day with
  // 3 sessions is visibly taller than a day with 1, without letting a
  // single outlier flatten the rest.
  const timelineMax = Math.max(1, ...timeline.map(pt => pt.sessions));

  return (
    <div style={styles.analyticsPanel}>
      {/* Level / XP card */}
      <div style={styles.xpCard}>
        <div style={styles.xpCardTitle}>{t('xpCardTitle')}</div>
        <div style={styles.xpCardRow}>
          <span style={styles.xpCardLevel}>{levelInfo.level}</span>
          <div style={styles.xpCardBarWrap}>
            <div style={styles.xpCardBar} aria-hidden="true">
              <div
                style={{
                  ...styles.xpCardBarFill,
                  width: `${Math.max(0, Math.min(1, levelInfo.progressPct)) * 100}%`,
                }}
              />
            </div>
            <span style={styles.xpCardTotal}>
              {t('xpTotal')}: {levelInfo.totalXp}
            </span>
          </div>
        </div>
        <div style={styles.xpCardHint}>
          {t('xpCardNextHint')
            .replace('{done}', String(levelInfo.xpIntoLevel))
            .replace('{need}', String(levelInfo.xpForNextLevel))
            .replace('{next}', String(levelInfo.level + 1))}
        </div>
      </div>

      {/* Streak Card */}
      <div style={styles.analyticsCard}>
        <div style={styles.analyticsCardTitle}>{t('statsStreakTitle')}</div>
        <div style={styles.analyticsStreakRow}>
          <div style={styles.analyticsStreakItem}>
            <span style={styles.analyticsStreakNumber}>{streaks.current}</span>
            <span style={styles.analyticsStreakLabel}>{t('statsCurrentStreak')}</span>
          </div>
          <div style={styles.analyticsStreakDivider} />
          <div style={styles.analyticsStreakItem}>
            <span style={styles.analyticsStreakNumber}>{streaks.longest}</span>
            <span style={styles.analyticsStreakLabel}>{t('statsLongestStreak')}</span>
          </div>
          <div style={styles.analyticsStreakDivider} />
          <div style={styles.analyticsStreakItem}>
            <span style={styles.analyticsStreakNumber}>{totalSessions}</span>
            <span style={styles.analyticsStreakLabel}>{t('statsTotalSessions')}</span>
          </div>
        </div>
        <div style={styles.analyticsFreezeRow}>
          <span
            style={
              freezeStatus.availableThisMonth
                ? styles.analyticsFreezeAvailable
                : styles.analyticsFreezeUsed
            }
          >
            {freezeStatus.usedThisMonth} {t('freezeUsed')}
          </span>
        </div>
      </div>

      {/* Achievements — earned tiles stay vivid, locked ones are dimmed. */}
      <div style={styles.analyticsCard}>
        <div style={styles.analyticsAchTitleRow}>
          <span style={styles.analyticsCardTitle}>{t('achievementsTitle')}</span>
          <span style={styles.analyticsAchCount}>
            {Object.keys(earnedAch).length}/{ACHIEVEMENTS.length}
          </span>
        </div>
        <div style={styles.analyticsAchGrid}>
          {ACHIEVEMENTS.map(def => {
            const earnedDate = earnedAch[def.id];
            return (
              <div
                key={def.id}
                style={
                  earnedDate
                    ? { ...styles.analyticsAchTile, ...styles.analyticsAchTileEarned }
                    : { ...styles.analyticsAchTile, ...styles.analyticsAchTileLocked }
                }
              >
                <span style={styles.analyticsAchIcon} aria-hidden="true">
                  {def.icon}
                </span>
                <span style={styles.analyticsAchName}>{t(def.nameKey)}</span>
                <span style={styles.analyticsAchDesc}>{t(def.descKey)}</span>
                {earnedDate && (
                  <span style={styles.analyticsAchDate}>
                    {t('achEarnedOn').replace('{date}', earnedDate)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Average Score */}
      {totalScoreCount > 0 && (
        <div style={styles.analyticsCard}>
          <div style={styles.analyticsCardTitle}>{t('statsAvgScore')}</div>
          <div style={styles.analyticsScoreBig}>
            {avgScore.toFixed(1)}
            <span style={styles.analyticsScoreStars}>
              {[1, 2, 3, 4, 5].map(n => (
                <span
                  key={n}
                  style={n <= Math.round(avgScore) ? styles.starFilled : styles.starEmpty}
                >
                  ★
                </span>
              ))}
            </span>
          </div>
        </div>
      )}

      {/* Score Distribution */}
      <div style={styles.analyticsCard}>
        <div style={styles.analyticsCardTitle}>{t('statsScoreDist')}</div>
        <div style={styles.analyticsBarChart}>
          {[1, 2, 3, 4, 5].map(n => {
            const count = scoreDist[n];
            const pct = totalScoreCount > 0 ? (count / totalScoreCount) * 100 : 0;
            return (
              <div key={n} style={styles.analyticsBarRow}>
                <span style={styles.analyticsBarLabel}>{n}★</span>
                <div style={styles.analyticsBarTrack}>
                  <div style={{ ...styles.analyticsBarFill, width: `${pct}%` }} />
                </div>
                <span style={styles.analyticsBarValue}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Practice Heatmap */}
      <div style={styles.analyticsCard}>
        <div style={styles.analyticsCardTitle}>{t('statsHeatmap')}</div>
        <div style={styles.analyticsHeatmapGrid}>
          {LETTERS.filter(l => !l.isWord).map(l => {
            const count = heatmap[l.name] || 0;
            const intensity = heatMax > 0 ? count / heatMax : 0;
            return (
              <button
                key={l.name}
                className="btn-alpha"
                style={{
                  ...styles.analyticsHeatmapCell,
                  fontFamily: getFontStack(calligraphyStyle),
                  opacity: 0.35 + intensity * 0.65,
                }}
                onClick={() => onGoToItem(l.name, 'isolated')}
                title={`${l.name} — ${count} ${t('statsSessions')}`}
                lang="ar"
              >
                {l.letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Weakness Analysis */}
      {weaknesses.length > 0 && (
        <div style={styles.analyticsCard}>
          <div style={styles.analyticsCardTitle}>{t('statsWeaknesses')}</div>
          <div style={styles.analyticsWeakList}>
            {weaknesses.map(w => (
              <button
                key={`${w.letterName}-${w.formKey}`}
                className="btn-alpha"
                style={styles.analyticsWeakItem}
                onClick={() => onGoToItem(w.letterName, w.formKey)}
              >
                <span
                  style={{
                    ...styles.analyticsWeakChar,
                    fontFamily: getFontStack(calligraphyStyle),
                  }}
                  lang="ar"
                >
                  {w.letterChar}
                </span>
                <span style={styles.analyticsWeakName}>{w.letterName}</span>
                <span style={styles.analyticsWeakForm}>
                  {t(FORM_NAMES[w.formKey] ?? w.formKey)}
                </span>
                <span style={styles.analyticsWeakScore}>{w.score}★</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Progress Timeline — real daily activity from arabic_practice_dates.
          Bar height reflects sessions that day relative to the busiest day
          in the 30-day window; days with no activity render as an empty
          slot so gaps are visible. */}
      <div style={styles.analyticsCard}>
        <div style={styles.analyticsCardTitle}>{t('statsTimeline')}</div>
        <div style={styles.analyticsTimeline}>
          {timeline.map((pt, i) => {
            const heightPct = pt.sessions > 0 ? (pt.sessions / timelineMax) * 100 : 0;
            return (
              <div
                key={pt.date}
                style={styles.analyticsTimelineCol}
                title={`${pt.date}: ${pt.sessions} ${t('statsSessions')}${pt.frozen ? ' · ' + t('freezePreserved') : ''}`}
              >
                <div style={styles.analyticsTimelineBarWrap}>
                  {pt.practiced &&
                    (pt.frozen ? (
                      <div style={styles.analyticsTimelineFrozenBar} />
                    ) : (
                      <div
                        style={{
                          ...styles.analyticsTimelineBar,
                          height: `${Math.max(heightPct, 8)}%`,
                        }}
                      />
                    ))}
                </div>
                {i % 5 === 0 && <span style={styles.analyticsTimelineLabel}>{pt.label}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
