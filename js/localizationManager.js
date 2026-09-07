/**
 * localizationManager.js
 *
 * Responsibility: Key-based localization and LTR/RTL direction handling
 * (GDD §20). Implemented: Phase 15 (Localization) — Prompt 016.
 *
 * Like uiManager.js/modalManager.js, this is a presentation-layer module —
 * it touches `document` directly (root `lang`/`dir` attributes, plus any
 * static `[data-i18n]` element in index.html) and is explicitly NOT
 * "engine-independent" in the gameState.js/turnManager.js sense; the
 * reverse must hold instead: nothing in the rules layer may ever import
 * this file. Nothing in this module reads or writes GameState either —
 * locale is a pure presentation concern, orthogonal to gameplay state.
 *
 * data/localization.json is a single file holding BOTH locales' full
 * string trees (`en`/`fa`, each with its own `dir`) — there is nothing to
 * fetch again when switching languages, so every function below is
 * synchronous. main.js loads the file once at bootstrap (alongside
 * cards.json/gameConfig.json/iconMap.json, the same pattern every other
 * manager's own init() already uses) and hands the parsed object to this
 * module's init().
 *
 * Key lookup (`t()`) is a dotted path into the active locale's string
 * tree (e.g. "actions.exploreFurther" -> strings.actions.exploreFurther).
 * A key missing from the active locale falls back to English with a
 * logged warning; a key missing from EVERY locale logs an error and
 * returns an empty string — this module never renders a raw lookup key
 * to the player (a leaked "zones.treasureDeck" on screen is exactly the
 * silent-fallback bug tests/unit/localization.test.js's EN/FA symmetry
 * check exists to catch before it ever reaches this point).
 *
 * uiManager.js/modalManager.js never import each other (see their own
 * headers) and must not start importing THIS module's re-render targets
 * either, so locale changes reach them the same decoupled way GameState
 * changes already do: this module owns a tiny internal pub/sub (mirrors
 * gameState.js's own minimal implementation — no external library, no
 * browser EventTarget) and main.js is what subscribes uiManager.render/
 * modalManager.render to it, exactly as it already wires both of them to
 * `gameState.on('*', ...)` independently.
 *
 * Rules this module respects (GDD §30):
 *  - No hard-coded card names — cardTypes.* keys are looked up by a card
 *    definition's own `type` field, never a per-card branch.
 *  - UI never mutates GameState directly — this module never imports
 *    gameState.js at all.
 *  - No `alert`/`confirm`/`prompt` anywhere (rule 11).
 */

import { createLogger } from './logger.js';

const log = createLogger('localizationManager');

const FALLBACK_LOCALE = 'en';

// Populated once by init() — the full parsed data/localization.json,
// never mutated afterward, only read.
let localizationData = null;

let activeLocale = FALLBACK_LOCALE;

// Tiny internal pub/sub (mirrors gameState.js's own — see this module's
// header). Only one event ever fires here, so a plain Set of handlers is
// enough; no need for gameState.js's eventName->Set map.
const localeChangeListeners = new Set();

let switcherEl = null;

// ---------------------------------------------------------------------------
// Pure lookup helpers
// ---------------------------------------------------------------------------

/**
 * @param {string} langCode
 * @returns {object|null} that locale's full string tree (including its
 *   own `dir` key), or null if `langCode` isn't in the loaded data
 */
function getLocaleStrings(langCode) {
  return localizationData?.[langCode] ?? null;
}

/**
 * Resolves a dotted key ("zones.treasureDeck") against a string tree.
 * @param {object} strings
 * @param {string} key
 * @returns {string|undefined}
 */
function resolveKey(strings, key) {
  return key
    .split('.')
    .reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), strings);
}

/**
 * Replaces `{name}`-style placeholders in `str` with `params[name]`.
 * Any placeholder with no matching param is left untouched (visible in
 * dev, rather than silently vanishing) — a template key should always be
 * called with every placeholder it declares.
 * @param {string} str
 * @param {object} [params]
 * @returns {string}
 */
function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/**
 * Loads (looks up — see module header for why this never re-fetches) one
 * locale's strings + direction from the already-loaded localization data.
 * Falls back to English, with a logged warning, if `langCode` isn't a
 * locale this build ships.
 * @param {string} langCode
 * @returns {{strings: object, dir: 'ltr'|'rtl'}}
 */
function loadLocale(langCode) {
  const strings = getLocaleStrings(langCode);
  if (strings) {
    return { strings, dir: strings.dir === 'rtl' ? 'rtl' : 'ltr' };
  }

  log.warn(`loadLocale: unknown locale "${langCode}" — falling back to "${FALLBACK_LOCALE}"`);
  const fallbackStrings = getLocaleStrings(FALLBACK_LOCALE);
  return { strings: fallbackStrings ?? {}, dir: fallbackStrings?.dir === 'rtl' ? 'rtl' : 'ltr' };
}

/**
 * Translates a dotted key against the active locale, falling back to
 * English (logged) if missing there, and to an empty string (logged as
 * an error — this means the EN/FA symmetry test should have caught it)
 * if missing everywhere. Never throws, never returns the raw key.
 * @param {string} key - dotted path, e.g. "actions.exploreFurther"
 * @param {object} [params] - values for any `{placeholder}` tokens
 * @returns {string}
 */
