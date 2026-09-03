/**
 * collectManager.js
 *
 * Responsibility: Handles Return to Ship (GDD §10).
 * Implemented: Phase 7 (Collection) — Prompt 007.
 * Updated: Phase 10b (Chain Abilities) — Prompt 010b.
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
 * Prompt 010b (GDD §14.8): Treasure Chest + Golden Key is the one ability
 * that triggers on Return to Ship rather than normal reveal resolution —
 * after securing cards but BEFORE the final sort, this module resolves
 * that ability (via abilityResolver.resolveAbility(), the same entry
 * point every other ability goes through) for each just-secured card that
 * has it, letting its handler add a bonus card directly to cargo. Sorting
 * happens once, after all such triggers, so the bonus card ends up in the
 * right position too.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - No hard-coded card names — dispatch/comparison is by a card
 *    definition's `value`/`type`/`ability` keys only, never `name` or `id`.
 *  - UI never mutates GameState directly — this module is one of the
 *    sanctioned callers of gameState.js's mutators, never uiManager.js.
 */

import { createLogger } from './logger.js';
import * as gameState from './gameState.js';
import * as cardManager from './cardManager.js';
import * as abilityResolver from './abilityResolver.js';

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
 * touched, only appended to — no duplication, no loss), triggers any
 * Treasure Chest + Golden Key among the just-secured cards (GDD §14.8 —
 * may add a bonus card from Lost Loot), re-sorts the full resulting
 * cargo lowest-to-highest by value (tie-break by type), and clears the
 * Expedition Area.
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

  // Append (unsorted) BEFORE triggering any Treasure Chest + Golden Key —
  // its handler reads/writes gameState.getPlayer(playerId).shipCargo
  // directly, so cargo must already reflect this expedition's haul before
  // it runs, or its bonus card would be silently overwritten by this
  // function's own final update below.
  gameState.updatePlayer(playerId, {
    shipCargo: [...(player.shipCargo ?? []), ...securedCards],
  });

  for (const card of securedCards) {
    const definition = cardManager.getDefinition(cardDefinitions, card.defId);
    if (definition?.ability !== 'treasureChestGoldenKey') continue;
    abilityResolver.resolveAbility(
      definition,
      { currentPlayer: gameState.getPlayer(playerId), reason: 'returnToShip' },
      cardDefinitions
    );
  }

  const finalPlayer = gameState.getPlayer(playerId);
  const sortedCargo = [...finalPlayer.shipCargo].sort((a, b) => compareForCargo(a, b, cardDefinitions));
  gameState.updatePlayer(playerId, { shipCargo: sortedCargo });
  gameState.clearExpeditionArea();

  log.info('Returned to ship', {
    playerId,
    cardsSecured: securedCards.length,
    cargoSize: sortedCargo.length,
  });

  return securedCards;
}

export { returnToShip, compareForCargo };

export default { returnToShip, compareForCargo };
