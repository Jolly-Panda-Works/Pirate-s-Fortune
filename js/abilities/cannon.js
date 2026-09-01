/**
 * abilities/cannon.js
 *
 * GDD §14.2 — Cannon: single-resolution targeted ability. Destroys one
 * eligible rival card. Does not create a Resolution Queue chain (it never
 * calls the `enqueue` callback it's given).
 * Implemented: Phase 10a (Single-Resolution Abilities) — Prompt 010.
 *
 * Target-selection UI doesn't exist yet (arrives Prompt 014) — per the
 * prompt spec, the target is accepted directly on the AbilityContext:
 *   context.targetPlayer  - the rival Player object being targeted
 *   context.targetCardId  - the instanceId of the CardInstance, within
 *                           that rival's Ship Cargo, to destroy
 *
 * Design decision (GDD §14.2 doesn't specify a zone for "rival card" —
 * the Expedition Area is a single SHARED zone used only by whoever's turn
 * it currently is, so it never simultaneously holds a rival's cards; a
 * rival's Ship Cargo is the only zone where multiple players' cards
 * coexist distinctly, so that's what "eligible rival card" targets here):
 * destroying a card removes it from the target player's Ship Cargo and
 * relocates it to Lost Loot (cardManager.ZONES has no separate "destroyed"
 * pile — Lost Loot is the existing zone that means "no longer under any
 * player's control", matching what a destroyed card should become, and
 * gives a later ability like Treasure Map somewhere consistent to find it).
 *
 * Eligibility (both enforced defensively, not as thrown errors — an
 * invalid/stale target is a legitimate runtime situation once real UI
 * selection exists, not a programmer bug):
 *  - context.targetPlayer must be a DIFFERENT player than the current one
 *    (a rival, never yourself).
 *  - context.targetCardId must reference a CardInstance that is currently,
 *    actually present in that player's Ship Cargo.
 * Either failing is a no-op (logged), not a thrown error or a Shipwreck.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - Registered under the ability key from data/cards.json ("cannon")
 *    via abilityManager — nothing else in the codebase checks for this
 *    ability by name (rule 4).
 *  - UI never mutates GameState directly — this module is one of the
 *    sanctioned callers of gameState.js's mutators.
 */

import { createLogger } from '../logger.js';
import * as gameState from '../gameState.js';
import * as cardManager from '../cardManager.js';
import * as abilityManager from '../abilityManager.js';

const log = createLogger('abilities/cannon');

/**
 * @param {object} context - AbilityContext (GDD §12.1), with
 *   `targetPlayer`/`targetCardId` populated (see module docstring)
 */
function handleCannon(context) {
  const currentPlayerId = context.currentPlayer?.id ?? null;
  const targetPlayerId = context.targetPlayer?.id ?? null;
  const targetCardId = context.targetCardId ?? null;

  if (!targetPlayerId || !targetCardId) {
    log.info('Cannon: no target supplied — no-op (real target-selection UI arrives Prompt 014)', {
      currentPlayerId,
    });
    return;
  }

  if (targetPlayerId === currentPlayerId) {
    log.warn('Cannon: cannot target your own Ship Cargo — ineligible target, no-op', {
      currentPlayerId,
    });
    return;
  }

  const targetPlayer = gameState.getPlayer(targetPlayerId);
  if (!targetPlayer) {
    log.warn('Cannon: target player does not exist — no-op', { targetPlayerId });
    return;
  }

  const targetCard = (targetPlayer.shipCargo ?? []).find((card) => card.instanceId === targetCardId);
  if (!targetCard) {
    log.warn("Cannon: target card not found in target player's Ship Cargo — ineligible, no-op", {
      targetPlayerId,
      targetCardId,
    });
    return;
  }

  const remainingCargo = targetPlayer.shipCargo.filter((card) => card.instanceId !== targetCardId);
  const destroyedCard = cardManager.moveInstance(targetCard, cardManager.ZONES.LOST_LOOT, null);

  gameState.updatePlayer(targetPlayerId, { shipCargo: remainingCargo });
  gameState.addToLostLoot([destroyedCard]);

  log.info('Cannon: destroyed rival card', {
    currentPlayerId,
    targetPlayerId,
    destroyedInstanceId: destroyedCard.instanceId,
    defId: destroyedCard.defId,
  });
}

abilityManager.registerAbility('cannon', handleCannon);

export { handleCannon };
