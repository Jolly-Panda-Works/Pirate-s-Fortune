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
    // Under the placeholder AI threshold (explore while size < 4), the
    // Treasure Deck can run dry mid-exploration for the last player to act
    // — drawCard() folds straight into GAME_END in that case (by design,
    // see turnManager.js's drawCard doc), so any cards that player was
    // mid-explore with are legitimately still sitting in the Expedition
    // Area, never returned to ship. Nothing is lost from the deck though:
    // every card is accounted for across lostLoot + every player's cargo +
    // whatever remains in the Expedition Area.
    const totalCargo = gameState.getPlayers().reduce((sum, p) => sum + p.shipCargo.length, 0);
    const expeditionRemaining = gameState.getExpeditionArea().length;
    assert.equal(totalCargo + expeditionRemaining, 50);
  });
}

test('the number of recorded turns is bounded by the Treasure Deck size, with at least one card secured per turn', () => {
  const players = buildPlayers(2);
  turnManager.startGame(cardDefs, config, players, {
    treasureSeed: 'history-treasure',
    lostLootSeed: 'history-lostloot',
  });

  // Initial Treasure Deck is exactly 50 cards (GDD §5.3). Under the
  // placeholder AI threshold (explore while Expedition Area size < 4),
  // most turns secure up to 4 cards, so turn count is well under 50 but
  // always at least 1 and never more than 50.
  const history = gameState.getTurnHistory();
  assert.ok(history.length >= 1);
  assert.ok(history.length <= 50);
  for (const entry of history) {
    assert.ok(entry.cardsSecured >= 1 && entry.cardsSecured <= 4);
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

test('every recorded turn history entry is a "return" decision (the only path that appends one)', () => {
  const players = buildPlayers(2);
  turnManager.startGame(cardDefs, config, players, {
    treasureSeed: 'decision-treasure',
    lostLootSeed: 'decision-lostloot',
  });

  for (const entry of gameState.getTurnHistory()) {
    assert.equal(entry.decision, 'return');
    assert.ok(entry.cardsSecured >= 1);
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
