/**
 * Play a short ascending success tone using the Web Audio API.
 * Silently no-ops if AudioContext is unavailable.
 *
 * A single module-level context is reused across calls (browsers cap the
 * number of live AudioContexts ~6; creating one per tone would exhaust that
 * limit and the tone would silently stop after a streak of 4–5★ scores).
 */
let ctx = null;

export function playSuccessTone() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    /* noop */
  }
}

export default playSuccessTone;
