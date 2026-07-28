import { UI } from '../locales';

export default function AffiliateLinks({ locale }) {
  const t = key => UI[locale][key] ?? key;

  if (!navigator.onLine) return null;

  // Plain non-affiliate product recommendations (no commission).
  // TODO: Replace with direct links to official product pages if desired.
  const links = [
    {
      emoji: '✏️',
      titleKey: 'affApplePencil',
      descKey: 'affApplePencilDesc',
      url: 'https://www.apple.com/apple-pencil/',
    },
    {
      emoji: '📱',
      titleKey: 'affGalaxyTab',
      descKey: 'affGalaxyTabDesc',
      url: 'https://www.samsung.com/us/tablets/',
    },
    {
      emoji: '🗣️',
      titleKey: 'affItalki',
      descKey: 'affItalkiDesc',
      url: 'https://www.italki.com',
    },
    {
      emoji: '🎓',
      titleKey: 'affPreply',
      descKey: 'affPreplyDesc',
      url: 'https://preply.com',
    },
  ];

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
        gap: '10px',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          fontWeight: '700',
          color: 'var(--color-text-muted)',
          letterSpacing: '.15em',
          textTransform: 'uppercase',
        }}
      >
        {t('affTitle')}
      </div>
      {links.map(item => (
        <a
          key={item.titleKey}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 10px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'background .15s',
          }}
          className="affiliate-link"
        >
          <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.emoji}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text)' }}>
              {t(item.titleKey)}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {t(item.descKey)}
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
