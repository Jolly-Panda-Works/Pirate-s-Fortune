/**
 * cardManager.js
 *
 * Responsibility: Handles card instances and card-related operations.
 * Implemented: Phase 2 (Game State) — Prompt 002.
 *
 * This module is a pure, stateless helper layer over `data/cards.json`
 * definitions (GDD §4.1). It does NOT own any game state itself — the
 * actual zone arrays (treasureDeck/lostLoot/expeditionArea/player cargo)
 * live in gameState.js, which is the single source of truth. cardManager
 * only knows how to build a CardInstance (GDD §4.2) and how to derive a
 * "moved" copy of one; callers are responsible for placing that copy into
 * gameState via its mutators.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - No hard-coded card names — every function operates on a card
 *    definition's `defId`/`type`/`ability`, never a literal name string.
 *  - Instances are treated as immutable value objects: every function
 *    that "changes" an instance returns a brand-new object rather than
 *    mutating the one it was given, so a stray reference elsewhere can
 *    never desync from the copy gameState actually stores.
 */

import { createLogger } from './logger.js';

const log = createLogger('cardManager');

/**
 * Valid runtime zones for a CardInstance (GDD §4.2).
 * Note: these are the *runtime* zone names, distinct from the GameState
 * field names (e.g. zone "deck" holds instances that live in the
 * GameState.treasureDeck array) — turnManager/deckManager/collectManager
 * are responsible for keeping the two in sync.
 */
const ZONES = Object.freeze({
  DECK: 'deck',
  LOST_LOOT: 'lostLoot',
  EXPEDITION: 'expedition',
  CARGO: 'cargo',
});

const VALID_ZONES = new Set(Object.values(ZONES));

// Monotonic counter used to generate unique instanceIds. Deliberately not
// based on Date.now()/Math.random()/crypto so behavior stays deterministic
// and engine-independent (no browser/Node-specific RNG dependency).
let instanceCounter = 0;

/**
 * Resets the internal instanceId counter. Exists purely so tests can get
 * deterministic, predictable instanceIds across runs — never call this
 * from real gameplay code.
 */
function resetInstanceCounter() {
  instanceCounter = 0;
}

function nextInstanceId(defId) {
  instanceCounter += 1;
  return `${defId}#${instanceCounter}`;
}

function assertValidZone(zone, fnName) {
  if (!VALID_ZONES.has(zone)) {
    throw new Error(
      `cardManager.${fnName}: invalid zone "${zone}" (expected one of: ${[...VALID_ZONES].join(', ')})`
    );
  }
}

/**
 * Looks up a card definition by defId. This is the ONLY sanctioned way to
 * go from an id to a definition — nothing else in the codebase should
 * hard-code a card's name/type/ability (rule 4).
 *
 * @param {Array<object>} cardDefinitions - parsed data/cards.json `.cards`
 * @param {string} defId
 * @returns {object|null}
 */
function getDefinition(cardDefinitions, defId) {
  if (!Array.isArray(cardDefinitions)) {
    log.warn('getDefinition called with a non-array cardDefinitions');
    return null;
  }
  return cardDefinitions.find((def) => def.id === defId) ?? null;
}

/**
 * Creates a single CardInstance from a card definition.
 *
 * @param {object} cardDefinition - an entry from data/cards.json `.cards`
 * @param {string} zone - one of ZONES
 * @param {string|null} [ownerId] - player id that owns this instance, or
 *   null for definitions that aren't owned by anyone yet (deck/lostLoot).
 * @returns {{instanceId: string, defId: string, currentZone: string, ownerId: string|null}}
 */
function createCardInstance(cardDefinition, zone, ownerId = null) {
  if (!cardDefinition || typeof cardDefinition.id !== 'string') {
    throw new Error('cardManager.createCardInstance: cardDefinition with a string `id` is required');
  }
  assertValidZone(zone, 'createCardInstance');

  return {
    instanceId: nextInstanceId(cardDefinition.id),
    defId: cardDefinition.id,
    currentZone: zone,
    ownerId,
  };
}

/**
 * Creates one CardInstance per given definition, all placed in the same
 * initial zone/owner. Order is preserved (callers/deckManager decide
 * shuffling, not this function).
 *
 * @param {Array<object>} cardDefinitions
 * @param {string} zone
 * @param {string|null} [ownerId]
 * @returns {Array<object>} CardInstance[]
 */
function createInstancesFromDefinitions(cardDefinitions, zone, ownerId = null) {
  if (!Array.isArray(cardDefinitions)) {
    throw new Error('cardManager.createInstancesFromDefinitions: cardDefinitions must be an array');
  }
  return cardDefinitions.map((def) => createCardInstance(def, zone, ownerId));
}

/**
 * Returns a NEW CardInstance with its zone (and optionally owner) changed.
 * Never mutates the instance it was given — the caller (via gameState's
 * mutators) is responsible for removing the old copy from its previous
 * zone array and inserting this new one into the destination zone array.
 *
 * @param {object} instance - an existing CardInstance
 * @param {string} newZone - one of ZONES
 * @param {string|null} [newOwnerId] - defaults to the instance's current owner
 * @returns {object} a new CardInstance object
 */
function moveInstance(instance, newZone, newOwnerId = instance?.ownerId ?? null) {
  if (!instance || typeof instance.instanceId !== 'string') {
    throw new Error('cardManager.moveInstance: a valid CardInstance is required');
  }
  assertValidZone(newZone, 'moveInstance');

  return {
    ...instance,
    currentZone: newZone,
    ownerId: newOwnerId,
  };
}

export {
  ZONES,
  resetInstanceCounter,
  getDefinition,
  createCardInstance,
  createInstancesFromDefinitions,
  moveInstance,
};

export default {
  ZONES,
  resetInstanceCounter,
  getDefinition,
  createCardInstance,
  createInstancesFromDefinitions,
  moveInstance,
};
