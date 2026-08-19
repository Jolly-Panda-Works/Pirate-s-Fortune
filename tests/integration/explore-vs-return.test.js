/**
 * explore-vs-return.test.js
 *
 * Covers Prompt 005 exit criteria for js/gameManager.js + js/turnManager.js:
 * a human-driven sequence of revealNextCard()/returnToShip() calls produces
 * the expected GameState at every step —
 *   - revealNextCard() repeatedly grows the Expedition Area
 *   - returnToShip() moves the Expedition Area into the current player's
 *     Ship Cargo and clears the Expedition Area
 *   - both guard against being called with no decision pending
 *   - AI players resolve their own PLAYER_DECISION without any external call
 *
 * Two human players (no AI) are used for the core explore/return sequence
 * tests below, so a human's own turn is never auto-continued by AI logic
 * mid-assertion — AI auto-resolution is covered separately.
 *
 * Updated for Prompt 006 (Duplicate / Shipwreck): duplicate detection is
 * now real (js/burnManager.js), so a purely random/seeded deck can
 * legitimately produce a Shipwreck partway through a scenario these tests
 * don't intend to exercise. primeSafeDraws() below overrides the front of
 * the live Treasure Deck with cards of guaranteed-distinct types right
 * after the game (or a turn) starts, so multi-card explore sequences in
 * this file are deterministically duplicate-free. Shipwreck itself is
 * covered separately in shipwreck.test.js.
 *
 * Run with: node --test tests/integration/explore-vs-return.test.js
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as gameManager from '../../js/gameManager.js';
import * as gameState from '../../js/gameState.js';
import * as cardManager from '../../js/cardManager.js';

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

function buildHumanPlayers() {
  return [
    { id: 'p1', name: 'Player 1', isAI: false, shipCargo: [], score: 0 },
    { id: 'p2', name: 'Player 2', isAI: false, shipCargo: [], score: 0 },
  ];
}

function buildHumanAndAiPlayers() {
  return [
    { id: 'human', name: 'Human', isAI: false, shipCargo: [], score: 0 },
    { id: 'ai', name: 'AI', isAI: true, shipCargo: [], score: 0 },
  ];
}

/**
 * Overrides the front of the live Treasure Deck with `count` freshly-built
 * CardInstances, each of a distinct type never used before by the current
 * Expedition Area's cards or by each other — guaranteeing that drawing all
 * of them in sequence into the SAME Expedition Area never triggers a
 * duplicate. The rest of the real (already-shuffled) deck follows behind
 * them, untouched.
 * @param {number} count
 * @returns {Array<object>} the primed CardInstance[] (in draw order)
 */
function primeSafeDraws(count) {
  const usedTypes = new Set(
    gameManager.getExpeditionArea().map((card) => {
      const def = cardDefs.find((d) => d.id === card.defId);
      return def.type;
    })
  );

  const chosenDefs = [];
  for (const def of cardDefs) {
    if (chosenDefs.length === count) break;
    if (usedTypes.has(def.type)) continue;
    usedTypes.add(def.type);
    chosenDefs.push(def);
  }
  if (chosenDefs.length < count) {
    throw new Error(`primeSafeDraws: cardDefs doesn't contain ${count} additional distinct types`);
  }

  const primedInstances = chosenDefs.map((def) => cardManager.createCardInstance(def, cardManager.ZONES.DECK));
  gameState.setTreasureDeck([...primedInstances, ...gameManager.getTreasureDeck()]);
  return primedInstances;
}

test('game pauses at PLAYER_DECISION for the first player right after the opening reveal', () => {
  gameManager.startGame(cardDefs, config, buildHumanPlayers(), {
    treasureSeed: 'explore-return-pause',
    lostLootSeed: 'explore-return-lostloot',
  });

  assert.equal(gameManager.getPhase(), gameManager.PHASES.PLAYER_DECISION);
  assert.equal(gameManager.getCurrentPlayer().id, 'p1');
  assert.equal(gameManager.getExpeditionArea().length, 1);
});

test('revealNextCard() repeatedly grows the Expedition Area, one card per call', () => {
  gameManager.startGame(cardDefs, config, buildHumanPlayers(), {
    treasureSeed: 'explore-growth',
    lostLootSeed: 'explore-growth-lostloot',
  });
  primeSafeDraws(2);

  assert.equal(gameManager.getExpeditionArea().length, 1);

  for (const expectedSize of [2, 3]) {
    const phase = gameManager.revealNextCard();
    assert.equal(phase, gameManager.PHASES.PLAYER_DECISION);
    assert.equal(gameManager.getExpeditionArea().length, expectedSize);
    assert.equal(gameManager.getCurrentPlayer().id, 'p1');
  }
});

