/**
 * abilities/seaSerpent.js
 *
 * GDD §14.6 — Sea Serpent: forces an additional card reveal directly from
 * the Treasure Deck, introduced into the current expedition's resolution
 * flow (a chain ability — GDD §13). The forced card follows the complete
 * Card Resolution Order — including its own ability, if it has one and
 * survives the duplicate check — handled entirely by abilityResolver.js's
 * Resolution Queue, never by this handler calling itself or
 * resolveAbility() again. In practice, a forced reveal that is ALSO a
 * Sea Serpent can never itself chain further: every Sea Serpent card
 * shares the single type "seaSerpent", so a second one always duplicates
 * the first and halts the queue (Shipwreck), before its own ability would
 * ever run — the chain only continues when the forced card is a
 * DIFFERENT, not-yet-present type.
 * Implemented: Phase 10b (Chain Abilities) — Prompt 010b.
 *
 * Design decision (GDD §29.6 graceful degradation): if the Treasure Deck
 * is empty when Sea Serpent tries to force a reveal, this is a pure
 * no-op — no card to force, no chain continues, no error. Whether an
 * empty deck here should also immediately end the game (GDD §GAME_END is
 * normally driven by turnManager's endTurn() checking deck emptiness
 * between TURNS, not mid-resolution) is left to that same check: the very
 * next endTurn() call after this turn concludes will see the same empty
 * deck and route to GAME_END exactly as it already does today. Nothing
 * additional is needed here.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - Registered under the ability key from data/cards.json ("seaSerpent")
 *    via abilityManager — nothing else in the codebase checks for this
 *    ability by name (rule 4).
 *  - UI never mutates GameState directly — this module is one of the
 *    sanctioned callers of gameState.js's mutators (indirectly, via
 *    deckManager.js's drawFromTreasureDeck(), the same function every
 *    normal draw already uses).
 */

import { createLogger } from '../logger.js';
import * as deckManager from '../deckManager.js';
import * as abilityManager from '../abilityManager.js';

const log = createLogger('abilities/seaSerpent');

/**
 * @param {object} context - AbilityContext (GDD §12.1)
 * @param {(ctx: object) => void} enqueue - Resolution Queue callback
 *   (abilityResolver.js)
 */
function handleSeaSerpent(context, enqueue) {
  const drawnCard = deckManager.drawFromTreasureDeck();

  if (!drawnCard) {
    log.info('Sea Serpent: Treasure Deck is empty — no forced reveal, graceful no-op', {
      playerId: context.currentPlayer?.id ?? null,
    });
    return;
  }

  enqueue({
    cardInstance: drawnCard,
    currentPlayer: context.currentPlayer,
    reason: 'forced',
    parentAbility: 'seaSerpent',
  });

  log.info('Sea Serpent: forced an additional card reveal', {
    playerId: context.currentPlayer?.id ?? null,
    defId: drawnCard.defId,
  });
}

abilityManager.registerAbility('seaSerpent', handleSeaSerpent);

export { handleSeaSerpent };
