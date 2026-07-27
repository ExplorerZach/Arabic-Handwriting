import { useState, useCallback, useEffect } from 'react';
import { LETTERS } from '../data/letters';
import { NUMBERS } from '../data/numbers';
import { DIACRITICS } from '../data/diacritics';
import { todayLocal } from '../utils/progress';
import { getDeck, setLastSession } from '../utils/decks';

export default function useDeckSession({
  dClearCanvas,
  lessonMode,
  lessonToAlpha,
  wordLookup,
  activeForm,
  reviewSessionRef,
  deckSessionRef,
  advanceDeckRef,
  setDeckSessionRef,
  alphaBtnRef,
  setLetterIndex,
  setFormIndex,
  setPracticeMode,
  setWordGroupIndex,
  setWordIndex,
  setShowComparison,
  setShowHistory,
  setUndoDelete,
  setReviewSubTab,
  refreshDecks,
  t,
}) {
  const [deckSession, setDeckSession] = useState(null);

  useEffect(() => {
    deckSessionRef.current = deckSession;
  }, [deckSession, deckSessionRef]);

  const resolveDeckItem = useCallback(
    item => {
      if (!item) return null;
      if (item.type === 'letter') {
        const l = LETTERS.find(x => x.name === item.ref);
        if (!l) return null;
        const allForms = Object.keys(l.forms);
        const formKeys =
          item.formKey && allForms.includes(item.formKey) ? [item.formKey] : allForms;
        return {
          glyph: l.letter,
          name: l.name,
          roman: l.roman,
          formKeys,
          practiceMode: 'letters',
          obj: l,
        };
      }
      if (item.type === 'number') {
        const n = NUMBERS.find(x => x.name === item.ref);
        if (!n) return null;
        return {
          glyph: n.letter,
          name: n.name,
          roman: n.roman,
          formKeys: ['isolated'],
          practiceMode: 'numbers',
          obj: n,
        };
      }
      if (item.type === 'diacritic') {
        const d = DIACRITICS.find(x => x.name === item.ref);
        if (!d) return null;
        return {
          glyph: d.letter,
          name: d.name,
          roman: d.roman,
          formKeys: ['isolated'],
          practiceMode: 'diacritics',
          obj: d,
        };
      }
      if (item.type === 'word') {
        const w = wordLookup.get(item.ref);
        if (!w) return null;
        return {
          glyph: w.word,
          name: w.word,
          roman: w.roman,
          formKeys: ['word'],
          practiceMode: 'words',
          obj: w,
        };
      }
      return null;
    },
    [wordLookup],
  );

  const enterDeckItem = useCallback(
    (idx, itemArg) => {
      const sess = deckSessionRef.current;
      const item = itemArg || (sess && sess.queue[idx]);
      if (!item) return;
      const resolved = resolveDeckItem(item);
      if (!resolved) return;
      setPracticeMode(resolved.practiceMode);
      if (resolved.practiceMode === 'words') {
        setWordGroupIndex(resolved.obj.groupIndex);
        setWordIndex(resolved.obj.wordIndex);
      } else if (resolved.practiceMode === 'letters') {
        const alphIdx = LETTERS.findIndex(l => l.name === item.ref);
        if (lessonMode) {
          const lessonIdx = lessonToAlpha.indexOf(alphIdx);
          setLetterIndex(lessonIdx !== -1 ? lessonIdx : 0);
        } else {
          setLetterIndex(alphIdx);
        }
      } else {
        const set = resolved.practiceMode === 'numbers' ? NUMBERS : DIACRITICS;
        const idxInSet = set.findIndex(x => x.name === item.ref);
        setLetterIndex(idxInSet);
      }
      setFormIndex(resolved.formKeys[0]);
      setShowComparison(false);
      setShowHistory(false);
      alphaBtnRef.current = [];
      dClearCanvas();
    },
    [
      resolveDeckItem,
      lessonMode,
      lessonToAlpha,
      dClearCanvas,
      deckSessionRef,
      setPracticeMode,
      setWordGroupIndex,
      setWordIndex,
      setLetterIndex,
      setFormIndex,
      setShowComparison,
      setShowHistory,
      alphaBtnRef,
    ],
  );

  const buildLowScoreQueue = useCallback(deckId => {
    const deck = getDeck(deckId);
    if (!deck || !deck.lastSession || !deck.lastSession.items) return [];
    return deck.lastSession.items
      .filter(
        e =>
          (e.score == null || e.score <= 3) &&
          deck.items.some(i => i.type === e.type && i.ref === e.ref),
      )
      .map(e => ({ type: e.type, ref: e.ref, formKey: e.formKey }));
  }, []);

  const restartDeckSession = useCallback(
    mode => {
      const sess = deckSessionRef.current;
      if (!sess) return;
      if (mode === 'full') {
        const deck = getDeck(sess.deckId);
        if (!deck || !deck.items.length) return;
        setDeckSession({
          ...sess,
          queue: deck.items.slice(),
          index: 0,
          summary: [],
          finished: false,
          mode: 'full',
        });
        enterDeckItem(0, deck.items[0]);
      } else {
        const queue = buildLowScoreQueue(sess.deckId);
        if (!queue.length) return;
        setDeckSession({
          ...sess,
          queue,
          index: 0,
          summary: [],
          finished: false,
          mode: 'lowScore',
        });
        enterDeckItem(0, queue[0]);
      }
    },
    [enterDeckItem, buildLowScoreQueue, deckSessionRef],
  );

  const startDeckSession = useCallback(
    (deck, mode = 'full') => {
      if (reviewSessionRef.current) return;
      if (!deck || !deck.items || deck.items.length === 0) return;
      setUndoDelete(null);
      setReviewSubTab('decks');
      let queue;
      if (mode === 'lowScore') {
        queue = buildLowScoreQueue(deck.id);
        if (queue.length === 0) return;
      } else {
        queue = deck.items.slice();
      }
      setDeckSession({
        deckId: deck.id,
        deckName: deck.name,
        queue,
        index: 0,
        summary: [],
        finished: false,
        mode,
      });
      enterDeckItem(0, queue[0]);
    },
    [enterDeckItem, buildLowScoreQueue, reviewSessionRef, setUndoDelete, setReviewSubTab],
  );

  const advanceDeck = useCallback(
    score => {
      const sess = deckSessionRef.current;
      if (!sess || sess.finished) return;
      const item = sess.queue[sess.index];
      const resolved = resolveDeckItem(item);
      if (!resolved) {
        const nextIndex = sess.index + 1;
        if (nextIndex >= sess.queue.length) {
          setDeckSession({ ...sess, finished: true });
        } else {
          setDeckSession({ ...sess, index: nextIndex });
          enterDeckItem(nextIndex);
        }
        return;
      }
      const formKeys = resolved.formKeys;
      const currentFormIdx = formKeys.indexOf(activeForm);
      const currentFormKey = currentFormIdx !== -1 ? formKeys[currentFormIdx] : formKeys[0];
      const isLastForm = currentFormIdx === -1 || currentFormIdx === formKeys.length - 1;
      const skipped = score == null;
      const summary = [
        ...sess.summary,
        {
          item,
          formKey: currentFormKey,
          score,
          skipped,
          letterChar: resolved.glyph,
          name: resolved.name,
        },
      ];
      if (!isLastForm) {
        setDeckSession({ ...sess, summary });
        setFormIndex(formKeys[currentFormIdx + 1]);
        setShowComparison(false);
        setShowHistory(false);
        dClearCanvas();
      } else {
        const nextIndex = sess.index + 1;
        if (nextIndex >= sess.queue.length) {
          const scored = summary.filter(s => s.score != null);
          const avgScore =
            scored.length > 0 ? scored.reduce((sum, s) => sum + s.score, 0) / scored.length : null;
          setLastSession(sess.deckId, {
            date: todayLocal(),
            mode: sess.mode || 'full',
            avgScore,
            items: summary.map(s => ({
              ref: s.item.ref,
              type: s.item.type,
              formKey: s.formKey,
              score: s.score,
            })),
          });
          refreshDecks();
          setDeckSession({ ...sess, summary, finished: true });
        } else {
          setDeckSession({ ...sess, index: nextIndex, summary });
          enterDeckItem(nextIndex);
        }
      }
    },
    [
      activeForm,
      resolveDeckItem,
      enterDeckItem,
      dClearCanvas,
      refreshDecks,
      deckSessionRef,
      setFormIndex,
      setShowComparison,
      setShowHistory,
    ],
  );

  // eslint-disable-next-line react-hooks/refs
  advanceDeckRef.current = advanceDeck;

  // eslint-disable-next-line react-hooks/refs
  setDeckSessionRef.current = setDeckSession;

  const exitDeckSession = useCallback(() => {
    const sess = deckSessionRef.current;
    if (sess && !sess.finished) {
      if (!window.confirm(t('deckExitConfirm'))) return;
    }
    setDeckSession(null);
    setUndoDelete(null);
    setShowComparison(false);
    setShowHistory(false);
    dClearCanvas();
  }, [dClearCanvas, t, deckSessionRef, setUndoDelete, setShowComparison, setShowHistory]);

  return {
    deckSession,
    resolveDeckItem,
    startDeckSession,
    exitDeckSession,
    restartDeckSession,
  };
}
