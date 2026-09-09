/**
 * gameState.js
 *
 * Responsibility: Owns GameState (single source of truth) and controlled
 * mutators. Implemented: Phase 2 (Game State) — Prompt 002.
 *
 * GDD §6 shape (extended beyond the doc's literal listing by later
 * prompts — noted individually below):
 *   GameState
 *   ├── phase
 *   ├── treasureDeck
 *   ├── lostLoot
 *   ├── expeditionArea
 *   ├── shieldActive   (Prompt 010, GDD §14.3 — Captain Shield's
 *   │                    expedition-scoped protection flag)
 *   ├── players[]
 *   ├── currentPlayerIndex
 *   ├── turnHistory
 *   ├── abilityContext
 *   ├── pendingAbilityChoice   (Prompt 014, GDD §14.2/14.4/14.5/14.7 —
 *   │                            a human-facing target-selection request
 *   │                            "Cannon/Pirate Dagger/Lucky Anchor/
 *   │                            Treasure Map" pauses on; null whenever
 *   │                            no choice is currently pending)
 *   ├── config
 *   └── results         (Prompt 008, GDD §11 — final scoring outcome)
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - No hard-coded card names — this module never inspects card identity.
 *  - UI never mutates GameState directly (rule 5) — enforced here by never
 *    exporting the raw state object, only selectors (which return deep
 *    copies) and named mutators.
 *  - Every mutation emits an event (GDD §6.1) so future UI/animation/audio
 *    systems can react without polling — implemented as a tiny internal
 *    pub/sub, no external library, no browser EventTarget dependency.
 *
 * Phase 20 (Prompt 020 — Save System): getStateSnapshot()/
 * restoreStateSnapshot() (near the bottom of this file) are the read/write
 * pair saveManager.js round-trips through browser-side persistence — see
 * restoreStateSnapshot()'s own doc comment for why a restore is one
 * atomic replace-and-emit-once rather than a series of individual setter
 * calls.
 */

import { createLogger } from './logger.js';

const log = createLogger('gameState');

/**
 * Controlled vocabulary for GameState.phase (GDD §7 state machine).
 * turnManager.js (Phase 4) drives transitions between these; this module
 * only stores whichever phase it's told to store.
 */
const PHASES = Object.freeze({
  GAME_INIT: 'GAME_INIT',
  PLAYER_TURN_START: 'PLAYER_TURN_START',
  DRAW_CARD: 'DRAW_CARD',
  REVEAL_CARD: 'REVEAL_CARD',
  CHECK_DUPLICATE: 'CHECK_DUPLICATE',
  SHIPWRECK: 'SHIPWRECK',
  RESOLVE_ABILITY: 'RESOLVE_ABILITY',
  PLAYER_CHOICE: 'PLAYER_CHOICE',
  PLAYER_DECISION: 'PLAYER_DECISION',
  RETURN_TO_SHIP: 'RETURN_TO_SHIP',
  END_TURN: 'END_TURN',
  GAME_END: 'GAME_END',
  SCORING: 'SCORING',
});

function createInitialState() {
  return {
    phase: PHASES.GAME_INIT,
    treasureDeck: [],
    lostLoot: [],
    expeditionArea: [],
    shieldActive: false,
    players: [],
    currentPlayerIndex: 0,
    turnHistory: [],
    abilityContext: null,
    pendingAbilityChoice: null,
    config: null,
    results: null,
  };
}

// Module-private state object. NEVER exported directly — see selectors below.
let state = createInitialState();

// ---------------------------------------------------------------------------
// Minimal internal pub/sub (no external library, no browser EventTarget —
// rule 1/12). Every mutator below calls emit() exactly once, after the
// mutation is applied, so listeners always observe the post-mutation state
// if they call a selector from within the handler.
// ---------------------------------------------------------------------------

const listeners = new Map(); // eventName -> Set<handler>
const WILDCARD = '*';

function on(eventName, handler) {
  if (typeof handler !== 'function') {
    throw new Error('gameState.on: handler must be a function');
  }
  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
  }
  listeners.get(eventName).add(handler);
  return () => off(eventName, handler);
}

function off(eventName, handler) {
  listeners.get(eventName)?.delete(handler);
}

