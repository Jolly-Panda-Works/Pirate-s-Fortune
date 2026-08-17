/**
 * deck-model.test.js
 *
 * Validates data/cards.json against the deck model in GDD §5, and
 * cross-checks it against data/gameConfig.json so the two files can never
 * silently drift apart.
 *
 * Run with: node --test tests/unit/deck-model.test.js
 * (or `npm test` to run the whole suite once wired in Prompt 022)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');

const cardsFile = JSON.parse(readFileSync(path.join(dataDir, 'cards.json'), 'utf-8'));
const config = JSON.parse(readFileSync(path.join(dataDir, 'gameConfig.json'), 'utf-8'));
const cards = cardsFile.cards;

test('exactly 60 cards total', () => {
  assert.equal(cards.length, 60);
});

test('every card has a unique id', () => {
  const ids = cards.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('Gold Coin: 6 cards, values 4-9, no ability', () => {
  const goldCoins = cards.filter((c) => c.type === 'goldCoin');
  assert.equal(goldCoins.length, 6);
  const values = goldCoins.map((c) => c.value).sort((a, b) => a - b);
  assert.deepEqual(values, [4, 5, 6, 7, 8, 9]);
  for (const c of goldCoins) {
    assert.equal(c.ability, null);
  }
});

test('the 9 non-Gold-Coin types each have exactly 6 cards, values 2-7', () => {
  const otherTypeKeys = config.deck.otherTypes.typeKeys;
  assert.equal(otherTypeKeys.length, 9);

  for (const typeKey of otherTypeKeys) {
    const matching = cards.filter((c) => c.type === typeKey);
    assert.equal(matching.length, 6, `type "${typeKey}" should have 6 cards`);
    const values = matching.map((c) => c.value).sort((a, b) => a - b);
    assert.deepEqual(values, [2, 3, 4, 5, 6, 7], `type "${typeKey}" value range`);
  }
});

test('exactly one card per value per type (no duplicate value within a type)', () => {
  const byType = new Map();
  for (const c of cards) {
    if (!byType.has(c.type)) byType.set(c.type, new Set());
    const seenValues = byType.get(c.type);
    assert.ok(!seenValues.has(c.value), `duplicate value ${c.value} in type "${c.type}"`);
    seenValues.add(c.value);
  }
});

test('every non-Gold-Coin card has a non-null ability key', () => {
  const nonGold = cards.filter((c) => c.type !== 'goldCoin');
  for (const c of nonGold) {
    assert.notEqual(c.ability, null, `card "${c.id}" is missing an ability key`);
  }
});

test('every ability key used in cards.json is declared in gameConfig.json', () => {
  const declaredAbilities = new Set([
    ...config.abilities.singleResolution,
    ...config.abilities.chain,
  ]);
  const usedAbilities = new Set(cards.map((c) => c.ability).filter(Boolean));
  for (const ability of usedAbilities) {
    assert.ok(
      declaredAbilities.has(ability),
      `ability "${ability}" used in cards.json but not declared in gameConfig.json`
    );
  }
});

test('initial Lost Loot rule: one value-2 per non-Gold-Coin type + one Gold Coin value-4', () => {
  const expectedIds = config.initialLostLoot.cardIds;
  assert.equal(expectedIds.length, 10);

  const byId = new Map(cards.map((c) => [c.id, c]));
  for (const id of expectedIds) {
    assert.ok(byId.has(id), `initialLostLoot references unknown card id "${id}"`);
  }

  const goldCoinEntries = expectedIds.filter((id) => byId.get(id).type === 'goldCoin');
  assert.equal(goldCoinEntries.length, 1);
  assert.equal(byId.get(goldCoinEntries[0]).value, 4);

  const nonGoldEntries = expectedIds.filter((id) => byId.get(id).type !== 'goldCoin');
  assert.equal(nonGoldEntries.length, 9);
  for (const id of nonGoldEntries) {
    assert.equal(byId.get(id).value, 2);
  }
  // one per type, no repeats
  const types = nonGoldEntries.map((id) => byId.get(id).type);
  assert.equal(new Set(types).size, 9);
});

test('deck totals in gameConfig.json match the actual card count', () => {
  assert.equal(config.deck.totalCards, 60);
  assert.equal(
    config.deck.goldCoin.cardCount + config.deck.otherTypes.count * config.deck.otherTypes.cardsPerType,
    60
  );
  assert.equal(
    config.initialTreasureDeck.totalCards + config.initialLostLoot.totalCards,
    60
  );
});
