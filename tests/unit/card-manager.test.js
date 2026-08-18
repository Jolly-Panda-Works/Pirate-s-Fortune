/**
 * card-manager.test.js
 *
 * Covers js/cardManager.js (Prompt 002): instance creation, zone moves,
 * and definition lookup — all against real data/cards.json definitions
 * so it also incidentally proves the module works with the actual Prompt
 * 001 deck model, not just synthetic fixtures.
 *
 * Run with: node --test tests/unit/card-manager.test.js
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as cardManager from '../../js/cardManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
const cardsFile = JSON.parse(readFileSync(path.join(dataDir, 'cards.json'), 'utf-8'));
const cardDefs = cardsFile.cards;

beforeEach(() => {
  cardManager.resetInstanceCounter();
});

test('createCardInstance produces the CardInstance shape from GDD §4.2', () => {
  const def = cardDefs.find((c) => c.id === 'goldCoin-v4');
  const instance = cardManager.createCardInstance(def, cardManager.ZONES.DECK);

  assert.equal(instance.defId, 'goldCoin-v4');
  assert.equal(instance.currentZone, cardManager.ZONES.DECK);
  assert.equal(instance.ownerId, null);
  assert.equal(typeof instance.instanceId, 'string');
  assert.ok(instance.instanceId.length > 0);
});

test('createCardInstance rejects an invalid zone', () => {
  const def = cardDefs.find((c) => c.id === 'goldCoin-v4');
  assert.throws(() => cardManager.createCardInstance(def, 'nonsense-zone'));
});

test('every instance gets a unique instanceId, even for the same definition', () => {
  const def = cardDefs.find((c) => c.id === 'goldCoin-v4');
  const a = cardManager.createCardInstance(def, cardManager.ZONES.DECK);
  const b = cardManager.createCardInstance(def, cardManager.ZONES.DECK);

  assert.notEqual(a.instanceId, b.instanceId);
});

test('createInstancesFromDefinitions preserves order and count', () => {
  const instances = cardManager.createInstancesFromDefinitions(cardDefs, cardManager.ZONES.DECK);

  assert.equal(instances.length, cardDefs.length);
  instances.forEach((instance, i) => {
    assert.equal(instance.defId, cardDefs[i].id);
  });
});

test('moveInstance returns a new object and does not mutate the original', () => {
  const def = cardDefs.find((c) => c.id === 'compass-v2');
  const original = cardManager.createCardInstance(def, cardManager.ZONES.DECK);
  const moved = cardManager.moveInstance(original, cardManager.ZONES.EXPEDITION);

  assert.equal(original.currentZone, cardManager.ZONES.DECK, 'original instance must be untouched');
  assert.equal(moved.currentZone, cardManager.ZONES.EXPEDITION);
  assert.equal(moved.instanceId, original.instanceId, 'moving preserves identity');
  assert.notEqual(moved, original, 'moveInstance must return a new object, not mutate in place');
});

test('moveInstance can also reassign ownerId (e.g. cargo zone)', () => {
  const def = cardDefs.find((c) => c.id === 'compass-v2');
  const original = cardManager.createCardInstance(def, cardManager.ZONES.EXPEDITION, null);
  const moved = cardManager.moveInstance(original, cardManager.ZONES.CARGO, 'p1');

  assert.equal(moved.currentZone, cardManager.ZONES.CARGO);
  assert.equal(moved.ownerId, 'p1');
});

test('moveInstance rejects an invalid zone', () => {
  const def = cardDefs.find((c) => c.id === 'compass-v2');
  const original = cardManager.createCardInstance(def, cardManager.ZONES.DECK);
  assert.throws(() => cardManager.moveInstance(original, 'nowhere'));
});

test('getDefinition looks up a definition by defId, never by name', () => {
  const found = cardManager.getDefinition(cardDefs, 'compass-v2');
  assert.equal(found.name, 'Compass');
  assert.equal(found.type, 'compass');

  const missing = cardManager.getDefinition(cardDefs, 'not-a-real-id');
  assert.equal(missing, null);
});
