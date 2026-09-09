/**
 * ai-simulation.test.js
 *
 * Prompt 022 (docs/prompts/stage-d-feel-and-release.md — "Testing
 * (Regression Suite)"), GDD §25.5:
 *   "AI simulation: script N AI-vs-AI full games (no human input) in a
 *   loop, asserting no illegal moves, no state corruption, no infinite
 *   loops, no crashes, no ability-chain failures. Start with N=100 for
 *   MVP."
 *   "Exit criteria: ... the AI-simulation batch completes with zero
 *   crashes/illegal states across all runs."
 *
 * This is a distinct exit criterion from every other scenario file:
 * full-game-scenario.test.js proves 4 hand-picked scenarios (one per
 * player count, plus a determinism pair) run correctly; this file
 * instead runs a large, varied BATCH and asserts the batch-level
 * property "zero failures across N runs" — the actual GDD §25.5
 * language. N defaults to 100 per the GDD's own MVP floor; override
 * with the AI_SIM_N env var for a larger ad hoc batch (e.g.
 * `AI_SIM_N=1000 node --test tests/scenarios/ai-simulation.test.js`).
 *
 * Every player is AI, so turnManager.startGame() runs the entire game
 * unattended (Prompt 015 — no Math.random anywhere in the AI decision
 * path, so each seed is reproducible, but seeds vary game-to-game here
 * to cover many different deck orders/player counts rather than
 * re-proving the same handful of seeds already pinned elsewhere).
 *
 * "No illegal moves / no state corruption / no ability-chain failures"
 * is operationalized per game as: reaches SCORING (not stuck mid-loop),
 * Treasure Deck ends empty, exactly 60 cards conserved across zones, no
 * instanceId duplicated across zones (the concrete signature of a
 * corrupted or double-applied ability), every player's stored score
 * matches an independent scoreManager.calculateScore() recomputation,
 * and the recorded winner(s) actually hold the max score. "No infinite
 * loops" is checked structurally (the synchronous call either returns
 * or throws — there is no async/timer path to hang on per the
 * synchronous-core constraint) plus a generous turn-count sanity bound
 * as a tripwire against a hypothetical runaway state-machine bug.
 *
 * Log output is silenced for the duration of the batch (Prompt 022 is
 * the first scenario file to do this) purely because N full games at
 * the existing per-turn INFO/WARN verbosity would otherwise dwarf every
 * other test file's output; this doesn't change what's asserted.
 *
 * Run with: node --test tests/scenarios/ai-simulation.test.js
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
import { setLevel } from '../../js/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');
const dataDir = path.join(rootDir, 'data');

const cardsFile = JSON.parse(readFileSync(path.join(dataDir, 'cards.json'), 'utf-8'));
const config = JSON.parse(readFileSync(path.join(dataDir, 'gameConfig.json'), 'utf-8'));
const cardDefs = cardsFile.cards;
const TOTAL_CARDS = config.deck.totalCards; // 60

// GDD §25.5's own MVP floor. Override for a larger ad hoc batch.
const N = Number(process.env.AI_SIM_N) || 100;
const PLAYER_COUNTS = [2, 3, 4];

// A generous tripwire, not a tuned bound: a normal game runs well under
// 60 turns (full-game-scenario.test.js's own 2/3/4-player runs are all
// under 30). 500 is only meant to catch a genuine runaway-loop bug, not
// to constrain normal variance.
const MAX_SANE_TURN_COUNT = 500;

function buildAIPlayers(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `AI Player ${i + 1}`,
    isAI: true,
    shipCargo: [],
    score: 0,
  }));
}

test(`AI-vs-AI simulation batch: N=${N} full unattended games, zero crashes/illegal states/corruption`, () => {
  const failures = [];
  const previousLevel = 'INFO'; // logger.js's own default (see logger.js header)
  setLevel('ERROR');

  try {
    for (let i = 0; i < N; i++) {
      const playerCount = PLAYER_COUNTS[i % PLAYER_COUNTS.length];
      const seedBase = `ai-sim-${i}`;

      try {
        gameState.resetState();
        gameState.clearAllListeners();
        cardManager.resetInstanceCounter();

        const finalPhase = turnManager.startGame(cardDefs, config, buildAIPlayers(playerCount), {
          treasureSeed: seedBase,
          lostLootSeed: `${seedBase}-lostloot`,
        });

        assert.equal(finalPhase, gameState.PHASES.SCORING, 'must reach SCORING, not stall mid-loop');
        assert.equal(gameState.getTreasureDeck().length, 0, 'game only ends once the Treasure Deck is exhausted');

        const players = gameState.getPlayers();
        const lostLoot = gameState.getLostLoot();
        const expeditionArea = gameState.getExpeditionArea();

        const totalCargo = players.reduce((sum, p) => sum + p.shipCargo.length, 0);
        assert.equal(
          totalCargo + lostLoot.length + expeditionArea.length,
          TOTAL_CARDS,
          'card conservation: all 60 cards accounted for'
        );

        const allInstanceIds = [
          ...lostLoot.map((c) => c.instanceId),
          ...expeditionArea.map((c) => c.instanceId),
          ...players.flatMap((p) => p.shipCargo.map((c) => c.instanceId)),
        ];
        assert.equal(
          new Set(allInstanceIds).size,
          allInstanceIds.length,
          'no card instance duplicated across zones (state corruption)'
        );

        const results = gameState.getResults();
        assert.ok(results, 'results populated once SCORING is reached');

        for (const player of players) {
          assert.equal(
            scoreManager.calculateScore(player, cardDefs),
            player.score,
            `player ${player.id}'s stored score matches an independent recomputation`
          );
        }

        assert.ok(results.winners.length >= 1, 'a completed game always has at least one winner');
        const maxScore = Math.max(...players.map((p) => p.score));
        for (const winnerId of results.winners) {
          const winner = players.find((p) => p.id === winnerId);
          assert.equal(winner.score, maxScore, 'recorded winner actually holds the max score');
        }

        assert.ok(
          gameState.getTurnHistory().length < MAX_SANE_TURN_COUNT,
          'turn count within a sane bound (no runaway loop)'
        );
      } catch (err) {
        failures.push({ index: i, playerCount, seedBase, message: err.message });
      }
    }
  } finally {
    setLevel(previousLevel);
  }

  const passCount = N - failures.length;
  if (failures.length > 0) {
    // eslint-disable-next-line no-console -- deliberate: surfaces exactly
    // which of the N games failed, for triage, without stopping the
    // batch early (a real batch tool never bails on the first failure).
    console.error(`AI simulation batch: ${failures.length}/${N} games failed:`, failures.slice(0, 20));
  }
  // eslint-disable-next-line no-console -- the "documented pass rate"
  // Prompt 022's own deliverable requires (see docs/phases/phase-22-testing-notes.md
  // for the committed record of one full run's result).
  console.log(`AI simulation batch: ${passCount}/${N} games passed all invariants (0 crashes required).`);

  assert.equal(failures.length, 0, `${failures.length}/${N} AI-vs-AI games hit a crash or illegal/corrupted state`);
});
