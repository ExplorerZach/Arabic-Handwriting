import { useState } from 'react';
import styles from '../styles/loginStyles';
import { UI } from '../locales';

export default function LoginScreen({ onSave, darkMode, onToggleDarkMode, locale = 'en' }) {
  const [key, setKey] = useState('');
  const t = (k) => UI[locale][k] ?? k;

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <button
          onClick={onToggleDarkMode}
          aria-label={darkMode ? t('ariaSwitchLight') : t('ariaSwitchDark')}
          aria-pressed={darkMode}
          title={darkMode ? t('settingsLightMode') : t('settingsDarkMode')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
            position: 'absolute',
            top: '20px',
            right: '24px',
            padding: '4px',
            color: 'var(--color-text-muted)',
          }}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
        <div style={styles.arabic} lang="ar">{t('appTitle')}</div>
        <div style={styles.title}>{t('appSubtitle')}</div>

        <p style={styles.body}>
          {t('loginIntroPrefix')}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            style={styles.link}
          >
            {t('loginIntroLink')}
          </a>
          {t('loginIntroSuffix')}
        </p>

        <p style={styles.note}>
          {t('loginNote')}
        </p>

        <input
          style={styles.input}
          type="password"
          placeholder={t('loginPlaceholder')}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />

        <button
          style={{
            ...styles.btn,
            opacity: key.startsWith('sk-or-') ? 1 : 0.5,
          }}
          disabled={!key.startsWith('sk-or-')}
          onClick={() => onSave(key.trim())}
        >
          {t('loginStart')}
        </button>

        <button
          style={{
            ...styles.btn,
            marginTop: '8px',
            background: 'transparent',
            color: 'var(--color-accent)',
            border: '1px solid var(--color-border)',
            boxShadow: 'none',
          }}
          onClick={() => onSave('skip')}
        >
          {t('loginSkip')}
        </button>
      </div>
    </div>
  );
}
