import { useCallback } from 'react';
import { isTauri } from '../utils/env';
import { getPaperColors, getBrushColor, drawPaperPattern, getFontStack } from '../styles/themes';

export default function useExport({
  dCanvasRef,
  dStrokesRef,
  dDrawStrokes,
  paperTheme,
  brushPack,
  darkMode,
  calligraphyStyle,
  practiceMode,
  currentWord,
  currentConnection,
  currentChar,
  letterName,
  activeForm,
}) {
  const exportForSave = useCallback(() => {
    const canvas = dCanvasRef.current;
    const dpr = devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const offscreen = document.createElement('canvas');
    offscreen.width = rect.width * dpr;
    offscreen.height = rect.height * dpr;
    const ctx = offscreen.getContext('2d');
    const paper = getPaperColors(paperTheme, darkMode);
    ctx.fillStyle = paper.bg;
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    drawPaperPattern(ctx, offscreen.width, offscreen.height, paperTheme, darkMode);
    const isMultiChar = practiceMode === 'words' || practiceMode === 'connect';
    const watermarkText = isMultiChar
      ? practiceMode === 'words'
        ? currentWord?.word
        : currentConnection?.joined
      : currentChar;
    const fontSize = (isMultiChar ? 0.25 : 0.5) * Math.min(offscreen.width, offscreen.height);
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#7d3f0f';
    ctx.font = `bold ${fontSize}px ${getFontStack(calligraphyStyle)}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(watermarkText, offscreen.width / 2, offscreen.height / 2);
    ctx.restore();
    ctx.drawImage(canvas, 0, 0);
    return offscreen.toDataURL('image/png');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darkMode, paperTheme, practiceMode, currentWord, currentConnection, currentChar]);

  const saveDrawing = useCallback(async () => {
    if (!dStrokesRef.current.length) return;
    const dataURL = exportForSave();
    const name =
      practiceMode === 'words'
        ? `arabic-${currentWord?.roman ?? 'word'}`
        : practiceMode === 'connect'
          ? `arabic-${currentConnection?.roman ?? 'connection'}`
          : `arabic-${letterName.toLowerCase()}-${activeForm}`;

    if (isTauri) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const filePath = await save({
        defaultPath: `${name}.png`,
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      });
      if (!filePath) return;
      const res = await fetch(dataURL);
      const blob = await res.blob();
      const buf = await blob.arrayBuffer();
      await writeFile(filePath, new Uint8Array(buf));
      return;
    }

    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `${name}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportForSave, practiceMode, currentWord, currentConnection, letterName, activeForm]);

  const shareDrawing = useCallback(async () => {
    if (!dStrokesRef.current.length) return;
    if (isTauri) {
      saveDrawing();
      return;
    }
    const dataURL = exportForSave();
    const name =
      practiceMode === 'words'
        ? `arabic-${currentWord?.roman ?? 'word'}`
        : practiceMode === 'connect'
          ? `arabic-${currentConnection?.roman ?? 'connection'}`
          : `arabic-${letterName.toLowerCase()}-${activeForm}`;
    if (navigator.share) {
      try {
        const res = await fetch(dataURL);
        const blob = await res.blob();
        const file = new File([blob], `${name}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Arabic Handwriting Practice',
          });
          return;
        }
        // eslint-disable-next-line no-empty
      } catch {}
    }
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `${name}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    exportForSave,
    practiceMode,
    currentWord,
    currentConnection,
    letterName,
    activeForm,
    saveDrawing,
  ]);

  const exportCanvas = () => {
    const canvas = dCanvasRef.current;
    const dpr = devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const offscreen = document.createElement('canvas');
    offscreen.width = rect.width * dpr;
    offscreen.height = rect.height * dpr;
    const ctx = offscreen.getContext('2d');
    const paper = getPaperColors(paperTheme, false);
    ctx.fillStyle = paper.bg;
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    drawPaperPattern(ctx, offscreen.width, offscreen.height, paperTheme, false);
    const isMultiChar = practiceMode === 'words' || practiceMode === 'connect';
    const watermarkText = isMultiChar
      ? practiceMode === 'words'
        ? currentWord?.word
        : currentConnection?.joined
      : currentChar;
    const fontSize = (isMultiChar ? 0.25 : 0.5) * Math.min(offscreen.width, offscreen.height);
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#7d3f0f';
    ctx.font = `bold ${fontSize}px ${getFontStack(calligraphyStyle)}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(watermarkText, offscreen.width / 2, offscreen.height / 2);
    ctx.restore();
    ctx.save();
    ctx.scale(dpr, dpr);
    const exportBrush = getBrushColor(brushPack, false);
    dDrawStrokes(ctx, dStrokesRef.current, rect.width, rect.height, exportBrush);
    ctx.restore();
    const MAX_SIZE = 512;
    const scale = Math.min(1, MAX_SIZE / Math.max(offscreen.width, offscreen.height));
    const compressed = document.createElement('canvas');
    compressed.width = Math.round(offscreen.width * scale);
    compressed.height = Math.round(offscreen.height * scale);
    compressed.getContext('2d').drawImage(offscreen, 0, 0, compressed.width, compressed.height);
    return compressed.toDataURL('image/jpeg', 0.85).split(',')[1];
  };

  return {
    exportForSave,
    saveDrawing,
    shareDrawing,
    exportCanvas,
  };
}
