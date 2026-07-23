import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
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
        target:
          process.env.TAURI_ENV_PLATFORM == 'windows'
            ? 'chrome105'
            : 'safari13',
        minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_ENV_DEBUG,
      }
    : {},
});
