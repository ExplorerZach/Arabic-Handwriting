import { useState } from 'react';
import styles from '../styles/loginStyles';
import { UI } from '../locales';
import { useDownloadLinks } from '../utils/downloads';
import AuthForm from './AuthForm';

export default function LoginScreen({
  onSave,
  onCancel,
  darkMode,
  onToggleDarkMode,
  locale = 'en',
}) {
  const [key, setKey] = useState('');
  const [showDownload, setShowDownload] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const { links: dlLinks, fallback: dlFallback } = useDownloadLinks();
  const t = k => UI[locale][k] ?? k;

  return (
    <div style={styles.root}>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
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
          <div style={styles.arabic} lang="ar">
            {t('appTitle')}
          </div>
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

          <p style={styles.note}>{t('loginNote')}</p>

          <input
            style={styles.input}
            type="password"
            placeholder={t('loginPlaceholder')}
            value={key}
            onChange={e => setKey(e.target.value)}
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

          {onCancel && (
            <button
              style={{
                ...styles.btn,
                marginTop: '8px',
                background: 'transparent',
                color: 'var(--color-accent)',
                border: '1px solid var(--color-border)',
                boxShadow: 'none',
              }}
              onClick={onCancel}
            >
              {t('loginCancel')}
            </button>
          )}

          {/* ── Account section ── */}
          <div
            style={{ marginTop: 24, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}
          >
            <button
              onClick={() => setShowAccount(v => !v)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--color-text-muted)',
                fontFamily: 'Georgia,serif',
              }}
            >
              {showAccount ? '▼' : '▶'} {t('authSectionToggle')}
            </button>

            {showAccount && <AuthForm t={t} />}
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={() => setShowDownload(v => !v)} style={styles.downloadLink}>
            {showDownload ? '▼' : '▶'} {t('downloadTitle')}
          </button>

          {showDownload && (
            <div style={styles.downloadPanel}>
              <p style={styles.downloadDesc}>{t('downloadDesc')}</p>
              <a
                href={
                  dlLinks.win ||
                  dlFallback ||
                  'https://github.com/ExplorerZach/arabic-handwriting/releases/latest'
                }
                style={styles.osBtn}
                target="_blank"
                rel="noreferrer"
              >
                <span style={styles.osBtnIcon}>🪟</span> {t('downloadWindows')}
              </a>
              <a
                href={
                  dlLinks.mac ||
                  dlFallback ||
                  'https://github.com/ExplorerZach/arabic-handwriting/releases/latest'
                }
                style={styles.osBtn}
                target="_blank"
                rel="noreferrer"
              >
                <span style={styles.osBtnIcon}>🍎</span> {t('downloadMacOS')}
              </a>
              <a
                href={
                  dlLinks.linux ||
                  dlFallback ||
                  'https://github.com/ExplorerZach/arabic-handwriting/releases/latest'
                }
                style={styles.osBtn}
                target="_blank"
                rel="noreferrer"
              >
                <span style={styles.osBtnIcon}>🐧</span> {t('downloadLinux')}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
