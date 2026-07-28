import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const host = process.env.TAURI_DEV_HOST;

// Dev-only: the CSP <meta> in index.html ends with `upgrade-insecure-requests`.
// Chrome exempts `localhost` from that upgrade but NOT other HTTP origins, so
// `npm run dev -- --host` breaks over the LAN (e.g. iPad + Apple Pencil testing)
// and for host.docker.internal — every subresource gets upgraded to https and
// fails. The full CSP (with the directive) is still served as a response header
// by vercel.json in production and kept in the built index.html for static
// hosting, so only the dev server's HTML is rewritten here.
const stripDevUpgradeInsecureRequests = () => ({
  name: 'strip-dev-upgrade-insecure-requests',
  apply: 'serve',
  transformIndexHtml(html) {
    return html.replace(/; upgrade-insecure-requests/, '');
  },
});

export default defineConfig({
  plugins: [react(), stripDevUpgradeInsecureRequests()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : false,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
    allowedHosts: ['host.docker.internal'],
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: process.env.TAURI_ENV_PLATFORM
    ? {
        target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari15',
        minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_ENV_DEBUG,
      }
    : {},
});
