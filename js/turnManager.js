/**
 * turnManager.js
 *
 * Responsibility: Drives state-machine transitions (GDD §7).
 * Implemented: Phase 4 (Turn System) — Prompt 004.
 * Updated: Phase 5 (Push-Your-Luck Core) — Prompt 005.
 *
 *   GAME_INIT -> PLAYER_TURN_START -> DRAW_CARD -> REVEAL_CARD ->
 *   CHECK_DUPLICATE -> (duplicate: SHIPWRECK -> END_TURN)
 *                    -> (safe: RESOLVE_ABILITY -> PLAYER_DECISION ->
 *                        (explore: DRAW_CARD) | (return: RETURN_TO_SHIP -> END_TURN))
 *   END_TURN -> (deck empty? GAME_END -> SCORING : next player -> PLAYER_TURN_START)
 *
 * Every transition is an explicitly named function, called in sequence
 * (never inlined into a giant switch), so the shape above can't be
 * silently reordered by a future change — matching the same discipline
 * development-rules.md requires for the Card Resolution Order.
 *
 * Prompt 005 scope (per docs/prompts/stage-a-core-engine.md, GDD §1.1/§2.2):
 *  - PLAYER_DECISION is now real for AI players: a placeholder threshold
 *    decision (explore while Expedition Area size < 4, else return —
 *    GDD §15 MVP AI; the real AI arrives in Prompt 015) resolves
 *    immediately and synchronously, same call stack.
 *  - PLAYER_DECISION PAUSES for human players (current.isAI === false):
 *    this function returns without calling drawCard()/returnToShip()
 *    itself. The state machine sits at PLAYER_DECISION until gameManager.js
 *    (Prompt 005) drives it forward externally by calling this module's
 *    drawCard() (Explore Further) or returnToShip() (Return to Ship) —
 *    i.e. PLAYER_DECISION is a resumable/awaitable step, not a blocking
 *    loop that waits on external input itself.
 *  - RETURN_TO_SHIP now moves the Expedition Area into the current
 *    player's Ship Cargo inline (unsorted) instead of only clearing the
 *    Expedition Area — the real, sorted implementation lands in
 *    collectManager.js, Prompt 007, which replaces this inline logic.
 *  - RESOLVE_ABILITY and SHIPWRECK remain no-op passthroughs; their real
 *    logic lands in Prompts 009/006 respectively.
 *  - CHECK_DUPLICATE still always resolves "safe" (detectDuplicate() is a
 *    stub returning false) until burnManager.js lands in Prompt 006.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - No hard-coded card names — nothing here ever inspects a card's name.
 *  - Drives everything through gameState.js's mutators only.
 */

import { createLogger } from './logger.js';
import * as gameState from './gameState.js';
import * as cardManager from './cardManager.js';
import * as deckManager from './deckManager.js';

const log = createLogger('turnManager');

const { PHASES } = gameState;

// ---------------------------------------------------------------------------
// Stubbed extension points (real implementations arrive in later prompts).
// Isolated as named functions so a later prompt swaps the body, not the
// call sites in the state machine below.
// ---------------------------------------------------------------------------

/**
 * Duplicate detection stub. Real implementation (comparing the new card's
 * type/symbol against every other card in the Expedition Area) arrives in
 * burnManager.js, Prompt 006 (GDD §8 Step 3).
 * @returns {boolean}
 */
function detectDuplicate(_expeditionCard) {
  return false;
}

/**
 * Placeholder MVP AI threshold (GDD §15): explore while the Expedition
 * Area has fewer than this many cards, return once it reaches this size.
 * Real AI (weighing deck composition, rival scores, risk, etc. — GDD §17)
 * arrives in Prompt 015; this constant/function exist only so
 * playerDecision() has stable, legal, non-blocking AI behavior until then.
 */
const AI_RETURN_THRESHOLD = 4;

/**
 * Placeholder AI decision. Pure function of expedition size so it's
 * trivially testable/deterministic on its own.
 * @param {number} expeditionSize
 * @returns {'explore'|'return'}
 */
function aiDecision(expeditionSize) {
  return expeditionSize >= AI_RETURN_THRESHOLD ? 'return' : 'explore';
}

// ---------------------------------------------------------------------------
// State machine steps — one named function per state in the diagram.
// ---------------------------------------------------------------------------

/**
 * GAME_INIT -> seeds GameState + decks, then starts the round-robin loop.
 *
 * @param {Array<object>} cardDefinitions - parsed data/cards.json `.cards`
 * @param {object} config - parsed data/gameConfig.json
 * @param {Array<object>} players - GDD §16 Player[] (id, name, isAI, shipCargo, score)
 * @param {{treasureSeed?: number|string, lostLootSeed?: number|string}} [deckOptions]
 * @returns {string} the phase the state machine settled on (SCORING on a
 *   completed game)
 */