function emit(eventName, detail) {
  const event = Object.freeze({ type: eventName, detail, timestamp: Date.now() });
  for (const handler of listeners.get(eventName) ?? []) {
    handler(event);
  }
  for (const handler of listeners.get(WILDCARD) ?? []) {
    handler(event);
  }
  log.debug(`event emitted: ${eventName}`, detail);
}

/**
 * Removes every registered listener. Intended for test teardown only —
 * real gameplay code should never need to clear other systems' listeners.
 */
function clearAllListeners() {
  listeners.clear();
}

// ---------------------------------------------------------------------------
// Deep-copy helper. GameState only ever holds plain JSON-serializable data
// (definitions/instances/plain player records), so JSON round-tripping is a
// safe, dependency-free deep clone — this is what guarantees selectors
// never leak a mutable reference back into caller code.
// ---------------------------------------------------------------------------

function clone(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Selectors — every one returns a deep copy, never the live reference.
// ---------------------------------------------------------------------------

function getPhase() {
  return state.phase;
}

function getConfig() {
  return clone(state.config);
}

function getTreasureDeck() {
  return clone(state.treasureDeck);
}

function getLostLoot() {
  return clone(state.lostLoot);
}

function getExpeditionArea() {
  return clone(state.expeditionArea);
}

function getPlayers() {
  return clone(state.players);
}

function getPlayer(playerId) {
  const found = state.players.find((p) => p.id === playerId);
  return found ? clone(found) : null;
}

function getCurrentPlayerIndex() {
  return state.currentPlayerIndex;
}

function getCurrentPlayer() {
  const current = state.players[state.currentPlayerIndex];
  return current ? clone(current) : null;
}

function getTurnHistory() {
  return clone(state.turnHistory);
}

function getAbilityContext() {
  return clone(state.abilityContext);
}

/**
 * GDD §14.2/14.4/14.5/14.7 (Prompt 014): the target-selection request a
 * targeted ability (Cannon/Pirate Dagger/Lucky Anchor/Treasure Map) is
 * currently paused on, or null if nothing is pending. Shape is the
 * caller's (turnManager.js's) responsibility — this module only stores/
 * clones/emits, matching every other mutator here.
 */
function getPendingAbilityChoice() {
  return clone(state.pendingAbilityChoice);
}

/**
 * GDD §11 final scoring results, set once by scoreManager's caller
 * (turnManager.js's scoring() step) when the Treasure Deck empties.
 * null until the game actually reaches SCORING.
 */
function getResults() {
  return clone(state.results);
}

/**
 * GDD §14.3: whether Captain Shield's one-time, expedition-scoped
 * protection is currently active (see js/abilities/captainShield.js for
 * when it's set, and turnManager.js's checkDuplicate() for how it's
 * consumed). Always false at the start of a fresh expedition —
 * clearExpeditionArea() resets it unconditionally.
 */
function getShieldActive() {
  return state.shieldActive;
}

/**
 * Full read-only snapshot of GameState — for saveManager.js (Phase 20) and
 * debugging/logging only. Still a deep copy; mutating the result has no
 * effect on the real state.
 */
function getStateSnapshot() {
  return clone(state);
}

// ---------------------------------------------------------------------------
// Mutators — the ONLY way GameState may change. Every one applies its
// change to the module-private `state`, then emits an event.
// ---------------------------------------------------------------------------

/**
 * Resets GameState to a fresh GAME_INIT shape and optionally seeds it with
 * a config and/or a player list. Intended to be called once per new game
 * (and by tests, between scenarios).
 *
 * @param {{config?: object, players?: Array<object>}} [options]
 */
function initState({ config, players } = {}) {
  state = createInitialState();
  if (config !== undefined) state.config = clone(config);
  if (players !== undefined) state.players = clone(players);
  emit('INIT_STATE', { config: clone(state.config), players: clone(state.players) });
}

/**
 * Hard reset with no seeding — mainly for test isolation between cases.
 */
function resetState() {
  state = createInitialState();
  emit('RESET_STATE', {});
}

function setPhase(phase) {
  if (!Object.values(PHASES).includes(phase)) {
    log.warn(`setPhase: unrecognized phase "${phase}" — storing it anyway`);
  }
  const previousPhase = state.phase;
  state.phase = phase;
  emit('PHASE_CHANGED', { previousPhase, phase });
}

function setTreasureDeck(cardInstances) {
  state.treasureDeck = clone(cardInstances) ?? [];
  emit('TREASURE_DECK_SET', { count: state.treasureDeck.length });
}

function setLostLoot(cardInstances) {
  state.lostLoot = clone(cardInstances) ?? [];
  emit('LOST_LOOT_SET', { count: state.lostLoot.length });
}

function addToLostLoot(cardInstanceOrInstances) {
  const additions = Array.isArray(cardInstanceOrInstances)
    ? cardInstanceOrInstances
    : [cardInstanceOrInstances];
  state.lostLoot.push(...clone(additions));
  emit('LOST_LOOT_ADDED', { added: clone(additions), count: state.lostLoot.length });
}

function setExpeditionArea(cardInstances) {
  state.expeditionArea = clone(cardInstances) ?? [];
  emit('EXPEDITION_AREA_SET', { count: state.expeditionArea.length });
}

function addToExpeditionArea(cardInstance) {
  const added = clone(cardInstance);
  state.expeditionArea.push(added);
  emit('EXPEDITION_AREA_CARD_ADDED', { added, count: state.expeditionArea.length });
}

function clearExpeditionArea() {
  const cleared = state.expeditionArea;
  state.expeditionArea = [];
  // Captain Shield protection (GDD §14.3) is scoped to a single
  // expedition by definition — clearing the Expedition Area (whether via
  // Shipwreck or a normal Return to Ship) is the one event that always
  // marks the end of an expedition, so resetting shieldActive here (one
  // spot) is sufficient to guarantee it never leaks into the next one.
  state.shieldActive = false;
  emit('EXPEDITION_AREA_CLEARED', { clearedCount: cleared.length });
}

function setPlayers(players) {
  state.players = clone(players) ?? [];
  emit('PLAYERS_SET', { count: state.players.length });
}

/**
 * Applies a partial patch to one player record (identified by id).
 * Never replaces the whole players array — safer for callers that only
 * want to change e.g. shipCargo or score.
 *
 * @param {string} playerId
 * @param {object} patch - shallow-merged onto the existing player record
 */
function updatePlayer(playerId, patch) {
  const index = state.players.findIndex((p) => p.id === playerId);
  if (index === -1) {
    log.warn(`updatePlayer: no player with id "${playerId}"`);
    return;
  }
  state.players[index] = { ...state.players[index], ...clone(patch) };
  emit('PLAYER_UPDATED', { playerId, patch: clone(patch) });
}

function setCurrentPlayerIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= Math.max(state.players.length, 1)) {
    log.warn(`setCurrentPlayerIndex: index ${index} out of bounds for ${state.players.length} players`);
  }
  const previousIndex = state.currentPlayerIndex;
  state.currentPlayerIndex = index;
  emit('CURRENT_PLAYER_CHANGED', { previousIndex, index });
}

