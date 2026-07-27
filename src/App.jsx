import { useState, useEffect, useCallback, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import PracticeView from './components/PracticeView';
import { UI } from './locales';
import { isTauri } from './utils/env';
import { maybeSendReminder } from './utils/notifications';
import { getItem, setItem, onChange } from './utils/storage';
import { getApiKey, setApiKey, removeApiKey } from './utils/secureStorage';
import { getSupabase } from './utils/supabase';
import { syncNow, isInitialSyncDone, resetInitialSync, markDirty, isDirty } from './utils/sync';
import { BACKUP_KEYS } from './utils/backup';

export default function App() {
  const [apiKey, setApiKeyState] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);

  const userRef = useRef(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Debounced sync: push to cloud 2 s after the last learning-data write,
  // only if signed in, online, and the sign-in initial sync has finished.
  // The BACKUP_KEYS filter is load-bearing: syncing itself writes
  // `_lastSyncTime` through storage, which would otherwise re-arm the
  // debounce after every successful push — an infinite push loop.
  const syncTimerRef = useRef(null);
  useEffect(() => {
    const unsub = onChange(key => {
      if (!BACKUP_KEYS.includes(key)) return;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        syncTimerRef.current = null;
        const u = userRef.current;
        if (!u || !isInitialSyncDone(u.id)) return;
        if (!navigator.onLine) {
          markDirty();
          return;
        }
        syncNow();
      }, 2000);
    });
    return () => {
      unsub();
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  // Flush offline writes when connectivity returns (or the tab regains
  // visibility — `online` events are unreliable behind captive portals).
  // pushToCloud clears the dirty flag itself on success and re-sets it on
  // failure, so a failed flush is retried on the next trigger.
  useEffect(() => {
    const flush = () => {
      const u = userRef.current;
      if (!u || !isDirty()) return;
      if (isInitialSyncDone(u.id)) syncNow();
    };
    const handleOnline = () => flush();
    const handleVisible = () => {
      if (document.visibilityState === 'visible') flush();
    };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisible);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, []);

  useEffect(() => {
    getApiKey().then(setApiKeyState);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    // INITIAL_SESSION fires immediately on subscribe with the restored
    // session (or null) — no separate getSession() call needed (it used to
    // double-fire the sign-in sync effect).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setUser(newSession?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [locale, setLocale] = useState(() => getItem('app_locale') || 'en');
  const [darkMode, setDarkMode] = useState(() => getItem('app_darkMode') === 'true');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', locale);
    document.documentElement.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  }, [locale]);

  const handleSetKey = key => {
    setApiKey(key).then(() => setApiKeyState(key));
  };

  const handleClearKey = () => {
    removeApiKey().then(() => setApiKeyState(''));
  };

  const handleSignOut = async () => {
    // Cancel any pending debounced push so it can't fire against the
    // signed-out account, and re-gate sync for the next sign-in.
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    resetInitialSync();
    await getSupabase().auth.signOut();
  };

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      setItem('app_darkMode', String(next));
      return next;
    });
  };

  const toggleLocale = () => {
    setLocale(prev => {
      const next = prev === 'en' ? 'ar' : 'en';
      setItem('app_locale', next);
      return next;
    });
  };

  const t = useCallback(key => UI[locale]?.[key] ?? key, [locale]);

  useEffect(() => {
    if (!isTauri) return;
    maybeSendReminder(t);
    const interval = setInterval(() => maybeSendReminder(t), 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [locale, t]);

  const skipLinkText = t('skipLink');

  return (
    <>
      <a href="#main-canvas" className="skip-link">
        {skipLinkText}
      </a>
      <PracticeView
        apiKey={apiKey}
        onSetKey={handleSetKey}
        onClearKey={handleClearKey}
        locale={locale}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onToggleLocale={toggleLocale}
        user={user}
        authLoading={authLoading}
        onSignOut={handleSignOut}
      />
      {!isTauri && <Analytics />}
      {!isTauri && <SpeedInsights />}
    </>
  );
}
