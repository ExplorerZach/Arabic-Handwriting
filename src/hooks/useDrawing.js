import { useRef, useState, useCallback, useEffect } from 'react';
import { calcLineWidth } from '../utils/drawing';
import { getBrushColor, drawPaperPattern } from '../styles/themes';
import { markDayActive } from '../utils/analytics';
import { markPracticed } from '../utils/progress';
import { getItem } from '../utils/storage';
import { XP_AWARDS } from '../utils/xp';

export default function useDrawing({
  darkMode,
  practiceMode,
  letter,
  activeForm,
  addXPRef,
  setProgressVersionRef,
  setFeedbackRef,
  restGlyphRef,
  setRestingGlyphRef,
  redrawRef,
}) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const canvasSnapshotRef = useRef(null);
  const dprRef = useRef(devicePixelRatio || 1);
  const darkModeRef = useRef(darkMode);
  const brushColorRef = useRef(getBrushColor(getItem('brush_pack') || 'classic', darkMode));
  const paperThemeRef = useRef(getItem('app_theme') || 'parchment');
  const strokeResumedRef = useRef(false);
  const countedDrawingRef = useRef(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  const drawStrokes = (ctx, points, W, H, brushColor) => {
    if (!points.length) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = brushColor;
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const x = pt.x * W;
      const y = pt.y * H;
      const width = calcLineWidth(pt.pressure ?? 0.5, pt.pointerType ?? 'touch');
      if (pt.newStroke || i === 0) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineWidth = width;
      } else {
        const prev = points[i - 1];
        const px = prev.x * W;
        const py = prev.y * H;
        const mx = (px + x) / 2;
        const my = (py + y) / 2;
        ctx.lineWidth = width;
        ctx.quadraticCurveTo(px, py, mx, my);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mx, my);
      }
    }
    ctx.stroke();
  };

  const redraw = useCallback(points => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const W = rect.width;
    const H = rect.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    const theme = paperThemeRef.current;
    if (theme === 'ruled' || theme === 'grid') {
      drawPaperPattern(ctx, W, H, theme, darkModeRef.current);
    }
    if (restGlyphRef.current && !points.length) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(restGlyphRef.current, 0, 0);
      ctx.restore();
      return;
    }
    drawStrokes(ctx, points, W, H, brushColorRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    redrawRef.current = redraw;
  }, [redraw]);

  const clearCanvas = useCallback(() => {
    strokesRef.current = [];
    restGlyphRef.current = null;
    setRestingGlyphRef.current?.(false);
    countedDrawingRef.current = false;
    setFeedbackRef.current?.(null);
    setHasStrokes(false);
    redraw([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redraw]);

  const undoStroke = useCallback(() => {
    const strokes = strokesRef.current;
    if (!strokes.length) return;
    let i = strokes.length - 1;
    while (i > 0 && !strokes[i].newStroke) i--;
    strokesRef.current = strokes.slice(0, i);
    redraw(strokesRef.current);
    if (!strokesRef.current.length) setHasStrokes(false);
  }, [redraw]);

  const getPoint = e => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
      pointerType: e.pointerType || 'touch',
    };
  };

  const handlePointerDown = e => {
    e.preventDefault();
    const p = getPoint(e);
    if (!p) return;
    if (restGlyphRef.current) {
      restGlyphRef.current = null;
      setRestingGlyphRef.current?.(false);
      redraw([]);
    }
    strokeResumedRef.current = false;
    strokesRef.current.push({ ...p, newStroke: true });
    try {
      canvasRef.current?.setPointerCapture?.(e.pointerId);
      // eslint-disable-next-line no-empty
    } catch {}
    if (!hasStrokes) setHasStrokes(true);
  };

  const handlePointerMove = e => {
    e.preventDefault();
    if (e.buttons === 0) return;
    const p = getPoint(e);
    if (!p) return;
    const startNew = strokeResumedRef.current;
    strokeResumedRef.current = false;
    strokesRef.current.push({ ...p, newStroke: startNew });
    redraw(strokesRef.current);
  };

  const handlePointerUp = e => {
    e.preventDefault();
    try {
      canvasRef.current?.releasePointerCapture?.(e.pointerId);
      // eslint-disable-next-line no-empty
    } catch {}
    strokeResumedRef.current = false;
    let bump = markDayActive();
    if (
      (practiceMode === 'letters' || practiceMode === 'numbers' || practiceMode === 'diacritics') &&
      !countedDrawingRef.current &&
      strokesRef.current.length > 0
    ) {
      countedDrawingRef.current = true;
      markPracticed(letter.name, activeForm);
      addXPRef.current?.(XP_AWARDS.PRACTICE, 'practice');
      bump = true;
    }
    if (bump) setProgressVersionRef.current?.(v => v + 1);
  };

  const handlePointerLeave = e => {
    e.preventDefault();
    if (e.buttons !== 0) strokeResumedRef.current = true;
  };

  // Keep dprRef in sync if the user moves the window to a different monitor
  // or zooms during an active session
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const mediaQuery = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const handler = () => {
      dprRef.current = window.devicePixelRatio || 1;
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return {
    canvasRef,
    strokesRef,
    canvasSnapshotRef,
    dprRef,
    darkModeRef,
    brushColorRef,
    paperThemeRef,
    strokeResumedRef,
    countedDrawingRef,
    hasStrokes,
    setHasStrokes,
    drawStrokes,
    redraw,
    clearCanvas,
    undoStroke,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  };
}