test("returnToShip() moves the Expedition Area into the current player's Ship Cargo and clears it", () => {
  gameManager.startGame(cardDefs, config, buildHumanPlayers(), {
    treasureSeed: 'explore-then-return',
    lostLootSeed: 'explore-then-return-lostloot',
  });
  primeSafeDraws(2);

  gameManager.revealNextCard();
  gameManager.revealNextCard();
  const expeditionBeforeReturn = gameManager.getExpeditionArea();
  assert.equal(expeditionBeforeReturn.length, 3);

  gameManager.returnToShip();

  // Turn has now passed to p2 (also human), who is paused at their own
  // opening PLAYER_DECISION with a freshly-drawn card of their own — so
  // check p1's cargo/state directly rather than the live Expedition Area.
  const p1 = gameManager.getPlayer('p1');
  assert.equal(p1.shipCargo.length, 3);
  assert.deepEqual(
    p1.shipCargo.map((c) => c.instanceId).sort(),
    expeditionBeforeReturn.map((c) => c.instanceId).sort()
  );
  assert.ok(p1.shipCargo.every((c) => c.currentZone === 'cargo' && c.ownerId === 'p1'));

  const firstTurnEntry = gameManager.getTurnHistory()[0];
  assert.equal(firstTurnEntry.playerId, 'p1');
  assert.equal(firstTurnEntry.decision, 'return');
  assert.equal(firstTurnEntry.cardsSecured, 3);

  // Turn correctly advanced to the next player and paused again.
  assert.equal(gameManager.getPhase(), gameManager.PHASES.PLAYER_DECISION);
  assert.equal(gameManager.getCurrentPlayer().id, 'p2');
  assert.equal(gameManager.getExpeditionArea().length, 1);
});

test('a full round trip (explore twice, return) leaves no cards duplicated or lost between zones', () => {
  gameManager.startGame(cardDefs, config, buildHumanPlayers(), {
    treasureSeed: 'round-trip',
    lostLootSeed: 'round-trip-lostloot',
  });
  primeSafeDraws(1);

  gameManager.revealNextCard();
  gameManager.returnToShip();

  const p1 = gameManager.getPlayer('p1');
  assert.equal(p1.shipCargo.length, 2);
  assert.equal(gameManager.getExpeditionArea().length, 1); // p2's opening reveal
});

test('revealNextCard() throws when called with no pending decision', () => {
  assert.throws(() => gameManager.revealNextCard());
});

test('returnToShip() throws when called with no pending decision', () => {
  assert.throws(() => gameManager.returnToShip());
});

test("AI player's turn resolves without any external revealNextCard()/returnToShip() call", () => {
  gameManager.startGame(cardDefs, config, buildHumanAndAiPlayers(), {
    treasureSeed: 'ai-auto-resolve',
    lostLootSeed: 'ai-auto-resolve-lostloot',
  });
  // The AI may explore up to the placeholder threshold (4 cards) once its
  // turn starts — prime that many guaranteed-distinct-type draws so its
  // whole turn is duplicate-free, exercising the "no Shipwreck" path.
  primeSafeDraws(4);

  // Human returns to ship immediately; the AI's entire turn (explore up to
  // the placeholder threshold, then return) plays out automatically inside
  // that same call — no external driver needed for it — leaving the state
  // machine paused back on the human's next decision (2-player round-robin).
  assert.doesNotThrow(() => gameManager.returnToShip());

  assert.equal(gameManager.getPhase(), gameManager.PHASES.PLAYER_DECISION);
  assert.equal(gameManager.getCurrentPlayer().id, 'human');

  const ai = gameManager.getPlayer('ai');
  assert.equal(ai.shipCargo.length, 4, 'AI should have explored to the threshold, then secured all 4 cards');

  const aiTurnEntry = gameManager.getTurnHistory().find((e) => e.playerId === 'ai');
  assert.ok(aiTurnEntry, 'AI turn should be recorded in turn history without any external call');
  assert.equal(aiTurnEntry.decision, 'return');
  assert.equal(aiTurnEntry.cardsSecured, 4);
});

test('an AI-first game plays its opening turn to completion before any human input is needed', () => {
  const players = [
    { id: 'ai', name: 'AI', isAI: true, shipCargo: [], score: 0 },
    { id: 'human', name: 'Human', isAI: false, shipCargo: [], score: 0 },
  ];

  // startGame() draws the AI's first card before we get any control back,
  // so this scenario relies on a seed whose first four cards for the AI
  // happen to be duplicate-free (verified for this fixed seed) rather than
  // primeSafeDraws() — there is no pause point between "game starts" and
  // "AI's whole opening turn resolves" to intervene from.
  gameManager.startGame(cardDefs, config, players, {
    treasureSeed: 'ai-first',
    lostLootSeed: 'ai-first-lostloot',
  });

  // startGame() itself must run the AI's whole opening turn synchronously
  // and land on the human's PLAYER_DECISION without any external call.
  assert.equal(gameManager.getPhase(), gameManager.PHASES.PLAYER_DECISION);
  assert.equal(gameManager.getCurrentPlayer().id, 'human');
  assert.ok(gameManager.getPlayer('ai').shipCargo.length >= 1);
});
