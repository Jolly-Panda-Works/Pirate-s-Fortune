/**
 * abilities/pirateDagger.js
 *
 * GDD §14.4 — Pirate Dagger: steals one card from a rival's Ship Cargo
 * and introduces it into the CURRENT expedition's resolution flow (a
 * chain ability — GDD §13).
 * Implemented: Phase 10b (Chain Abilities) — Prompt 010b.
 *
 * Target selection (Prompt 014 — modalManager.js) supplies the target
 * via the AbilityContext, exactly as it always has (same shape as
 * Cannon, GDD §14.2):
 *   context.targetPlayer  - the rival Player object being targeted
 *   context.targetCardId  - the instanceId of the CardInstance, within
 *                           that rival's Ship Cargo, to steal
 * This module's own getEligibleTargets() (below) is what modalManager.js
 * (via turnManager.js) uses to render the actual selectable list.
 *
 * Unlike Cannon (which destroys the target permanently, to Lost Loot),
 * Dagger puts the stolen card back into play: it's removed from the
 * rival's cargo and handed to abilityResolver.js's Resolution Queue via
 * `enqueue({ cardInstance, ... })`, which runs it through the full Card
 * Resolution Order (enters the Expedition Area, duplicate-checked, then
 * its own ability if it has one) exactly like a normally-drawn card — so
 * a stolen card CAN cause a Shipwreck (losing the whole expedition,
 * including the theft) if it happens to duplicate a type already present.
 * That risk is the point of a "steal" rather than a guaranteed gain.
 *
 * Eligibility (both enforced defensively, not as thrown errors — an
 * invalid/stale target is a legitimate runtime situation once real UI
 * selection exists, not a programmer bug — same posture as Cannon):
 *  - context.targetPlayer must be a DIFFERENT player than the current one.
 *  - context.targetCardId must reference a CardInstance that is
 *    currently, actually present in that player's Ship Cargo.
 * Either failing is a no-op (logged), not a thrown error.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - Registered under the ability key from data/cards.json
 *    ("pirateDagger") via abilityManager — nothing else in the codebase
 *    checks for this ability by name (rule 4).
 *  - UI never mutates GameState directly — this module is one of the
 *    sanctioned callers of gameState.js's mutators.
 */

import { createLogger } from '../logger.js';
import * as gameState from '../gameState.js';
import * as abilityManager from '../abilityManager.js';

const log = createLogger('abilities/pirateDagger');

/**
 * @param {object} context - AbilityContext (GDD §12.1), with
 *   `targetPlayer`/`targetCardId` populated (see module docstring)
 * @param {(ctx: object) => void} enqueue - Resolution Queue callback
 *   (abilityResolver.js)
 */
function handlePirateDagger(context, enqueue) {
  const currentPlayerId = context.currentPlayer?.id ?? null;
  const targetPlayerId = context.targetPlayer?.id ?? null;
  const targetCardId = context.targetCardId ?? null;

  if (!targetPlayerId || !targetCardId) {
    log.info('Pirate Dagger: no target supplied — no-op (a human or an AI with no eligible target lands here — Prompt 015)', {
      currentPlayerId,
    });
    return;
  }

  if (targetPlayerId === currentPlayerId) {
    log.warn('Pirate Dagger: cannot steal from your own Ship Cargo — ineligible target, no-op', {
      currentPlayerId,
    });
    return;
  }

  const targetPlayer = gameState.getPlayer(targetPlayerId);
  if (!targetPlayer) {
    log.warn('Pirate Dagger: target player does not exist — no-op', { targetPlayerId });
    return;
  }

  const stolenCard = (targetPlayer.shipCargo ?? []).find((card) => card.instanceId === targetCardId);
  if (!stolenCard) {
    log.warn("Pirate Dagger: target card not found in target player's Ship Cargo — ineligible, no-op", {
      targetPlayerId,
      targetCardId,
    });
    return;
  }

  const remainingCargo = targetPlayer.shipCargo.filter((card) => card.instanceId !== targetCardId);
  gameState.updatePlayer(targetPlayerId, { shipCargo: remainingCargo });

  enqueue({
    cardInstance: stolenCard,
    currentPlayer: context.currentPlayer,
    reason: 'stolen',
    parentAbility: 'pirateDagger',
  });

  log.info('Pirate Dagger: stole a card, returning it to the resolution flow', {
    currentPlayerId,
    targetPlayerId,
    stolenInstanceId: stolenCard.instanceId,
    defId: stolenCard.defId,
  });
}

/**
 * Every currently-eligible Dagger target: one entry per card in every
 * OTHER player's Ship Cargo — identical eligibility shape to Cannon's own
 * getEligibleTargets() (both target "a card in a rival's Ship Cargo"),
 * kept as its own independent function rather than a shared import to
 * keep each ability module self-contained (matches the project's
 * existing one-module-per-ability discipline).
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

abilityManager.registerAbility('pirateDagger', handlePirateDagger, { getEligibleTargets });

export { handlePirateDagger, getEligibleTargets };
