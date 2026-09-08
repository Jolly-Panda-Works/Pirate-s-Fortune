/**
 * audioManager.js
 *
 * Responsibility: Audio event handling and mute support (GDD §23).
 * Implemented: Phase 18 (Audio) — Prompt 019.
 *
 * GDD §23's six sound categories, and how each one is triggered:
 *   1. Card reveal      — gameState "EXPEDITION_AREA_CARD_ADDED"
 *   2. Shipwreck         — gameState "PHASE_CHANGED" -> SHIPWRECK
 *   3. Return to Ship    — gameState "PHASE_CHANGED" -> RETURN_TO_SHIP
 *   4. Ability trigger   — explicit playAbility(abilityKey) call (see below)
 *   5. Special ability   — explicit playAbility(abilityKey) call (see below)
 *   6. Game completion   — gameState "RESULTS_SET"
 *
 * ARCHITECTURE DECISION — why 4 of 6 are pure gameState subscriptions but
 * 2 are not, and how "ability trigger" vs "special ability" is decided.
 * ---------------------------------------------------------------------
 * The prompt that commissioned this module says playback should be
 * "event-driven ... tied to gameplay events from gameState.js". For
 * reveal/Shipwreck/Return to Ship/game completion that's followed
 * literally: this module's init() below does nothing but
 * `gameState.on(...)` — turnManager.js needed ZERO changes for those four
 * categories, exactly like the prompt's own wording implies.
 *
 * "Ability trigger" and "special ability" can't work the same way: unlike
 * the other four, gameState.js's own emitted events never carry WHICH
 * ability just resolved (only compass.js ever calls
 * gameState.setAbilityContext(), and only for its own preview panel — see
 * that module) — there is no generic "an ability resolved, here's its
 * key" event to subscribe to. animationManager.js (Prompt 018) hit this
 * exact same gap for its own playAbilityTrigger() and solved it the same
 * way this module does: turnManager.js's finishResolveAbility() already
 * fire-and-forgets an explicit animationManager call at the one place
 * that genuinely knows the ability key; this module's playAbility() is
 * called from that SAME call site (see turnManager.js), never from a
 * gameState subscription.
 *
 * The GDD lists "Ability trigger" and "Special ability" as two distinct
 * categories but never defines the split. Rather than inventing a new
 * taxonomy, playAbility() classifies purely off data this codebase
 * already ships for exactly this purpose — gameConfig.json's
 * `abilities.singleResolution` (Compass/Cannon/Captain Shield — resolves
 * once, no follow-on) vs `abilities.chain` (Pirate Dagger/Lucky
 * Anchor/Sea Serpent/Treasure Map/Treasure Chest+Golden Key — can chain
 * into further resolutions via the Resolution Queue, GDD §12/§13) —
 * exactly the distinction "ability trigger" (a simple one-shot effect)
 * vs "special ability" (a more elaborate chained effect) most naturally
 * maps to. This is a config lookup, never a hard-coded ability-key
 * branch (rule 4) — a NEW ability only ever needs adding to
 * gameConfig.json's existing singleResolution/chain arrays (already
 * required for gameplay to work at all) for its sound category to be
 * correct automatically.
 *
 * Mute (GDD §23 "Audio must be muteable"):
 *  - Persisted to localStorage under a namespaced key (see
 *    MUTE_STORAGE_KEY below) — no saveManager.js exists yet (that's
 *    Prompt 020, right after this one), so this is the "simple
 *    standalone persisted flag" option the prompt explicitly allows.
 *    Namespaced (`pirateFortune.*`) so saveManager.js can later adopt
 *    the same prefix for its own keys without a collision.
 *  - "actually stops all playback, not just future sounds" (the
 *    prompt's own exit criteria) is implemented via `activeAudioEls`, a
 *    registry of every currently-in-flight HTMLAudioElement — setMuted
 *    (true) pauses every one of them immediately, not merely gating
 *    future play() calls.
 *
 * Rules this module respects (GDD §30):
 *  - No hard-coded card names — dispatch is by ability KEY only
 *    (playAbility(abilityKey)), classified via gameConfig.json data, not
 *    a per-card or per-ability-name branch.
 *  - UI never mutates GameState directly — this module only ever READS
 *    gameState (subscribing to its events); it never calls a single
 *    gameState mutator.
 *  - Defensive by construction: every function touching `document`/
 *    `Audio`/`localStorage` guards its availability first and no-ops
 *    otherwise, so importing/calling this module is always safe from a
 *    plain Node test with no DOM/Audio/localStorage at all.
 */

