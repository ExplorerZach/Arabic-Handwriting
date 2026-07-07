import { useState, useEffect, useRef } from "react";
import styles from "../styles/practiceStyles";
import { LETTERS } from "../data/letters";
import { NUMBERS } from "../data/numbers";
import { DIACRITICS } from "../data/diacritics";
import { WORD_GROUPS } from "../data/words";

/**
 * Deck manager — presentational component for the "My Decks" sub-tab
 * inside the Review tab. Three panes (list / editor / picker) controlled
 * by local `deckView` state. Receives CRUD handlers + onStartSession as
 * props; all mutation flows through PracticeView which bumps decksVersion.
 *
 * Props:
 *   t, locale, darkMode
 *   decks — array of deck objects
 *   onCreateDeck(name), onRenameDeck(id, name), onDeleteDeck(id)
 *   onAddItem(deckId, item), onRemoveItem(deckId, itemId)
 *   onReorderItem(deckId, fromIdx, toIdx)
 *   onStartSession(deck)
 */
export default function DeckManager({
  t,
  locale,
  darkMode,
  decks,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onAddItem,
  onRemoveItem,
  onReorderItem,
  onReorderDecks,
  onCopyDeck,
  onStartSession,
}) {
  const [deckView, setDeckView] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [pickerTab, setPickerTab] = useState("letters");
  const [wordSearch, setWordSearch] = useState("");

  const paneHeaderRef = useRef(null);

  useEffect(() => {
    // Move focus to the pane heading on view change for a11y.
    paneHeaderRef.current?.focus?.();
  }, [deckView]);

  const [gridFocusIdx, setGridFocusIdx] = useState(0);

  const handleGridKeyDown = (e, items, idx) => {
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + items.length) % items.length;
    else if (e.key === "ArrowDown") next = Math.min(idx + 1, items.length - 1);
    else if (e.key === "ArrowUp") next = Math.max(idx - 1, 0);
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      return; // let the button onClick fire
    } else return;
    e.preventDefault();
    setGridFocusIdx(next);
  };

  const editingDeck = editingId ? decks.find((d) => d.id === editingId) : null;

  const countLowScore = (deck) => {
    if (!deck.lastSession || !deck.lastSession.items) return 0;
    return deck.lastSession.items.filter(
      (e) => e.score == null || e.score <= 3
    ).length;
  };

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // If the deck being edited is deleted (e.g. in another tab via storage
  // event), editingDeck becomes null and both the editor and picker panes
  // would fall through to the `return null` fallback — stranding the user
  // on a blank screen. Auto-return to the list view instead.
  useEffect(() => {
    if (deckView !== "list" && editingId && !editingDeck) {
      setDeckView("list");
      setEditingId(null);
    }
  }, [deckView, editingId, editingDeck]);

  useEffect(() => {
    setGridFocusIdx(0);
  }, [pickerTab]);

  useEffect(() => {
    setWordSearch("");
  }, [deckView]);

  const backToList = () => {
    setDeckView("list");
    setEditingId(null);
  };

  const handleNewDeck = () => {
    const deck = onCreateDeck("");
    if (deck) {
      setEditingId(deck.id);
      setDeckView("edit");
    }
  };

  // ─── Resolve an item ref to a display glyph + label ────
  const resolveDisplay = (item) => {
    if (item.type === "letter") {
      const l = LETTERS.find((x) => x.name === item.ref);
      return l ? { char: l.letter, label: `${l.name} — ${l.roman}` } : null;
    }
    if (item.type === "number") {
      const n = NUMBERS.find((x) => x.name === item.ref);
      return n ? { char: n.letter, label: `${n.name} — ${n.roman}` } : null;
    }
    if (item.type === "diacritic") {
      const d = DIACRITICS.find((x) => x.name === item.ref);
      return d ? { char: d.letter, label: `${d.name} — ${d.roman}` } : null;
    }
    if (item.type === "word") {
      let found = null;
      for (const g of WORD_GROUPS) {
        const w = g.words.find((x) => x.word === item.ref);
        if (w) { found = { char: w.word, label: `${w.roman} — ${w.meaning}` }; break; }
      }
      return found;
    }
    return null;
  };

  const isInDeck = (type, ref) => {
    if (!editingDeck) return false;
    return editingDeck.items.some((it) => it.type === type && it.ref === ref);
  };

  const toggleItem = (type, ref) => {
    if (!editingDeck) return;
    if (isInDeck(type, ref)) {
      const item = editingDeck.items.find((it) => it.type === type && it.ref === ref);
      if (item) onRemoveItem(editingDeck.id, item.id);
    } else {
      onAddItem(editingDeck.id, { type, ref });
    }
  };

  // ═══ Pane 1: Deck list ═════════════════════════════════
  if (deckView === "list") {
    return (
      <div style={styles.reviewDash}>
        <div style={{ ...styles.reviewHeader, justifyContent: "space-between" }}>
          <span ref={paneHeaderRef} tabIndex={-1}>{t("deckListTitle")}</span>
          <button
            className="btn-ai"
            style={{ ...styles.btn, ...styles.btnAI, fontSize: 12, padding: "4px 10px" }}
            onClick={handleNewDeck}
          >
            ＋ {t("deckNew")}
          </button>
        </div>
        {decks.length === 0 ? (
          <div style={styles.reviewEmpty}>
            <p style={{ marginBottom: 8 }}>{t("deckEmpty")}</p>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
              {t("deckEmptyHint")}
            </p>
            <button className="btn-ai" style={{ ...styles.btn, ...styles.btnAI }} onClick={handleNewDeck}>
              {t("deckEmptyCta")}
            </button>
          </div>
        ) : (
          decks.map((deck, deckIdx) => {
            const lowCount = countLowScore(deck);
            const lastDate = deck.lastSession ? formatDate(deck.lastSession.date) : null;
            const avgScore = deck.lastSession && deck.lastSession.avgScore != null
              ? `★${deck.lastSession.avgScore.toFixed(1)}`
              : null;
            return (
              <div key={deck.id} style={styles.deckRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.deckRowName}>{deck.name}</div>
                  <div style={styles.deckRowMeta}>
                    {deck.items.length} {t("deckItemCount")}
                    {lastDate && ` · ${t("deckLastPractice")} ${lastDate}`}
                    {avgScore && ` · ${t("deckSessionAvg")} ${avgScore}`}
                  </div>
                </div>
                <div style={styles.deckRowActions}>
                  {lowCount > 0 && (
                    <button
                      className="btn-ai"
                      style={{ ...styles.btn, ...styles.btnAI, ...styles.deckRowActionSmall }}
                      onClick={() => onStartSession(deck, "lowScore")}
                      aria-label={t("deckRerunLow")}
                      title={t("deckRerunLow")}
                    >
                      ↻ {t("deckLowScoreStart")}
                    </button>
                  )}
                  <button
                    className="btn-ai"
                    style={{ ...styles.btn, ...styles.btnAI, ...styles.deckRowActionSmall }}
                    onClick={() => onStartSession(deck, "full")}
                    disabled={deck.items.length === 0}
                  >
                    ▶ {t("deckStart")}
                  </button>
                  <button
                    className="btn-panel"
                    style={{ ...styles.btn, ...styles.deckRowActionSmall }}
                    onClick={() => onCopyDeck(deck.id)}
                    aria-label={t("deckCopy")}
                    title={t("deckCopy")}
                  >
                    ⎘
                  </button>
                  <button
                    className="btn-panel"
                    style={{ ...styles.btn, ...styles.deckRowActionSmall }}
                    onClick={() => { setEditingId(deck.id); setDeckView("edit"); }}
                  >
                    {t("deckEdit")}
                  </button>
                  <button
                    className="btn-clear"
                    style={{ ...styles.btn, ...styles.deckRowActionSmall }}
                    onClick={() => onReorderDecks(deckIdx, Math.max(0, deckIdx - 1))}
                    disabled={deckIdx === 0}
                    aria-label={t("deckMoveUp")}
                  >
                    ↑
                  </button>
                  <button
                    className="btn-clear"
                    style={{ ...styles.btn, ...styles.deckRowActionSmall }}
                    onClick={() => onReorderDecks(deckIdx, Math.min(decks.length - 1, deckIdx + 1))}
                    disabled={deckIdx === decks.length - 1}
                    aria-label={t("deckMoveDown")}
                  >
                    ↓
                  </button>
                  <button
                    className="btn-clear"
                    style={{ ...styles.btn, ...styles.deckRowActionSmall }}
                    onClick={() => {
                      if (window.confirm(t("deckDeleteConfirm"))) onDeleteDeck(deck.id);
                    }}
                  >
                    {t("deckDelete")}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  // ═══ Pane 2: Deck editor ═══════════════════════════════
  if (deckView === "edit" && editingDeck) {
    return (
      <div style={styles.reviewDash}>
        <div style={{ ...styles.reviewHeader, justifyContent: "space-between" }}>
          <button ref={paneHeaderRef} tabIndex={-1} className="btn-clear" style={{ ...styles.btn, fontSize: 12, padding: "4px 10px" }} onClick={backToList}>
            ← {t("deckBack")}
          </button>
          <button className="btn-nav" style={{ ...styles.btn, fontSize: 12, padding: "4px 10px" }} onClick={backToList}>
            {t("deckDone")}
          </button>
        </div>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>
            {t("deckNameLabel")}
          </span>
          <input
            type="text"
            value={editingDeck.name}
            onChange={(e) => onRenameDeck(editingDeck.id, e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: 15,
              boxSizing: "border-box",
            }}
          />
        </label>
        <div style={styles.deckBulkBar}>
          <button
            className="btn-panel"
            style={styles.deckBulkBtn}
            onClick={() => {
              const items = LETTERS.map((l) => ({ type: "letter", ref: l.name }));
              onAddItem(editingDeck.id, { type: "_bulk", ref: "_bulk", _bulk: items });
            }}
          >
            {t("deckBulkAllLetters")}
          </button>
          <button
            className="btn-panel"
            style={styles.deckBulkBtn}
            onClick={() => {
              const items = NUMBERS.map((n) => ({ type: "number", ref: n.name }));
              onAddItem(editingDeck.id, { type: "_bulk", ref: "_bulk", _bulk: items });
            }}
          >
            {t("deckBulkNumbers")}
          </button>
          <button
            className="btn-panel"
            style={styles.deckBulkBtn}
            onClick={() => {
              const items = WORD_GROUPS[1].words.map((w) => ({ type: "word", ref: w.word }));
              onAddItem(editingDeck.id, { type: "_bulk", ref: "_bulk", _bulk: items });
            }}
          >
            {t("deckBulkCommonWords")}
          </button>
          <button
            className="btn-panel"
            style={styles.deckBulkBtn}
            onClick={() => {
              const items = DIACRITICS.map((d) => ({ type: "diacritic", ref: d.name }));
              onAddItem(editingDeck.id, { type: "_bulk", ref: "_bulk", _bulk: items });
            }}
          >
            {t("deckBulkAllDiacritics")}
          </button>
        </div>
        <button
          className="btn-ai"
          style={{ ...styles.btn, ...styles.btnAI, marginBottom: 12 }}
          onClick={() => setDeckView("picker")}
        >
          ＋ {t("deckAddItems")}
        </button>
        {editingDeck.items.length === 0 ? (
          <div style={styles.reviewEmpty}>{t("deckEmpty")}</div>
        ) : (
          editingDeck.items.map((item, idx) => {
            const disp = resolveDisplay(item);
            if (!disp) return null;
            return (
              <div key={item.id} style={styles.deckEditorItem}>
                <span style={styles.deckEditorItemChar} lang="ar">{disp.char}</span>
                <span style={styles.deckEditorItemLabel}>{disp.label}</span>
                <button
                  className="btn-clear"
                  style={{ ...styles.btn, fontSize: 11, padding: "2px 8px" }}
                  onClick={() => onReorderItem(editingDeck.id, idx, Math.max(0, idx - 1))}
                  disabled={idx === 0}
                  aria-label={t("deckMoveUp")}
                >
                  ↑
                </button>
                <button
                  className="btn-clear"
                  style={{ ...styles.btn, fontSize: 11, padding: "2px 8px" }}
                  onClick={() => onReorderItem(editingDeck.id, idx, Math.min(editingDeck.items.length - 1, idx + 1))}
                  disabled={idx === editingDeck.items.length - 1}
                  aria-label={t("deckMoveDown")}
                >
                  ↓
                </button>
                <button
                  className="btn-clear"
                  style={{ ...styles.btn, fontSize: 11, padding: "2px 8px" }}
                  onClick={() => onRemoveItem(editingDeck.id, item.id)}
                  aria-label={t("deckItemRemove")}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
    );
  }

  // ═══ Pane 3: Item picker ═══════════════════════════════
  if (deckView === "picker" && editingDeck) {
    const subTabs = [
      { key: "letters", label: t("deckPickerLetters") },
      { key: "numbers", label: t("deckPickerNumbers") },
      { key: "diacritics", label: t("deckPickerDiacritics") },
      { key: "words", label: t("deckPickerWords") },
    ];
    return (
      <div style={styles.reviewDash}>
        <div style={{ ...styles.reviewHeader, justifyContent: "space-between" }}>
          <button ref={paneHeaderRef} tabIndex={-1} className="btn-clear" style={{ ...styles.btn, fontSize: 12, padding: "4px 10px" }} onClick={() => setDeckView("edit")}>
            ← {t("deckBack")}
          </button>
          <button className="btn-nav" style={{ ...styles.btn, fontSize: 12, padding: "4px 10px" }} onClick={() => setDeckView("edit")}>
            {t("deckDone")}
          </button>
        </div>
        <div style={styles.deckSubNav}>
          {subTabs.map((st) => (
            <button
              key={st.key}
              className="btn-form"
              style={{
                ...styles.deckSubNavBtn,
                ...(pickerTab === st.key ? styles.deckSubNavBtnActive : {}),
              }}
              onClick={() => setPickerTab(st.key)}
              aria-pressed={pickerTab === st.key}
            >
              {st.label}
            </button>
          ))}
        </div>

        {pickerTab === "letters" && (
          <div style={styles.deckPickerGrid} role="grid" aria-label={t("deckPickerLetters")}>
            {LETTERS.map((l, idx) => {
              const selected = isInDeck("letter", l.name);
              return (
                <div key={l.name} style={styles.deckPickerTileWrap}>
                  <button
                    className="btn-alpha"
                    style={{
                      ...styles.reviewTile,
                      ...(selected ? { borderColor: "var(--color-accent)", background: "rgba(var(--color-accent-rgb, 192,112,58),0.12)" } : {}),
                    }}
                    onClick={() => toggleItem("letter", l.name)}
                    onKeyDown={(e) => handleGridKeyDown(e, LETTERS, idx)}
                    tabIndex={idx === gridFocusIdx ? 0 : -1}
                    aria-pressed={selected}
                    role="gridcell"
                  >
                    <span style={styles.reviewTileChar} lang="ar">{l.letter}</span>
                    <span style={styles.reviewTileName}>{l.name}</span>
                  </button>
                  {selected && <span style={styles.deckPickerCheckmark}>✓</span>}
                </div>
              );
            })}
          </div>
        )}

        {pickerTab === "numbers" && (
          <div style={styles.deckPickerGrid} role="grid" aria-label={t("deckPickerNumbers")}>
            {NUMBERS.map((n, idx) => {
              const selected = isInDeck("number", n.name);
              return (
                <div key={n.name} style={styles.deckPickerTileWrap}>
                  <button
                    className="btn-alpha"
                    style={{
                      ...styles.reviewTile,
                      ...(selected ? { borderColor: "var(--color-accent)", background: "rgba(var(--color-accent-rgb, 192,112,58),0.12)" } : {}),
                    }}
                    onClick={() => toggleItem("number", n.name)}
                    onKeyDown={(e) => handleGridKeyDown(e, NUMBERS, idx)}
                    tabIndex={idx === gridFocusIdx ? 0 : -1}
                    aria-pressed={selected}
                    role="gridcell"
                  >
                    <span style={styles.reviewTileChar} lang="ar">{n.letter}</span>
                    <span style={styles.reviewTileName}>{n.name}</span>
                  </button>
                  {selected && <span style={styles.deckPickerCheckmark}>✓</span>}
                </div>
              );
            })}
          </div>
        )}

        {pickerTab === "diacritics" && (
          <div style={styles.deckPickerGrid} role="grid" aria-label={t("deckPickerDiacritics")}>
            {DIACRITICS.map((d, idx) => {
              const selected = isInDeck("diacritic", d.name);
              return (
                <div key={d.name} style={styles.deckPickerTileWrap}>
                  <button
                    className="btn-alpha"
                    style={{
                      ...styles.reviewTile,
                      ...(selected ? { borderColor: "var(--color-accent)", background: "rgba(var(--color-accent-rgb, 192,112,58),0.12)" } : {}),
                    }}
                    onClick={() => toggleItem("diacritic", d.name)}
                    onKeyDown={(e) => handleGridKeyDown(e, DIACRITICS, idx)}
                    tabIndex={idx === gridFocusIdx ? 0 : -1}
                    aria-pressed={selected}
                    role="gridcell"
                  >
                    <span style={styles.reviewTileChar} lang="ar">{d.letter}</span>
                    <span style={styles.reviewTileName}>{d.name}</span>
                  </button>
                  {selected && <span style={styles.deckPickerCheckmark}>✓</span>}
                </div>
              );
            })}
          </div>
        )}

        {pickerTab === "words" && (
          <input
            type="text"
            value={wordSearch}
            onChange={(e) => setWordSearch(e.target.value)}
            placeholder={t("deckSearchWords")}
            style={styles.deckSearchInput}
            aria-label={t("deckSearchWords")}
          />
        )}

        {pickerTab === "words" && (
          <div>
            {WORD_GROUPS.map((g, gIdx) => {
              const filtered = g.words.filter((w) => {
                if (!wordSearch.trim()) return true;
                const q = wordSearch.toLowerCase().trim();
                return (
                  w.word.includes(q) ||
                  (w.roman && w.roman.toLowerCase().includes(q)) ||
                  (w.meaning && w.meaning.toLowerCase().includes(q))
                );
              });
              if (filtered.length === 0) return null;
              return (
                <div key={gIdx} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: ".15em", marginBottom: 6 }}>
                    {g.name}
                  </div>
                  {filtered.map((w, wIdx) => {
                    const selected = isInDeck("word", w.word);
                    return (
                      <button
                        key={`${gIdx}-${wIdx}`}
                        className="btn-alpha"
                        style={{
                          ...styles.deckPickerWordRow,
                          width: "100%",
                          ...(selected ? { borderColor: "var(--color-accent)", background: "rgba(var(--color-accent-rgb, 192,112,58),0.12)" } : {}),
                        }}
                        onClick={() => toggleItem("word", w.word)}
                        aria-pressed={selected}
                      >
                        <span style={styles.deckPickerWordChar} lang="ar">{w.word}</span>
                        <span style={styles.deckPickerWordMeta}>{w.roman} — {w.meaning}</span>
                        <span style={{ fontSize: 16, color: selected ? "var(--color-accent)" : "var(--color-text-muted)" }}>
                          {selected ? "✓" : "+"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Fallback (shouldn't reach)
  return null;
}
