import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import PracticeView from './components/PracticeView';
import { UI } from './locales';
import { isTauri } from './utils/env';
import { maybeSendReminder } from './utils/notifications';

export default function App() {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem('openrouter_key') || ''
  );
  const [locale, setLocale] = useState(
    () => localStorage.getItem('app_locale') || 'en'
  );
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('app_darkMode') === 'true'
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
    localStorage.setItem('openrouter_key', key);
    setApiKey(key);
  };

  const handleClearKey = () => {
    localStorage.removeItem('openrouter_key');
    setApiKey('');
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('app_darkMode', String(next));
      return next;
    });
  };

  const toggleLocale = () => {
    setLocale((prev) => {
      const next = prev === 'en' ? 'ar' : 'en';
      localStorage.setItem('app_locale', next);
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
