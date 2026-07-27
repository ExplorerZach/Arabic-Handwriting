import { useState } from 'react';
import { PAPER_THEMES, BRUSH_PACKS, getPaperColors, getBrushColor } from '../styles/themes';
import { getItem } from '../utils/storage';
import AuthForm from './AuthForm';
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
  dailyGoalInput,
  handleDailyGoalChange,
  handleDailyGoalBlur,
  onRevokeConsent,
  onWipeData,
  user,
  authLoading,
  onSignOut,
}) {
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wipeInput, setWipeInput] = useState('');
  const [wiped, setWiped] = useState(false);

  return (
    <div id="settings-panel" style={styles.keyPanel}>
      {/* ── Account ── */}
      <div style={styles.settingsSection} role="group">
        <span style={styles.settingsSectionTitle}>
          {user ? t('authSignedInAs') : t('authSectionToggle')}
        </span>
        {authLoading ? (
          // Session restore in flight — don't flash the sign-in form at a
          // user who is about to be signed in.
          <span
            style={{
              fontSize: 12,
              color: 'var(--color-text-muted)',
              marginTop: 4,
              display: 'block',
            }}
          >
            …
          </span>
        ) : user ? (
          <>
            <span
              style={{ fontSize: 13, color: 'var(--color-text)', marginTop: 4, display: 'block' }}
            >
              {user.email}
            </span>
            {onSignOut && (
              <button
                className="btn-panel"
                onClick={onSignOut}
                style={{
                  marginTop: 8,
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'Georgia,serif',
                }}
              >
                {t('authSignOut')}
              </button>
            )}
          </>
        ) : (
          <AuthForm t={t} compact />
        )}
      </div>
      <div style={styles.settingsDivider} />

      {/* ── Appearance ── */}
      <div
        style={styles.settingsSection}
        role="group"
        aria-labelledby="settings-heading-appearance"
      >
        <span id="settings-heading-appearance" style={styles.settingsSectionTitle}>
          {t('settingsSectionAppearance')}
        </span>
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
            onClick={() => setHighContrast(v => !v)}
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
        <span id="settings-heading-model" style={styles.settingsSectionTitle}>
          {t('settingsSectionModel')}
        </span>
        <select
          value={model}
          onChange={handleModelChange}
          style={{
            padding: '6px 8px',
            borderRadius: '8px',
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-input-bg)',
            fontSize: '13px',
            fontFamily: 'Georgia,serif',
            color: 'var(--color-text)',
            width: '100%',
          }}
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
        <span id="settings-heading-canvas" style={styles.settingsSectionTitle}>
          {t('settingsSectionCanvas')}
        </span>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--color-text-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {t('settingsTheme')}
          <div style={styles.themeRow}>
            {Object.values(PAPER_THEMES).map(theme => {
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
        <div
          style={{
            fontSize: '12px',
            color: 'var(--color-text-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {t('settingsBrush')}
          <div style={styles.brushRow}>
            {Object.values(BRUSH_PACKS).map(pack => {
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
        <span id="settings-heading-apikey" style={styles.settingsSectionTitle}>
          {t('settingsSectionApiKey')}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-soft)' }}>
          {t('settingsNote')}
        </span>
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
        <span id="settings-heading-data" style={styles.settingsSectionTitle}>
          {t('settingsSectionData')}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-soft)' }}>
          {t('settingsDataNote')}
        </span>
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
        <span id="settings-heading-goal" style={styles.settingsSectionTitle}>
          {t('dailyGoalTitle')}
        </span>
        <div style={styles.settingsRow}>
          <label style={{ fontSize: '12px', color: 'var(--color-text-soft)' }}>
            {t('dailyGoalSet')}
          </label>
          <input
            type="text"
            inputMode="numeric"
            min={1}
            max={50}
            value={dailyGoalInput}
            onChange={handleDailyGoalChange}
            onBlur={handleDailyGoalBlur}
            style={{
              width: 64,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1.5px solid var(--color-border)',
              background: 'var(--color-input-bg)',
              color: 'var(--color-text)',
            }}
            aria-label={t('dailyGoalSet')}
          />
        </div>
      </div>

      <div style={styles.settingsDivider} />

      {/* ── Privacy ── */}
      <div style={styles.settingsSection}>
        <a
          href="/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '13px',
            color: 'var(--color-text-muted)',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
        >
          {t('privacyLink')}
        </a>
        {getItem('ai_consent') === 'true' && onRevokeConsent && (
          <button
            className="btn-panel"
            onClick={onRevokeConsent}
            style={{
              marginTop: 12,
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'Georgia,serif',
            }}
          >
            {t('settingsRevokeConsent')}
          </button>
        )}
      </div>

      <div style={styles.settingsDivider} />

      {/* ── Delete all data ── */}
      <div style={styles.settingsSection}>
        {wiped ? (
          <span style={{ fontSize: '12px', color: 'var(--color-accent)' }}>{t('wipeSuccess')}</span>
        ) : showWipeConfirm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text)' }}>
              {t('settingsWipeConfirmTitle')}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-soft)' }}>
              {t('settingsWipeConfirmBody')}
            </span>
            <input
              type="text"
              value={wipeInput}
              onChange={e => setWipeInput(e.target.value)}
              placeholder={t('settingsWipeConfirmPlaceholder')}
              style={{
                padding: '6px 8px',
                borderRadius: 6,
                border: '1.5px solid var(--color-border)',
                background: 'var(--color-input-bg)',
                color: 'var(--color-text)',
                fontSize: 12,
                fontFamily: 'Georgia,serif',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-panel"
                disabled={wipeInput !== 'DELETE'}
                onClick={() => {
                  if (onWipeData) onWipeData();
                  setWiped(true);
                  setShowWipeConfirm(false);
                }}
                style={{
                  ...styles.keyPanelBtn,
                  flex: 1,
                  background:
                    wipeInput === 'DELETE' ? 'var(--color-accent)' : 'var(--color-border)',
                  color: '#fff',
                  opacity: wipeInput === 'DELETE' ? 1 : 0.5,
                  cursor: wipeInput === 'DELETE' ? 'pointer' : 'not-allowed',
                }}
              >
                {t('settingsWipeConfirmBtn')}
              </button>
              <button
                className="btn-panel"
                onClick={() => {
                  setShowWipeConfirm(false);
                  setWipeInput('');
                }}
                style={{
                  ...styles.keyPanelBtn,
                  flex: 1,
                  background: 'transparent',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'none',
                }}
              >
                {t('settingsWipeCancelBtn')}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn-panel"
            onClick={() => setShowWipeConfirm(true)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--color-accent)',
              background: 'transparent',
              color: 'var(--color-accent)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'Georgia,serif',
            }}
          >
            {t('settingsWipeData')}
          </button>
        )}
      </div>
    </div>
  );
}
