/**
 * deck-manager.test.js
 *
 * Covers Prompt 003 exit criteria for js/deckManager.js:
 *  - seeded shuffle is deterministic (same seed -> same order)
 *  - initial Lost Loot matches the GDD §5.2 rule exactly
 *  - initial Treasure Deck is exactly 50 cards
 *  - drawing from an empty deck returns null without throwing
 *
 * Run with: node --test tests/unit/deck-manager.test.js
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as deckManager from '../../js/deckManager.js';
import * as cardManager from '../../js/cardManager.js';
import * as gameState from '../../js/gameState.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
const cardsFile = JSON.parse(readFileSync(path.join(dataDir, 'cards.json'), 'utf-8'));
const config = JSON.parse(readFileSync(path.join(dataDir, 'gameConfig.json'), 'utf-8'));
const cardDefs = cardsFile.cards;

beforeEach(() => {
  gameState.resetState();
  gameState.clearAllListeners();
  cardManager.resetInstanceCounter();
});

// --- seeded shuffle ---------------------------------------------------------

test('seededShuffle: same seed produces the same order', () => {
  const input = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const first = deckManager.seededShuffle(input, 'seed-123');
  const second = deckManager.seededShuffle(input, 'seed-123');

  assert.deepEqual(first, second);
});

test('seededShuffle: different seeds (usually) produce different orders', () => {
  const input = Array.from({ length: 30 }, (_, i) => i);
  const a = deckManager.seededShuffle(input, 'seed-a');
  const b = deckManager.seededShuffle(input, 'seed-b');

  assert.notDeepEqual(a, b);
});

test('seededShuffle: numeric seeds are deterministic too', () => {
  const input = [1, 2, 3, 4, 5];
  const first = deckManager.seededShuffle(input, 42);
  const second = deckManager.seededShuffle(input, 42);

  assert.deepEqual(first, second);
});

test('seededShuffle: does not mutate the input array', () => {
  const input = [1, 2, 3, 4, 5];
  const snapshot = [...input];
  deckManager.seededShuffle(input, 'seed-x');

  assert.deepEqual(input, snapshot);
});

test('seededShuffle: shuffled result is a permutation of the input (same elements)', () => {
  const input = Array.from({ length: 20 }, (_, i) => `card-${i}`);
  const shuffled = deckManager.seededShuffle(input, 'seed-y');

  assert.equal(shuffled.length, input.length);
  assert.deepEqual([...shuffled].sort(), [...input].sort());
});

// --- initial deck derivation -------------------------------------------------

test('buildInitialDecks: initial Lost Loot matches GDD §5.2 exactly', () => {
  const { lostLoot } = deckManager.buildInitialDecks(cardDefs, config, {
    treasureSeed: 'ts',
    lostLootSeed: 'ls',
  });

  assert.equal(lostLoot.length, 10);

  const defsById = new Map(cardDefs.map((d) => [d.id, d]));
  const lostLootDefs = lostLoot.map((instance) => defsById.get(instance.defId));

  const goldCoinEntries = lostLootDefs.filter((d) => d.type === 'goldCoin');
  assert.equal(goldCoinEntries.length, 1);
  assert.equal(goldCoinEntries[0].value, 4);

  const nonGoldEntries = lostLootDefs.filter((d) => d.type !== 'goldCoin');
  assert.equal(nonGoldEntries.length, 9);
  for (const def of nonGoldEntries) {
    assert.equal(def.value, 2, `non-Gold-Coin Lost Loot entry "${def.id}" should be value 2`);
  }
  const nonGoldTypes = new Set(nonGoldEntries.map((d) => d.type));
  assert.equal(nonGoldTypes.size, 9, 'all 9 non-Gold-Coin types should be represented exactly once');

  // Every Lost Loot instance should carry the correct runtime zone.
  for (const instance of lostLoot) {
    assert.equal(instance.currentZone, cardManager.ZONES.LOST_LOOT);
  }
});

test('buildInitialDecks: initial Treasure Deck is exactly 50 cards', () => {
  const { treasureDeck } = deckManager.buildInitialDecks(cardDefs, config, {
    treasureSeed: 'ts',
    lostLootSeed: 'ls',
  });

  assert.equal(treasureDeck.length, 50);
  for (const instance of treasureDeck) {
    assert.equal(instance.currentZone, cardManager.ZONES.DECK);
  }
});

test('buildInitialDecks: Treasure Deck and Lost Loot together account for all 60 defIds exactly once', () => {
  const { treasureDeck, lostLoot } = deckManager.buildInitialDecks(cardDefs, config, {
    treasureSeed: 'ts',
    lostLootSeed: 'ls',
  });

  const allDefIds = [...treasureDeck, ...lostLoot].map((i) => i.defId).sort();
  const expectedDefIds = cardDefs.map((d) => d.id).sort();
  assert.deepEqual(allDefIds, expectedDefIds);
});

test('buildInitialDecks: Treasure Deck and Lost Loot are shuffled independently (different seeds -> different orders)', () => {
  const first = deckManager.buildInitialDecks(cardDefs, config, { treasureSeed: 'A', lostLootSeed: 'B' });
  const second = deckManager.buildInitialDecks(cardDefs, config, { treasureSeed: 'C', lostLootSeed: 'D' });

  assert.notDeepEqual(
    first.treasureDeck.map((i) => i.defId),
    second.treasureDeck.map((i) => i.defId)
  );
  assert.notDeepEqual(
    first.lostLoot.map((i) => i.defId),
    second.lostLoot.map((i) => i.defId)
  );
});

test('buildInitialDecks: same seeds -> identical deck order across calls (determinism end-to-end)', () => {
  const first = deckManager.buildInitialDecks(cardDefs, config, { treasureSeed: 'fixed', lostLootSeed: 'fixed-2' });
  const second = deckManager.buildInitialDecks(cardDefs, config, { treasureSeed: 'fixed', lostLootSeed: 'fixed-2' });

  assert.deepEqual(
    first.treasureDeck.map((i) => i.defId),
    second.treasureDeck.map((i) => i.defId)
  );
  assert.deepEqual(
    first.lostLoot.map((i) => i.defId),
    second.lostLoot.map((i) => i.defId)
  );
});

// --- initializeDecks (gameState wiring) --------------------------------------

test('initializeDecks: wires the built decks into gameState via its mutators', () => {
  deckManager.initializeDecks(cardDefs, config, { treasureSeed: 'w1', lostLootSeed: 'w2' });

  assert.equal(gameState.getTreasureDeck().length, 50);
  assert.equal(gameState.getLostLoot().length, 10);
});

// --- drawFromTreasureDeck -----------------------------------------------------

test('drawFromTreasureDeck: draws the top card and shrinks the deck by one', () => {
  deckManager.initializeDecks(cardDefs, config, { treasureSeed: 'd1', lostLootSeed: 'd2' });
  const before = gameState.getTreasureDeck();

  const drawn = deckManager.drawFromTreasureDeck();

  assert.ok(drawn);
  assert.equal(drawn.instanceId, before[0].instanceId);
  assert.equal(gameState.getTreasureDeck().length, before.length - 1);
});

test('drawFromTreasureDeck: draws in order (top of deck first)', () => {
  deckManager.initializeDecks(cardDefs, config, { treasureSeed: 'd3', lostLootSeed: 'd4' });
  const expectedOrder = gameState.getTreasureDeck().map((c) => c.instanceId);

  const drawnOrder = [];
  let drawn = deckManager.drawFromTreasureDeck();
  while (drawn) {
    drawnOrder.push(drawn.instanceId);
    drawn = deckManager.drawFromTreasureDeck();
  }

  assert.deepEqual(drawnOrder, expectedOrder);
});

test('drawFromTreasureDeck: returns null without throwing once the deck is empty', () => {
  gameState.setTreasureDeck([]);

  assert.doesNotThrow(() => {
    const result = deckManager.drawFromTreasureDeck();
    assert.equal(result, null);
  });
});

test('drawFromTreasureDeck: repeated draws on an exhausted deck keep returning null', () => {
  deckManager.initializeDecks(cardDefs, config, { treasureSeed: 'd5', lostLootSeed: 'd6' });

  let drawn = deckManager.drawFromTreasureDeck();
  let count = 0;
  while (drawn) {
    count += 1;
    drawn = deckManager.drawFromTreasureDeck();
  }

  assert.equal(count, 50);
  assert.equal(deckManager.drawFromTreasureDeck(), null);
  assert.equal(deckManager.drawFromTreasureDeck(), null);
});
