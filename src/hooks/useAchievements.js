import { useState, useRef, useEffect, useCallback } from 'react';
import { checkAndAward } from '../utils/achievements';

const ACH_DISMISS_MS = 2500;

/**
 * Achievement unlock lifecycle for the designer's toast component.
 *
 * Runs detection once per `progressVersion` bump (initial mount included, so
 * legacy users instantly unlock past achievements). Only ONE toast at a time:
 * the first newly-earned achievement is surfaced as `achUnlocked` and the
 * rest are picked up on later progressVersion bumps — keeps legacy backfill
 * from spamming toasts. Badges only; never awards XP.
 *
 * Returns:
 *   achUnlocked — null | { key, def }  (`key` = unique token for React remount)
 *   achDismiss  — () => void, clears achUnlocked
 */
export default function useAchievements({ progressVersion, LETTERS }) {
  const [achUnlocked, setAchUnlocked] = useState(null);
  const achTimerRef = useRef(null);
  // Ref mirror so the effect can check "is a toast showing" without re-running
  // on every achUnlocked state change.
  const achShowingRef = useRef(false);

  useEffect(() => {
    achShowingRef.current = achUnlocked !== null;
  }, [achUnlocked]);

  useEffect(() => {
    if (achShowingRef.current) return; // one toast at a time
    const newly = checkAndAward({ LETTERS });
    if (newly.length === 0) return;

    setAchUnlocked({ key: Date.now(), def: newly[0] });
    achShowingRef.current = true;
    if (achTimerRef.current) clearTimeout(achTimerRef.current);
    achTimerRef.current = setTimeout(() => setAchUnlocked(null), ACH_DISMISS_MS);
  }, [progressVersion, LETTERS]);

  // Clear the auto-dismiss timer on unmount.
  useEffect(() => {
    return () => {
      if (achTimerRef.current) clearTimeout(achTimerRef.current);
    };
  }, []);

  const achDismiss = useCallback(() => {
    if (achTimerRef.current) clearTimeout(achTimerRef.current);
    setAchUnlocked(null);
  }, []);

  return { achUnlocked, achDismiss };
}