import { createLogger } from './logger.js';
import * as gameState from './gameState.js';
import * as localizationManager from './localizationManager.js';

const log = createLogger('audioManager');

const MUTE_STORAGE_KEY = 'pirateFortune.audioMuted';

// Populated once by init() — parsed data/audioMap.json, never mutated
// afterward, only read (mirrors iconManager.js's own `iconMap`).
let audioMap = null;

// Populated once by init() — parsed data/gameConfig.json, read only for
// `abilities.singleResolution` / `abilities.chain` (see header above).
let gameConfig = null;

let muted = false;

// Every HTMLAudioElement currently playing or pending playback, so
// setMuted(true) can stop genuinely in-flight sound, not just gate
// future play() calls (see header). Cleared as each element finishes.
const activeAudioEls = new Set();

let muteButtonEl = null;
let unsubscribeGameState = null;

// ---------------------------------------------------------------------------
// Mute persistence — every localStorage touch guarded (private-browsing /
// storage-disabled contexts must never throw or break audio entirely).
// ---------------------------------------------------------------------------

function readPersistedMuted() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch (err) {
    log.warn('readPersistedMuted: localStorage unavailable, defaulting to unmuted', err);
    return false;
  }
}

function persistMuted(value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, String(value));
  } catch (err) {
    log.warn('persistMuted: localStorage unavailable, mute state will not survive reload', err);
  }
}

// ---------------------------------------------------------------------------
// Core playback — every function below guards `Audio`'s availability, so
// this module is always safe to import/call from a plain Node test.
// ---------------------------------------------------------------------------

/**
 * @param {string} soundKey - a key in data/audioMap.json
 */
function playSound(soundKey) {
  if (muted) return;
  if (!audioMap) {
    log.warn('playSound called before init()');
    return;
  }
  if (typeof Audio === 'undefined') return; // headless/Node — no-op

  const entry = audioMap[soundKey];
  if (!entry?.file) {
    log.warn(`playSound: no audioMap entry for "${soundKey}"`);
    return;
  }

  let el;
  try {
    el = new Audio(entry.file);
    el.volume = typeof entry.volume === 'number' ? entry.volume : 1;
  } catch (err) {
    log.warn(`playSound: failed to construct Audio for "${soundKey}"`, err);
    return;
  }

  activeAudioEls.add(el);
  const cleanup = () => activeAudioEls.delete(el);
  el.addEventListener('ended', cleanup);
  el.addEventListener('error', cleanup);

  const playResult = el.play();
  // HTMLMediaElement.play() returns a Promise in real browsers; guard
  // for test/mocked environments where it might not.
  if (playResult && typeof playResult.catch === 'function') {
    playResult.catch((err) => {
      // Autoplay-policy rejection or similar — never let this surface as
      // an unhandled rejection or break gameplay.
      log.debug(`playSound: playback rejected for "${soundKey}"`, err?.message);
      cleanup();
    });
  }
}

/**
 * Immediately silences every currently in-flight sound (see header —
 * this is what makes mute "actually stop all playback", not just gate
 * future sounds).
 */
function stopAllPlayback() {
  for (const el of activeAudioEls) {
    try {
      el.pause();
      el.currentTime = 0;
    } catch (err) {
      log.debug('stopAllPlayback: failed to stop an element', err?.message);
    }
  }
  activeAudioEls.clear();
}

// ---------------------------------------------------------------------------
// Semantic trigger functions — one per GDD §23 category.
// ---------------------------------------------------------------------------

function playReveal() {
  playSound('reveal');
}

function playShipwreck() {
  playSound('shipwreck');
}

function playReturnToShip() {
  playSound('returnToShip');
}

function playGameEnd() {
  playSound('gameEnd');
}

/**
 * The explicit call site for "ability trigger" / "special ability"
 * (see this module's header for why these two can't be pure gameState
 * subscriptions, and how the split is decided). Called by
 * turnManager.js's finishResolveAbility() — the same place
 * animationManager.playAbilityTrigger() is already called from — with
 * the ability key alone (rule 4: never a card name).
 * @param {string} abilityKey - e.g. "cannon", "pirateDagger"
 */
function playAbility(abilityKey) {
  const isChain = gameConfig?.abilities?.chain?.includes(abilityKey);
  playSound(isChain ? 'specialAbility' : 'abilityTrigger');
}

