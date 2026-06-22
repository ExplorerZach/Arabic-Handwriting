# Review Session Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five gaps in the guided review session: save SM-2 scores, shuffle queue, resume interrupted sessions, auto-advance without AI, and better skip visuals.

**Architecture:** All changes are in `PracticeView.jsx` (review session state machine) and supporting utils (`progress.js`, `locales/index.js`). No new components needed — each task modifies the existing review flow within the ~1100-line component.

**Tech Stack:** React 19, inline JS styles, localStorage, canvas 2D.

---

### Task 1: Save SM-2 scores during review sessions

**Problem:** `requestFeedback` at `PracticeView.jsx:1282` gates all progress saving (`setScore`/`updateSR`/`addFeedbackEntry`/`setProgressVersion`) behind `practiceMode === "letters" || isNumbersMode || isDiacriticsMode`. When `practiceMode === "review"` these are skipped, so SM-2 intervals never update and the same items remain due forever.

**Fix:** Also run the progress-saving block when `reviewSessionRef.current` is active.

**Files:**
- Modify: `src/components/PracticeView.jsx:1282-1296`

- [ ] **Step 1: Read the current code**

Read lines 1282-1296 of `PracticeView.jsx` to confirm the exact condition.

- [ ] **Step 2: Update the condition to include review mode**

Change line 1282 from:
```js
if (practiceMode === "letters" || isNumbersMode || isDiacriticsMode) {
```
to:
```js
if (practiceMode === "letters" || isNumbersMode || isDiacriticsMode || reviewSessionRef.current) {
```

This ensures `setScore`, `updateSR`, `addFeedbackEntry`, and `progressVersion` bump all fire during a review session when AI feedback returns a score.

- [ ] **Step 3: Build and verify**

```bash
npm run build
```
Expected: exit 0.

---

### Task 2: Shuffle the review queue

**Problem:** `getDueLetters` iterates `LETTERS` in definition order (alphabetical by Arabic — Alef, Ba, Ta, Tha, etc.). Every review session presents items in the same order, making it predictable and less effective for recall.

**Fix:** Add a Fisher-Yates shuffle to the queue in `startReviewSession`.

**Files:**
- Modify: `src/components/PracticeView.jsx:1074-1079`

- [ ] **Step 1: Read `startReviewSession`**

Read lines 1074-1079 of `PracticeView.jsx`.

- [ ] **Step 2: Add shuffle helper and modify `startReviewSession`**

Replace the `startReviewSession` callback:

```js
const startReviewSession = useCallback(() => {
  if (!dueItems.length) return;
  const queue = dueItems.slice();
  // Fisher-Yates shuffle
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  setReviewSession({ queue, index: 0, summary: [] });
  enterReviewItem(queue[0].letterName, queue[0].formKey);
}, [dueItems, enterReviewItem]);
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```
Expected: exit 0.

---

### Task 3: Resume interrupted review sessions

**Problem:** If the user exits mid-session (via "Exit" button, tab switch, or accidental refresh), all in-progress scores are lost. No state persists.

