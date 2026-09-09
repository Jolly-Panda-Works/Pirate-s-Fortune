/**
 * saveManager.js
 *
 * Responsibility: GameState serialization/restoration (GDD §24). Engine-
 * layer and DOM-free by design (GDD §18.2 lists this module's scope as
 * "GameState serialization/restoration" only — unlike
 * localizationManager.js/audioManager.js/animationManager.js, this one
 * owns no DOM element and renders nothing; the "resume game" BUTTON
 * itself is main.js's/uiManager.js's concern, not this module's — see
 * main.js's own bootstrap() for that wiring).
 * Implemented: Phase 20 (Save System) — Prompt 020.
 *
 * serialize()/restore() (GDD §24's own two named entry points):
 *  - serialize() calls gameState.getStateSnapshot() — a selector that
 *    already existed (added ahead of time by Prompt 002, its own doc
 *    comment says "for saveManager.js (Phase 20)") — never reaches into
 *    gameState.js's internals, exactly as the prompt requires. The
 *    result is wrapped in a small versioned envelope (`schemaVersion`,
 *    `savedAt`) so a future format change has somewhere to branch
 *    without breaking an old save outright.
 *  - restore(saveFile) calls gameState.restoreStateSnapshot() — the
 *    write-side counterpart added alongside this prompt (see that
 *    function's own doc comment in gameState.js for why a restore is one
 *    atomic replace-and-emit-once, not a series of individual setter
 *    calls). Validates the envelope shape first and never throws on
 *    malformed/corrupted data — a bad save must never crash the app, it
 *    should just fail to restore.
 *
 * Save-gating (GDD §24 "Saving should occur at discrete safe states
 * rather than during the middle of an active ability chain"):
 * save() delegates the actual "is now safe?" decision entirely to
 * turnManager.isSafeToSave() — this module never re-derives or
 * duplicates that phase logic itself (turnManager.js is the one module
 * that actually owns the state-machine shape/pause-point knowledge; see
 * that function's own extensive header for exactly which phases are
 * genuinely safe and why).
 *
 * Auto-save (this module's own design decision — the prompt allows any
 * reasonable trigger, it only mandates the GATE): save() is called
 * automatically from a `gameState.on('*', ...)` wildcard subscription,
 * mirroring animationManager.js's and audioManager.js's own identical
 * pattern — no polling, no manual "Save" button required for MVP. This
 * is also WHY the gate above has real work to do: unlike a UI button
 * click (which can only ever observe a phase the state machine is
 * genuinely resting at), a wildcard gameState subscriber is invoked
 * synchronously at literally every intermediate phase change too (see
 * turnManager.isSafeToSave()'s own header) — isSafeToSave() is what
 * silently no-ops every one of those, so only a real "at rest" moment
 * ever actually reaches localStorage.
 *
 * init() is deliberately NOT wired before the very first startGame()
 * call in main.js (unlike animationManager.js/audioManager.js, which
 * both need to be wired first to cover a fresh game's very first turn's
 * own presentation effects) — see main.js's own bootstrap() comment for
 * why: wiring the auto-save subscription only AFTER a fresh default
 * game's initial synchronous cascade already completed means that
 * cascade's own phase changes are never auto-saved, so a returning
 * player's PREVIOUS save is never silently overwritten before they've
 * had a chance to see/use the "Resume Game" affordance.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs beyond `localStorage`,
 *    which — like audioManager.js's own identical use of it for mute
 *    persistence — is presentation-layer persistence, not gameplay
 *    logic; every `localStorage` touch is guarded, so this module is
 *    still always safe to import/call from a plain Node test).
 *  - No hard-coded card names — this module never inspects a card at
 *    all; it only ever round-trips gameState.js's own opaque snapshot
 *    shape unchanged.
 *  - UI never mutates GameState directly — N/A in the usual sense (this
 *    IS the sanctioned engine-layer path GameState gets bulk-restored
 *    through), but this module still never reaches into gameState.js's
 *    private `state` — only its two dedicated public
 *    selector/mutator functions.
 */

import { createLogger } from './logger.js';
import * as gameState from './gameState.js';
import * as turnManager from './turnManager.js';

const log = createLogger('saveManager');

const STORAGE_KEY = 'pirateFortune.save';
const SCHEMA_VERSION = 1;

let unsubscribeGameState = null;

// ---------------------------------------------------------------------------
// localStorage access — every touch guarded (private-browsing/storage-
// disabled contexts must never throw or crash gameplay).
// ---------------------------------------------------------------------------

function readRaw() {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    log.warn('readRaw: localStorage unavailable', err);
    return null;
  }
}

function writeRaw(json) {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch (err) {
    log.warn('writeRaw: localStorage unavailable — save will not persist', err);
    return false;
  }
}

function removeRaw() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    log.warn('removeRaw: localStorage unavailable', err);
  }
}

// ---------------------------------------------------------------------------
// serialize() / restore() — GDD §24's own two named operations.
// ---------------------------------------------------------------------------