// ---------------------------------------------------------------------------
// gameState subscription — the four categories that genuinely are pure
// "event-driven playback tied to gameplay events from gameState.js".
// ---------------------------------------------------------------------------

/**
 * @param {{type: string, detail: object}} event - gameState.js's own
 *   wildcard event shape (see gameState.js's emit())
 */
function handleGameStateEvent(event) {
  switch (event.type) {
    case 'EXPEDITION_AREA_CARD_ADDED':
      playReveal();
      return;
    case 'PHASE_CHANGED':
      if (event.detail.phase === gameState.PHASES.SHIPWRECK) {
        playShipwreck();
      } else if (event.detail.phase === gameState.PHASES.RETURN_TO_SHIP) {
        playReturnToShip();
      }
      return;
    case 'RESULTS_SET':
      playGameEnd();
      return;
    default:
      return;
  }
}

// ---------------------------------------------------------------------------
// Mute state + UI
// ---------------------------------------------------------------------------

function isMuted() {
  return muted;
}

/**
 * @param {boolean} value
 */
function setMuted(value) {
  muted = Boolean(value);
  persistMuted(muted);
  if (muted) stopAllPlayback();
  refreshMuteButtonState();
  log.info(`Audio ${muted ? 'muted' : 'unmuted'}`);
}

function toggleMute() {
  setMuted(!muted);
}

/**
 * Unlike every other `[data-i18n]` element (refreshed only on a locale
 * change, by localizationManager.js's own refreshStaticStrings()), this
 * button's label must ALSO change on every mute toggle, independent of
 * locale — so this function sets both the `data-i18n` key (so a
 * subsequent locale change still finds the right string) AND the
 * textContent directly (via localizationManager.t(), read-only — this
 * module never subscribes to locale changes, it just looks a string up
 * on demand, exactly like uiManager.js/modalManager.js already do for
 * every dynamic string they render).
 */
function refreshMuteButtonState() {
  if (!muteButtonEl) return;
  muteButtonEl.classList.toggle('mute-button--active', muted);
  muteButtonEl.setAttribute('aria-pressed', String(muted));
  const key = muted ? 'audio.unmuteButton' : 'audio.muteButton';
  muteButtonEl.setAttribute('data-i18n', key);
  muteButtonEl.textContent = localizationManager.t(key);
}

/**
 * Wires up the mute toggle already present in index.html
 * (`#audio-controls`, one button), mirroring
 * localizationManager.js's mountSwitcher() — a presentation-only toggle
 * with no GameState dependency, so (like locale switching) it bypasses
 * inputManager.js's gameManager-routing seam and calls setMuted()/
 * toggleMute() directly.
 */
function mountMuteToggle() {
  if (typeof document === 'undefined') return;

  muteButtonEl = document.getElementById('audio-mute-toggle');
  if (!muteButtonEl) {
    log.warn('mountMuteToggle: #audio-mute-toggle is missing from index.html — no toggle to wire up');
    return;
  }

  muteButtonEl.addEventListener('click', toggleMute);
  refreshMuteButtonState();
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * @param {object} config - parsed data/gameConfig.json
 * @param {object} loadedAudioMap - parsed data/audioMap.json
 */
function init(config, loadedAudioMap) {
  gameConfig = config ?? null;
  audioMap = loadedAudioMap ?? null;
  muted = readPersistedMuted();

  unsubscribeGameState = gameState.on('*', handleGameStateEvent);
  mountMuteToggle();

  log.info('audioManager mounted', { muted });
}

/**
 * Testing-only: clears every module-level mutable variable back to its
 * just-imported defaults and unsubscribes from gameState — mirrors
 * animationManager.js's own resetForTesting() (added there after real
 * cross-test leakage surfaced; applied here proactively for the same
 * reason). Real app code never calls this.
 */
function resetForTesting() {
  if (unsubscribeGameState) {
    unsubscribeGameState();
    unsubscribeGameState = null;
  }
  audioMap = null;
  gameConfig = null;
  muted = false;
  activeAudioEls.clear();
  muteButtonEl = null;
}

export {
  init,
  resetForTesting,
  handleGameStateEvent,
  playReveal,
  playShipwreck,
  playReturnToShip,
  playGameEnd,
  playAbility,
  isMuted,
  setMuted,
  toggleMute,
};

export default {
  init,
  resetForTesting,
  handleGameStateEvent,
  playReveal,
  playShipwreck,
  playReturnToShip,
  playGameEnd,
  playAbility,
  isMuted,
  setMuted,
  toggleMute,
};
