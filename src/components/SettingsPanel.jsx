import { PAPER_THEMES, BRUSH_PACKS, getPaperColors, getBrushColor } from '../styles/themes';
import styles from '../styles/practiceStyles';

/**
 * Settings panel — extracted from PracticeView for maintainability.
 * Receives all state + handlers as props; purely presentational.
 */
export default function SettingsPanel({
  t,
  locale,
  darkMode,
  onToggleDarkMode,
  onToggleLocale,
  highContrast,
  setHighContrast,
  reduceMotion,
  handleReduceMotionChange,
  soundEnabled,
  handleSoundToggle,
  model,
  handleModelChange,
  paperTheme,
  handleThemeChange,
  brushPack,
  handleBrushPackChange,
  apiKey,
  onClearKey,
  setShowSettings,
  setShowKeyScreen,
  exportBackup,
  importInputRef,
  handleImportFile,
  dailyGoalState,
  handleDailyGoalChange,
}) {
  return (
    <div id="settings-panel" style={styles.keyPanel}>

      {/* ── Appearance ── */}
      <div style={styles.settingsSection} role="group" aria-labelledby="settings-heading-appearance">
        <span id="settings-heading-appearance" style={styles.settingsSectionTitle}>{t('settingsSectionAppearance')}</span>
        <div style={styles.settingsRow}>
          <button
            className="btn-panel"
            style={styles.settingsToggleBtn}
            onClick={onToggleDarkMode}
            aria-pressed={darkMode}
            aria-label={t('ariaDarkModeBtn')}
          >
            {darkMode ? '☀ ' + t('settingsLightMode') : '🌙 ' + t('settingsDarkMode')}
          </button>
          <button
            className="btn-panel"
            style={styles.settingsToggleBtn}
            onClick={onToggleLocale}
            aria-label={t('ariaLangBtn')}
          >
            {locale === 'ar' ? 'EN' : 'عربي'}
          </button>
        </div>
        <div style={{ ...styles.settingsRow, marginTop: 8 }}>
          <button
            className="btn-panel"
            style={{ ...styles.settingsToggleBtn, flex: 1 }}
            onClick={() => setHighContrast((v) => !v)}
            aria-pressed={highContrast}
            aria-label="Toggle high contrast"
          >
            {highContrast ? 'High contrast: on' : 'High contrast: off'}
          </button>
          <button
            className="btn-panel"
            style={{ ...styles.settingsToggleBtn, flex: 1 }}
            onClick={() => handleReduceMotionChange(!reduceMotion)}
            aria-pressed={reduceMotion}
            aria-label="Toggle reduced motion"
          >
            {reduceMotion ? 'Reduced motion: on' : 'Reduced motion: off'}
          </button>
        </div>
        <div style={{ ...styles.settingsRow, marginTop: 8 }}>
          <button
            className="btn-panel"
            style={{ ...styles.settingsToggleBtn, flex: 1 }}
            onClick={() => handleSoundToggle(!soundEnabled)}
            aria-pressed={soundEnabled}
            aria-label="Toggle success sound"
          >
            {soundEnabled ? 'Sound: on' : 'Sound: off'}
          </button>
        </div>
      </div>

      <div style={styles.settingsDivider} />

      {/* ── AI Model ── */}
      <div style={styles.settingsSection} role="group" aria-labelledby="settings-heading-model">
        <span id="settings-heading-model" style={styles.settingsSectionTitle}>{t('settingsSectionModel')}</span>
        <select
          value={model}
          onChange={handleModelChange}
          style={{ padding: '6px 8px', borderRadius: '8px', border: '1.5px solid var(--color-border)', background: 'var(--color-input-bg)', fontSize: '13px', fontFamily: 'Georgia,serif', color: 'var(--color-text)', width: '100%' }}
          aria-labelledby="settings-heading-model"
        >
          <option value="google/gemini-3-flash-preview">Gemini 3 Flash</option>
          <option value="google/gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
          <option value="anthropic/claude-sonnet-4.6">Claude Sonnet 4.6</option>
          <option value="openai/gpt-5.4-mini">GPT-5.4 mini</option>
        </select>
      </div>

      <div style={styles.settingsDivider} />

      {/* ── Canvas (Paper + Ink) ── */}
      <div style={styles.settingsSection} role="group" aria-labelledby="settings-heading-canvas">
        <span id="settings-heading-canvas" style={styles.settingsSectionTitle}>{t('settingsSectionCanvas')}</span>
        <div style={{ fontSize: '12px', color: 'var(--color-text-soft)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {t('settingsTheme')}
          <div style={styles.themeRow}>
            {Object.values(PAPER_THEMES).map((theme) => {
              const colors = getPaperColors(theme.id, darkMode);
              const isActive = paperTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  className={`btn-theme ${isActive ? 'btn-theme-active' : ''}`}
                  style={{ ...styles.themeBtn, ...(isActive ? styles.themeBtnActive : {}) }}
                  onClick={() => handleThemeChange(theme.id)}
                  aria-pressed={isActive}
                  aria-label={t(theme.nameKey)}
                >
                  <span style={{ ...styles.themeSwatch, background: colors.bg }} />
                  <span>{t(theme.nameKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-soft)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {t('settingsBrush')}
          <div style={styles.brushRow}>
            {Object.values(BRUSH_PACKS).map((pack) => {
              const color = getBrushColor(pack.id, darkMode);
              const isActive = brushPack === pack.id;
              return (
                <button
                  key={pack.id}
                  className={`btn-swatch ${isActive ? 'btn-swatch-active' : ''}`}
                  style={{
                    ...styles.brushSwatch,
                    background: color,
                    ...(isActive ? styles.brushSwatchActive : {}),
                  }}
                  onClick={() => handleBrushPackChange(pack.id)}
                  aria-pressed={isActive}
                  aria-label={t(pack.nameKey)}
                  title={t(pack.nameKey)}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div style={styles.settingsDivider} />

      {/* ── API Key ── */}
      <div style={styles.settingsSection} role="group" aria-labelledby="settings-heading-apikey">
        <span id="settings-heading-apikey" style={styles.settingsSectionTitle}>{t('settingsSectionApiKey')}</span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-soft)' }}>{t('settingsNote')}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-panel"
            style={{ ...styles.keyPanelBtn, flex: 1 }}
            onClick={() => {
              setShowSettings(false);
              setShowKeyScreen(true);
            }}
          >
            {apiKey && apiKey !== 'skip' ? t('settingsChangeKey') : t('settingsSetKey')}
          </button>
          {apiKey && apiKey !== 'skip' && (
            <button
              className="btn-panel"
              style={{
                ...styles.keyPanelBtn,
                flex: 1,
                background: 'transparent',
                color: 'var(--color-accent)',
                border: '1px solid var(--color-border)',
                boxShadow: 'none',
              }}
              onClick={onClearKey}
            >
              {t('settingsClearKey')}
            </button>
          )}
        </div>
      </div>

      <div style={styles.settingsDivider} />

      {/* ── Backup (export / import) ── */}
      <div style={styles.settingsSection} role="group" aria-labelledby="settings-heading-data">
        <span id="settings-heading-data" style={styles.settingsSectionTitle}>{t('settingsSectionData')}</span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-soft)' }}>{t('settingsDataNote')}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-panel"
            style={{ ...styles.keyPanelBtn, flex: 1 }}
            onClick={exportBackup}
            aria-label={t('ariaExportBtn')}
          >
            {t('settingsExport')}
          </button>
          <button
            className="btn-panel"
            style={{
              ...styles.keyPanelBtn,
              flex: 1,
              background: 'transparent',
              color: 'var(--color-accent)',
              border: '1px solid var(--color-border)',
              boxShadow: 'none',
            }}
            onClick={() => importInputRef.current?.click()}
            aria-label={t('ariaImportBtn')}
          >
            {t('settingsImport')}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div style={styles.settingsDivider} />

      {/* ── Goals ── */}
      <div style={styles.settingsSection} role="group" aria-labelledby="settings-heading-goal">
        <span id="settings-heading-goal" style={styles.settingsSectionTitle}>{t('dailyGoalTitle')}</span>
        <div style={styles.settingsRow}>
          <label style={{ fontSize: '12px', color: 'var(--color-text-soft)' }}>{t('dailyGoalSet')}</label>
          <input
            type="number"
            min={1}
            max={50}
            value={dailyGoalState}
            onChange={handleDailyGoalChange}
            style={{ width: 64, padding: '4px 8px', borderRadius: 6, border: '1.5px solid var(--color-border)', background: 'var(--color-input-bg)', color: 'var(--color-text)' }}
            aria-label={t('dailyGoalSet')}
          />
        </div>
      </div>

    </div>
  );
}
