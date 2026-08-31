/**
 * collectManager.js
 *
 * Responsibility: Handles Return to Ship (GDD §10).
 * Implemented: Phase 7 (Collection) — Prompt 007.
 *
 * GDD §10: when a player Returns to Ship, every card currently in the
 * Expedition Area is secured into that player's Ship Cargo, Ship Cargo is
 * sorted lowest-to-highest by value (tie-broken by type, per Prompt 007's
 * exit criteria), and the Expedition Area is cleared. This module owns that
 * aftermath ONLY — mirroring burnManager.js's split for Shipwreck (GDD §9):
 * it never decides *when* to return (that is turnManager.js's
 * PLAYER_DECISION step) and never touches turnHistory or turn advancement
 * (turnManager.js's returnToShip()/endTurn() own both).
 *
 * This replaces the inline, unsorted "move Expedition Area -> cargo" logic
 * turnManager.js used as a Prompt 005 stub — turnManager.returnToShip() now
 * delegates here instead of mutating gameState directly.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - No hard-coded card names — dispatch/comparison is by a card
 *    definition's `value`/`type` keys only, never `name` or `id`.
 *  - UI never mutates GameState directly — this module is one of the
 *    sanctioned callers of gameState.js's mutators, never uiManager.js.
 */

import { createLogger } from './logger.js';
import * as gameState from './gameState.js';
import * as cardManager from './cardManager.js';

const log = createLogger('collectManager');

/**
 * Comparator for Ship Cargo ordering (GDD §10: "Cargo is sorted
 * lowest-to-highest"; Prompt 007: "tie-break by type for stable
 * ordering"). Looks up each CardInstance's definition via
 * cardManager.getDefinition() — a CardInstance only ever stores defId,
 * never value/type directly (rule 4).
 *
 * @param {object} a - CardInstance
 * @param {object} b - CardInstance
 * @param {Array<object>} cardDefinitions - parsed data/cards.json `.cards`
 * @returns {number} negative if a sorts before b, positive if after, 0 if equal
 */
function compareForCargo(a, b, cardDefinitions) {
  const defA = cardManager.getDefinition(cardDefinitions, a.defId);
  const defB = cardManager.getDefinition(cardDefinitions, b.defId);

  if (!defA || !defB) {
    throw new Error(
      'collectManager.compareForCargo: unknown defId — cardDefinitions is missing this card'
    );
  }

  if (defA.value !== defB.value) {
    return defA.value - defB.value;
  }
  if (defA.type < defB.type) return -1;
  if (defA.type > defB.type) return 1;
  return 0;
}

/**
 * GDD §10 Return to Ship: moves every card currently in the Expedition
 * Area into `playerId`'s Ship Cargo, merges it with whatever cargo that
 * player already had (cards already secured on earlier turns are never
 * touched, only appended to — no duplication, no loss), re-sorts the full
 * merged cargo lowest-to-highest by value (tie-break by type), and clears
 * the Expedition Area.
 *
 * Does not append a turnHistory entry and does not end the turn —
 * turnManager.js's returnToShip() does both immediately after calling this.
 *
 * @param {string} playerId - the player securing the current expedition
 * @param {Array<object>} cardDefinitions - parsed data/cards.json `.cards`
 * @returns {Array<object>} the CardInstance[] that were just secured (i.e.
 *   what had been in the Expedition Area, now re-zoned to cargo) — NOT the
 *   player's full cargo; callers that want the full cargo should read it
 *   back via gameState.getPlayer()/gameManager.getPlayer().
 */
function returnToShip(playerId, cardDefinitions) {
  const player = gameState.getPlayer(playerId);
  if (!player) {
    throw new Error(`collectManager.returnToShip: no player with id "${playerId}"`);
  }

  const expeditionCards = gameState.getExpeditionArea();
  const securedCards = expeditionCards.map((card) =>
    cardManager.moveInstance(card, cardManager.ZONES.CARGO, playerId)
  );

  const mergedCargo = [...(player.shipCargo ?? []), ...securedCards].sort((a, b) =>
    compareForCargo(a, b, cardDefinitions)
  );

  gameState.updatePlayer(playerId, { shipCargo: mergedCargo });
  gameState.clearExpeditionArea();

  log.info('Returned to ship', {
    playerId,
    cardsSecured: securedCards.length,
    cargoSize: mergedCargo.length,
  });

  return securedCards;
}

export { returnToShip, compareForCargo };

export default { returnToShip, compareForCargo };
