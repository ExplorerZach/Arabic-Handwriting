import { useState, useRef, useEffect, useMemo } from 'react';
import {
  initialSync,
  resetInitialSync,
  isInitialSyncDone,
  getLastSyncUserId,
  hasLocalLearningData,
  clearSyncableData,
} from '../utils/sync';

export default function useSyncConflict({ userId, isOnline, setProgressVersion }) {
  const needsConflictPrompt = useMemo(() => {
    if (!userId) return false;
    const lastId = getLastSyncUserId();
    return !!lastId && lastId !== userId && hasLocalLearningData();
  }, [userId]);

  const [conflictChoice, setConflictChoice] = useState(null);
  const conflictPromptOpen = needsConflictPrompt && conflictChoice?.uid !== userId;
  const syncStartedForRef = useRef(null);

  useEffect(() => {
    if (!userId) {
      syncStartedForRef.current = null;
      resetInitialSync();
      return;
    }
    if (conflictPromptOpen) return;
    if (syncStartedForRef.current === userId) return;
    syncStartedForRef.current = userId;
    const discard = conflictChoice?.uid === userId && conflictChoice.choice === 'discard';
    if (discard) {
      clearSyncableData();
    }
    let cancelled = false;
    initialSync(userId, { pushLocal: !discard }).then(() => {
      if (!cancelled) setProgressVersion(v => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, conflictPromptOpen, conflictChoice, setProgressVersion]);

  useEffect(() => {
    if (!isOnline || !userId || conflictPromptOpen) return;
    if (isInitialSyncDone(userId)) return;
    let cancelled = false;
    initialSync(userId).then(() => {
      if (!cancelled) setProgressVersion(v => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [isOnline, userId, conflictPromptOpen, setProgressVersion]);

  return {
    conflictPromptOpen,
    setConflictChoice,
  };
}
