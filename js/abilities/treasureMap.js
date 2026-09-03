/**
 * abilities/treasureMap.js
 *
 * GDD §14.7 — Treasure Map: retrieves an eligible card from Lost Loot and
 * introduces it into the current expedition's resolution flow (a chain
 * ability — GDD §13).
 * Implemented: Phase 10b (Chain Abilities) — Prompt 010b.
 *
 * Selection UI doesn't exist yet (arrives Prompt 014) — the target is
 * accepted directly on the AbilityContext:
 *   context.targetCardId - the instanceId of the CardInstance, within
 *                          Lost Loot, to retrieve. If omitted, defaults
 *                          to the first eligible card in Lost Loot (a
 *                          defensive fallback for automated/no-UI paths,
 *                          not a real "auto-pick" game rule — real
 *                          gameplay will always supply an explicit
 *                          selection once Prompt 014 lands).
 *
 * The retrieved card is removed from Lost Loot and handed to
 * abilityResolver.js's Resolution Queue via `enqueue({ cardInstance,
 * ... })`, running it through the full Card Resolution Order exactly
 * like a normally-drawn card — so retrieving from Lost Loot carries the
 * same duplicate/Shipwreck risk a normal reveal does.
 *
 * GDD §29.6 graceful degradation: an empty Lost Loot, or a
 * `targetCardId` that doesn't exist there, is a no-op (logged), not a
 * thrown error.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - Registered under the ability key from data/cards.json
 *    ("treasureMap") via abilityManager — nothing else in the codebase
 *    checks for this ability by name (rule 4).
 *  - UI never mutates GameState directly — this module is one of the
 *    sanctioned callers of gameState.js's mutators.
 */

import { createLogger } from '../logger.js';
import * as gameState from '../gameState.js';
import * as abilityManager from '../abilityManager.js';

const log = createLogger('abilities/treasureMap');

/**
 * @param {object} context - AbilityContext (GDD §12.1); `targetCardId` is
 *   optional (see module docstring)
 * @param {(ctx: object) => void} enqueue - Resolution Queue callback
 *   (abilityResolver.js)
 */
function handleTreasureMap(context, enqueue) {
  const lostLoot = gameState.getLostLoot();

  if (lostLoot.length === 0) {
    log.info('Treasure Map: Lost Loot is empty — no eligible card, graceful no-op', {
      playerId: context.currentPlayer?.id ?? null,
    });
    return;
  }

  const targetCardId = context.targetCardId ?? null;
  const retrievedCard = targetCardId
    ? lostLoot.find((card) => card.instanceId === targetCardId)
    : lostLoot[0];

  if (!retrievedCard) {
    log.warn('Treasure Map: target card not found in Lost Loot — ineligible, no-op', {
      playerId: context.currentPlayer?.id ?? null,
      targetCardId,
    });
    return;
  }

  const remainingLostLoot = lostLoot.filter((card) => card.instanceId !== retrievedCard.instanceId);
  gameState.setLostLoot(remainingLostLoot);

  enqueue({
    cardInstance: retrievedCard,
    currentPlayer: context.currentPlayer,
    reason: 'searched',
    parentAbility: 'treasureMap',
  });

  log.info('Treasure Map: retrieved a card from Lost Loot into the resolution flow', {
    playerId: context.currentPlayer?.id ?? null,
    retrievedInstanceId: retrievedCard.instanceId,
    defId: retrievedCard.defId,
  });
}

abilityManager.registerAbility('treasureMap', handleTreasureMap);

export { handleTreasureMap };