function addTurnHistoryEntry(entry) {
  const added = clone(entry);
  state.turnHistory.push(added);
  emit('TURN_HISTORY_APPENDED', { added, count: state.turnHistory.length });
}

function setAbilityContext(context) {
  state.abilityContext = clone(context);
  emit('ABILITY_CONTEXT_SET', { context: clone(context) });
}

function clearAbilityContext() {
  state.abilityContext = null;
  emit('ABILITY_CONTEXT_CLEARED', {});
}

/**
 * GDD §14.2/14.4/14.5/14.7 (Prompt 014): records a pending target-
 * selection request — set by turnManager.js's resolveAbility() when a
 * targeted ability has at least one eligible target and the current
 * player is human, read by modalManager.js to render the choices, and
 * cleared once turnManager.js's resolveAbilityChoice() consumes it.
 * @param {object} choice
 */
function setPendingAbilityChoice(choice) {
  state.pendingAbilityChoice = clone(choice);
  emit('PENDING_ABILITY_CHOICE_SET', { choice: clone(choice) });
}

function clearPendingAbilityChoice() {
  state.pendingAbilityChoice = null;
  emit('PENDING_ABILITY_CHOICE_CLEARED', {});
}

/**
 * GDD §11: stores the final scoring results — set by turnManager.js's
 * scoring() step (via scoreManager.js) once, when the Treasure Deck
 * empties. Shape is the caller's responsibility (a plain, JSON-serializable
 * object); gameState.js only stores/clones/emits, matching every other
 * mutator here.
 * @param {object} results
 */
