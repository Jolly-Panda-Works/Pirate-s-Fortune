/**
 * engineHost.js
 *
 * Hosts the ORIGINAL, unmodified headless rules engine (../../js/*) on
 * the Colyseus server. Nothing under ../../js is edited or forked — this
 * module only calls gameManager.js's public API and gameState.js's
 * snapshot pair, exactly like the 2D build's main.js/saveManager.js do.
 *
 * Why snapshot swapping: gameState.js keeps ONE module-private `state`
 * object per process. A server hosts many rooms, so before every action
 * we restore that room's own snapshot (restoreStateSnapshot), run the
 * engine call, then take the new snapshot back out. The engine is 100%
 * synchronous and Node is single-threaded, so nothing else can observe
 * or interleave with the swapped-in state while a call runs.
 *
 * Every GameState event emitted during an action is recorded as a
 * "frame" (event + compact public view) so clients can replay the turn
 * with 3D animations — the same role animationManager.js plays for the
 * 2D build, just over the network.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { setLevel } from '../../js/logger.js';
import * as gameManager from '../../js/gameManager.js';
import * as gameState from '../../js/gameState.js';
import * as turnManager from '../../js/turnManager.js';
import * as playerManager from '../../js/playerManager.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function loadJSON(relative) {
  return JSON.parse(readFileSync(path.join(ROOT, relative), 'utf8'));
}

setLevel(process.env.ENGINE_LOG_LEVEL ?? 'ERROR');

export const cardDefinitions = loadJSON('data/cards.json').cards;
export const gameConfig = loadJSON('data/gameConfig.json');

const { PHASES } = gameState;

// Events worth replaying on the client. Everything else (bookkeeping
// such as TREASURE_DECK_SET) still lands in the final frame's view.
const VISUAL_EVENTS = new Set([
  'PHASE_CHANGED',
  'EXPEDITION_AREA_CARD_ADDED',
  'EXPEDITION_AREA_CLEARED',
  'LOST_LOOT_ADDED',
  'PLAYER_UPDATED',
  'CURRENT_PLAYER_CHANGED',
  'SHIELD_ACTIVE_SET',
  'ABILITY_CONTEXT_SET',
  'PENDING_ABILITY_CHOICE_SET',
  'PENDING_ABILITY_CHOICE_CLEARED',
  'TURN_HISTORY_APPENDED',
  'RESULTS_SET',
]);

// Intermediate phases that only matter when they carry a visual beat.
const VISUAL_PHASES = new Set([
  PHASES.SHIPWRECK,
  PHASES.RESOLVE_ABILITY,
  PHASES.RETURN_TO_SHIP,
  PHASES.PLAYER_TURN_START,
  PHASES.PLAYER_DECISION,
  PHASES.PLAYER_CHOICE,
  PHASES.SCORING,
]);

let recording = null;

gameState.on('*', (event) => {
  if (!recording) return;
  if (!VISUAL_EVENTS.has(event.type)) return;
  if (event.type === 'PHASE_CHANGED' && !VISUAL_PHASES.has(event.detail.phase)) return;
  recording.push({
    type: event.type,
    phase: gameState.getPhase(),
    detail: event.detail,
    view: toPublicView(gameState.getStateSnapshot()),
  });
});

/**
 * Strips everything a client must not (or need not) see: the Treasure
 * Deck's order becomes a count, config is dropped, turn history is
 * trimmed to its tail.
 * @param {object} snapshot - full gameState.getStateSnapshot()
 */
export function toPublicView(snapshot) {
  if (!snapshot) return null;
  return {
    phase: snapshot.phase,
    treasureDeckCount: snapshot.treasureDeck.length,
    lostLoot: snapshot.lostLoot,
    expeditionArea: snapshot.expeditionArea,
    shieldActive: snapshot.shieldActive,
    players: snapshot.players,
    currentPlayerIndex: snapshot.currentPlayerIndex,
    turnCount: snapshot.turnHistory.length,
    lastTurn: snapshot.turnHistory[snapshot.turnHistory.length - 1] ?? null,
    abilityContext: snapshot.abilityContext,
    pendingAbilityChoice: snapshot.pendingAbilityChoice,
    results: snapshot.results,
  };
}

/**
 * Runs `fn` against a room's own engine state.
 * @param {object|null} snapshot - the room's previous full snapshot (null for a brand-new game)
 * @param {() => void} fn - calls into gameManager
 * @returns {{snapshot: object, frames: Array<object>}}
 */
export function runInRoom(snapshot, fn) {
  if (snapshot) gameState.restoreStateSnapshot(snapshot);
  recording = [];
  try {
    // gameManager's own guards throw BEFORE any mutation on an invalid
    // action, so an error here leaves the room's snapshot untouched.
    fn(gameManager);
    return {
      snapshot: gameState.getStateSnapshot(),
      frames: recording,
      safeToSave: turnManager.isSafeToSave(),
    };
  } finally {
    recording = null;
  }
}

/**
 * A human left for good mid-game: their seat becomes an AI seat. The
 * flag is flipped in the room's snapshot, and if the game is currently
 * paused on THEIR decision/choice it is resumed through the same
 * playerManager + turnManager calls turnManager itself uses for AI
 * players — so the rules the bot follows are the engine's own.
 * @param {object} snapshot
 * @param {string} playerId
 */
export function takeOverSeat(snapshot, playerId) {
  const patched = JSON.parse(JSON.stringify(snapshot));
  const player = patched.players.find((p) => p.id === playerId);
  if (!player) return { snapshot, frames: [], safeToSave: false };
  player.isAI = true;

  return runInRoom(patched, () => {
    const current = gameState.getCurrentPlayer();
    if (current?.id !== playerId) return;
    const phase = gameState.getPhase();
    if (phase === PHASES.PLAYER_CHOICE) {
      const pending = gameState.getPendingAbilityChoice();
      turnManager.resolveAbilityChoice(playerManager.chooseAbilityTarget(pending.options));
    }
    if (gameState.getPhase() === PHASES.PLAYER_DECISION && gameState.getCurrentPlayer()?.id === playerId) {
      const decision = playerManager.decideAction(gameState.getExpeditionArea().length);
      if (decision === 'explore') turnManager.drawCard();
      else turnManager.returnToShip();
    }
  });
}

/**
 * turnManager keeps the card definitions of the last startGame() call
 * in a module-private variable. Every room uses the same data/cards.json,
 * so one warm-up game at boot makes resuming a saved snapshot work even
 * before any room has started a fresh game.
 */
export function warmUp() {
  gameManager.startGame(cardDefinitions, gameConfig, [
    { id: 'warmup-a', name: 'A', isAI: true, shipCargo: [], score: 0 },
    { id: 'warmup-b', name: 'B', isAI: true, shipCargo: [], score: 0 },
  ], { treasureSeed: 'warmup', lostLootSeed: 'warmup' });
}

export { PHASES };