/**
 * Produces a JSON-safe snapshot of the full GameState, via
 * gameState.js's own selector (never by reaching into internals — see
 * this module's header).
 * @returns {{schemaVersion: number, savedAt: string, gameState: object}}
 */
function serialize() {
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    gameState: gameState.getStateSnapshot(),
  };
}

/**
 * @param {unknown} saveFile - expected shape: whatever serialize() above
 *   produces (or whatever readRaw()+JSON.parse() yielded from
 *   localStorage) — validated defensively since it may have come from
 *   outside this session entirely (a stale/corrupted localStorage entry,
 *   a hand-edited value, an older schema version).
 * @returns {boolean} whether the restore actually happened
 */
function restore(saveFile) {
  if (!saveFile || typeof saveFile !== 'object' || typeof saveFile.gameState !== 'object' || saveFile.gameState === null) {
    log.warn('restore: malformed save data — refusing to restore', { saveFile });
    return false;
  }
  if (saveFile.schemaVersion !== SCHEMA_VERSION) {
    log.warn(
      `restore: schemaVersion mismatch (save is v${saveFile.schemaVersion}, this build expects v${SCHEMA_VERSION}) — attempting anyway`
    );
  }
  gameState.restoreStateSnapshot(saveFile.gameState);
  return true;
}

// ---------------------------------------------------------------------------
// localStorage-backed save / load / resume — the MVP web persistence
// layer (GDD §24: "The Web MVP uses local persistence").
// ---------------------------------------------------------------------------

/**
 * Writes the current GameState to localStorage, but ONLY when
 * turnManager.isSafeToSave() says the state machine is genuinely at
 * rest (GDD §24) — every call, whether from the auto-save subscription
 * below or called directly, goes through this same gate.
 * @returns {boolean} true if a save actually happened
 */
function save() {
  if (!turnManager.isSafeToSave()) {
    log.debug('save: skipped — not at a safe state', { phase: gameState.getPhase() });
    return false;
  }
  if (gameState.getPlayers().length === 0) {
    log.debug('save: skipped — no game in progress');
    return false;
  }

  const saveFile = serialize();
  const written = writeRaw(JSON.stringify(saveFile));
  if (written) {
    log.info('Game saved', { phase: saveFile.gameState.phase, savedAt: saveFile.savedAt });
  }
  return written;
}

/**
 * Reads and parses whatever is currently in localStorage, without
 * restoring it — useful for e.g. showing "last saved at ..." before the
 * player commits to resuming. Never throws on corrupted JSON.
 * @returns {object|null}
 */
function loadRaw() {
  const raw = readRaw();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    log.warn('loadRaw: stored save data is not valid JSON — treating as no save', err);
    return null;
  }
}

/**
 * @returns {boolean} whether a (structurally valid) save currently
 *   exists — this is what main.js checks to decide whether to show the
 *   "Resume Game" affordance (GDD §24's own deliverable).
 */
function hasSave() {
  const parsed = loadRaw();
  return Boolean(parsed && typeof parsed.gameState === 'object' && parsed.gameState !== null);
}

/**
 * The "resume game" affordance's actual action (GDD §24 deliverable):
 * loads whatever is in localStorage and restores it in one step.
 * @returns {boolean} whether the resume actually happened
 */
function resumeGame() {
  const parsed = loadRaw();
  if (!parsed) {
    log.warn('resumeGame: no save to resume');
    return false;
  }
  return restore(parsed);
}

/**
 * Deletes the current save, if any. Not required by the prompt's own
 * exit criteria, but a reasonable small addition: without it, a save
 * from a finished (SCORING) game would linger forever, offering a
 * confusing "Resume Game" back into an already-decided game.
 */
function clearSave() {
  removeRaw();
}

// ---------------------------------------------------------------------------
// Auto-save subscription (this module's own design decision — see
// header for why gating makes this safe to wire unconditionally).
// ---------------------------------------------------------------------------

function handleGameStateEvent() {
  save();
}

/**
 * Wires the auto-save subscription. See this module's own header for
 * why main.js deliberately calls this AFTER the first startGame(), not
 * before (unlike animationManager.js/audioManager.js).
 */
function init() {
  unsubscribeGameState = gameState.on('*', handleGameStateEvent);
  log.info('saveManager mounted (auto-save active)');
}

/**
 * Testing-only: unsubscribes from gameState so a stale listener never
 * leaks into the next test — mirrors animationManager.js's/
 * audioManager.js's own resetForTesting(). Real app code never calls
 * this.
 */
function resetForTesting() {
  if (unsubscribeGameState) {
    unsubscribeGameState();
    unsubscribeGameState = null;
  }
}

export {
  serialize,
  restore,
  save,
  loadRaw,
  hasSave,
  resumeGame,
  clearSave,
  init,
  resetForTesting,
};

export default {
  serialize,
  restore,
  save,
  loadRaw,
  hasSave,
  resumeGame,
  clearSave,
  init,
  resetForTesting,
};
