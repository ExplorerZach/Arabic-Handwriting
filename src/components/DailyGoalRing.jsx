export default function DailyGoalRing({ current, goal, label }) {
  const safeGoal = Math.max(1, goal || 5);
  const pct = Math.min(current / safeGoal, 1);
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;
  const complete = current >= safeGoal;

  return (
    <div
      title={`${label || ''} ${current}/${safeGoal}`}
      style={{
        width: 32,
        height: 32,
        position: 'relative',
        flexShrink: 0,
      }}
      aria-label={`${label || ''} ${current} ${label ? '' : 'out of'} ${safeGoal}`}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <circle
          cx="16"
          cy="16"
          r={radius}
          fill="none"
          stroke="var(--color-progress-badge-bg)"
          strokeWidth="4"
        />
        <circle
          cx="16"
          cy="16"
          r={radius}
          fill="none"
          stroke={complete ? 'var(--color-dot-complete)' : 'var(--color-accent)'}
          strokeWidth="4"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 16 16)"
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--color-text)',
        }}
      >
        {current >= safeGoal ? '✓' : safeGoal}
      </span>
    </div>
  );
}
