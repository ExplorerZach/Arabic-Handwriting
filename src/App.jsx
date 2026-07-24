import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import PracticeView from './components/PracticeView';
import { UI } from './locales';
import { isTauri } from './utils/env';
import { maybeSendReminder } from './utils/notifications';
import { getItem, setItem } from './utils/storage';
import { getApiKey, setApiKey, removeApiKey } from './utils/secureStorage';

export default function App() {
  const [apiKey, setApiKeyState] = useState('');

  useEffect(() => {
    getApiKey().then(setApiKeyState);
  }, []);
  const [locale, setLocale] = useState(
    () => getItem('app_locale') || 'en'
  );
  const [darkMode, setDarkMode] = useState(
    () => getItem('app_darkMode') === 'true'
  );

  // Sync dark mode to <html> attribute for CSS selectors
  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [darkMode]);

  // Sync locale to <html lang> for a11y + browser behavior
  useEffect(() => {
    document.documentElement.setAttribute('lang', locale);
    document.documentElement.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  }, [locale]);

  const handleSetKey = (key) => {
    setApiKey(key).then(() => setApiKeyState(key));
  };

  const handleClearKey = () => {
    removeApiKey().then(() => setApiKeyState(''));
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      setItem('app_darkMode', String(next));
      return next;
    });
  };

  const toggleLocale = () => {
    setLocale((prev) => {
      const next = prev === 'en' ? 'ar' : 'en';
      setItem('app_locale', next);
      return next;
    });
  };

  const t = (key) => UI[locale]?.[key] ?? key;

  // Daily practice reminder (Tauri only)
  useEffect(() => {
    if (!isTauri) return;
    maybeSendReminder(t);
    const interval = setInterval(() => maybeSendReminder(t), 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [locale]);

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
      />
      {!isTauri && <Analytics />}
      {!isTauri && <SpeedInsights />}
    </>
  );
}
