/**
 * full-game-scenario.test.js
 *
 * Prompt 011 (docs/prompts/stage-a-core-engine.md) — Stage A completion
 * gate:
 *   "A full, unscripted-decision-but-deterministic-deck 2-4 player game,
 *   exercising every one of the 8 abilities at least once across the
 *   test suite, runs start to finish (tests/scenarios/) producing a
 *   correct winner."
 *   "Every test file in tests/unit and tests/integration passes."
 *   "No file in js/ imports anything DOM-related."
 *   "No ability key in data/cards.json is unregistered."
 *
 * "Unscripted decision" here means every PLAYER_DECISION is resolved by
 * turnManager's own placeholder AI threshold (aiDecision(), GDD §15) —
 * nothing in this file hand-picks which card comes up or what a player
 * decides at each step, unlike every other integration test file, which
 * deliberately DOES script exact cards to exercise one ability at a
 * time. The Treasure Deck/Lost Loot shuffles are still deterministic (a
 * fixed seed per scenario), so each run is reproducible without being
 * hand-authored card-by-card. "Every one of the 8 abilities at least
 * once ACROSS THE TEST SUITE" is satisfied by
 * tests/integration/ability-chains.test.js (plus the Prompt 009/010/010b
 * files) — this file does not re-script all 8 abilities into one run;
 * it proves the full, unattended state machine (GAME_INIT through
 * SCORING) is internally consistent no matter which real cards/abilities
 * happen to come up along the way.
 *
 * Run with: node --test tests/scenarios/full-game-scenario.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as gameState from '../../js/gameState.js';
import * as cardManager from '../../js/cardManager.js';
import * as turnManager from '../../js/turnManager.js';
import * as scoreManager from '../../js/scoreManager.js';
import * as abilityManager from '../../js/abilityManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');
const dataDir = path.join(rootDir, 'data');
const jsDir = path.join(rootDir, 'js');

const cardsFile = JSON.parse(readFileSync(path.join(dataDir, 'cards.json'), 'utf-8'));
const config = JSON.parse(readFileSync(path.join(dataDir, 'gameConfig.json'), 'utf-8'));
const cardDefs = cardsFile.cards;
const TOTAL_CARDS = config.deck.totalCards; // 60, per data/gameConfig.json

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
 * Runs one full, unattended AI game to SCORING and asserts every
 * structural invariant a completed game must satisfy — regardless of
 * exactly which cards/abilities happened to come up along the way.
 * @returns {{players: Array<object>, results: object, lostLoot: Array<object>}}
 */
function runFullGameAndAssertConsistency(playerCount, seedSuffix) {
  gameState.resetState();
  gameState.clearAllListeners();
  cardManager.resetInstanceCounter();

  const finalPhase = turnManager.startGame(cardDefs, config, buildAIPlayers(playerCount), {
    treasureSeed: `full-game-scenario-${seedSuffix}`,
    lostLootSeed: `full-game-scenario-${seedSuffix}-lostloot`,
  });

  assert.equal(finalPhase, gameState.PHASES.SCORING, 'an all-AI game must run unattended, start to finish');
  assert.equal(gameState.getTreasureDeck().length, 0, 'the game only ends once the Treasure Deck is exhausted');

  const players = gameState.getPlayers();
  const lostLoot = gameState.getLostLoot();
  const expeditionArea = gameState.getExpeditionArea();

  // The Treasure Deck can run dry mid-explore, after a player has already
  // revealed some cards this turn but before they Return to Ship or hit a
  // duplicate — drawCard() folds straight into endTurn() in that case
  // (documented in turnManager.js's DRAW_CARD step), so whatever's still
  // sitting in the Expedition Area at that instant is simply abandoned
  // (never secured, never Shipwrecked) rather than cleared. This is
  // established, accepted behavior — see full-loop-stub.test.js's own
  // card-conservation check from Prompt 004/005 — not a bug this
  // scenario should assert against; the conservation check below folds
  // any such leftover cards in rather than requiring the area be empty.

  // Card conservation: every one of the 60 cards is accounted for across
  // Lost Loot, any abandoned Expedition Area cards, and every player's
  // Ship Cargo. Nothing is ever created or silently dropped.
  const totalCargo = players.reduce((sum, p) => sum + p.shipCargo.length, 0);
  assert.equal(totalCargo + lostLoot.length + expeditionArea.length, TOTAL_CARDS, 'all 60 cards accounted for');

  const allInstanceIds = [
    ...lostLoot.map((c) => c.instanceId),
    ...expeditionArea.map((c) => c.instanceId),
    ...players.flatMap((p) => p.shipCargo.map((c) => c.instanceId)),
  ];
  assert.equal(new Set(allInstanceIds).size, allInstanceIds.length, 'no card instance is duplicated across zones');

  // Scoring correctness: recompute independently (scoreManager is pure/
  // stateless — safe to call again outside turnManager) and cross-check
  // against GameState.results, which turnManager.scoring() populated
  // during the run itself.
  const results = gameState.getResults();
  assert.ok(results, 'results must be populated once SCORING is reached');

  for (const player of players) {
    const recomputed = scoreManager.calculateScore(player, cardDefs);
    assert.equal(player.score, recomputed, `player ${player.id}'s stored score matches an independent recomputation`);
    assert.equal(results.scores[player.id], recomputed);
  }

  const expectedWinners = scoreManager.determineWinner(players).map((p) => p.id);
  assert.deepEqual(
    [...results.winners].sort(),
    [...expectedWinners].sort(),
    'the recorded winner(s) match an independent determineWinner() over the final player states'
  );
  assert.ok(results.winners.length >= 1, 'a completed game always has at least one winner');

  // The actual definition of "a correct winner" this scenario needs to
  // prove: nobody outscored whoever GameState.results says won.
  const maxScore = Math.max(...players.map((p) => p.score));
  for (const winnerId of results.winners) {
    const winner = players.find((p) => p.id === winnerId);
    assert.equal(winner.score, maxScore);
  }

  return { players, results, lostLoot };
}

