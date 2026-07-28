/**
 * Theme registry for paper backgrounds and brush color packs.
 *
 * Paper themes affect the canvas background fill and optional pattern overlay.
 * Brush packs affect stroke color; they vary between light and dark mode.
 *
 * When the user enables high-contrast mode we ignore the decorative paper
 * colors and pattern colors so the canvas matches the high-contrast palette
 * defined in global.css.
 */

export const PAPER_THEMES = {
  parchment: {
    id: 'parchment',
    nameKey: 'themeParchment',
    light: { bg: '#fbf5e6' },
    dark: { bg: '#1a1008' },
  },
  aged: {
    id: 'aged',
    nameKey: 'themeAged',
    light: { bg: '#f2e6ca' },
    dark: { bg: '#241808' },
  },
  cream: {
    id: 'cream',
    nameKey: 'themeCream',
    light: { bg: '#faf8f5' },
    dark: { bg: '#1e1208' },
  },
  coolGray: {
    id: 'coolGray',
    nameKey: 'themeCoolGray',
    light: { bg: '#f0eeea' },
    dark: { bg: '#161616' },
  },
  ruled: {
    id: 'ruled',
    nameKey: 'themeRuled',
    light: { bg: '#faf8f5', lineColor: 'rgba(160,140,100,0.30)', lineHeight: 40 },
    dark: { bg: '#1e1208', lineColor: 'rgba(192,112,58,0.15)', lineHeight: 40 },
  },
  grid: {
    id: 'grid',
    nameKey: 'themeGrid',
    light: { bg: '#faf8f5', lineColor: 'rgba(160,140,100,0.25)', spacing: 40 },
    dark: { bg: '#1e1208', lineColor: 'rgba(192,112,58,0.12)', spacing: 40 },
  },
};

export const BRUSH_PACKS = {
  classic: { id: 'classic', nameKey: 'brushClassic', light: '#1a0a00', dark: '#ffffff' },
  crimson: { id: 'crimson', nameKey: 'brushCrimson', light: '#8b1a1a', dark: '#ff6b6b' },
  indigo: { id: 'indigo', nameKey: 'brushIndigo', light: '#1a1a6b', dark: '#a0a0ff' },
  forest: { id: 'forest', nameKey: 'brushForest', light: '#1a4a1a', dark: '#6bff6b' },
  copper: { id: 'copper', nameKey: 'brushCopper', light: '#b87333', dark: '#ffd8a8' },
};

function isHighContrast() {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-high-contrast') === 'true'
  );
}

/** Resolve a paper theme's colors for the current dark-mode state. */
export function getPaperColors(themeId, isDark) {
  if (isHighContrast()) {
    return { bg: isDark ? '#000000' : '#ffffff' };
  }
  const theme = PAPER_THEMES[themeId] || PAPER_THEMES.parchment;
  return isDark ? theme.dark : theme.light;
}

/** Resolve a brush pack's color for the current dark-mode state. */
export function getBrushColor(packId, isDark) {
  const pack = BRUSH_PACKS[packId] || BRUSH_PACKS.classic;
  return isDark ? pack.dark : pack.light;
}

/** Draw the paper pattern (ruled lines / grid dots) onto a canvas context. */
export function drawPaperPattern(ctx, W, H, themeId, isDark) {
  // In high-contrast mode the canvas background is uniform black/white, so
  // skip the subtle decorative ruling/grid pattern.
  if (isHighContrast()) return;

  const theme = PAPER_THEMES[themeId] || PAPER_THEMES.parchment;
  const colors = isDark ? theme.dark : theme.light;
  if (!colors.lineColor) return;

  ctx.save();
  ctx.strokeStyle = colors.lineColor;
  ctx.fillStyle = colors.lineColor;

  if (themeId === 'ruled') {
    const lh = colors.lineHeight || 40;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = lh; y < H; y += lh) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
  } else if (themeId === 'grid') {
    const sp = colors.spacing || 40;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = sp; x < W; x += sp) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = sp; y < H; y += sp) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/** Return a suitable glyph/ink color for the canvas, respecting high contrast. */
export function getCanvasInkColor(isDark) {
  return isHighContrast() ? (isDark ? '#ffffff' : '#000000') : isDark ? '#c0703a' : '#7d3f0f';
}
