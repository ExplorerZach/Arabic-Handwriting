/** Brush scale factor — persisted in localStorage */
export let brushScale = parseFloat(localStorage.getItem('brushScale') || '1');

/**
 * Update the brush scale (called from the slider onChange).
 * Also persists the new value to localStorage.
 */
export function setBrushScale(value) {
  brushScale = value;
  localStorage.setItem('brushScale', String(value));
}

/**
 * Calculate the line width for a stroke point based on pressure and pointer type.
 * Pen input (Apple Pencil, stylus) gets thicker pressure-sensitive strokes.
 */
export function calcLineWidth(pressure, pointerType) {
  if (pointerType === 'pen') {
    return Math.max(3, Math.sqrt(pressure) * 32 * brushScale);
  }
  return Math.max(3, pressure * 28 * brushScale);
}

/** Stroke color — near-black brown ink */
export const STROKE_COLOR = '#1a0a00';
