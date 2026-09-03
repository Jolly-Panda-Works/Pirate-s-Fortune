/**
 * abilities/luckyAnchor.js
 *
 * GDD §14.5 — Lucky Anchor: replays a card from the CURRENT player's own
 * Ship Cargo, returning it to the current expedition's resolution flow (a
 * chain ability — GDD §13).
 * Implemented: Phase 10b (Chain Abilities) — Prompt 010b.
 *
 * Card-selection UI doesn't exist yet (arrives Prompt 014) — the card is
 * accepted directly on the AbilityContext:
 *   context.cargoCardId - the instanceId of the CardInstance, within the
 *                         CURRENT player's own Ship Cargo, to replay
 *
 * Design decision (GDD §14.5 doesn't spell out whether "replay" removes
 * the card from cargo or duplicates it there): removing it is the only
 * reading consistent with the rest of this game's economy — cards aren't
 * ever duplicated out of nowhere elsewhere in the ruleset, and gambling
 * an already-secured card back into risk (it could Shipwreck the whole
 * expedition, including itself, if its type duplicates one already
 * present) is what makes this an interesting, risky ability rather than
 * a pure freebie. The removed card is handed to abilityResolver.js's
 * Resolution Queue via `enqueue({ cardInstance, ... })`, running it
 * through the full Card Resolution Order exactly like a normally-drawn
 * card.
 *
 * Eligibility (a no-op, not a thrown error — a stale/invalid selection is
 * a legitimate runtime situation once real UI selection exists):
 *  - context.cargoCardId must reference a CardInstance that is
 *    currently, actually present in the CURRENT player's own Ship Cargo.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - Registered under the ability key from data/cards.json
 *    ("luckyAnchor") via abilityManager — nothing else in the codebase
 *    checks for this ability by name (rule 4).
 *  - UI never mutates GameState directly — this module is one of the
 *    sanctioned callers of gameState.js's mutators.
 */

import { createLogger } from '../logger.js';
import * as gameState from '../gameState.js';
import * as abilityManager from '../abilityManager.js';

const log = createLogger('abilities/luckyAnchor');

/**
 * @param {object} context - AbilityContext (GDD §12.1), with
 *   `cargoCardId` populated (see module docstring)
 * @param {(ctx: object) => void} enqueue - Resolution Queue callback
 *   (abilityResolver.js)
 */
function handleLuckyAnchor(context, enqueue) {
  const currentPlayerId = context.currentPlayer?.id ?? null;
  const cargoCardId = context.cargoCardId ?? null;

  if (!currentPlayerId || !cargoCardId) {
    log.info('Lucky Anchor: no cargo card selected — no-op (real selection UI arrives Prompt 014)', {
      currentPlayerId,
    });
    return;
  }

  const currentPlayer = gameState.getPlayer(currentPlayerId);
  if (!currentPlayer) {
    log.warn('Lucky Anchor: current player does not exist — no-op', { currentPlayerId });
    return;
  }

  const replayedCard = (currentPlayer.shipCargo ?? []).find((card) => card.instanceId === cargoCardId);
  if (!replayedCard) {
    log.warn("Lucky Anchor: selected card not found in the current player's Ship Cargo — ineligible, no-op", {
      currentPlayerId,
      cargoCardId,
    });
    return;
  }

  const remainingCargo = currentPlayer.shipCargo.filter((card) => card.instanceId !== cargoCardId);
  gameState.updatePlayer(currentPlayerId, { shipCargo: remainingCargo });

  enqueue({
    cardInstance: replayedCard,
    currentPlayer: context.currentPlayer,
    reason: 'replayed',
    parentAbility: 'luckyAnchor',
  });

  log.info('Lucky Anchor: replayed a card from Ship Cargo back into the resolution flow', {
    currentPlayerId,
    replayedInstanceId: replayedCard.instanceId,
    defId: replayedCard.defId,
  });
}

abilityManager.registerAbility('luckyAnchor', handleLuckyAnchor);

export { handleLuckyAnchor };
