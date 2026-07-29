import { useState, useRef, useCallback, useEffect } from 'react';
import STROKE_DATA from '../data/strokeOrder';
import {
  getPaperColors,
  getCanvasInkColor,
  drawPaperPattern,
  getFontStack,
} from '../styles/themes';

export default function useAnimation({
  dCanvasRef,
  dStrokesRef,
  dDprRef,
  dSetHasStrokes,
  dRedraw,
  dPaperThemeRef,
  dDarkModeRef,
  restGlyphRef,
  templateScale,
  calligraphyStyle,
  reduceMotion,
  paperTheme,
  currentChar,
  letterKey,
  setShowComparison,
  setFeedbackRef,
  letterIndex,
  formIndex,
  practiceMode,
}) {
  const animFrameRef = useRef(null);
  const animatingRef = useRef(false);
  const glyphCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const compCanvasRef = useRef(null);

  const [animating, setAnimating] = useState(false);
  const [restingGlyph, setRestingGlyph] = useState(false);

  const drawReferenceGlyph = useCallback(() => {
    const canvas = dCanvasRef.current;
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
    const theme = dPaperThemeRef.current;
    const paperColors = getPaperColors(theme, dDarkModeRef.current);
    ctx.fillStyle = paperColors.bg;
    ctx.fillRect(0, 0, W, H);
    if (theme === 'ruled' || theme === 'grid') {
      drawPaperPattern(ctx, W, H, theme, dDarkModeRef.current);
    }
    const fontSize = Math.min(W, H) * 0.65 * templateScale;
    ctx.save();
    ctx.font = `${fontSize}px ${getFontStack(calligraphyStyle)}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = dDarkModeRef.current ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.25)';
    ctx.fillText(currentChar, W / 2, H / 2 + fontSize * 0.08);
    ctx.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChar, templateScale]);

  const playStrokeAnimation = useCallback(async () => {
    const data = STROKE_DATA[letterKey];
    if (!data || animatingRef.current) return;
    if (reduceMotion) {
      drawReferenceGlyph();
      setRestingGlyph(true);
      return;
    }
    const canvas = dCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const dpr = dDprRef.current;
    const savedStrokes = dStrokesRef.current;
    dStrokesRef.current = [];
    restGlyphRef.current = null;
    setRestingGlyph(false);
    dSetHasStrokes(false);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Fill + pattern in CSS-pixel space so grid/line spacing matches redraw()
    // (device-pixel dims would paint a dpr-times denser grid at dpr > 1).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const paperClear = getPaperColors(paperTheme, dDarkModeRef.current);
    ctx.fillStyle = paperClear.bg;
    ctx.fillRect(0, 0, rect.width, rect.height);
    drawPaperPattern(ctx, rect.width, rect.height, paperTheme, dDarkModeRef.current);
    ctx.restore();
    animatingRef.current = true;
    setAnimating(true);
    setFeedbackRef.current?.(null);
    setShowComparison(false);
    try {
      await document.fonts.ready;
      // eslint-disable-next-line no-empty
    } catch {}

    const W = canvas.width;
    const H = canvas.height;

    const CSS_SIZE = Math.min(200, rect.height * 0.8) * templateScale;
    const glyphSize = CSS_SIZE * dpr;
    const centerX = (rect.width / 2) * dpr;
    const centerY = (rect.height / 2) * dpr;
    const glyphX = centerX - glyphSize / 2;
    const glyphY = centerY - glyphSize / 2;

    const glyphCanvas = glyphCanvasRef.current ?? document.createElement('canvas');
    glyphCanvas.width = W;
    glyphCanvas.height = H;
    glyphCanvasRef.current = glyphCanvas;
    const gCtx = glyphCanvas.getContext('2d');
    gCtx.clearRect(0, 0, W, H);
    gCtx.save();
    gCtx.font = `${glyphSize}px ${getFontStack(calligraphyStyle)}`;
    gCtx.fillStyle = getCanvasInkColor(dDarkModeRef.current);
    gCtx.textAlign = 'center';
    gCtx.textBaseline = 'middle';
    gCtx.direction = 'rtl';
    gCtx.fillText(currentChar, centerX, centerY);
    gCtx.restore();

    const pixels = gCtx.getImageData(0, 0, W, H).data;
    let minX = W,
      maxX = 0,
      minY = H,
      maxY = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (pixels[(y * W + x) * 4 + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (minX > maxX || minY > maxY) {
      minX = glyphX;
      maxX = glyphX + glyphSize;
      minY = glyphY;
      maxY = glyphY + glyphSize;
    }
    const renderedW = maxX - minX;
    const renderedH = maxY - minY;

    const maskCanvas = maskCanvasRef.current ?? document.createElement('canvas');
    maskCanvas.width = W;
    maskCanvas.height = H;
    maskCanvasRef.current = maskCanvas;
    const mCtx = maskCanvas.getContext('2d');
    mCtx.clearRect(0, 0, W, H);

    const mapX = x => minX + (x / 100) * renderedW;
    const mapY = y => minY + (y / 100) * renderedH;

    const buildPolyline = pts => pts.map(p => ({ x: mapX(p.x), y: mapY(p.y) }));

    const BRUSH_RADIUS = Math.max(renderedW, renderedH) * 0.2;
    const PIXELS_PER_SEC = Math.max(80, Math.max(renderedW, renderedH) / 3.0);

    const ops = [];
    for (const stroke of data.strokes) {
      const poly = buildPolyline(stroke);
      const lens = [0];
      for (let i = 1; i < poly.length; i++) {
        const dx = poly[i].x - poly[i - 1].x;
        const dy = poly[i].y - poly[i - 1].y;
        lens.push(lens[i - 1] + Math.hypot(dx, dy));
      }
      ops.push({ type: 'stroke', poly, lens, total: lens[lens.length - 1] });
    }
    for (const dot of data.dots) {
      ops.push({ type: 'dot', point: { x: mapX(dot.x), y: mapY(dot.y) } });
    }

    const paintSegment = (from, to, radius) => {
      mCtx.beginPath();
      mCtx.moveTo(from.x, from.y);
      mCtx.lineTo(to.x, to.y);
      mCtx.strokeStyle = '#000';
      mCtx.lineWidth = radius * 2;
      mCtx.lineCap = 'round';
      mCtx.lineJoin = 'round';
      mCtx.stroke();
    };

    const pointAt = (poly, lens, d) => {
      if (d <= 0) return poly[0];
      const total = lens[lens.length - 1];
      if (d >= total) return poly[poly.length - 1];
      for (let i = 1; i < lens.length; i++) {
        if (lens[i] >= d) {
          const segLen = lens[i] - lens[i - 1];
          const tt = segLen === 0 ? 0 : (d - lens[i - 1]) / segLen;
          const a = poly[i - 1];
          const b = poly[i];
          return { x: a.x + (b.x - a.x) * tt, y: a.y + (b.y - a.y) * tt };
        }
      }
      return poly[poly.length - 1];
    };

    let opIdx = 0;
    let dist = 0;
    let prevPoint = null;
    const PAUSE_MS = 150;
    let pauseElapsed = 0;
    const FILL_MS = 350;
    let fillElapsed = 0;
    let lastTs = null;

    const compCanvas = compCanvasRef.current ?? document.createElement('canvas');
    compCanvas.width = W;
    compCanvas.height = H;
    compCanvasRef.current = compCanvas;
    const cCtx = compCanvas.getContext('2d');

    const drawFrame = (fillAlpha = 0) => {
      cCtx.save();
      cCtx.setTransform(1, 0, 0, 1, 0, 0);
      cCtx.clearRect(0, 0, W, H);
      cCtx.drawImage(maskCanvas, 0, 0);
      cCtx.globalCompositeOperation = 'source-in';
      cCtx.drawImage(glyphCanvas, 0, 0);
      cCtx.restore();

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // Fill + pattern in CSS-pixel space (spacing consistency with redraw),
      // then back to device space for the device-resolution glyph canvases.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const paperAnim = getPaperColors(paperTheme, dDarkModeRef.current);
      ctx.fillStyle = paperAnim.bg;
      ctx.fillRect(0, 0, rect.width, rect.height);
      drawPaperPattern(ctx, rect.width, rect.height, paperTheme, dDarkModeRef.current);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.14;
      ctx.drawImage(glyphCanvas, 0, 0);
      ctx.globalAlpha = 1;
      ctx.drawImage(compCanvas, 0, 0);
      if (fillAlpha > 0) {
        ctx.globalAlpha = fillAlpha;
        ctx.drawImage(glyphCanvas, 0, 0);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };

    const finish = () => {
      animatingRef.current = false;
      animFrameRef.current = null;
      setAnimating(false);
      dStrokesRef.current = savedStrokes;
      if (savedStrokes.length) {
        restGlyphRef.current = null;
        setRestingGlyph(false);
        dSetHasStrokes(true);
        dRedraw(savedStrokes);
      } else {
        const snap = document.createElement('canvas');
        snap.width = W;
        snap.height = H;
        snap.getContext('2d').drawImage(glyphCanvas, 0, 0);
        restGlyphRef.current = snap;
        setRestingGlyph(true);
        dRedraw([]);
      }
    };

    const animate = ts => {
      if (!animatingRef.current) return;
      if (lastTs === null) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      if (opIdx >= ops.length) {
        if (fillElapsed < FILL_MS) {
          fillElapsed += dt * 1000;
          drawFrame(Math.min(1, fillElapsed / FILL_MS));
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        mCtx.save();
        mCtx.setTransform(1, 0, 0, 1, 0, 0);
        mCtx.globalCompositeOperation = 'source-over';
        mCtx.drawImage(glyphCanvas, 0, 0);
        mCtx.restore();
        drawFrame(0);
        finish();
        return;
      }
      const op = ops[opIdx];
      if (op.type === 'stroke') {
        if (prevPoint === null) {
          prevPoint = op.poly[0];
          mCtx.beginPath();
          mCtx.arc(prevPoint.x, prevPoint.y, BRUSH_RADIUS, 0, Math.PI * 2);
          mCtx.fillStyle = '#000';
          mCtx.fill();
          drawFrame();
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        if (dist < op.total) {
          dist = Math.min(dist + PIXELS_PER_SEC * dt, op.total);
          const nextPoint = pointAt(op.poly, op.lens, dist);
          paintSegment(prevPoint, nextPoint, BRUSH_RADIUS);
          prevPoint = nextPoint;
          drawFrame();
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        if (pauseElapsed < PAUSE_MS) {
          pauseElapsed += dt * 1000;
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        opIdx++;
        dist = 0;
        prevPoint = null;
        pauseElapsed = 0;
        animFrameRef.current = requestAnimationFrame(animate);
      } else if (op.type === 'dot') {
        const dp = op.point;
        mCtx.beginPath();
        mCtx.arc(dp.x, dp.y, BRUSH_RADIUS, 0, Math.PI * 2);
        mCtx.fillStyle = '#000';
        mCtx.fill();
        drawFrame();
        if (pauseElapsed < PAUSE_MS) {
          pauseElapsed += dt * 1000;
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        opIdx++;
        pauseElapsed = 0;
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    drawFrame();
    animFrameRef.current = requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letterKey, currentChar, templateScale, drawReferenceGlyph]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      animatingRef.current = false;
      setAnimating(false);
      restGlyphRef.current = null;
      setRestingGlyph(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letterIndex, formIndex, practiceMode]);

  return {
    animating,
    restingGlyph,
    setRestingGlyph,
    playStrokeAnimation,
  };
}
