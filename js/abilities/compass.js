/**
 * abilities/compass.js
 *
 * GDD §14.1 — Compass: mandatory preview flow.
 * Implemented: Phase 10a (Single-Resolution Abilities) — Prompt 010.
 *
 *   COMPASS_REVEALED
 *     -> peek top card of Treasure Deck
 *     -> emit a "preview" state (GameState.abilityContext)
 *     -> PLAYER_CHOICE (Return to Ship / Explore Further — the EXISTING
 *        PLAYER_DECISION step already handles this; Compass doesn't need
 *        its own decision phase)
 *
 * "The exact previewed card becomes the next draw — it must not be
 * replaced" (GDD §14.1) is satisfied structurally, not by any special
 * casing here: this handler only READS gameState.getTreasureDeck()[0]
 * (index 0 is the deck's top — deckManager.drawFromTreasureDeck() shifts
 * from that same index), it never removes or reorders anything. As long
 * as nothing else touches the Treasure Deck between now and the player's
 * next draw (nothing does — RESOLVE_ABILITY/PLAYER_DECISION never mutate
 * it), the natural next drawCard() call is guaranteed to return this
 * exact CardInstance.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - Registered under the ability key from data/cards.json ("compass")
 *    via abilityManager — nothing else in the codebase checks for this
 *    ability by name (rule 4).
 */

import { createLogger } from '../logger.js';
import * as gameState from '../gameState.js';
import * as abilityManager from '../abilityManager.js';

const log = createLogger('abilities/compass');

/**
 * @param {object} context - AbilityContext (GDD §12.1); `context.source`
 *   is the Compass card's own definition, unused here since Compass's
 *   effect concerns the Treasure Deck, not itself.
 */
function handleCompass(context) {
  const topCard = gameState.getTreasureDeck()[0] ?? null;

  gameState.setAbilityContext({
    ability: 'compass',
    playerId: context.currentPlayer?.id ?? null,
    peekedInstanceId: topCard?.instanceId ?? null,
    peekedDefId: topCard?.defId ?? null,
  });

  log.info('Compass: peeked top of Treasure Deck', {
    playerId: context.currentPlayer?.id,
    peekedDefId: topCard?.defId ?? null,
    deckEmpty: topCard === null,
  });
}

abilityManager.registerAbility('compass', handleCompass);

export { handleCompass };
