import { getItem, setItem } from './storage.js';

/** Brush scale factor — persisted in localStorage */
let brushScale = parseFloat(getItem('brushScale') || '1');
if (!Number.isFinite(brushScale)) brushScale = 1;

/** Read the current brush scale (use in hot paths like calcLineWidth). */
export function getBrushScale() {
  return brushScale;
}

/**
 * Update the brush scale (called from the slider onChange).
 * Also persists the new value to localStorage.
 */
export function setBrushScale(value) {
  const next = Number.isFinite(value) ? value : 1;
  brushScale = next;
  setItem('brushScale', String(next));
}

/**
 * Calculate the line width for a stroke point based on pressure and pointer type.
 * Pen input (Apple Pencil, stylus) gets thicker pressure-sensitive strokes.
 *
 * Some pointer devices report pressure=0 even while actively drawing (older
 * Android touch, some mouse vendors). Fall back to 0.5 when that happens so
 * the stroke doesn't collapse to the 3px minimum.
 */
export function calcLineWidth(pressure, pointerType) {
  const p = pressure > 0 ? pressure : 0.5;
  if (pointerType === 'pen') {
    return Math.max(3, Math.sqrt(p) * 32 * brushScale);
  }
  return Math.max(3, p * 28 * brushScale);
}