function setResults(results) {
  state.results = clone(results);
  emit('RESULTS_SET', { results: clone(results) });
}

/**
 * @param {boolean} active
 */
function setShieldActive(active) {
  state.shieldActive = Boolean(active);
  emit('SHIELD_ACTIVE_SET', { active: state.shieldActive });
}

/**
 * GDD §24 (Prompt 020 — Save System): the write-side counterpart of
 * getStateSnapshot() above (whose own doc comment already earmarked it
 * "for saveManager.js (Phase 20)"). Replaces the ENTIRE module-private
 * `state` object in one atomic assignment — never a series of individual
 * setter calls — for two reasons:
 *   1. Correctness: a restore must land on EXACTLY the snapshot's shape,
 *      including fields no individual mutator can set on its own (e.g.
 *      `currentPlayerIndex` together with `players` together with
 *      `phase`, all consistent with each other) — piecing it back
 *      together via ~13 separate setter calls would risk a
 *      briefly-inconsistent intermediate state between them, and there
 *      is no existing setter for every field (e.g. `results` has
 *      setResults() but nothing restores `currentPlayerIndex` and
 *      `players` as a single unit the way a real snapshot needs).
 *   2. Presentation-layer behavior: a restore is fundamentally different
 *      from ordinary gameplay progressing (see animationManager.js's own
 *      SHIPWRECK-hold logic, and audioManager.js's per-event sound
 *      triggers) — a page reload restoring a mid-game save must NOT
 *      replay every historical animation hold or sound cue that
 *      originally produced that state. Emitting exactly ONE new event
 *      type here (`STATE_RESTORED`, below) rather than the dozen+
 *      granular events a piecemeal rebuild would fire means
 *      animationManager.js/audioManager.js's existing wildcard
 *      `gameState.on('*', ...)` subscriptions each see exactly one
 *      notification: animationManager.js's `handleGameStateEvent()`
 *      unconditionally calls `requestRender()` for ANY event type before
 *      its own `if (event.type === 'PHASE_CHANGED' ...)` branch, so the
 *      board correctly re-renders once, immediately, without engaging
 *      the Shipwreck-hold machinery (this isn't a `PHASE_CHANGED` event);
 *      audioManager.js's own `switch (event.type)` has no
 *      `'STATE_RESTORED'` case, so it correctly falls through to its
 *      `default: return;` and plays nothing. Both are correct-by-
 *      construction from this one new event type, with ZERO changes
 *      needed to either module.
 *
 * `snapshot` is expected to be exactly the shape getStateSnapshot()
 * itself returns (createInitialState()'s own field set) — saveManager.js
 * is the only sanctioned caller, and it never reaches into this shape
 * itself (see that module's own header), only round-trips whatever
 * getStateSnapshot() gave it through JSON, unchanged.
 *
 * @param {object} snapshot - a full GameState shape, as returned by
 *   getStateSnapshot()
 */
function restoreStateSnapshot(snapshot) {
  state = clone(snapshot) ?? createInitialState();
  emit('STATE_RESTORED', { phase: state.phase });
  log.info('GameState restored from a snapshot', { phase: state.phase });
}

export {
  PHASES,
  // events
  on,
  off,
  clearAllListeners,
  // selectors
  getPhase,
  getConfig,
  getTreasureDeck,
  getLostLoot,
  getExpeditionArea,
  getPlayers,
  getPlayer,
  getCurrentPlayerIndex,
  getCurrentPlayer,
  getTurnHistory,
  getAbilityContext,
  getPendingAbilityChoice,
  getResults,
  getShieldActive,
  getStateSnapshot,
  // mutators
  initState,
  resetState,
  setPhase,
  setTreasureDeck,
  setLostLoot,
  addToLostLoot,
  setExpeditionArea,
  addToExpeditionArea,
  clearExpeditionArea,
  setPlayers,
  updatePlayer,
  setCurrentPlayerIndex,
  addTurnHistoryEntry,
  setAbilityContext,
  clearAbilityContext,
  setPendingAbilityChoice,
  clearPendingAbilityChoice,
  setResults,
  setShieldActive,
  restoreStateSnapshot,
};
