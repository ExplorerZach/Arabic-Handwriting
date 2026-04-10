import { useState } from 'react';
import styles from '../styles/loginStyles';

export default function LoginScreen({ onSave }) {
  const [key, setKey] = useState('');

  return (
    <div style={styles.root}>
      <div style={styles.card}>
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
            color: '#6b3800',
            border: '1px solid rgba(107,56,0,.3)',
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
