/**
 * turnManager.js
 *
 * Responsibility: Drives state-machine transitions (GDD §7).
 * Implemented: Phase 4 (Turn System) — Prompt 004.
 * Updated: Phase 5 (Push-Your-Luck Core) — Prompt 005.
 * Updated: Phase 6 (Duplicate / Shipwreck) — Prompt 006.
 * Updated: Phase 7 (Collection) — Prompt 007.
 * Updated: Phase 8 (Scoring) — Prompt 008.
 * Updated: Phase 9 (Ability Framework) — Prompt 009.
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
 * Prompt 006 scope (per docs/prompts/stage-a-core-engine.md, GDD §8/§9):
 *  - CHECK_DUPLICATE now calls burnManager.isDuplicate() for real (GDD §8
 *    Step 3) instead of the old always-false stub.
 *  - SHIPWRECK now calls burnManager.triggerShipwreck() (GDD §9): the
 *    duplicate's ability never executes because SHIPWRECK is reached
 *    directly from CHECK_DUPLICATE, bypassing RESOLVE_ABILITY entirely —
 *    the call graph itself is the guarantee, not a flag/branch inside
 *    resolveAbility().
 *  - startGame() now retains the card definitions it was given (in a
 *    module-private variable, gameCardDefinitions) for the lifetime of the
 *    current game, since burnManager.isDuplicate() needs to look up each
 *    CardInstance's `type` by defId and CardInstances only ever store
 *    defId, never the full definition.
 *
 * Prompt 007 scope (per docs/prompts/stage-a-core-engine.md, GDD §10):
 *  - RETURN_TO_SHIP now calls collectManager.returnToShip() (GDD §10):
 *    Expedition Area cards are merged into the current player's Ship
 *    Cargo and the FULL merged cargo is re-sorted lowest-to-highest by
 *    value (tie-break by type) — replacing the Prompt 005 inline/unsorted
 *    stub. collectManager owns the aftermath only (mirroring burnManager's
 *    split for Shipwreck); turnManager still owns the turnHistory entry
 *    and the call to endTurn().
 *
 * Prompt 009 scope (per docs/prompts/stage-a-core-engine.md, GDD §12/§13):
 *  - RESOLVE_ABILITY is no longer a no-op stub: it resolves
 *    expeditionCard's definition via cardManager.getDefinition() (using
 *    gameCardDefinitions) and calls
 *    abilityResolver.resolveAbility(definition, { currentPlayer, reason:
 *    'reveal' }). No concrete ability handlers are registered yet
 *    (Prompt 010/010b) — every card currently resolves as a no-op inside
 *    abilityResolver, which is the correct, explicit behavior for a null
 *    ability key (Gold Coin) and an unregistered one alike.
 *
 * Prompt 008 scope (per docs/prompts/stage-a-core-engine.md, GDD §11/§11.1):
 *  - SCORING is no longer a terminal stub: it calls
 *    scoreManager.calculateScore() per player (writing each player's
 *    `.score` back via gameState.updatePlayer()), then
 *    scoreManager.determineWinner() over the freshly-scored players, and
 *    stores { scores, winners } via gameState.setResults(). Reuses
 *    gameCardDefinitions (see Prompt 006 note below) since calculateScore()
 *    needs to resolve each Ship Cargo CardInstance's `value`/`type` by
 *    `defId`.
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
 *  - RESOLVE_ABILITY remains a no-op passthrough; real logic lands in
 *    Prompt 009.
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
import * as burnManager from './burnManager.js';
import * as collectManager from './collectManager.js';
import * as scoreManager from './scoreManager.js';
import * as abilityResolver from './abilityResolver.js';

const log = createLogger('turnManager');

const { PHASES } = gameState;

/**
 * Module-private snapshot of the card definitions (data/cards.json
 * `.cards`) the current game was started with. Set once per startGame()
 * call and read by checkDuplicate() (via burnManager.isDuplicate()) —
 * CardInstances only ever store defId, never their full definition, so
 * something has to remember which definitions apply to this game.
 */
let gameCardDefinitions = null;

// ---------------------------------------------------------------------------
// Stubbed extension points (real implementations arrive in later prompts).
// Isolated as named functions so a later prompt swaps the body, not the
// call sites in the state machine below.
// ---------------------------------------------------------------------------

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

  gameCardDefinitions = cardDefinitions;
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
 * GDD §8 Step 3: delegates the actual comparison to burnManager.isDuplicate(),
 * which compares expeditionCard's type against every OTHER card already in
 * the Expedition Area (expeditionCard itself is already in there — it was
 * added by revealCard() before this runs).
 */
function checkDuplicate(expeditionCard) {
  gameState.setPhase(PHASES.CHECK_DUPLICATE);
  const duplicate = burnManager.isDuplicate(
    expeditionCard,
    gameState.getExpeditionArea(),
    gameCardDefinitions
  );

  if (duplicate) {
    return shipwreck(expeditionCard);
  }
  return resolveAbility(expeditionCard);
}