test('Full 2-player AI game: unscripted decisions over a deterministic deck reach SCORING with a correct, internally-consistent winner', () => {
  runFullGameAndAssertConsistency(2, '2p');
});

test('Full 3-player AI game reaches SCORING with a correct, internally-consistent winner', () => {
  runFullGameAndAssertConsistency(3, '3p');
});

test('Full 4-player AI game (max table size) reaches SCORING with a correct, internally-consistent winner', () => {
  runFullGameAndAssertConsistency(4, '4p');
});

test('Two runs with identical seeds produce identical turn histories and results (determinism, GDD §25.3)', () => {
  function runOnce() {
    gameState.resetState();
    gameState.clearAllListeners();
    cardManager.resetInstanceCounter();
    turnManager.startGame(cardDefs, config, buildAIPlayers(3), {
      treasureSeed: 'full-game-scenario-determinism',
      lostLootSeed: 'full-game-scenario-determinism-lostloot',
    });
    return { history: gameState.getTurnHistory(), results: gameState.getResults() };
  }

  const run1 = runOnce();
  const run2 = runOnce();

  assert.deepEqual(run1.history, run2.history);
  assert.deepEqual(run1.results, run2.results);
});

// ---------------------------------------------------------------------------
// Stage A completion gate (per docs/prompts/stage-a-core-engine.md, Prompt 011)
// ---------------------------------------------------------------------------

test('Stage A gate: no ability key in data/cards.json is unregistered', () => {
  const abilityKeys = new Set(cardDefs.map((d) => d.ability).filter((a) => a !== null));
  assert.equal(abilityKeys.size, 8, 'sanity check: the full 8-ability roster is present in the data');
  for (const key of abilityKeys) {
    assert.equal(abilityManager.hasAbility(key), true, `"${key}" must be registered`);
  }
});

test('Stage A gate: every core-engine file in js/ is free of DOM/browser APIs', () => {
  // Scoped to the actual Stage A deliverables (GDD §2.4: "No Prompt in
  // this Stage should depend on DOM, CSS, or the browser"). Deliberately
  // excludes the Phase 0 scaffolding files for LATER stages (main.js,
  // uiManager.js, modalManager.js, animationManager.js, audioManager.js,
  // playerManager.js, saveManager.js, localizationManager.js) — those are
  // explicitly out of Stage A's scope and are documented (in their own
  // headers) as future-phase stubs that will legitimately touch the DOM
  // once their own phase arrives.
  const stageAFiles = [
    'logger.js',
    'cardManager.js',
    'gameState.js',
    'deckManager.js',
    'burnManager.js',
    'collectManager.js',
    'scoreManager.js',
    'abilityManager.js',
    'abilityResolver.js',
    'turnManager.js',
    'gameManager.js',
    'iconManager.js',
    path.join('abilities', 'index.js'),
    path.join('abilities', 'compass.js'),
    path.join('abilities', 'cannon.js'),
    path.join('abilities', 'captainShield.js'),
    path.join('abilities', 'pirateDagger.js'),
    path.join('abilities', 'luckyAnchor.js'),
    path.join('abilities', 'seaSerpent.js'),
    path.join('abilities', 'treasureMap.js'),
    path.join('abilities', 'treasureChestGoldenKey.js'),
  ];

  const forbiddenPatterns = [
    /\bdocument\./,
    /\bwindow\./,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bnavigator\./,
    /\baddEventListener\(/,
  ];

  const offenders = [];
  for (const relPath of stageAFiles) {
    const contents = readFileSync(path.join(jsDir, relPath), 'utf-8');
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(contents)) {
        offenders.push(`${relPath} matches ${pattern}`);
      }
    }
  }
  assert.deepEqual(offenders, [], 'Stage A engine code must never touch DOM/browser APIs directly');
});

test('Stage A gate: js/ actually contains the files this gate checks (catches a silently-skipped scan)', () => {
  const jsFiles = readdirSync(jsDir, { recursive: true }).filter((f) => f.endsWith('.js'));
  assert.ok(jsFiles.length >= 10, 'sanity check: js/ has the expected number of engine files');
});