function startGame(cardDefinitions, config, players, deckOptions = {}) {
  if (!Array.isArray(players) || players.length < 1) {
    throw new Error('turnManager.startGame: at least one player is required');
  }

  gameState.setPhase(PHASES.GAME_INIT);
  gameState.initState({ config, players });
  deckManager.initializeDecks(cardDefinitions, config, deckOptions);
  gameState.setCurrentPlayerIndex(0);

  log.info('Game started', {
    playerCount: players.length,
    treasureDeckCount: gameState.getTreasureDeck().length,
    lostLootCount: gameState.getLostLoot().length,
  });

  return playerTurnStart();
}

/**
 * PLAYER_TURN_START -> DRAW_CARD.
 */
function playerTurnStart() {
  gameState.setPhase(PHASES.PLAYER_TURN_START);
  const current = gameState.getCurrentPlayer();
  log.info('Player turn started', { playerId: current?.id });
  return drawCard();
}

/**
 * DRAW_CARD -> REVEAL_CARD (or, if the deck is already exhausted mid-turn,
 * folds straight into END_TURN so the deck-empty check there can route to
 * GAME_END — this keeps the "deck runs out" handling in exactly one place
 * per rule 6/no-hidden-branching, even for the edge case of the deck
 * emptying between two draws in the same turn).
 */
function drawCard() {
  gameState.setPhase(PHASES.DRAW_CARD);
  const drawn = deckManager.drawFromTreasureDeck();

  if (!drawn) {
    log.warn('Treasure Deck exhausted during DRAW_CARD');
    return endTurn();
  }

  return revealCard(drawn);
}

/**
 * REVEAL_CARD -> CHECK_DUPLICATE.
 * Moves the drawn instance into the Expedition Area zone and adds it to
 * GameState — gameState.addToExpeditionArea() emits an event on every
 * call, which is the "card is displayed" hook future UI/animation code
 * will subscribe to (GDD §8 Step 2).
 */
function revealCard(drawnCard) {
  gameState.setPhase(PHASES.REVEAL_CARD);
  const expeditionCard = cardManager.moveInstance(drawnCard, cardManager.ZONES.EXPEDITION);
  gameState.addToExpeditionArea(expeditionCard);
  log.debug('Card revealed', { instanceId: expeditionCard.instanceId, defId: expeditionCard.defId });
  return checkDuplicate(expeditionCard);
}

/**
 * CHECK_DUPLICATE -> SHIPWRECK (duplicate) | RESOLVE_ABILITY (safe).
 */
function checkDuplicate(expeditionCard) {
  gameState.setPhase(PHASES.CHECK_DUPLICATE);
  const isDuplicate = detectDuplicate(expeditionCard);

  if (isDuplicate) {
    return shipwreck(expeditionCard);
  }
  return resolveAbility(expeditionCard);
}

/**
 * SHIPWRECK -> END_TURN.
 * Stub: real Shipwreck effects (move all Expedition Area cards to Lost
 * Loot, clear Expedition Area) arrive in burnManager.js, Prompt 006.
 * Unreachable for now since detectDuplicate() always returns false, but
 * the transition shape is delivered so Prompt 006 only has to replace
 * this function's body, not the call sites.
 */
function shipwreck(expeditionCard) {
  gameState.setPhase(PHASES.SHIPWRECK);
  log.warn('Shipwreck (stub — burnManager.js arrives Prompt 006)', {
    instanceId: expeditionCard.instanceId,
  });
  return endTurn();
}

/**
 * RESOLVE_ABILITY -> PLAYER_DECISION.
 * Stub: real ability resolution (abilityResolver.js's Resolution Queue)
 * arrives in Prompt 009. Cards with no ability, like Gold Coin, will
 * legitimately no-op here even after Prompt 009 lands.
 */
function resolveAbility(expeditionCard) {
  gameState.setPhase(PHASES.RESOLVE_ABILITY);
  log.debug('Ability resolution (stub — abilityResolver.js arrives Prompt 009)', {
    instanceId: expeditionCard.instanceId,
  });
  return playerDecision();
}

