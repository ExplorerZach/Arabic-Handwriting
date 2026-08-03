import { useState, useCallback, useEffect } from 'react';
import { LETTERS } from '../data/letters';
import { NUMBERS } from '../data/numbers';
import { DIACRITICS } from '../data/diacritics';
import { CONNECTIONS } from '../data/connections';
import { snoozeDue, snoozeAllDue } from '../utils/progress';

const RESUME_KEY = 'arabic_review_session';

export default function useReviewSession({
  dClearCanvas,
  lessonMode,
  lessonToAlpha,
  dueItems,
  setProgressVersion,
  deckSessionRef,
  alphaBtnRef,
  setLetterIndex,
  setFormIndex,
  setPracticeMode,
  setConnectIndex,
  setShowComparison,
  setShowHistory,
  reviewSessionRef,
  advanceReviewRef,
  exitReviewSessionRef,
}) {
  const [reviewSession, setReviewSession] = useState(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [stashedSession, setStashedSession] = useState(null);

  useEffect(() => {
    reviewSessionRef.current = reviewSession;
  }, [reviewSession, reviewSessionRef]);

  useEffect(() => {
    if (reviewSession) {
      try {
        sessionStorage.setItem(RESUME_KEY, JSON.stringify(reviewSession));
        // eslint-disable-next-line no-empty
      } catch {}
    } else {
      sessionStorage.removeItem(RESUME_KEY);
    }
  }, [reviewSession]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RESUME_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.queue && !parsed.finished) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setStashedSession(parsed);
          setShowResumePrompt(true);
        }
      }
      // eslint-disable-next-line no-empty
    } catch {}
  }, []);

  const enterReviewItem = useCallback(
    (letterName, formKey) => {
      // Connections are keyed by their joined string (formKey 'word').
      const connIdx = CONNECTIONS.findIndex(c => c.joined === letterName);
      if (connIdx !== -1) {
        setConnectIndex(connIdx);
        setPracticeMode('connect');
      } else if (letterName.startsWith('Num')) {
        const numIdx = NUMBERS.findIndex(n => n.name === letterName);
        if (numIdx === -1) return;
        setLetterIndex(numIdx);
        setFormIndex('isolated');
      } else if (letterName.startsWith('Diacritic')) {
        const diaIdx = DIACRITICS.findIndex(d => d.name === letterName);
        if (diaIdx === -1) return;
        setLetterIndex(diaIdx);
        setFormIndex('isolated');
      } else {
        const alphIdx = LETTERS.findIndex(l => l.name === letterName);
        if (alphIdx === -1) return;
        if (lessonMode) {
          const lessonIdx = lessonToAlpha.indexOf(alphIdx);
          setLetterIndex(lessonIdx !== -1 ? lessonIdx : 0);
        } else {
          setLetterIndex(alphIdx);
        }
        setFormIndex(formKey);
      }
      setShowComparison(false);
      setShowHistory(false);
      alphaBtnRef.current = [];
      dClearCanvas();
    },
    [
      lessonMode,
      lessonToAlpha,
      dClearCanvas,
      setLetterIndex,
      setFormIndex,
      setConnectIndex,
      setPracticeMode,
      setShowComparison,
      setShowHistory,
      alphaBtnRef,
    ],
  );

  const startReviewSession = useCallback(() => {
    if (deckSessionRef.current) return;
    if (!dueItems.length) return;
    const queue = dueItems.slice();
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    setReviewSession({ queue, index: 0, summary: [] });
    enterReviewItem(queue[0].letterName, queue[0].formKey);
  }, [dueItems, enterReviewItem, deckSessionRef]);

  const exitReviewSession = useCallback(() => {
    setReviewSession(null);
  }, []);

  const advanceReview = useCallback(
    (score, { snoozed = false } = {}) => {
      const sess = reviewSessionRef.current;
      if (!sess || sess.finished) return;
      const item = sess.queue[sess.index];
      const skipped = score == null && !snoozed;
      const summary = [...sess.summary, { ...item, score, skipped, snoozed }];
      const nextIndex = sess.index + 1;
      if (nextIndex >= sess.queue.length) {
        setReviewSession({ ...sess, summary, finished: true });
      } else {
        setReviewSession({ ...sess, index: nextIndex, summary });
        enterReviewItem(sess.queue[nextIndex].letterName, sess.queue[nextIndex].formKey);
      }
    },
    [enterReviewItem, reviewSessionRef],
  );

  // eslint-disable-next-line react-hooks/refs
  advanceReviewRef.current = advanceReview;

  // eslint-disable-next-line react-hooks/refs
  exitReviewSessionRef.current = exitReviewSession;

  const handleSnoozeCurrentItem = useCallback(() => {
    const sess = reviewSessionRef.current;
    if (!sess || sess.finished) return;
    const item = sess.queue[sess.index];
    snoozeDue(item.letterName, item.formKey);
    setProgressVersion(v => v + 1);
    advanceReviewRef.current?.(null, { snoozed: true });
  }, [reviewSessionRef, advanceReviewRef, setProgressVersion]);

  const handleSnoozeItem = useCallback(
    (letterName, formKey) => {
      snoozeDue(letterName, formKey);
      setProgressVersion(v => v + 1);
    },
    [setProgressVersion],
  );

  const handleResetDueList = useCallback(() => {
    if (!dueItems.length) return;
    snoozeAllDue(dueItems);
    setProgressVersion(v => v + 1);
  }, [dueItems, setProgressVersion]);

  const goToReviewItem = useCallback(
    (letterName, formKey) => {
      const connIdx = CONNECTIONS.findIndex(c => c.joined === letterName);
      if (connIdx !== -1) {
        setConnectIndex(connIdx);
        setPracticeMode('connect');
        setShowComparison(false);
        setShowHistory(false);
        alphaBtnRef.current = [];
        dClearCanvas();
        return;
      }
      if (letterName.startsWith('Num')) {
        const numIdx = NUMBERS.findIndex(n => n.name === letterName);
        if (numIdx === -1) return;
        setLetterIndex(numIdx);
        setFormIndex('isolated');
        setPracticeMode('numbers');
        setShowComparison(false);
        setShowHistory(false);
        alphaBtnRef.current = [];
        dClearCanvas();
        return;
      }
      if (letterName.startsWith('Diacritic')) {
        const diaIdx = DIACRITICS.findIndex(d => d.name === letterName);
        if (diaIdx === -1) return;
        setLetterIndex(diaIdx);
        setFormIndex('isolated');
        setPracticeMode('diacritics');
        setShowComparison(false);
        setShowHistory(false);
        alphaBtnRef.current = [];
        dClearCanvas();
        return;
      }
      const alphIdx = LETTERS.findIndex(l => l.name === letterName);
      if (alphIdx === -1) return;
      if (lessonMode) {
        const lessonIdx = lessonToAlpha.indexOf(alphIdx);
        setLetterIndex(lessonIdx !== -1 ? lessonIdx : 0);
      } else {
        setLetterIndex(alphIdx);
      }
      setFormIndex(formKey);
      setPracticeMode('letters');
      setShowComparison(false);
      setShowHistory(false);
      alphaBtnRef.current = [];
      dClearCanvas();
    },
    [
      lessonMode,
      lessonToAlpha,
      dClearCanvas,
      setLetterIndex,
      setFormIndex,
      setPracticeMode,
      setConnectIndex,
      setShowComparison,
      setShowHistory,
      alphaBtnRef,
    ],
  );

  const goToAnalyticsItem = useCallback(
    (letterName, formKey) => {
      const connIdx = CONNECTIONS.findIndex(c => c.joined === letterName);
      if (connIdx !== -1) {
        setConnectIndex(connIdx);
        setPracticeMode('connect');
        setShowComparison(false);
        setShowHistory(false);
        alphaBtnRef.current = [];
        dClearCanvas();
        return;
      }
      let targetSet = 'letters';
      let idx = LETTERS.findIndex(l => l.name === letterName);

      if (idx === -1) {
        idx = NUMBERS.findIndex(l => l.name === letterName);
        if (idx !== -1) {
          targetSet = 'numbers';
        } else {
          idx = DIACRITICS.findIndex(l => l.name === letterName);
          if (idx !== -1) targetSet = 'diacritics';
        }
      }

      if (idx === -1) return;

      if (targetSet === 'letters' && lessonMode) {
        const lessonIdx = lessonToAlpha.indexOf(idx);
        setLetterIndex(lessonIdx !== -1 ? lessonIdx : 0);
      } else {
        setLetterIndex(idx);
      }

      setFormIndex(formKey);
      setPracticeMode(targetSet);
      setShowComparison(false);
      setShowHistory(false);
      alphaBtnRef.current = [];
      dClearCanvas();
    },
    [
      lessonMode,
      lessonToAlpha,
      dClearCanvas,
      setLetterIndex,
      setFormIndex,
      setPracticeMode,
      setConnectIndex,
      setShowComparison,
      setShowHistory,
      alphaBtnRef,
    ],
  );

  const resumeReviewSession = useCallback(() => {
    if (!stashedSession) return;
    setReviewSession(stashedSession);
    enterReviewItem(
      stashedSession.queue[stashedSession.index].letterName,
      stashedSession.queue[stashedSession.index].formKey,
    );
    setShowResumePrompt(false);
    setStashedSession(null);
  }, [stashedSession, enterReviewItem]);

  const dismissResumePrompt = useCallback(() => {
    sessionStorage.removeItem(RESUME_KEY);
    setShowResumePrompt(false);
    setStashedSession(null);
  }, []);

  return {
    reviewSession,
    startReviewSession,
    exitReviewSession,
    goToReviewItem,
    goToAnalyticsItem,
    handleSnoozeCurrentItem,
    handleSnoozeItem,
    handleResetDueList,
    showResumePrompt,
    stashedSession,
    resumeReviewSession,
    dismissResumePrompt,
  };
}