function t(key, params) {
  const activeStrings = getLocaleStrings(activeLocale);
  let value = activeStrings ? resolveKey(activeStrings, key) : undefined;

  if (typeof value !== 'string' && activeLocale !== FALLBACK_LOCALE) {
    log.warn(`t: missing key "${key}" in locale "${activeLocale}" — falling back to "${FALLBACK_LOCALE}"`);
    const fallbackStrings = getLocaleStrings(FALLBACK_LOCALE);
    value = fallbackStrings ? resolveKey(fallbackStrings, key) : undefined;
  }

  if (typeof value !== 'string') {
    log.error(`t: missing key "${key}" in every locale — rendering an empty string`);
    return '';
  }

  return interpolate(value, params);
}

/**
 * Locale-aware number formatting (GDD §20: "Number and score formatting
 * should also pass through the localization layer") — Persian renders
 * Eastern Arabic-Indic digits (۰۱۲۳...) via `Intl.NumberFormat('fa-IR')`,
 * English renders ordinary digits, so callers never need their own
 * per-locale digit logic.
 * @param {number} value
 * @returns {string}
 */
function formatNumber(value) {
  const intlLocale = activeLocale === 'fa' ? 'fa-IR' : 'en-US';
  return new Intl.NumberFormat(intlLocale).format(value);
}

function getActiveLocale() {
  return activeLocale;
}

function getDir() {
  return getLocaleStrings(activeLocale)?.dir === 'rtl' ? 'rtl' : 'ltr';
}

// ---------------------------------------------------------------------------
// DOM-touching functions (document.documentElement, [data-i18n], the
// language switcher) — everything above this line is pure and needs no
// `document` at all.
// ---------------------------------------------------------------------------

/**
 * Updates every static `[data-i18n="key"]` element's textContent (e.g.
 * the orientation gate's rotate-device prompt in index.html) and every
 * `[data-i18n-aria-label="key"]` element's aria-label (e.g. the language
 * switcher's own accessible name) — the one category of UI text/labeling
 * that lives OUTSIDE uiManager.js/modalManager.js's own re-render loops,
 * since it's markup that's already in index.html rather than something
 * either module ever creates.
 */
function refreshStaticStrings() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
  });
}

/**
 * Re-marks whichever `[data-lang]` button in the switcher matches the
 * active locale, so the visible toggle always reflects reality.
 */
function refreshSwitcherState() {
  if (!switcherEl) return;
  switcherEl.querySelectorAll('[data-lang]').forEach((button) => {
    const isActive = button.getAttribute('data-lang') === activeLocale;
    button.classList.toggle('lang-button--active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

/**
 * Switches the active locale: updates `document.documentElement.lang`/
 * `.dir` (GDD §20: en -> ltr, fa -> rtl), refreshes every static
 * `[data-i18n]` element and the language switcher's own active state,
 * then emits "locale-changed" so uiManager.js/modalManager.js (wired up
 * by main.js) re-render every DYNAMIC string without a full page reload.
 * @param {string} langCode
 */
function setLocale(langCode) {
  const { dir } = loadLocale(langCode);
  activeLocale = getLocaleStrings(langCode) ? langCode : FALLBACK_LOCALE;

  document.documentElement.lang = activeLocale;
  document.documentElement.dir = dir;

  refreshStaticStrings();
  refreshSwitcherState();

  for (const handler of localeChangeListeners) {
    handler({ locale: activeLocale, dir });
  }

  log.info('Locale changed', { locale: activeLocale, dir });
}

/**
 * @param {(detail: {locale: string, dir: string}) => void} handler
 * @returns {() => void} unsubscribe function
 */
function onLocaleChange(handler) {
  localeChangeListeners.add(handler);
  return () => localeChangeListeners.delete(handler);
}

/**
 * Wires up the EN/FA toggle already present in index.html
 * (`#language-switcher`, one `[data-lang]` button per locale) — a simple
 * toggle is enough for MVP per the prompt's own scope; placement/styling
 * is refined in Stage D polish. Reads `data-lang` off each button
 * generically rather than hard-coding "en"/"fa" branches, so adding a
 * third locale later only means adding a button + a data/localization.json
 * block, never touching this function.
 *
 * Locale switching has no gameplay-state dependency at all (unlike
 * Explore Further/Return to Ship/target selection), so — unlike every
 * real game action — this deliberately bypasses inputManager.js's
 * gameManager-routing seam and calls setLocale() directly; there is no
 * GameState guard it could ever violate.
 */
function mountSwitcher() {
  switcherEl = document.getElementById('language-switcher');
  if (!switcherEl) {
    log.warn('mountSwitcher: #language-switcher is missing from index.html — no switcher to wire up');
    return;
  }

  switcherEl.querySelectorAll('[data-lang]').forEach((button) => {
    button.addEventListener('click', () => setLocale(button.getAttribute('data-lang')));
  });
}

/**
 * @param {object} localizationDataParam - parsed data/localization.json
 * @param {string} [initialLocale] - defaults to English
 */
function init(localizationDataParam, initialLocale = FALLBACK_LOCALE) {
  localizationData = localizationDataParam;
  mountSwitcher();
  setLocale(initialLocale);
  log.info('localizationManager mounted');
}

export {
  init,
  loadLocale,
  t,
  setLocale,
  getActiveLocale,
  getDir,
  formatNumber,
  onLocaleChange,
};

export default {
  init,
  loadLocale,
  t,
  setLocale,
  getActiveLocale,
  getDir,
  formatNumber,
  onLocaleChange,
};