**Fix:** Stash `{ queue, index, summary, finished }` into `sessionStorage` (survives refresh within a tab; cleared on tab close so stale data doesn't linger). On mount or when switching to the review tab, check for a stashed session and offer to resume.

**Files:**
- Modify: `src/components/PracticeView.jsx` (multiple locations)
- Modify: `src/locales/index.js`

- [ ] **Step 1: Add resume prompt UI strings to both locales**

In `src/locales/index.js`, add to `en` section:
```js
reviewResume: "Resume unfinished review session?",
reviewResumeYes: "Resume",
reviewResumeNo: "Start fresh",
```

Add to `ar` section:
```js
reviewResume: "استئناف جلسة المراجعة غير المكتملة؟",
reviewResumeYes: "استئناف",
reviewResumeNo: "بدء من جديد",
```

- [ ] **Step 2: Add state and storage helpers in PracticeView.jsx**

After the existing `reviewSession` state (line 180), add:
```js
const RESUME_KEY = "arabic_review_session";
```

Add a `useEffect` to stash session changes into `sessionStorage`:
```js
useEffect(() => {
  if (reviewSession) {
    try {
      sessionStorage.setItem(RESUME_KEY, JSON.stringify(reviewSession));
    } catch (_) {}
  } else {
    sessionStorage.removeItem(RESUME_KEY);
  }
}, [reviewSession]);
```

Add a `useEffect` to check for a stashed session on mount:
```js
const [showResumePrompt, setShowResumePrompt] = useState(false);
const [stashedSession, setStashedSession] = useState(null);
useEffect(() => {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.queue && !parsed.finished) {
        setStashedSession(parsed);
        setShowResumePrompt(true);
      }
    }
  } catch (_) {}
}, []);
```

- [ ] **Step 3: Render resume prompt in review dashboard**

In the review dashboard section (`practiceMode === "review" && !reviewSession`), before the existing content, add:
```js
{showResumePrompt && stashedSession && (
  <div style={{ padding: "12px 16px", marginBottom: 12, background: "var(--color-card-bg)", borderRadius: 12, border: "1px solid var(--color-border)" }}>
    <p style={{ marginBottom: 8, fontSize: 14, color: "var(--color-text)" }}>{t("reviewResume")}</p>
    <div style={{ display: "flex", gap: 8 }}>
      <button className="btn-ai" style={{ ...styles.btn, ...styles.btnAI, flex: 1 }} onClick={() => {
        setReviewSession(stashedSession);
        enterReviewItem(stashedSession.queue[stashedSession.index].letterName, stashedSession.queue[stashedSession.index].formKey);
        setShowResumePrompt(false);
        setStashedSession(null);
      }}>{t("reviewResumeYes")}</button>
      <button className="btn-clear" style={{ ...styles.btn, flex: 1 }} onClick={() => {
        sessionStorage.removeItem(RESUME_KEY);
        setShowResumePrompt(false);
        setStashedSession(null);
      }}>{t("reviewResumeNo")}</button>
    </div>
  </div>
)}
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```
Expected: exit 0.

---

### Task 4: Auto-advance for non-AI users

**Problem:** The manual "Next" button (added in the previous bugfix) requires a click per item. Users without an API key get no auto-advance, while AI users get auto-advance after 1400ms.

**Fix:** Add an auto-advance on `handlePointerUp` when in a review session with no API key. After the user lifts their pen, wait a brief cooldown and advance. This mirrors the AI auto-advance timing.

**Files:**
- Modify: `src/components/PracticeView.jsx`

- [ ] **Step 1: Read `handlePointerUp`**

Read lines 920-952 of `PracticeView.jsx`.

- [ ] **Step 2: Add non-AI auto-advance in `handlePointerUp`**

After the existing `handlePointerUp` logic (after the `progressVersion` bump at line 951), add:

```js
// Auto-advance in review session when there's no API key
if (
  reviewSession &&
  !reviewSessionRef.current?.finished &&
  strokesRef.current.length > 0 &&
  apiKey === "skip"
) {
  clearTimeout(autoAdvanceTimerRef.current);
  autoAdvanceTimerRef.current = setTimeout(() => {
    advanceReviewRef.current?.();
  }, 800);
}
```

Add the ref at the top of the component (near the other refs around line 183):
```js
const autoAdvanceTimerRef = useRef(null);
```

Add cleanup in a useEffect to clear the timer on unmount or session end:
```js
useEffect(() => {
  return () => clearTimeout(autoAdvanceTimerRef.current);
}, []);
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```
Expected: exit 0.

---

### Task 5: Visual indicator for skipped items in summary

**Problem:** The review summary at lines 1806-1832 already handles `score: undefined` (neutral background, no star), but skipped items look identical to "not yet scored" rather than clearly indicating they were intentionally skipped. No visual distinction.

**Fix:** Track a `skipped` flag per summary entry and style it differently (dimmed, dash instead of star).

**Files:**
- Modify: `src/components/PracticeView.jsx`

- [ ] **Step 1: Update `advanceReview` to pass a `skipped` flag**

In the summary entry creation (line 1090), change:
```js
const summary = [...sess.summary, { ...item, score }];
```
to:
```js
const skipped = score == null;
const summary = [...sess.summary, { ...item, score, skipped }];
```

- [ ] **Step 2: Update the summary rendering**

Replace the existing summary map (lines 1806-1831) with:

```js
{reviewSession.summary.map((item, i) => (
  <span
    key={i}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "4px 8px",
      borderRadius: 6,
      background: item.skipped
        ? "var(--color-progress-badge-bg)"
        : item.score >= 4
          ? "rgba(90,158,78,0.15)"
          : "rgba(192,112,58,0.15)",
      color: "var(--color-text)",
      fontSize: 13,
      opacity: item.skipped ? 0.55 : 1,
    }}
    lang="ar"
  >
    {item.letterChar}
    {item.skipped ? (
      <span style={{ fontSize: 10, opacity: 0.6 }}>—</span>
    ) : (
      <span style={{ fontSize: 11, opacity: 0.8 }}>★{item.score}</span>
    )}
  </span>
))}
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```
Expected: exit 0.
