import { useState, useRef, useEffect } from 'react';
import { getItem, setItem } from '../utils/storage';
import { setBrushScale } from '../utils/drawing';
import { getDailyGoal, setDailyGoal } from '../utils/dailyGoal';
import { getBrushColor } from '../styles/themes';
import { useDownloadLinks } from '../utils/downloads';

const DEFAULT_MODEL = 'google/gemini-3-flash-preview';

export default function usePrefs({
  redrawRef,
  strokesRef,
  brushColorRef,
  restGlyphRef,
  darkMode,
  setRestingGlyphRef,
}) {
  const [model, setModel] = useState(() => getItem('openrouter_model') || DEFAULT_MODEL);
  const { links: dlLinks, fallback: dlFallback } = useDownloadLinks();
  const [brushValue, setBrushValue] = useState(() => {
    const v = parseFloat(getItem('brushScale') || '1');
    return Number.isFinite(v) ? v : 1;
  });
  const [templateScale, setTemplateScale] = useState(() => {
    const v = parseFloat(getItem('templateScale') || '1');
    return Number.isFinite(v) ? v : 1;
  });
  const [paperTheme, setPaperTheme] = useState(() => getItem('app_theme') || 'parchment');
  const [brushPack, setBrushPack] = useState(() => getItem('brush_pack') || 'classic');
  const [dailyGoalState, setDailyGoalState] = useState(() => getDailyGoal());
  const [dailyGoalInput, setDailyGoalInput] = useState(() => String(getDailyGoal()));
  const [reduceMotion, setReduceMotion] = useState(() => {
    const saved = getItem('reduce_motion');
    const initial =
      saved !== null
        ? saved === 'true'
        : (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    document.documentElement.setAttribute('data-reduced-motion', String(initial));
    return initial;
  });
  const [highContrast, setHighContrast] = useState(() => getItem('high_contrast') === 'true');
  const [celebrate, setCelebrate] = useState(false);
  const [xpGain, setXpGain] = useState(null);
  const xpGainTimerRef = useRef(null);
  const appTitleRef = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(() => getItem('sound_enabled') === 'true');

  useEffect(() => {
    document.documentElement.setAttribute('data-high-contrast', String(highContrast));
    setItem('high_contrast', String(highContrast));
  }, [highContrast]);

  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-motion', String(reduceMotion));
    setItem('reduce_motion', String(reduceMotion));
  }, [reduceMotion]);

  useEffect(() => {
    return () => {
      if (xpGainTimerRef.current) clearTimeout(xpGainTimerRef.current);
    };
  }, []);

  const handleReduceMotionChange = v => {
    setReduceMotion(v);
  };

  const handleSoundToggle = v => {
    setSoundEnabled(v);
    setItem('sound_enabled', String(v));
  };

  const handleModelChange = ev => {
    const v = ev.target.value;
    setModel(v);
    setItem('openrouter_model', v);
  };

  const handleDailyGoalChange = ev => {
    const raw = ev.target.value;
    setDailyGoalInput(raw);
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      const value = setDailyGoal(n);
      setDailyGoalState(value);
    }
  };

  const handleDailyGoalBlur = () => {
    const n = parseInt(dailyGoalInput, 10);
    if (Number.isFinite(n) && n > 0) {
      const value = setDailyGoal(n);
      setDailyGoalState(value);
      setDailyGoalInput(String(value));
    } else {
      setDailyGoalInput(String(dailyGoalState));
    }
  };

  const handleBrushChange = ev => {
    const v = parseFloat(ev.target.value);
    const safe = Number.isFinite(v) ? v : 1;
    setBrushValue(safe);
    setBrushScale(safe);
  };

  const handleTemplateScaleChange = ev => {
    const v = parseFloat(ev.target.value);
    const safe = Number.isFinite(v) ? v : 1;
    setTemplateScale(safe);
    setItem('templateScale', String(safe));
    if (restGlyphRef.current) {
      restGlyphRef.current = null;
      setRestingGlyphRef.current?.(false);
      redrawRef.current(strokesRef.current);
    }
  };

  const handleThemeChange = themeId => {
    setPaperTheme(themeId);
    setItem('app_theme', themeId);
    redrawRef.current(strokesRef.current);
  };

  const handleBrushPackChange = packId => {
    setBrushPack(packId);
    setItem('brush_pack', packId);
    brushColorRef.current = getBrushColor(packId, darkMode);
    redrawRef.current(strokesRef.current);
  };

  return {
    brushValue,
    brushPack,
    paperTheme,
    templateScale,
    soundEnabled,
    reduceMotion,
    highContrast,
    model,
    dailyGoalState,
    dailyGoalInput,
    celebrate,
    xpGain,
    xpGainTimerRef,
    appTitleRef,
    dlLinks,
    dlFallback,
    setCelebrate,
    setXpGain,
    setHighContrast,
    setReduceMotion,
    handleBrushChange,
    handleBrushPackChange,
    handleThemeChange,
    handleTemplateScaleChange,
    handleModelChange,
    handleDailyGoalChange,
    handleDailyGoalBlur,
    handleSoundToggle,
    handleReduceMotionChange,
  };
}
