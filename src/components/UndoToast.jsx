import { useEffect, useRef } from 'react';
import styles from '../styles/practiceStyles';

/**
 * Transient undo toast — accessible, interactive. Rendered by a parent
 * that owns the timeout and the undo action.
 *
 * Props:
 *   message     — string (already translated)
 *   actionLabel — string (e.g. t("undo"))
 *   onUndo      — () => void  (parent clears the toast + restores state)
 *   onDismiss   — () => void (parent clears the toast; called on timer or X)
 *   duration    — number ms, default 6000
 *   dismissRef  — ref to the element to return focus to on dismiss (optional)
 */
export default function UndoToast({
  message,
  actionLabel,
  onUndo,
  onDismiss,
  duration = 6000,
  dismissRef,
}) {
  const undoBtnRef = useRef(null);

  useEffect(() => {
    // Move focus to the Undo button so keyboard users can act immediately.
    undoBtnRef.current?.focus();
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  const handleUndo = () => {
    dismissRef?.current?.focus?.();
    onUndo();
  };

  const handleDismiss = () => {
    dismissRef?.current?.focus?.();
    onDismiss();
  };

  return (
    <div className="undo-toast" role="status" aria-live="polite" style={styles.undoToast}>
      <span style={styles.undoToastMessage}>{message}</span>
      <button
        ref={undoBtnRef}
        className="btn-nav"
        style={{ ...styles.btn, ...styles.undoToastAction }}
        onClick={handleUndo}
        aria-label={actionLabel}
      >
        {actionLabel}
      </button>
      <button
        className="btn-clear"
        style={styles.undoToastDismiss}
        onClick={handleDismiss}
        aria-label="✕"
      >
        ✕
      </button>
    </div>
  );
}
