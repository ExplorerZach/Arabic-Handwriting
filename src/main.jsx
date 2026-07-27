import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App';
import { isTauri } from './utils/env';
import { hydrate } from './utils/storage';
import { checkForUpdatesOnLaunch } from './utils/updater';

hydrate().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  checkForUpdatesOnLaunch();
});

if (!isTauri && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      // eslint-disable-next-line no-console
      console.error('[SW] registration failed:', err);
    });
  });
}
