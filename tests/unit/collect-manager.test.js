/**
 * collect-manager.test.js
 *
 * Covers Prompt 007 exit criteria for js/collectManager.js (GDD §10):
 *   - Ship Cargo is sorted lowest-to-highest by value, tie-broken by type,
 *     across MULTIPLE returns spanning multiple turns (not just a single
 *     return).
 *   - Cards already secured in cargo from an earlier return are untouched
 *     by a later return — no duplication, no loss.
 *   - The Expedition Area is cleared and re-zoned/re-owned cards land in
 *     the 'cargo' zone under the correct player.
 *
 * Run with: node --test tests/unit/collect-manager.test.js
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as gameState from '../../js/gameState.js';
import * as cardManager from '../../js/cardManager.js';
import * as collectManager from '../../js/collectManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
const cardsFile = JSON.parse(readFileSync(path.join(dataDir, 'cards.json'), 'utf-8'));
const cardDefs = cardsFile.cards;

function defFor(id) {
  const def = cardDefs.find((d) => d.id === id);
  if (!def) throw new Error(`fixture setup: no card definition with id "${id}"`);
  return def;
}

beforeEach(() => {
  gameState.resetState();
  gameState.clearAllListeners();
  cardManager.resetInstanceCounter();
  gameState.setPlayers([
    { id: 'p1', name: 'Player 1', isAI: false, shipCargo: [], score: 0 },
    { id: 'p2', name: 'Player 2', isAI: false, shipCargo: [], score: 0 },
  ]);
  gameState.setCurrentPlayerIndex(0);
});

test('returnToShip sorts a single expedition lowest-to-highest by value', () => {
  const high = cardManager.createCardInstance(defFor('cannon-v5'), cardManager.ZONES.EXPEDITION);
  const low = cardManager.createCardInstance(defFor('compass-v2'), cardManager.ZONES.EXPEDITION);
  const mid = cardManager.createCardInstance(defFor('goldCoin-v4'), cardManager.ZONES.EXPEDITION);
  gameState.setExpeditionArea([high, low, mid]);

  collectManager.returnToShip('p1', cardDefs);

  const p1 = gameState.getPlayer('p1');
  assert.deepEqual(
    p1.shipCargo.map((c) => c.defId),
    ['compass-v2', 'goldCoin-v4', 'cannon-v5']
  );
  assert.ok(p1.shipCargo.every((c) => c.currentZone === 'cargo' && c.ownerId === 'p1'));
  assert.equal(gameState.getExpeditionArea().length, 0);
});

test('returnToShip tie-breaks equal-value cards by type', () => {
  // compass-v3 and cannon-v3 share value 3, distinct types.
  const cannon3 = cardManager.createCardInstance(defFor('cannon-v3'), cardManager.ZONES.EXPEDITION);
  const compass3 = cardManager.createCardInstance(defFor('compass-v3'), cardManager.ZONES.EXPEDITION);
  gameState.setExpeditionArea([cannon3, compass3]);

  collectManager.returnToShip('p1', cardDefs);

  const p1 = gameState.getPlayer('p1');
  assert.deepEqual(
    p1.shipCargo.map((c) => c.defId),
    ['cannon-v3', 'compass-v3'] // 'cannon' < 'compass' lexicographically
  );
});

test('across multiple turns: earlier cargo is preserved and the merged cargo stays fully sorted', () => {
  // Turn 1: p1 secures a mid-value card.
  const turn1Card = cardManager.createCardInstance(defFor('goldCoin-v6'), cardManager.ZONES.EXPEDITION);
  gameState.setExpeditionArea([turn1Card]);
  const turn1Secured = collectManager.returnToShip('p1', cardDefs);

  assert.equal(turn1Secured.length, 1);
  assert.equal(gameState.getPlayer('p1').shipCargo.length, 1);

  // Turn 2 (a later turn): p1 secures a lower-value card and a higher-value
  // card. The earlier turn1Card must still be present afterward, and the
  // full cargo must come out sorted, not just the new cards appended raw.
  const lowerCard = cardManager.createCardInstance(defFor('goldCoin-v4'), cardManager.ZONES.EXPEDITION);
  const higherCard = cardManager.createCardInstance(defFor('goldCoin-v9'), cardManager.ZONES.EXPEDITION);
  gameState.setExpeditionArea([lowerCard, higherCard]);
  const turn2Secured = collectManager.returnToShip('p1', cardDefs);

  assert.equal(turn2Secured.length, 2);

  const p1 = gameState.getPlayer('p1');
  assert.equal(p1.shipCargo.length, 3, 'no duplication, no loss across turns');
  assert.deepEqual(
    p1.shipCargo.map((c) => c.defId),
    ['goldCoin-v4', 'goldCoin-v6', 'goldCoin-v9']
  );

  // The original turn1 instance is still present, unmodified in identity.
  assert.ok(p1.shipCargo.some((c) => c.instanceId === turn1Card.instanceId));

  // p2's cargo was never touched by any of p1's returns.
  assert.equal(gameState.getPlayer('p2').shipCargo.length, 0);
});

test('returnToShip never mixes cards between players', () => {
  const p1Card = cardManager.createCardInstance(defFor('goldCoin-v4'), cardManager.ZONES.EXPEDITION);
  gameState.setExpeditionArea([p1Card]);
  collectManager.returnToShip('p1', cardDefs);

  const p2Card = cardManager.createCardInstance(defFor('goldCoin-v5'), cardManager.ZONES.EXPEDITION);
  gameState.setExpeditionArea([p2Card]);
  collectManager.returnToShip('p2', cardDefs);

  assert.equal(gameState.getPlayer('p1').shipCargo.length, 1);
  assert.equal(gameState.getPlayer('p2').shipCargo.length, 1);
  assert.equal(gameState.getPlayer('p1').shipCargo[0].ownerId, 'p1');
  assert.equal(gameState.getPlayer('p2').shipCargo[0].ownerId, 'p2');
});

test('returnToShip throws for an unknown player id', () => {
  gameState.setExpeditionArea([]);
  assert.throws(() => collectManager.returnToShip('ghost', cardDefs));
});
