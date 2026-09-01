/**
 * burnManager.js
 *
 * Responsibility: Handles Shipwreck / duplicate resolution (GDD §9).
 * Implemented: Phase 6 (Duplicate / Shipwreck) — Prompt 006.
 *
 * Card Resolution Order (GDD §8) Step 3 + GDD §9, isolated as two named
 * functions so the ordering (duplicate check, THEN — only if duplicate —
 * the Shipwreck aftermath) can never be silently inlined/reordered by a
 * future change:
 *
 *   isDuplicate(candidate, expeditionArea, cardDefinitions)
 *     -> true/false, no side effects.
 *   triggerShipwreck()
 *     -> the aftermath ONLY: moves every card currently in the Expedition
 *        Area to Lost Loot and clears the Expedition Area. Never resolves
 *        an ability, never decides whether a card was a duplicate — that
 *        is turnManager.js's job (it calls isDuplicate() in
 *        CHECK_DUPLICATE and only calls triggerShipwreck() from its
 *        SHIPWRECK step when isDuplicate() returned true, going straight
 *        there instead of RESOLVE_ABILITY — this is what structurally
 *        guarantees the duplicate's own ability never executes, GDD §9).
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - No hard-coded card names — dispatch/comparison is by a card
 *    definition's `type` key only, never `name` or `id`.
 *  - UI never mutates GameState directly — this module is one of the
 *    sanctioned callers of gameState.js's mutators, never uiManager.js.
 */

import { createLogger } from './logger.js';
import * as gameState from './gameState.js';
import * as cardManager from './cardManager.js';

const log = createLogger('burnManager');

/**
 * GDD §8 Step 3: "The new card's type/symbol is compared with all previous
 * cards in the current Expedition Area." In data/cards.json every
 * definition's `symbol` always mirrors its `type` (verified by Prompt 001's
 * data), so comparing `type` alone is equivalent — this avoids checking two
 * redundant keys for the same comparison.
 *
 * Looks up each CardInstance's definition via cardManager.getDefinition()
 * (the sanctioned defId -> definition path, rule 4) since a CardInstance
 * itself only stores defId, never its type directly.
 *
 * @param {object} candidateCard - the CardInstance that just entered the
 *   Expedition Area (may already be present in expeditionArea — it is
 *   never compared against itself)
 * @param {Array<object>} expeditionArea - current Expedition Area CardInstance[]
 * @param {Array<object>} cardDefinitions - parsed data/cards.json `.cards`
 * @returns {boolean} true if any OTHER card in expeditionArea shares
 *   candidateCard's type
 */
function isDuplicate(candidateCard, expeditionArea, cardDefinitions) {
  const candidateDef = cardManager.getDefinition(cardDefinitions, candidateCard.defId);
  if (!candidateDef) {
    throw new Error(
      `burnManager.isDuplicate: unknown defId "${candidateCard.defId}" — cardDefinitions is missing this card`
    );
  }

  return expeditionArea.some((other) => {
    if (other.instanceId === candidateCard.instanceId) return false; // never compare a card to itself
    const otherDef = cardManager.getDefinition(cardDefinitions, other.defId);
    return otherDef?.type === candidateDef.type;
  });
}

/**
 * GDD §9 Shipwreck aftermath: moves every card currently in the Expedition
 * Area (including the duplicate that triggered this) to Lost Loot, then
 * clears the Expedition Area. Does not touch turnHistory or advance the
 * turn — turnManager.js's endTurn() (called right after this) owns that.
 *
 * @returns {Array<object>} the CardInstance[] that were moved to Lost Loot
 */
function triggerShipwreck() {
  const expeditionCards = gameState.getExpeditionArea();
  const lostLootCards = expeditionCards.map((card) =>
    cardManager.moveInstance(card, cardManager.ZONES.LOST_LOOT, null)
  );

  gameState.addToLostLoot(lostLootCards);
  gameState.clearExpeditionArea();

  log.warn('Shipwreck triggered — Expedition Area lost', {
    cardsLost: lostLootCards.length,
    instanceIds: lostLootCards.map((c) => c.instanceId),
  });

  return lostLootCards;
}

/**
 * GDD §14.3 Captain Shield: the narrow, one-time exception to Shipwreck.
 * Called ONLY when turnManager.checkDuplicate() has confirmed all three
 * conditions hold: isDuplicate() was true, gameState.getShieldActive()
 * was true, and the duplicate is not itself another Captain Shield (a
 * Shield-vs-Shield duplicate is explicitly still a normal Shipwreck —
 * GDD §14.3's "a second Shield is still a normal duplicate" edge case;
 * that check is the CALLER's responsibility, not this function's, so it
 * stays symmetric with triggerShipwreck()/isDuplicate() never inspecting
 * ability keys themselves).
 *
 * Unlike triggerShipwreck() (which loses the ENTIRE Expedition Area),
 * this removes ONLY the duplicate card that triggered detection — to
 * Lost Loot, same destination Shipwreck uses — leaving every other card
 * already secured in this expedition untouched. The duplicate's own
 * ability still never executes (the caller routes straight to
 * playerDecision(), never resolveAbility(), for the absorbed card,
 * mirroring how triggerShipwreck() is reached instead of
 * resolveAbility() — GDD §14.3: "Shield does not grant general immunity
 * to duplicate detection beyond its specific documented effect", so nothing
 * about a shielded duplicate behaves as if it had never been a duplicate
 * at all).
 *
 * @param {object} duplicateCard - the CardInstance that triggered
 *   isDuplicate() === true (already present in the Expedition Area)
 * @returns {object} the CardInstance as moved into Lost Loot
 */
function absorbDuplicateWithShield(duplicateCard) {
  const remainingExpedition = gameState
    .getExpeditionArea()
    .filter((card) => card.instanceId !== duplicateCard.instanceId);
  const absorbedCard = cardManager.moveInstance(duplicateCard, cardManager.ZONES.LOST_LOOT, null);

  gameState.setExpeditionArea(remainingExpedition);
  gameState.addToLostLoot([absorbedCard]);
  gameState.setShieldActive(false);

  log.info('Captain Shield absorbed a duplicate — Shipwreck averted, expedition continues', {
    absorbedInstanceId: absorbedCard.instanceId,
    remainingExpeditionSize: remainingExpedition.length,
  });

  return absorbedCard;
}

export { isDuplicate, triggerShipwreck, absorbDuplicateWithShield };

export default { isDuplicate, triggerShipwreck, absorbDuplicateWithShield };
