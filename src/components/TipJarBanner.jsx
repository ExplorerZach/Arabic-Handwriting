import { UI } from '../locales';

export default function TipJarBanner({ locale }) {
  const t = (key) => UI[locale][key] ?? key;

  if (!navigator.onLine) return null;

  // TODO: Replace with your actual Ko-fi URL (e.g. https://ko-fi.com/yourname)
  const KO_FI_URL = 'https://ko-fi.com';

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '520px',
        padding: '12px 14px',
        background: 'var(--color-surface-solid)',
        borderRadius: '10px',
        border: '1px solid var(--color-border)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: '13px', color: 'var(--color-text-soft)', lineHeight: 1.5 }}>
        {t('tipJarMessage')}
      </span>
      <a
        href={KO_FI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-panel"
        style={{
          padding: '6px 14px',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-btn-nav-bg)',
          fontSize: '12px',
          color: 'var(--color-accent)',
          textDecoration: 'none',
          fontWeight: '600',
          fontFamily: "'Georgia',serif",
        }}
      >
        ❤️ {t('tipJarKofi')}
      </a>
    </div>
  );
}