/**
 * PLAYER_DECISION -> DRAW_CARD (explore) | RETURN_TO_SHIP (return).
 *
 * AI players (current.isAI === true) resolve immediately using the
 * placeholder threshold decision (aiDecision()) — same call stack, no
 * pause.
 *
 * Human players PAUSE here: this function returns the PLAYER_DECISION
 * phase without calling drawCard() or returnToShip() itself. The call
 * stack above (drawCard -> revealCard -> checkDuplicate -> resolveAbility
 * -> playerDecision) simply unwinds, leaving GameState sitting at
 * PLAYER_DECISION for the current player. gameManager.revealNextCard()/
 * returnToShip() (Prompt 005) resume play by calling this module's
 * drawCard()/returnToShip() directly — each such call re-enters and runs
 * exactly one more step of the state machine, which may pause again at
 * the next PLAYER_DECISION or run on to GAME_END/SCORING.
 *
 * @returns {string} PHASES.PLAYER_DECISION when paused for a human, or
 *   whatever phase the resumed AI branch settles on
 */
function playerDecision() {
  gameState.setPhase(PHASES.PLAYER_DECISION);
  const current = gameState.getCurrentPlayer();

  if (current?.isAI) {
    const expeditionSize = gameState.getExpeditionArea().length;
    const decision = aiDecision(expeditionSize);
    log.debug('AI player decision (placeholder threshold — real AI arrives Prompt 015)', {
      playerId: current.id,
      expeditionSize,
      decision,
    });
    return decision === 'explore' ? drawCard() : returnToShip();
  }

  log.info('Awaiting human player decision — paused at PLAYER_DECISION', {
    playerId: current?.id,
  });
  return gameState.getPhase();
}

/**
 * RETURN_TO_SHIP -> END_TURN.
 * Inline stub (Prompt 005): moves every Expedition Area card into the
 * current player's Ship Cargo (via cardManager.moveInstance, zone ->
 * CARGO, owner -> current player) and clears the Expedition Area.
 * Unsorted — the real, sorted implementation (GDD §10: lowest-to-highest
 * by value, tie-break by type) lands in collectManager.js, Prompt 007,
 * which replaces this function's body; the call site in playerDecision()/
 * gameManager.returnToShip() will not need to change.
 */
function returnToShip() {
  gameState.setPhase(PHASES.RETURN_TO_SHIP);
  const current = gameState.getCurrentPlayer();
  const expeditionCards = gameState.getExpeditionArea();

  if (current) {
    const cargoCards = expeditionCards.map((card) =>
      cardManager.moveInstance(card, cardManager.ZONES.CARGO, current.id)
    );
    gameState.updatePlayer(current.id, {
      shipCargo: [...(current.shipCargo ?? []), ...cargoCards],
    });
  }

  gameState.clearExpeditionArea();
  gameState.addTurnHistoryEntry({
    playerId: current?.id ?? null,
    decision: 'return',
    cardsSecured: expeditionCards.length,
  });
  log.info('Returned to ship (inline stub — collectManager.js sorts cargo in Prompt 007)', {
    playerId: current?.id,
    cardsSecured: expeditionCards.length,
  });
  return endTurn();
}

/**
 * END_TURN -> GAME_END (deck empty) | PLAYER_TURN_START (next player).
 * Round-robin advance is driven entirely through gameState's
 * setCurrentPlayerIndex() mutator — never a local counter.
 */
function endTurn() {
  gameState.setPhase(PHASES.END_TURN);

  if (gameState.getTreasureDeck().length === 0) {
    log.info('Treasure Deck empty — ending game');
    return gameEnd();
  }

  const players = gameState.getPlayers();
  const nextIndex = (gameState.getCurrentPlayerIndex() + 1) % players.length;
  gameState.setCurrentPlayerIndex(nextIndex);
  return playerTurnStart();
}

/**
 * GAME_END -> SCORING.
 * Stub: real score calculation arrives in scoreManager.js, Prompt 008.
 */
function gameEnd() {
  gameState.setPhase(PHASES.GAME_END);
  log.info('GAME_END reached');
  return scoring();
}

/**
 * SCORING — terminal phase for this prompt.
 * Stub: real score calculation/winner determination arrives in
 * scoreManager.js, Prompt 008.
 * @returns {string} PHASES.SCORING
 */
function scoring() {
  gameState.setPhase(PHASES.SCORING);
  log.info('SCORING phase reached (stub — scoreManager.js arrives Prompt 008)');
  return gameState.getPhase();
}

export {
  startGame,
  playerTurnStart,
  drawCard,
  revealCard,
  checkDuplicate,
  shipwreck,
  resolveAbility,
  playerDecision,
  returnToShip,
  endTurn,
  gameEnd,
  scoring,
};

export default {
  startGame,
  playerTurnStart,
  drawCard,
  revealCard,
  checkDuplicate,
  shipwreck,
  resolveAbility,
  playerDecision,
  returnToShip,
  endTurn,
  gameEnd,
  scoring,
};
