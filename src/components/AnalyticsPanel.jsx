import { useMemo } from 'react';
import { UI } from '../locales';
import { getStreaks, getScoreDistribution, getWeaknesses, getPracticeHeatmap, getProgressOverTime, getTotalSessions } from '../utils/analytics';
import { getFreezeStatus } from '../utils/freezes';
import { FORM_NAMES } from '../locales';
import styles from '../styles/practiceStyles';

export default function AnalyticsPanel({ locale, LETTERS, progress, progressVersion, onGoToItem }) {
  const t = (key) => UI[locale][key] ?? key;

  // All of these re-derive real data from localStorage. Cheap individually
  // but a handful of them are O(days × letters × forms) and the stats tab
  // re-renders on every unrelated PracticeView state change (pointer moves,
  // feedback flips, theme toggles). Memoize on progressVersion so they only
  // re-run when the underlying data actually changes.
  const streaks = useMemo(() => getStreaks(), [progressVersion]);
  const scoreDist = useMemo(() => getScoreDistribution(progress), [progress, progressVersion]);
  const weaknesses = useMemo(() => getWeaknesses(LETTERS, progress), [LETTERS, progress, progressVersion]);
  const { heatmap, max: heatMax } = useMemo(() => getPracticeHeatmap(LETTERS, progress), [LETTERS, progress, progressVersion]);
  const timeline = useMemo(() => getProgressOverTime(LETTERS, progress, 30), [LETTERS, progress, progressVersion]);
  const totalSessions = useMemo(() => getTotalSessions(), [progressVersion]);
  const freezeStatus = useMemo(() => getFreezeStatus(), [progressVersion]);

  const totalScoreCount = Object.values(scoreDist).reduce((a, b) => a + b, 0);
  const avgScore = totalScoreCount > 0
    ? Object.entries(scoreDist).reduce((sum, [k, v]) => sum + Number(k) * v, 0) / totalScoreCount
    : 0;

  // Timeline Y-axis: scale to the busiest day in the window so a day with
  // 3 sessions is visibly taller than a day with 1, without letting a
  // single outlier flatten the rest.
  const timelineMax = Math.max(1, ...timeline.map((pt) => pt.sessions));

  return (
    <div style={styles.analyticsPanel}>
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
          <span style={freezeStatus.availableThisMonth ? styles.analyticsFreezeAvailable : styles.analyticsFreezeUsed}>
            {freezeStatus.availableThisMonth ? t('freezeAvailable') : t('freezeUsed')}
          </span>
        </div>
      </div>

      {/* Average Score */}
      {totalScoreCount > 0 && (
        <div style={styles.analyticsCard}>
          <div style={styles.analyticsCardTitle}>{t('statsAvgScore')}</div>
          <div style={styles.analyticsScoreBig}>
            {avgScore.toFixed(1)}
            <span style={styles.analyticsScoreStars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} style={n <= Math.round(avgScore) ? styles.starFilled : styles.starEmpty}>★</span>
              ))}
            </span>
          </div>
        </div>
      )}

      {/* Score Distribution */}
      <div style={styles.analyticsCard}>
        <div style={styles.analyticsCardTitle}>{t('statsScoreDist')}</div>
        <div style={styles.analyticsBarChart}>
          {[1, 2, 3, 4, 5].map((n) => {
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
          {LETTERS.map((l) => {
            const count = heatmap[l.name] || 0;
            const intensity = heatMax > 0 ? count / heatMax : 0;
            return (
              <button
                key={l.name}
                className="btn-alpha"
                style={{
                  ...styles.analyticsHeatmapCell,
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
            {weaknesses.map((w) => (
              <button
                key={`${w.letterName}-${w.formKey}`}
                className="btn-alpha"
                style={styles.analyticsWeakItem}
                onClick={() => onGoToItem(w.letterName, w.formKey)}
              >
                <span style={styles.analyticsWeakChar} lang="ar">{w.letterChar}</span>
                <span style={styles.analyticsWeakName}>{w.letterName}</span>
                <span style={styles.analyticsWeakForm}>{t(FORM_NAMES[w.formKey] ?? w.formKey)}</span>
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
                  {pt.practiced && (
                    pt.frozen ? (
                      <div style={styles.analyticsTimelineFrozenBar} />
                    ) : (
                      <div style={{ ...styles.analyticsTimelineBar, height: `${Math.max(heightPct, 8)}%` }} />
                    )
                  )}
                </div>
                {i % 5 === 0 && (
                  <span style={styles.analyticsTimelineLabel}>{pt.label}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
