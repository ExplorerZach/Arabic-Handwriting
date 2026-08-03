import { useState, useCallback } from 'react';
import { getItem, setItem, removeItem } from '../utils/storage';
import { getAIFeedback } from '../utils/api';
import { FORM_FULL } from '../locales';
import { CONNECTION_FORM_KEY } from '../data/connections';
import { markPracticed, setScore, updateSR, isReviewOnTime } from '../utils/progress';
import { addFeedbackEntry } from '../utils/history';
import { XP_AWARDS } from '../utils/xp';
import { playSuccessTone } from '../utils/sound';

export default function useAIFeedback({
  apiKey,
  t,
  practiceMode,
  currentWord,
  currentConnection,
  letter,
  isNumbersMode,
  isDiacriticsMode,
  activeForm,
  setProgressVersion,
  setCelebrate,
  soundEnabled,
  addXPRef,
  eExportCanvas,
  dStrokesRef,
  dCanvasSnapshotRef,
  dCountedDrawingRef,
  reviewSessionRef,
  advanceReviewRef,
  deckSessionRef,
  advanceDeckRef,
}) {
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  // True while a review/deck session has a scheduled auto-advance pending.
  // Lets the UI disable the Next button so a manual click can't double-advance
  // (skipping a queue item) right before the 1400ms timer fires.
  const [advancePending, setAdvancePending] = useState(false);

  const giveConsent = useCallback(() => {
    setItem('ai_consent', 'true');
    setShowConsentDialog(false);
  }, []);

  const revokeConsent = useCallback(() => {
    removeItem('ai_consent');
    setShowConsentDialog(false);
  }, []);

  const requestFeedback = useCallback(async () => {
    if (dStrokesRef.current.length < 5) {
      setFeedback({
        error:
          practiceMode === 'words'
            ? t('hintDrawWordFirst')
            : practiceMode === 'connect'
              ? t('hintDrawConnected')
              : t('hintDrawFirst'),
      });
      return;
    }
    if (getItem('ai_consent') !== 'true') {
      setShowConsentDialog(true);
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const imageBase64 = eExportCanvas();
      dCanvasSnapshotRef.current = `data:image/jpeg;base64,${imageBase64}`;
      let text;
      if (practiceMode === 'connect' && currentConnection) {
        text = await getAIFeedback(
          apiKey,
          imageBase64,
          currentConnection.joined,
          currentConnection.joined,
          currentConnection.roman,
          `connection "${currentConnection.meaning}"`,
          true,
        );
      } else if (practiceMode === 'words' && currentWord) {
        text = await getAIFeedback(
          apiKey,
          imageBase64,
          currentWord.word,
          currentWord.word,
          currentWord.roman,
          `word "${currentWord.meaning}"`,
        );
      } else if (isNumbersMode || isDiacriticsMode) {
        text = await getAIFeedback(
          apiKey,
          imageBase64,
          letter.name,
          letter.letter,
          letter.roman,
          isNumbersMode ? 'Arabic numeral' : 'Arabic diacritic (harakat)',
        );
      } else {
        text = await getAIFeedback(
          apiKey,
          imageBase64,
          letter.name,
          letter.letter,
          letter.roman,
          t(FORM_FULL[activeForm]),
        );
      }
      const scoreMatch = text.match(/\[SCORE:\s*([1-5])\s*\]/i);
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
      const cleanText = text.replace(/\[SCORE:\s*[1-5]\s*\]\s*/gi, '').trim();
      const inDeck = !!deckSessionRef.current;
      const progressName =
        practiceMode === 'connect'
          ? currentConnection.joined
          : practiceMode === 'words' && inDeck
            ? currentWord.word
            : letter.name;
      const progressForm =
        practiceMode === 'connect'
          ? CONNECTION_FORM_KEY
          : practiceMode === 'words' && inDeck
            ? 'word'
            : activeForm;
      if (
        practiceMode === 'letters' ||
        practiceMode === 'connect' ||
        isNumbersMode ||
        isDiacriticsMode ||
        reviewSessionRef.current ||
        inDeck
      ) {
        if (!dCountedDrawingRef.current) {
          dCountedDrawingRef.current = true;
          markPracticed(progressName, progressForm);
        }
        if (score) {
          const inReview = !!reviewSessionRef.current;
          const onTime = !inReview || isReviewOnTime(progressName, progressForm);
          setScore(progressName, progressForm, score);
          if (!inDeck) {
            updateSR(progressName, progressForm, score);
          }
          addXPRef.current?.(XP_AWARDS.SCORE[score] || 0, 'score');
          if (inReview && onTime) addXPRef.current?.(XP_AWARDS.REVIEW_ON_TIME, 'review-on-time');
          if (score >= 4) {
            setCelebrate(true);
            setTimeout(() => setCelebrate(false), 850);
            if (soundEnabled) playSuccessTone();
          }
        }
        addFeedbackEntry(progressName, progressForm, cleanText);
        setProgressVersion(v => v + 1);
      }
      setFeedback({ text: cleanText, score });
      if (score && reviewSessionRef.current && !reviewSessionRef.current.finished) {
        setAdvancePending(true);
        setTimeout(() => {
          setAdvancePending(false);
          advanceReviewRef.current?.(score);
        }, 1400);
      }
      if (score && deckSessionRef.current && !deckSessionRef.current.finished) {
        setAdvancePending(true);
        setTimeout(() => {
          setAdvancePending(false);
          advanceDeckRef.current?.(score);
        }, 1400);
      }
    } catch (err) {
      setFeedback({ error: err.message });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    apiKey,
    practiceMode,
    currentWord,
    currentConnection,
    letter,
    isNumbersMode,
    isDiacriticsMode,
    activeForm,
    t,
    soundEnabled,
    eExportCanvas,
  ]);

  return {
    feedback,
    setFeedback,
    loading,
    showConsentDialog,
    setShowConsentDialog,
    requestFeedback,
    giveConsent,
    revokeConsent,
    advancePending,
  };
}