/**
 * SHIPWRECK -> END_TURN.
 * GDD §9: delegates the aftermath to burnManager.triggerShipwreck() (moves
 * every Expedition Area card to Lost Loot, clears the Expedition Area),
 * then records a turnHistory entry (decision: 'shipwreck', cardsLost) —
 * mirroring the entry returnToShip() records for a normal turn, so every
 * completed turn (safe or not) has exactly one turnHistory entry.
 * Reached directly from CHECK_DUPLICATE — never from RESOLVE_ABILITY — so
 * the duplicate's own ability structurally never executes (GDD §9: "The
 * duplicate card must never execute its own ability"). No player decision
 * occurs; this goes straight to END_TURN.
 */
function shipwreck(expeditionCard) {
  gameState.setPhase(PHASES.SHIPWRECK);
  const current = gameState.getCurrentPlayer();
  const lostLootCards = burnManager.triggerShipwreck();
  gameState.addTurnHistoryEntry({
    playerId: current?.id ?? null,
    decision: 'shipwreck',
    cardsLost: lostLootCards.length,
  });
  log.warn('Shipwreck', {
    playerId: current?.id,
    triggeringInstanceId: expeditionCard.instanceId,
    cardsLost: lostLootCards.length,
  });
  return endTurn();
}

/**
 * RESOLVE_ABILITY -> PLAYER_DECISION.
 * GDD §8 Step 4 / §12/§13: resolves expeditionCard's ability (if any) via
 * abilityResolver.resolveAbility(), which also drains its own internal
 * Resolution Queue for any further contexts the ability generates (chain
 * abilities — concrete ones arrive in Prompt 010b, but the framework
 * handles them uniformly starting now). Looks the card's definition up
 * via cardManager.getDefinition() since abilityResolver operates on
 * definitions (for their `.ability` key), never on bare CardInstances.
 * Cards with no ability (ability key = null, e.g. Gold Coin) legitimately
 * no-op inside abilityResolver — nothing special is done for them here.
 */
function resolveAbility(expeditionCard) {
  gameState.setPhase(PHASES.RESOLVE_ABILITY);
  const current = gameState.getCurrentPlayer();
  const definition = cardManager.getDefinition(gameCardDefinitions, expeditionCard.defId);

  abilityResolver.resolveAbility(definition, {
    currentPlayer: current,
    reason: 'reveal',
  });

  log.debug('Ability resolution complete', {
    instanceId: expeditionCard.instanceId,
    ability: definition?.ability ?? null,
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
 * GDD §10: delegates the aftermath to collectManager.returnToShip() — moves
 * every Expedition Area card into the current player's Ship Cargo, merged
 * with cargo already secured on earlier turns and re-sorted lowest-to-
 * highest by value (tie-break by type), then clears the Expedition Area.
 * Replaces the Prompt 005 inline/unsorted stub — the call sites in
 * playerDecision()/gameManager.returnToShip() did not need to change.
 */
function returnToShip() {
  gameState.setPhase(PHASES.RETURN_TO_SHIP);
  const current = gameState.getCurrentPlayer();

  let securedCards = [];
  if (current) {
    securedCards = collectManager.returnToShip(current.id, gameCardDefinitions);
  } else {
    gameState.clearExpeditionArea();
  }

  gameState.addTurnHistoryEntry({
    playerId: current?.id ?? null,
    decision: 'return',
    cardsSecured: securedCards.length,
  });
  log.info('Returned to ship', {
    playerId: current?.id,
    cardsSecured: securedCards.length,
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
 * SCORING — terminal phase.
 * GDD §11/§11.1: computes every player's score via
 * scoreManager.calculateScore() (writing it back onto each Player record
 * via gameState.updatePlayer(), since GDD §16's Player shape includes
 * `score`), determines the winner(s) via scoreManager.determineWinner()
 * (a length > 1 result means a genuine, fully unresolved tie — GDD §11.1
 * — not an error), and stores the outcome via gameState.setResults() so
 * callers never have to re-derive it themselves.
 * @returns {string} PHASES.SCORING
 */
function scoring() {
  gameState.setPhase(PHASES.SCORING);

  for (const player of gameState.getPlayers()) {
    const score = scoreManager.calculateScore(player, gameCardDefinitions);
    gameState.updatePlayer(player.id, { score });
  }

  const scoredPlayers = gameState.getPlayers();
  const winners = scoreManager.determineWinner(scoredPlayers);

  gameState.setResults({
    scores: Object.fromEntries(scoredPlayers.map((p) => [p.id, p.score])),
    winners: winners.map((p) => p.id),
  });

  log.info('SCORING complete', {
    scores: Object.fromEntries(scoredPlayers.map((p) => [p.id, p.score])),
    winners: winners.map((p) => p.id),
  });

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
