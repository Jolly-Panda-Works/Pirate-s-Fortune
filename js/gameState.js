/**
 * gameState.js
 *
 * Responsibility: Owns GameState (single source of truth) and controlled
 * mutators. Implemented: Phase 2 (Game State) — Prompt 002.
 *
 * GDD §6 shape:
 *   GameState
 *   ├── phase
 *   ├── treasureDeck
 *   ├── lostLoot
 *   ├── expeditionArea
 *   ├── players[]
 *   ├── currentPlayerIndex
 *   ├── turnHistory
 *   ├── abilityContext
 *   └── config
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
    players: [],
    currentPlayerIndex: 0,
    turnHistory: [],
    abilityContext: null,
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
 * GDD §11 final scoring results, set once by scoreManager's caller
 * (turnManager.js's scoring() step) when the Treasure Deck empties.
 * null until the game actually reaches SCORING.
 */
function getResults() {
  return clone(state.results);
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
  getResults,
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
  setResults,
};
