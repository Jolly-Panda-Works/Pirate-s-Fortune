/**
 * deckManager.js
 *
 * Responsibility: Handles Treasure Deck and Lost Loot, including shuffle.
 * Implemented: Phase 3 (Deck System) — Prompt 003.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - No hard-coded card names — dispatch/selection is driven by
 *    `gameConfig.json`'s `initialLostLoot.cardIds` (already validated
 *    against the GDD §5.2 rule by Prompt 001's deck-model tests) and by
 *    card `type`/`ability` keys, never by display `name`.
 *  - UI never mutates GameState directly — this module is one of the
 *    sanctioned callers of gameState.js's mutators, never uiManager.js.
 *  - No DOM/browser APIs.
 *
 * Deck convention: index 0 of a deck/lostLoot array is the "top" — the
 * next card to be drawn/drawn-from. drawFromTreasureDeck() shifts from
 * the front for that reason.
 */

import { createLogger } from './logger.js';
import * as cardManager from './cardManager.js';
import * as gameState from './gameState.js';

const log = createLogger('deckManager');

// ---------------------------------------------------------------------------
// Seeded shuffle (GDD §25.3 — deterministic test scenarios).
// A tiny, dependency-free PRNG (mulberry32) so the same seed always
// produces the same shuffle order, with no reliance on Math.random when a
// seed is supplied. When no seed is given, real gameplay falls back to
// Math.random for genuine randomness.
// ---------------------------------------------------------------------------

/**
 * Hashes an arbitrary seed (number or string) down to a 32-bit unsigned
 * integer so callers can pass either a human-readable string seed
 * ("test-seed-1") or a raw number.
 */
function normalizeSeed(seed) {
  if (typeof seed === 'number') return seed >>> 0;

  // Simple string hash (djb2-ish) — deterministic, no crypto dependency.
  let hash = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = normalizeSeed(seed);
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle. Returns a NEW array — never mutates the input.
 *
 * @param {Array} array
 * @param {number|string} [seed] - when omitted, uses Math.random (non-
 *   deterministic, for real gameplay). When provided, shuffling is fully
 *   deterministic — same seed always yields the same order.
 * @returns {Array} a new, shuffled array
 */
function seededShuffle(array, seed) {
  const random = seed === undefined || seed === null ? Math.random : createSeededRandom(seed);
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Initial deck derivation (GDD §5.2 / §5.3).
// ---------------------------------------------------------------------------

/**
 * Derives the initial Treasure Deck and Lost Loot from the full set of
 * card definitions, per GDD §5.2/§5.3:
 *   - Lost Loot: the 10 cards referenced by gameConfig.initialLostLoot.cardIds
 *     (nine value-2 cards, one per non-Gold-Coin type, plus one Gold Coin
 *     value-4 card — already derived and validated once in Prompt 001, so
 *     this module consumes that single checked source instead of
 *     re-deriving the value/type rule by hand).
 *   - Treasure Deck: every remaining definition (50 cards).
 * Both are converted to CardInstances (via cardManager) and shuffled
 * independently (GDD §5.3), with an optional seed for deterministic tests.
 *
 * This function is pure — it does not touch gameState. Use
 * initializeDecks() to build AND wire the result into gameState.
 *
 * @param {Array<object>} cardDefinitions - parsed data/cards.json `.cards`
 * @param {object} config - parsed data/gameConfig.json
 * @param {{treasureSeed?: number|string, lostLootSeed?: number|string}} [options]
 * @returns {{treasureDeck: Array<object>, lostLoot: Array<object>}} CardInstance[]
 */
function buildInitialDecks(cardDefinitions, config, options = {}) {
  if (!Array.isArray(cardDefinitions)) {
    throw new Error('deckManager.buildInitialDecks: cardDefinitions must be an array');
  }
  if (!config?.initialLostLoot?.cardIds) {
    throw new Error('deckManager.buildInitialDecks: config.initialLostLoot.cardIds is required');
  }

  const lostLootIds = new Set(config.initialLostLoot.cardIds);
  const lostLootDefs = cardDefinitions.filter((def) => lostLootIds.has(def.id));
  const treasureDeckDefs = cardDefinitions.filter((def) => !lostLootIds.has(def.id));

  if (lostLootDefs.length !== lostLootIds.size) {
    throw new Error(
      `deckManager.buildInitialDecks: expected ${lostLootIds.size} Lost Loot definitions, found ${lostLootDefs.length} — check cardIds against cards.json`
    );
  }

  const lostLootInstances = cardManager.createInstancesFromDefinitions(
    lostLootDefs,
    cardManager.ZONES.LOST_LOOT
  );
  const treasureDeckInstances = cardManager.createInstancesFromDefinitions(
    treasureDeckDefs,
    cardManager.ZONES.DECK
  );

  const treasureDeck = seededShuffle(treasureDeckInstances, options.treasureSeed);
  const lostLoot = seededShuffle(lostLootInstances, options.lostLootSeed);

  log.info('Initial decks built', {
    treasureDeckCount: treasureDeck.length,
    lostLootCount: lostLoot.length,
  });

  return { treasureDeck, lostLoot };
}

/**
 * Builds the initial decks (via buildInitialDecks) AND wires the result
 * into gameState via its mutators — the sanctioned way to seed a new
 * game's decks. deckManager never mutates GameState directly by reaching
 * into internals; it only ever calls gameState's exported mutators.
 *
 * @param {Array<object>} cardDefinitions
 * @param {object} config
 * @param {{treasureSeed?: number|string, lostLootSeed?: number|string}} [options]
 * @returns {{treasureDeck: Array<object>, lostLoot: Array<object>}}
 */
function initializeDecks(cardDefinitions, config, options = {}) {
  const { treasureDeck, lostLoot } = buildInitialDecks(cardDefinitions, config, options);
  gameState.setTreasureDeck(treasureDeck);
  gameState.setLostLoot(lostLoot);
  return { treasureDeck, lostLoot };
}

// ---------------------------------------------------------------------------
// Draw.
// ---------------------------------------------------------------------------

/**
 * Draws the top card of the Treasure Deck (gameState's live deck, read via
 * its selector and written back via its mutator — never touched directly).
 * Returns null (never throws) when the deck is empty, which turnManager.js
 * (Phase 4) uses to trigger GAME_END.
 *
 * @returns {object|null} the drawn CardInstance, or null if the deck is empty
 */
function drawFromTreasureDeck() {
  const deck = gameState.getTreasureDeck();

  if (deck.length === 0) {
    log.info('drawFromTreasureDeck: deck is empty');
    return null;
  }

  const [drawnCard, ...remaining] = deck;
  gameState.setTreasureDeck(remaining);
  log.debug('Card drawn from Treasure Deck', { instanceId: drawnCard.instanceId, remaining: remaining.length });
  return drawnCard;
}

export { seededShuffle, buildInitialDecks, initializeDecks, drawFromTreasureDeck };

export default {
  seededShuffle,
  buildInitialDecks,
  initializeDecks,
  drawFromTreasureDeck,
};
