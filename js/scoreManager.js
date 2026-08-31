/**
 * scoreManager.js
 *
 * Responsibility: Handles scoring and tie-breaking (GDD §11).
 * Implemented: Phase 8 (Scoring) — Prompt 008.
 *
 * Pure, stateless helper layer — like cardManager.js, this module never
 * touches GameState directly (it has no gameState.js import). It operates
 * only on the Player objects and card definitions it's given; turnManager.js
 * is responsible for reading players from gameState, calling these
 * functions, and writing the results back via gameState's mutators.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - No hard-coded card names — every lookup goes through a card
 *    definition's `type`/`value` keys via cardManager.getDefinition(),
 *    never a literal name string.
 *  - UI never mutates GameState directly — this module doesn't mutate
 *    GameState at all.
 */

import { createLogger } from './logger.js';
import * as cardManager from './cardManager.js';

const log = createLogger('scoreManager');

/**
 * GDD §11: a player's score is the sum of the HIGHEST card value per
 * distinct type present in their Ship Cargo. Extra, lower-value cards of
 * an already-represented type contribute nothing beyond that type's max.
 *
 * @param {object} player - a Player record (GDD §16); only `shipCargo` is
 *   read (CardInstance[] — each only stores `defId`, so definitions must
 *   be supplied to resolve `type`/`value`).
 * @param {Array<object>} cardDefinitions - parsed data/cards.json `.cards`
 * @returns {number} the player's total score
 */
function calculateScore(player, cardDefinitions) {
  const bestValueByType = new Map();

  for (const card of player?.shipCargo ?? []) {
    const definition = cardManager.getDefinition(cardDefinitions, card.defId);
    if (!definition) {
      log.warn('calculateScore: unknown defId in shipCargo — skipping', {
        playerId: player?.id,
        defId: card.defId,
      });
      continue;
    }
    const currentBest = bestValueByType.get(definition.type);
    if (currentBest === undefined || definition.value > currentBest) {
      bestValueByType.set(definition.type, definition.value);
    }
  }

  let total = 0;
  for (const value of bestValueByType.values()) {
    total += value;
  }
  return total;
}

/**
 * GDD §11.1: highest score wins. On a score tie, the player(s) with the
 * most total cards in Ship Cargo win. If that is ALSO tied, every
 * remaining tied player is returned — no invented tiebreaker beyond what
 * the GDD specifies.
 *
 * Expects each player's `.score` to already be populated (typically via
 * calculateScore(), applied by the caller before invoking this) — this
 * function does not recompute scores itself, since cargo-count
 * tie-breaking needs the players array either way and re-deriving score
 * here would require the same cardDefinitions parameter for no benefit.
 *
 * @param {Array<object>} players - Player[] (GDD §16), each with a numeric
 *   `.score` and a `.shipCargo` array
 * @returns {Array<object>} the winning player(s) — length 1 unless a
 *   genuine, fully unresolved tie remains
 */
function determineWinner(players) {
  if (!Array.isArray(players) || players.length === 0) {
    return [];
  }

  const maxScore = Math.max(...players.map((p) => p.score ?? 0));
  const topScorers = players.filter((p) => (p.score ?? 0) === maxScore);

  if (topScorers.length === 1) {
    return topScorers;
  }

  const maxCargoCount = Math.max(...topScorers.map((p) => (p.shipCargo ?? []).length));
  const topCargoScorers = topScorers.filter(
    (p) => (p.shipCargo ?? []).length === maxCargoCount
  );

  // Either the cargo-count tiebreaker resolved it down to one player, or
  // every remaining candidate is genuinely, fully tied — both cases are
  // exactly what's returned here, with no further invented tiebreaker.
  return topCargoScorers;
}

export { calculateScore, determineWinner };

export default { calculateScore, determineWinner };
