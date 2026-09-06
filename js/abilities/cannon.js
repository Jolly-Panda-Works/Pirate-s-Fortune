/**
 * abilities/cannon.js
 *
 * GDD §14.2 — Cannon: single-resolution targeted ability. Destroys one
 * eligible rival card. Does not create a Resolution Queue chain (it never
 * calls the `enqueue` callback it's given).
 * Implemented: Phase 10a (Single-Resolution Abilities) — Prompt 010.
 *
 * Target selection (Prompt 014 — modalManager.js) supplies the target
 * via the AbilityContext, exactly as it always has:
 *   context.targetPlayer  - the rival Player object being targeted
 *   context.targetCardId  - the instanceId of the CardInstance, within
 *                           that rival's Ship Cargo, to destroy
 * This module's own getEligibleTargets() (below) is what modalManager.js
 * (via turnManager.js) uses to render the actual selectable list — the
 * handler itself never needs to know whether a target came from a human's
 * click or (Prompt 015) an AI's deterministic choice; it just validates
 * whatever context it's given, same as before.
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
    log.info('Cannon: no target supplied — no-op (a human or an AI with no eligible target lands here — Prompt 015)', {
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

/**
 * Every currently-eligible Cannon target: one entry per card in every
 * OTHER player's Ship Cargo (GDD §14.2 — "one eligible rival card").
 * Prompt 014: this is what modalManager.js renders as the selection
 * list, and the SAME function turnManager.js calls to decide whether a
 * just-revealed Cannon needs to pause for a human's choice at all (an
 * empty return means "no eligible target exists" — resolve immediately,
 * matching the graceful-degrade posture every other ability already has).
 *
 * @param {string} currentPlayerId
 * @returns {Array<{targetPlayerId: string, targetCardId: string, defId: string}>}
 */
function getEligibleTargets(currentPlayerId) {
  const options = [];
  for (const player of gameState.getPlayers()) {
    if (player.id === currentPlayerId) continue;
    for (const card of player.shipCargo ?? []) {
      options.push({ targetPlayerId: player.id, targetCardId: card.instanceId, defId: card.defId });
    }
  }
  return options;
}

abilityManager.registerAbility('cannon', handleCannon, { getEligibleTargets });

export { handleCannon, getEligibleTargets };
