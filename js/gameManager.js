/**
 * gameManager.js
 *
 * Responsibility: Thin orchestrator and public gameplay API (GDD §18.2).
 * Implemented: Phase 5 (Push-Your-Luck Core) — Prompt 005.
 *
 * This is the ONLY module external callers (future UI) should import for
 * gameplay actions (GDD §6.1) — never turnManager.js or gameState.js's
 * mutators directly. Every selector below is a straight re-export of
 * gameState.js's read-only selectors (each already returns a deep copy),
 * so a caller never needs to import gameState.js itself either.
 *
 * Decision-pausing (GDD §7 PLAYER_DECISION, GDD §1.1/§2.2):
 * turnManager's PLAYER_DECISION step pauses the state machine whenever the
 * current player is human (isAI === false) — see turnManager.js's
 * playerDecision() for the mechanics. revealNextCard() and returnToShip()
 * are what resume it from that pause point; each call runs exactly one
 * more step of the underlying state machine (turnManager.drawCard() /
 * turnManager.returnToShip()), which may pause again at the next
 * PLAYER_DECISION or run on to GAME_END/SCORING if the Treasure Deck
 * empties. Both guard against being called out of turn — no pending
 * decision, or the current player is AI — so a caller can never force a
 * decision that would silently desync GameState.
 *
 * AI players never need revealNextCard()/returnToShip() — turnManager
 * resolves their PLAYER_DECISION itself using a placeholder threshold
 * (real AI arrives in Prompt 015).
 *
 * Rules this module must respect (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - No hard-coded card names — dispatch via card.ability keys only.
 *  - UI never mutates GameState directly.
 */

import { createLogger } from './logger.js';
import * as turnManager from './turnManager.js';
import * as gameState from './gameState.js';

const log = createLogger('gameManager');

const { PHASES } = gameState;

// ---------------------------------------------------------------------------
// Guard shared by both decision actions.
// ---------------------------------------------------------------------------

/**
 * Throws unless the state machine is currently paused waiting on a human
 * player's Explore Further / Return to Ship decision.
 * @param {string} actionName - for the error message only
 */
function assertAwaitingHumanDecision(actionName) {
  const phase = gameState.getPhase();
  if (phase !== PHASES.PLAYER_DECISION) {
    throw new Error(
      `gameManager.${actionName}: no decision is pending (current phase is "${phase}")`
    );
  }
  const current = gameState.getCurrentPlayer();
  if (!current || current.isAI) {
    throw new Error(
      `gameManager.${actionName}: it is not a human player's turn to decide`
    );
  }
}

// ---------------------------------------------------------------------------
// Public gameplay actions.
// ---------------------------------------------------------------------------

/**
 * Starts a new game. Thin passthrough to turnManager.startGame — kept here
 * so callers never need to import turnManager.js directly.
 * @param {Array<object>} cardDefinitions - parsed data/cards.json `.cards`
 * @param {object} config - parsed data/gameConfig.json
 * @param {Array<object>} players - GDD §16 Player[]
 * @param {{treasureSeed?: number|string, lostLootSeed?: number|string}} [deckOptions]
 * @returns {string} the phase the state machine settled on — PLAYER_DECISION
 *   if play paused waiting on a human, or SCORING if every player happened
 *   to be AI and the game ran to completion unattended.
 */
function startGame(cardDefinitions, config, players, deckOptions) {
  return turnManager.startGame(cardDefinitions, config, players, deckOptions);
}

/**
 * "Explore Further" — resumes a paused human PLAYER_DECISION by revealing
 * the next card, growing the Expedition Area by one.
 * @returns {string} the phase the state machine settled on next
 */
function revealNextCard() {
  assertAwaitingHumanDecision('revealNextCard');
  log.info('Human decision: Explore Further', { playerId: gameState.getCurrentPlayer()?.id });
  return turnManager.drawCard();
}

/**
 * "Return to Ship" — resumes a paused human PLAYER_DECISION by banking the
 * current Expedition Area into the player's Ship Cargo and ending the turn.
 * @returns {string} the phase the state machine settled on next
 */
function returnToShip() {
  assertAwaitingHumanDecision('returnToShip');
  log.info('Human decision: Return to Ship', { playerId: gameState.getCurrentPlayer()?.id });
  return turnManager.returnToShip();
}

// ---------------------------------------------------------------------------
// Read-only selectors, re-exported from gameState.js.
// ---------------------------------------------------------------------------

const {
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
  on,
  off,
} = gameState;

export {
  PHASES,
  // actions
  startGame,
  revealNextCard,
  returnToShip,
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
  // events
  on,
  off,
};

export default {
  PHASES,
  startGame,
  revealNextCard,
  returnToShip,
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
  on,
  off,
};
