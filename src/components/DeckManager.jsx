import { useState, useEffect } from "react";
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
  onStartSession,
}) {
  const [deckView, setDeckView] = useState("list");
  const [editingId, setEditingId] = useState(null);
  const [pickerTab, setPickerTab] = useState("letters");

  const editingDeck = editingId ? decks.find((d) => d.id === editingId) : null;

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
          <span>{t("deckListTitle")}</span>
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
            <p style={{ marginBottom: 12 }}>{t("deckEmpty")}</p>
            <button className="btn-ai" style={{ ...styles.btn, ...styles.btnAI }} onClick={handleNewDeck}>
              {t("deckEmptyCta")}
            </button>
          </div>
        ) : (
          decks.map((deck) => (
            <div key={deck.id} style={styles.deckRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.deckRowName}>{deck.name}</div>
                <div style={styles.deckRowCount}>
                  {deck.items.length} {t("deckItemCount")}
                </div>
              </div>
              <button
                className="btn-ai"
                style={{ ...styles.btn, ...styles.btnAI, fontSize: 12, padding: "4px 10px" }}
                onClick={() => onStartSession(deck)}
                disabled={deck.items.length === 0}
              >
                ▶ {t("deckStart")}
              </button>
              <button
                className="btn-panel"
                style={{ ...styles.btn, fontSize: 12, padding: "4px 10px" }}
                onClick={() => { setEditingId(deck.id); setDeckView("edit"); }}
              >
                {t("deckEdit")}
              </button>
              <button
                className="btn-clear"
                style={{ ...styles.btn, fontSize: 12, padding: "4px 10px" }}
                onClick={() => {
                  if (window.confirm(t("deckDeleteConfirm"))) onDeleteDeck(deck.id);
                }}
              >
                {t("deckDelete")}
              </button>
            </div>
          ))
        )}
      </div>
    );
  }

  // ═══ Pane 2: Deck editor ═══════════════════════════════
  if (deckView === "edit" && editingDeck) {
    return (
      <div style={styles.reviewDash}>
        <div style={{ ...styles.reviewHeader, justifyContent: "space-between" }}>
          <button className="btn-clear" style={{ ...styles.btn, fontSize: 12, padding: "4px 10px" }} onClick={backToList}>
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
          <button className="btn-clear" style={{ ...styles.btn, fontSize: 12, padding: "4px 10px" }} onClick={() => setDeckView("edit")}>
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
          <div style={styles.deckPickerGrid}>
            {LETTERS.map((l) => {
              const selected = isInDeck("letter", l.name);
              return (
                <button
                  key={l.name}
                  className="btn-alpha"
                  style={{
                    ...styles.reviewTile,
                    ...(selected ? { borderColor: "var(--color-accent)", background: "rgba(var(--color-accent-rgb, 192,112,58),0.12)" } : {}),
                  }}
                  onClick={() => toggleItem("letter", l.name)}
                  aria-pressed={selected}
                >
                  <span style={styles.reviewTileChar} lang="ar">{l.letter}</span>
                  <span style={styles.reviewTileName}>{l.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {pickerTab === "numbers" && (
          <div style={styles.deckPickerGrid}>
            {NUMBERS.map((n) => {
              const selected = isInDeck("number", n.name);
              return (
                <button
                  key={n.name}
                  className="btn-alpha"
                  style={{
                    ...styles.reviewTile,
                    ...(selected ? { borderColor: "var(--color-accent)", background: "rgba(var(--color-accent-rgb, 192,112,58),0.12)" } : {}),
                  }}
                  onClick={() => toggleItem("number", n.name)}
                  aria-pressed={selected}
                >
                  <span style={styles.reviewTileChar} lang="ar">{n.letter}</span>
                  <span style={styles.reviewTileName}>{n.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {pickerTab === "diacritics" && (
          <div style={styles.deckPickerGrid}>
            {DIACRITICS.map((d) => {
              const selected = isInDeck("diacritic", d.name);
              return (
                <button
                  key={d.name}
                  className="btn-alpha"
                  style={{
                    ...styles.reviewTile,
                    ...(selected ? { borderColor: "var(--color-accent)", background: "rgba(var(--color-accent-rgb, 192,112,58),0.12)" } : {}),
                  }}
                  onClick={() => toggleItem("diacritic", d.name)}
                  aria-pressed={selected}
                >
                  <span style={styles.reviewTileChar} lang="ar">{d.letter}</span>
                  <span style={styles.reviewTileName}>{d.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {pickerTab === "words" && (
          <div>
            {WORD_GROUPS.map((g, gIdx) => (
              <div key={gIdx} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: ".15em", marginBottom: 6 }}>
                  {g.name}
                </div>
                {g.words.map((w, wIdx) => {
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
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback (shouldn't reach)
  return null;
}
