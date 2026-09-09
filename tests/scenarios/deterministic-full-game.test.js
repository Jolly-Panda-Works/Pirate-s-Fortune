/**
 * deterministic-full-game.test.js
 *
 * Prompt 022 (docs/prompts/stage-d-feel-and-release.md — "Testing
 * (Regression Suite)") requires, specifically under tests/scenarios/:
 *   "deterministic full-game scripts (known GameState + known deck
 *   order, driven end to end, exact final state asserted) — add at
 *   least one scenario per player count (2, 3, 4)."
 *
 * This is a distinct exit criterion from the two scenario files that
 * already existed before this prompt:
 *   - full-game-scenario.test.js (Prompt 011/Stage A gate) drives
 *     2/3/4-player AI games over a fixed-seed deck but only asserts
 *     internal-consistency invariants (card conservation, no duplicate
 *     instanceIds, recomputed score == stored score) — it deliberately
 *     does NOT hard-code the actual final scores/winner, since its own
 *     purpose is "runs correctly no matter which real cards come up".
 *   - tests/unit/score-manager.test.js has one exact-final-state test,
 *     but only for 2 players, and it is a human-driven (not AI-driven)
 *     scenario living in tests/unit/, not tests/scenarios/.
 *
 * Every player here is AI. Per turnManager.js/playerManager.js (Prompt
 * 015), AI decision-making is 100% deterministic — no Math.random
 * anywhere in the decision path — so a full AI-vs-AI game over a fixed
 * seed (deckManager's seededShuffle, Prompt 003) always plays out
 * identically. That determinism is what makes "exact final state"
 * assertions safe to hard-code here rather than derived at runtime (the
 * approach full-game-scenario.test.js/score-manager.test.js use when a
 * human decision or a random ability target could change the outcome).
 * The expected scores/winners below were captured from one real,
 * unmodified run of turnManager.startGame() with these exact seeds and
 * are re-verified turn-for-turn by 'Two runs with identical seeds...'
 * in full-game-scenario.test.js, so a silent determinism regression
 * would already fail that test too — this file's own job is only to
 * pin the actual numbers.
 *
 * Run with: node --test tests/scenarios/deterministic-full-game.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as gameState from '../../js/gameState.js';
import * as cardManager from '../../js/cardManager.js';
import * as turnManager from '../../js/turnManager.js';
import * as scoreManager from '../../js/scoreManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');
const dataDir = path.join(rootDir, 'data');

const cardsFile = JSON.parse(readFileSync(path.join(dataDir, 'cards.json'), 'utf-8'));
const config = JSON.parse(readFileSync(path.join(dataDir, 'gameConfig.json'), 'utf-8'));
const cardDefs = cardsFile.cards;
const TOTAL_CARDS = config.deck.totalCards; // 60

function buildAIPlayers(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `AI Player ${i + 1}`,
    isAI: true,
    shipCargo: [],
    score: 0,
  }));
}

/**
 * Runs one fully-deterministic AI-vs-AI game (fixed seed, every player
 * AI) and asserts the exact GDD §16 GameState.results this specific
 * seed/player-count combination is known to produce.
 */
function runDeterministicGame(playerCount, seedBase, expected) {
  gameState.resetState();
  gameState.clearAllListeners();
  cardManager.resetInstanceCounter();

  const finalPhase = turnManager.startGame(cardDefs, config, buildAIPlayers(playerCount), {
    treasureSeed: seedBase,
    lostLootSeed: `${seedBase}-lostloot`,
  });

  assert.equal(finalPhase, gameState.PHASES.SCORING);
  assert.equal(gameState.getTreasureDeck().length, 0);

  const results = gameState.getResults();
  assert.deepEqual(results.scores, expected.scores);
  assert.deepEqual([...results.winners].sort(), [...expected.winners].sort());
  assert.equal(gameState.getTurnHistory().length, expected.turnCount);

  // Card conservation, independent of the exact-score pin above: still
  // every one of the 60 cards, still no duplicated instanceId anywhere.
  const players = gameState.getPlayers();
  const lostLoot = gameState.getLostLoot();
  const expeditionArea = gameState.getExpeditionArea();
  const totalCargo = players.reduce((sum, p) => sum + p.shipCargo.length, 0);
  assert.equal(totalCargo + lostLoot.length + expeditionArea.length, TOTAL_CARDS);

  const allInstanceIds = [
    ...lostLoot.map((c) => c.instanceId),
    ...expeditionArea.map((c) => c.instanceId),
    ...players.flatMap((p) => p.shipCargo.map((c) => c.instanceId)),
  ];
  assert.equal(new Set(allInstanceIds).size, allInstanceIds.length);

  // Independent recomputation, exactly like the other scenario file —
  // the pinned numbers above must also agree with scoreManager itself.
  for (const player of players) {
    assert.equal(scoreManager.calculateScore(player, cardDefs), player.score);
  }
}

test('Deterministic 2-player AI game: known seed reaches the exact known final scores/winner', () => {
  runDeterministicGame(2, 'prompt022-deterministic-2p', {
    scores: { p1: 38, p2: 46 },
    winners: ['p2'],
    turnCount: 16,
  });
});

test('Deterministic 3-player AI game: known seed reaches the exact known final scores/winner', () => {
  runDeterministicGame(3, 'prompt022-deterministic-3p', {
    scores: { p1: 21, p2: 0, p3: 50 },
    winners: ['p3'],
    turnCount: 17,
  });
});

test('Deterministic 4-player AI game (max table size): known seed reaches the exact known final scores/winner', () => {
  runDeterministicGame(4, 'prompt022-deterministic-4p', {
    scores: { p1: 7, p2: 40, p3: 51, p4: 29 },
    winners: ['p3'],
    turnCount: 15,
  });
});
