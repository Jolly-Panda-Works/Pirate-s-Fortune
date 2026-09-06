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
 * Updated: Phase 10a (Single-Resolution Abilities) — Prompt 010.
 * Updated: Phase 14 (Modal System) — Prompt 014.
 * Updated: Phase 19 (AI), pulled forward into Stage B — Prompt 015.
 *
 *   GAME_INIT -> PLAYER_TURN_START -> DRAW_CARD -> REVEAL_CARD ->
 *   CHECK_DUPLICATE -> (duplicate: SHIPWRECK -> END_TURN)
 *                    -> (safe: RESOLVE_ABILITY
 *                        -> (targeted ability, human, eligible target
 *                            exists: pause at PLAYER_CHOICE, resumed by
 *                            resolveAbilityChoice() -> back into
 *                            RESOLVE_ABILITY's own continuation)
 *                        -> (targeted ability, AI, eligible target
 *                            exists: playerManager.chooseAbilityTarget()
 *                            picks one immediately, no pause)
 *                        -> PLAYER_DECISION ->
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
 * Prompt 010 scope (per docs/prompts/stage-a-core-engine.md, GDD §14.1-14.3):
 *  - `import './abilities/index.js'` added (side-effect only) so the three
 *    single-resolution ability handlers (Compass/Cannon/Captain Shield)
 *    register themselves the moment turnManager.js loads — no other
 *    change was needed for Compass/Cannon, since RESOLVE_ABILITY already
 *    (Prompt 009) calls into abilityResolver generically.
 *  - checkDuplicate() gained the ONE piece of new branching Captain
 *    Shield's GDD §14.3 behavior actually requires: when
 *    burnManager.isDuplicate() is true AND gameState.getShieldActive() is
 *    true AND the duplicate card is not itself another Captain Shield
 *    (checked here, by ability key, so burnManager stays exactly as
 *    ability-agnostic as before), the duplicate is absorbed via
 *    burnManager.absorbDuplicateWithShield() instead of a full Shipwreck,
 *    then flow goes straight to playerDecision() — never resolveAbility()
 *    — preserving "a duplicate's own ability never executes" for the
 *    absorbed card exactly as strictly as for a normal Shipwrecked one.
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
 * Prompt 015 scope (per docs/prompts/stage-b-minimal-ui.md, GDD §15/§17):
 *  - playerManager.js (new) is now the ONLY source of AI decisions.
 *    PLAYER_DECISION's AI branch calls playerManager.decideAction()
 *    instead of the local placeholder threshold function Prompt 005 used
 *    to define here (removed) — same threshold value/behavior, just
 *    relocated to the module GDD §15/§17 assign this responsibility to.
 *  - RESOLVE_ABILITY's targeted-ability branch (Prompt 014) now also
 *    handles an AI current player: instead of always falling through to
 *    "resolve with no target" (Stage A/B's deliberate placeholder),
 *    an AI with at least one real eligible option now calls
 *    playerManager.chooseAbilityTarget() (first eligible option,
 *    deterministic per GDD §17) and resolves immediately through the
 *    same buildAbilityTargetContext() mapping a human's PLAYER_CHOICE
 *    resumption uses — see resolveAbility()/buildAbilityTargetContext()
 *    below. An AI never pauses at PLAYER_CHOICE; only a human does.
 *
 * Prompt 005 scope (per docs/prompts/stage-a-core-engine.md, GDD §1.1/§2.2):
 *  - PLAYER_DECISION is now real for AI players: a placeholder threshold
 *    decision (explore while Expedition Area size < 4, else return —
 *    GDD §15 MVP AI) resolves immediately and synchronously, same call
 *    stack. (Relocated into playerManager.js by Prompt 015, above.)
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
 * Prompt 014 scope (per docs/prompts/stage-b-minimal-ui.md, GDD
 * §14.2/14.4/14.5/14.7): RESOLVE_ABILITY now PAUSES — a brand new
 * PLAYER_CHOICE phase, the same "pause point + resume function" pattern
 * PLAYER_DECISION already uses for Explore Further/Return to Ship — for
 * a targeted ability (Cannon/Pirate Dagger/Lucky Anchor/Treasure Map)
 * whenever BOTH of these hold: the current player is human, AND
 * abilityManager.getEligibleTargets() finds at least one real option.
 * (An AI player instead resolves immediately with a deterministic target
 * — Prompt 015, see that Prompt's own scope note above; only a human
 * with nothing eligible, e.g. no rival has any cargo yet, still falls
 * through to "resolve with no target", exactly as Stage A left it: a
 * deliberate, already-tested no-op.) modalManager.js (also Prompt 014) is what a
 * human's choice actually comes from — it renders
 * gameState.getPendingAbilityChoice() into #modal-root and, on a click,
 * calls gameManager.chooseAbilityTarget(selection), which calls this
 * module's new resolveAbilityChoice() to resume. Compass needs NONE of
 * this — its own ability handler (abilities/compass.js) has no
 * registered eligibility function, so it always resolves immediately
 * exactly as before; GDD §14.1's "PLAYER_CHOICE" is just its own name
 * for the ALREADY-existing PLAYER_DECISION step (Explore Further/Return
 * to Ship), which this Prompt's new PLAYER_CHOICE phase is deliberately
 * NOT reused for, to avoid colliding two different meanings under one
 * name — modalManager.js separately shows the previewed card during
 * PLAYER_DECISION whenever a Compass abilityContext is present.
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
import * as abilityManager from './abilityManager.js';
import * as playerManager from './playerManager.js';
import './abilities/index.js';

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
 * CHECK_DUPLICATE -> SHIPWRECK (duplicate, no active shield) | PLAYER_DECISION
 * (duplicate, absorbed by an active Captain Shield) | RESOLVE_ABILITY (safe).
 * GDD §8 Step 3: delegates the actual comparison to burnManager.isDuplicate(),
 * which compares expeditionCard's type against every OTHER card already in
 * the Expedition Area (expeditionCard itself is already in there — it was
 * added by revealCard() before this runs).
 *
 * GDD §14.3 Captain Shield: a duplicate is only ever absorbed instead of
 * triggering Shipwreck when gameState.getShieldActive() is true AND the
 * duplicate card is not itself a Captain Shield (a Shield-vs-Shield
 * duplicate is explicitly still a normal Shipwreck — checked here, not
 * inside burnManager, so burnManager.isDuplicate()/triggerShipwreck() stay
 * exactly as ability-key-agnostic as every other rule-4-respecting
 * function in this codebase). Either way — Shipwreck or absorbed — the
 * duplicate's own ability never executes: this function only ever reaches
 * resolveAbility() down the "safe" branch.
 */
function checkDuplicate(expeditionCard) {
  gameState.setPhase(PHASES.CHECK_DUPLICATE);
  const duplicate = burnManager.isDuplicate(
    expeditionCard,
    gameState.getExpeditionArea(),
    gameCardDefinitions
  );

  if (duplicate) {
    const duplicateDef = cardManager.getDefinition(gameCardDefinitions, expeditionCard.defId);
    const isAnotherShield = duplicateDef?.ability === 'captainShield';
    if (gameState.getShieldActive() && !isAnotherShield) {
      burnManager.absorbDuplicateWithShield(expeditionCard);
      return playerDecision();
    }
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
 * RESOLVE_ABILITY -> PLAYER_CHOICE (a human's targeted-ability selection
 * is pending — Prompt 014) | PLAYER_DECISION (safe, resolved
 * immediately) | SHIPWRECK (a chain-generated card turned out to be a
 * duplicate — GDD §14.4-14.6).
 *
 * GDD §8 Step 4 / §12/§13: resolves expeditionCard's ability (if any) via
 * abilityResolver.resolveAbility() (through finishResolveAbility() below),
 * which also drains its own internal Resolution Queue for any further
 * contexts the ability generates. Looks the card's definition up via
 * cardManager.getDefinition() since abilityResolver operates on
 * definitions (for their `.ability` key), never on bare CardInstances.
 * Cards with no ability (ability key = null, e.g. Gold Coin) legitimately
 * no-op inside abilityResolver — nothing special is done for them here.
 *
 * Prompt 014: before resolving anything, checks whether this ability is
 * even a targeted one at all (abilityManager.needsTargetSelection()) —
 * Compass/Captain Shield/Sea Serpent/Treasure Chest+Golden Key/Gold Coin
 * all return false here and skip straight to finishResolveAbility(),
 * unchanged from Prompt 010/010b. For a targeted ability
 * (Cannon/Dagger/Anchor/Map) with at least one real eligible option: a
 * human current player PAUSES at PLAYER_CHOICE — see this function's own
 * header block above for the full rationale — and resolveAbilityChoice()
 * (below) is what resumes it; an AI current player (Prompt 015) instead
 * resolves immediately, using playerManager.chooseAbilityTarget() to pick
 * a target deterministically (first eligible option, GDD §17) and
 * buildAbilityTargetContext() (below) to turn that choice into the same
 * AbilityContext fields a human's own selection would produce — the
 * "same code path, different input source" this codebase's Prompt 014
 * notes already promised.
 */
function resolveAbility(expeditionCard) {
  gameState.setPhase(PHASES.RESOLVE_ABILITY);
  const current = gameState.getCurrentPlayer();
  const definition = cardManager.getDefinition(gameCardDefinitions, expeditionCard.defId);
  const abilityKey = definition?.ability ?? null;

  // Prompt 014: a stale preview from an EARLIER Compass reveal (this
  // turn or a previous one) must never leak into modalManager.js's
  // rendering of THIS card's own resolution — GameState.abilityContext
  // is otherwise never cleared automatically (only Compass's own handler
  // ever sets it), so every new ability resolution starts clean; Compass
  // re-sets it immediately below if this card IS one.
  gameState.clearAbilityContext();

  if (current && abilityManager.needsTargetSelection(abilityKey)) {
    const eligibleOptions = abilityManager.getEligibleTargets(abilityKey, current.id);
    if (eligibleOptions.length > 0) {
      if (current.isAI) {
        const selection = playerManager.chooseAbilityTarget(eligibleOptions);
        log.debug('AI ability target selected — resolving immediately', {
          playerId: current.id,
          ability: abilityKey,
          selection,
        });
        return finishResolveAbility(expeditionCard, definition, buildAbilityTargetContext(selection));
      }

      gameState.setPendingAbilityChoice({
        ability: abilityKey,
        expeditionCardInstanceId: expeditionCard.instanceId,
        currentPlayerId: current.id,
        options: eligibleOptions,
      });
      gameState.setPhase(PHASES.PLAYER_CHOICE);
      log.info('Awaiting human ability target selection — paused at PLAYER_CHOICE', {
        playerId: current.id,
        ability: abilityKey,
        optionCount: eligibleOptions.length,
      });
      return gameState.getPhase();
    }
    log.debug('Targeted ability has no eligible target right now — resolving immediately with no target', {
      playerId: current.id,
      ability: abilityKey,
    });
  }

  return finishResolveAbility(expeditionCard, definition, {});
}

/**
 * Builds the target-selection AbilityContext fields generically, straight
 * from whichever field names `selection` itself carries
 * (`targetPlayerId`/`targetCardId` for Cannon/Dagger/Map, `cargoCardId`
 * for Anchor) — never a hard-coded per-ability switch (rule 4), since
 * every ability's own getEligibleTargets() already chose its own option
 * shape and every ability's own handler already reads exactly those
 * AbilityContext field names (see each abilities/*.js module's header).
 * Shared by both the human path (resolveAbilityChoice(), resuming a
 * PLAYER_CHOICE pause) and the AI path (resolveAbility() above, resolving
 * immediately, Prompt 015) — the one place this mapping is written.
 *
 * @param {object} selection - one of a targeted ability's own
 *   getEligibleTargets() options
 * @returns {object} AbilityContext fields to merge in
 */
function buildAbilityTargetContext(selection) {
  const targetContext = {};
  if (selection.targetPlayerId) {
    targetContext.targetPlayer = gameState.getPlayer(selection.targetPlayerId);
  }
  if (selection.targetCardId) {
    targetContext.targetCardId = selection.targetCardId;
  }
  if (selection.cargoCardId) {
    targetContext.cargoCardId = selection.cargoCardId;
  }
  return targetContext;
}

/**
 * Shared tail end of ability resolution — called from resolveAbility()
 * itself (no target needed, none eligible, or an AI's immediate
 * deterministic target, Prompt 015) or from resolveAbilityChoice() (a
 * human's target, just resumed from a PLAYER_CHOICE pause). Exactly the
 * Stage A resolveAbility() body, factored out so every call site shares
 * one Shipwreck-check/continuation path.
 *
 * @param {object} expeditionCard - the CardInstance whose ability this is
 * @param {object} definition - its card definition (for `.ability`)
 * @param {object} targetContext - extra AbilityContext fields to merge in
 *   (e.g. `{targetPlayer, targetCardId}` or `{cargoCardId}`) — `{}` when
 *   no target applies.
 */
function finishResolveAbility(expeditionCard, definition, targetContext) {
  const current = gameState.getCurrentPlayer();

  const result = abilityResolver.resolveAbility(
    definition,
    { currentPlayer: current, reason: 'reveal', ...targetContext },
    gameCardDefinitions
  );

  if (result.shipwreckedCard) {
    log.info('A chain-generated card duplicated during ability resolution — Shipwreck required', {
      instanceId: result.shipwreckedCard.instanceId,
      defId: result.shipwreckedCard.defId,
    });
    return shipwreck(result.shipwreckedCard);
  }

  log.debug('Ability resolution complete', {
    instanceId: expeditionCard.instanceId,
    ability: definition?.ability ?? null,
    processedCount: result.processedCount,
  });
  return playerDecision();
}

/**
 * PLAYER_CHOICE -> PLAYER_DECISION (safe) | SHIPWRECK. Resumes a
 * RESOLVE_ABILITY that paused for a human's targeted-ability selection
 * (Prompt 014) — modalManager.js (via gameManager.chooseAbilityTarget())
 * is the only caller in real play. `selection` must be exactly one of
 * the option objects gameState.getPendingAbilityChoice().options offered
 * (compared by value, via JSON serialization — every option is already a
 * small, flat, JSON-safe object, since abilityManager's
 * getEligibleTargets() functions build them that way). An AI's own
 * targeted-ability choice (Prompt 015) never pauses at PLAYER_CHOICE at
 * all — see resolveAbility() above — so it never calls this function;
 * the two paths share only buildAbilityTargetContext(), the "same code
 * path, different input source" this codebase's Prompt 014 notes
 * promised.
 *
 * Builds the target-selection AbilityContext fields generically, straight
 * from whichever field names `selection` itself carries
 * (`targetPlayerId`/`targetCardId` for Cannon/Dagger/Map,
 * `cargoCardId` for Anchor) — never a hard-coded per-ability switch here
 * (rule 4), since every ability's own getEligibleTargets() already chose
 * its own option shape and every ability's own handler already reads
 * exactly those AbilityContext field names (see each abilities/*.js
 * module's header).
 *
 * @param {object} selection - one of the pending choice's own `options`
 * @returns {string} the phase the state machine settled on next
 */
function resolveAbilityChoice(selection) {
  const pending = gameState.getPendingAbilityChoice();
  if (!pending) {
    throw new Error('turnManager.resolveAbilityChoice: no ability choice is currently pending');
  }

  const serializedSelection = JSON.stringify(selection);
  const isValidOption = pending.options.some((option) => JSON.stringify(option) === serializedSelection);
  if (!isValidOption) {
    throw new Error('turnManager.resolveAbilityChoice: selection is not one of the pending eligible options');
  }

  const expeditionCard = gameState
    .getExpeditionArea()
    .find((card) => card.instanceId === pending.expeditionCardInstanceId);
  if (!expeditionCard) {
    throw new Error('turnManager.resolveAbilityChoice: the pending choice\'s own card is no longer in the Expedition Area');
  }
  const definition = cardManager.getDefinition(gameCardDefinitions, expeditionCard.defId);
  const targetContext = buildAbilityTargetContext(selection);

  gameState.clearPendingAbilityChoice();
  log.info('Human ability target selected — resuming RESOLVE_ABILITY', {
    ability: pending.ability,
    playerId: pending.currentPlayerId,
    selection,
  });

  return finishResolveAbility(expeditionCard, definition, targetContext);
}

/**
 * PLAYER_DECISION -> DRAW_CARD (explore) | RETURN_TO_SHIP (return).
 *
 * AI players (current.isAI === true) resolve immediately using
 * playerManager.decideAction() (GDD §15 MVP threshold, Prompt 015) —
 * same call stack, no pause.
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
    const decision = playerManager.decideAction(expeditionSize);
    log.debug('AI player decision', {
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
  resolveAbilityChoice,
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
  resolveAbilityChoice,
  playerDecision,
  returnToShip,
  endTurn,
  gameEnd,
  scoring,
};
