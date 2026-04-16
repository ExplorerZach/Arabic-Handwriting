import { useState } from 'react';
import styles from '../styles/loginStyles';

export default function LoginScreen({ onSave, darkMode, onToggleDarkMode }) {
  const [key, setKey] = useState('');

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <button
          onClick={onToggleDarkMode}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={darkMode}
          title={darkMode ? 'Light mode' : 'Dark mode'}
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
        <div style={styles.arabic}>مكتبة الخط</div>
        <div style={styles.title}>Arabic Script Practice</div>

        <p style={styles.body}>
          This app uses AI for handwriting feedback. Paste your OpenRouter API
          key below to get started. You can get one at{' '}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            style={styles.link}
          >
            openrouter.ai/keys
          </a>
          .
        </p>

        <p style={styles.note}>
          Your key is stored only on this device and never sent anywhere except
          OpenRouter.
        </p>

        <input
          style={styles.input}
          type="password"
          placeholder="sk-or-..."
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
          Start Practicing →
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
          Continue without AI
        </button>
      </div>
    </div>
  );
}
