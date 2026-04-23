import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import PracticeView from './components/PracticeView';
import LoginScreen from './components/LoginScreen';
import { UI } from './locales';

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

  const handleSave = (key) => {
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

  const skipLinkText = UI[locale]?.skipLink ?? 'Skip to canvas';

  return (
    <>
      <a href="#main-canvas" className="skip-link">
        {skipLinkText}
      </a>
      {apiKey ? (
        <PracticeView
          apiKey={apiKey}
          onClearKey={handleClearKey}
          locale={locale}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onToggleLocale={toggleLocale}
        />
      ) : (
        <LoginScreen
          onSave={handleSave}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          locale={locale}
        />
      )}
      <Analytics />
    </>
  );
}
