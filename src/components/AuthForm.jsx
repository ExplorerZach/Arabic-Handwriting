import { useState } from 'react';
import { getSupabase } from '../utils/supabase';
import loginStyles from '../styles/loginStyles';

/**
 * Shared email/password sign-in/sign-up form — used by LoginScreen (full
 * size) and SettingsPanel (compact). Extraction keeps the auth quirks in
 * ONE place:
 * - `identities.length === 0` on signUp = account already exists (Supabase
 *   returns a fake user when email confirmation is on).
 * - `data.session === null` after signUp = email confirmation required →
 *   show "check your inbox" instead of silently doing nothing.
 * - `email_not_confirmed` error mapped by code, not message substring.
 */
export default function AuthForm({ t, compact = false }) {
  const [mode, setMode] = useState('signIn'); // 'signIn' | 'signUp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const supabase = getSupabase();
    try {
      if (mode === 'signUp') {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        if (data?.user?.identities?.length === 0) {
          setError(t('authEmailExists'));
          return;
        }
        if (!data?.session) {
          // Email confirmation enabled — no session until they verify.
          setCheckEmail(true);
          return;
        }
        // Otherwise signUp auto-signed in; onAuthStateChange takes over.
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      if (err?.code === 'email_not_confirmed' || (err?.message || '').includes('not confirmed')) {
        setError(t('authEmailNotConfirmed'));
      } else {
        setError(err?.message || t('authGenericError'));
      }
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = compact
    ? {
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        padding: '6px 10px',
        marginBottom: 6,
        borderRadius: 6,
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        fontSize: 13,
        fontFamily: 'Georgia,serif',
      }
    : {
        ...loginStyles.input,
        display: 'block',
        marginBottom: 8,
        fontSize: 14,
        fontFamily: 'Georgia,serif',
      };

  const toggleBtnStyle = active => ({
    flex: 1,
    padding: compact ? '4px 0' : '6px 0',
    borderRadius: 6,
    border: active ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
    background: active ? 'var(--color-btn-alpha-bg)' : 'transparent',
    color: 'var(--color-text)',
    fontSize: compact ? 12 : 13,
    cursor: 'pointer',
    fontFamily: 'Georgia,serif',
  });

  const disabled = busy || !email || password.length < 6;

  const submitStyle = compact
    ? {
        padding: '6px 14px',
        borderRadius: 6,
        border: 'none',
        background: 'var(--color-accent)',
        color: '#fff',
        fontSize: 12,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'Georgia,serif',
      }
    : {
        ...loginStyles.btn,
        opacity: disabled ? 0.5 : 1,
        marginTop: 4,
      };

  if (checkEmail) {
    return (
      <p
        style={{
          fontSize: compact ? 12 : 13,
          color: 'var(--color-text)',
          lineHeight: 1.5,
          margin: '8px 0',
        }}
      >
        {t('authCheckEmail')}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: compact ? 8 : 12 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: compact ? 8 : 12 }}>
        <button
          type="button"
          onClick={() => {
            setMode('signIn');
            setError('');
          }}
          style={toggleBtnStyle(mode === 'signIn')}
        >
          {t('authSignIn')}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signUp');
            setError('');
          }}
          style={toggleBtnStyle(mode === 'signUp')}
        >
          {t('authSignUp')}
        </button>
      </div>

      <input
        style={inputStyle}
        type="email"
        placeholder={t('authEmailPlaceholder')}
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />

      <input
        style={inputStyle}
        type="password"
        autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
        placeholder={t('authPasswordPlaceholder')}
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        minLength={6}
      />

      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: compact ? 11 : 12, margin: '4px 0' }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={disabled} style={submitStyle}>
        {busy ? '…' : mode === 'signUp' ? t('authCreateAccount') : t('authSignIn')}
      </button>
    </form>
  );
}
