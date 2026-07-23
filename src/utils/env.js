/**
 * Runtime environment detection.
 * In a Tauri webview, window.__TAURI_INTERNALS__ is always present.
 */
export const isTauri = typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
