/**
 * full-loop-stub.test.js
 *
 * Covers Prompt 004 exit criteria for js/turnManager.js: run a full,
 * self-driving game end-to-end (every card resolves "safe" — real
 * duplicate detection isn't wired in until Prompt 006 — and every
 * decision is the stubbed "Return to Ship" from Prompt 004) and assert
 * it reaches GAME_END/SCORING with the Treasure Deck exhausted and no
 * runtime errors, for 2, 3, and 4 players.
 *
 * Run with: node --test tests/integration/full-loop-stub.test.js
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as turnManager from '../../js/turnManager.js';
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

function buildPlayers(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    isAI: i !== 0,
    shipCargo: [],
    score: 0,
  }));
}

for (const playerCount of [2, 3, 4]) {
  test(`stub full loop completes for ${playerCount} players — reaches GAME_END/SCORING, deck exhausted, no errors`, () => {
    const players = buildPlayers(playerCount);

    assert.doesNotThrow(() => {
      turnManager.startGame(cardDefs, config, players, {
        treasureSeed: `fixed-treasure-${playerCount}`,
        lostLootSeed: `fixed-lostloot-${playerCount}`,
      });
    });

    assert.equal(gameState.getPhase(), gameState.PHASES.SCORING);
    assert.equal(gameState.getTreasureDeck().length, 0);
    assert.equal(gameState.getExpeditionArea().length, 0);
  });
}

test('one turn is played per Treasure Deck card, since the stubbed decision always returns to ship immediately', () => {
  const players = buildPlayers(2);
  turnManager.startGame(cardDefs, config, players, {
    treasureSeed: 'history-treasure',
    lostLootSeed: 'history-lostloot',
  });

  // Initial Treasure Deck is exactly 50 cards (GDD §5.3); one draw per
  // turn under the Prompt 004 stub means exactly 50 turns are recorded.
  assert.equal(gameState.getTurnHistory().length, 50);
});

test('turn order is strict round-robin across players[]', () => {
  const players = buildPlayers(3);
  turnManager.startGame(cardDefs, config, players, {
    treasureSeed: 'round-robin-treasure',
    lostLootSeed: 'round-robin-lostloot',
  });

  const history = gameState.getTurnHistory();
  assert.ok(history.length > 0);
  history.forEach((entry, i) => {
    const expectedPlayerId = players[i % players.length].id;
    assert.equal(entry.playerId, expectedPlayerId, `turn ${i} should belong to ${expectedPlayerId}`);
  });
});

test('every player gets at least one turn across a full game', () => {
  const players = buildPlayers(4);
  turnManager.startGame(cardDefs, config, players, {
    treasureSeed: 'all-players-treasure',
    lostLootSeed: 'all-players-lostloot',
  });

  const seenPlayerIds = new Set(gameState.getTurnHistory().map((entry) => entry.playerId));
  assert.equal(seenPlayerIds.size, players.length);
});

test('every turn history entry records the stubbed "return" decision with exactly one card secured', () => {
  const players = buildPlayers(2);
  turnManager.startGame(cardDefs, config, players, {
    treasureSeed: 'decision-treasure',
    lostLootSeed: 'decision-lostloot',
  });

  for (const entry of gameState.getTurnHistory()) {
    assert.equal(entry.decision, 'return');
    assert.equal(entry.cardsSecured, 1);
  }
});

test('same seeds produce an identical turn history across two separate runs (deterministic)', () => {
  const players = buildPlayers(2);

  turnManager.startGame(cardDefs, config, players, {
    treasureSeed: 'determinism-treasure',
    lostLootSeed: 'determinism-lostloot',
  });
  const firstHistory = gameState.getTurnHistory();

  gameState.resetState();
  gameState.clearAllListeners();
  cardManager.resetInstanceCounter();

  turnManager.startGame(cardDefs, config, buildPlayers(2), {
    treasureSeed: 'determinism-treasure',
    lostLootSeed: 'determinism-lostloot',
  });
  const secondHistory = gameState.getTurnHistory();

  assert.deepEqual(firstHistory, secondHistory);
});

test('startGame throws for zero players instead of silently misbehaving', () => {
  assert.throws(() => {
    turnManager.startGame(cardDefs, config, [], { treasureSeed: 'x', lostLootSeed: 'y' });
  });
});
