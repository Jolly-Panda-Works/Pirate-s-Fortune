/**
 * full-loop-stub.test.js
 *
 * Originally Prompt 004's exit-criteria test: run a full, self-driving
 * game end-to-end and assert it reaches GAME_END/SCORING with no runtime
 * errors. Prompt 004's version relied on PLAYER_DECISION always
 * auto-resolving "Return to Ship" for every player — Prompt 005 replaced
 * that stub with real behavior (AI players resolve via a placeholder
 * threshold; HUMAN players now pause PLAYER_DECISION for external input,
 * see explore-vs-return.test.js).
 *
 * To keep validating a genuinely unattended full game (round-robin order,
 * determinism, deck exhaustion, no thrown errors) this file now uses
 * all-AI players, so the placeholder threshold decision
 * (js/turnManager.js's aiDecision — explore while Expedition Area size < 4,
 * else return) drives the whole game to completion with no external calls.
 * Every card still resolves "safe" — real duplicate detection isn't wired
 * in until Prompt 006.
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
    isAI: true,
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
    // Every one of the 60 total cards (10 initial Lost Loot + 50 initial
    // Treasure Deck) ends up in exactly one place once the deck is empty:
    // a player's Ship Cargo, Lost Loot (initial 10 plus anything lost to a
    // Shipwreck along the way), or — for the last player to act, if the
    // Treasure Deck happened to run dry mid-explore — still sitting in the
    // Expedition Area (drawCard() folds straight into GAME_END in that
    // case; see its doc comment). Nothing may be created or destroyed.
    const totalCargo = gameState.getPlayers().reduce((sum, p) => sum + p.shipCargo.length, 0);
    const expeditionRemaining = gameState.getExpeditionArea().length;
    const lostLootCount = gameState.getLostLoot().length;
    assert.equal(totalCargo + expeditionRemaining + lostLootCount, 60);
  });
}

test('the number of recorded turns is bounded by the Treasure Deck size, with valid per-decision fields', () => {
  const players = buildPlayers(2);
  turnManager.startGame(cardDefs, config, players, {
    treasureSeed: 'history-treasure',
    lostLootSeed: 'history-lostloot',
  });

  // Initial Treasure Deck is exactly 50 cards (GDD §5.3). Under the
  // placeholder AI threshold (explore while Expedition Area size < 4),
  // most turns secure/lose up to 4 cards, so turn count is well under 50
  // but always at least 1 and never more than 50.
  const history = gameState.getTurnHistory();
  assert.ok(history.length >= 1);
  assert.ok(history.length <= 50);
  for (const entry of history) {
    if (entry.decision === 'return') {
      assert.ok(entry.cardsSecured >= 1 && entry.cardsSecured <= 4);
    } else {
      assert.equal(entry.decision, 'shipwreck');
      assert.ok(entry.cardsLost >= 1 && entry.cardsLost <= 4);
    }
  }
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

test('every recorded turn history entry is "return" or "shipwreck" — every turn produces exactly one', () => {
  const players = buildPlayers(2);
  turnManager.startGame(cardDefs, config, players, {
    treasureSeed: 'decision-treasure',
    lostLootSeed: 'decision-lostloot',
  });

  for (const entry of gameState.getTurnHistory()) {
    assert.ok(entry.decision === 'return' || entry.decision === 'shipwreck');
    if (entry.decision === 'return') {
      assert.ok(entry.cardsSecured >= 1);
    } else {
      assert.ok(entry.cardsLost >= 1);
    }
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
