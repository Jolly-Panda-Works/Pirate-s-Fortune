/**
 * score-manager.test.js
 *
 * Covers Prompt 008 exit criteria for js/scoreManager.js (GDD §11/§11.1)
 * and its wiring into js/turnManager.js's SCORING step:
 *   - calculateScore(): only the highest card value per type counts.
 *   - determineWinner(): the cargo-count tiebreaker on an equal-score tie.
 *   - determineWinner(): a genuine, fully unresolved tie (equal score AND
 *     equal cargo count) returns every tied player, not an invented
 *     tiebreak.
 *   - A full, deterministic 2-player game — driven end-to-end via
 *     gameManager with scripted Return to Ship decisions on a
 *     fully-controlled deck — reaches SCORING with the exact expected
 *     winner and correctly populated GameState.results.
 *
 * Run with: node --test tests/unit/score-manager.test.js
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as scoreManager from '../../js/scoreManager.js';
import * as gameManager from '../../js/gameManager.js';
import * as gameState from '../../js/gameState.js';
import * as cardManager from '../../js/cardManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
const cardsFile = JSON.parse(readFileSync(path.join(dataDir, 'cards.json'), 'utf-8'));
const config = JSON.parse(readFileSync(path.join(dataDir, 'gameConfig.json'), 'utf-8'));
const cardDefs = cardsFile.cards;

function defFor(id) {
  const def = cardDefs.find((d) => d.id === id);
  if (!def) throw new Error(`fixture setup: no card definition with id "${id}"`);
  return def;
}

function cargoOf(...defIds) {
  return defIds.map((id) => cardManager.createCardInstance(defFor(id), cardManager.ZONES.CARGO));
}

beforeEach(() => {
  gameState.resetState();
  gameState.clearAllListeners();
  cardManager.resetInstanceCounter();
});

// ---------------------------------------------------------------------------
// scoreManager.calculateScore() — pure function checks.
// ---------------------------------------------------------------------------

test('calculateScore: sums only the highest value per distinct type', () => {
  const player = {
    id: 'p1',
    shipCargo: cargoOf('goldCoin-v4', 'goldCoin-v7', 'compass-v3', 'compass-v6', 'cannon-v2'),
  };

  // goldCoin: max(4,7)=7, compass: max(3,6)=6, cannon: 2 -> 7+6+2 = 15
  assert.equal(scoreManager.calculateScore(player, cardDefs), 15);
});

test('calculateScore: an empty Ship Cargo scores 0', () => {
  assert.equal(scoreManager.calculateScore({ id: 'p1', shipCargo: [] }, cardDefs), 0);
});

test('calculateScore: a single card of a single type scores exactly that value', () => {
  const player = { id: 'p1', shipCargo: cargoOf('cannon-v5') };
  assert.equal(scoreManager.calculateScore(player, cardDefs), 5);
});

// ---------------------------------------------------------------------------
// scoreManager.determineWinner() — pure function checks.
// ---------------------------------------------------------------------------

test('determineWinner: the single highest score wins outright', () => {
  const players = [
    { id: 'p1', score: 12, shipCargo: cargoOf('cannon-v5') },
    { id: 'p2', score: 20, shipCargo: cargoOf('cannon-v7') },
  ];
  const winners = scoreManager.determineWinner(players);
  assert.deepEqual(winners.map((p) => p.id), ['p2']);
});

test('determineWinner: on an equal score, the player with more total cargo cards wins', () => {
  const players = [
    { id: 'p1', score: 15, shipCargo: cargoOf('goldCoin-v9', 'cannon-v6') }, // 2 cards
    {
      id: 'p2',
      score: 15,
      shipCargo: cargoOf('goldCoin-v4', 'goldCoin-v5', 'cannon-v6', 'compass-v2'), // 4 cards
    },
  ];
  const winners = scoreManager.determineWinner(players);
  assert.deepEqual(winners.map((p) => p.id), ['p2']);
});

test('determineWinner: equal score AND equal cargo count is a genuine unresolved tie — all tied players returned', () => {
  const players = [
    { id: 'p1', score: 15, shipCargo: cargoOf('goldCoin-v9', 'cannon-v6') },
    { id: 'p2', score: 15, shipCargo: cargoOf('goldCoin-v8', 'cannon-v7') },
    { id: 'p3', score: 9, shipCargo: cargoOf('cannon-v2') },
  ];
  const winners = scoreManager.determineWinner(players);
  assert.deepEqual(winners.map((p) => p.id).sort(), ['p1', 'p2']);
});

test('determineWinner: an empty players array returns no winners', () => {
  assert.deepEqual(scoreManager.determineWinner([]), []);
});

// ---------------------------------------------------------------------------
// Full-game integration: turnManager's SCORING wiring end-to-end.
// ---------------------------------------------------------------------------

function buildHumanPlayers() {
  return [
    { id: 'p1', name: 'Player 1', isAI: false, shipCargo: [], score: 0 },
    { id: 'p2', name: 'Player 2', isAI: false, shipCargo: [], score: 0 },
  ];
}

test('a full deterministic 2-player game reaches SCORING with the exact expected winner', () => {
  gameManager.startGame(cardDefs, config, buildHumanPlayers(), {
    treasureSeed: 'score-manager-scenario',
    lostLootSeed: 'score-manager-scenario-lostloot',
  });

  // p1's opening card auto-revealed by startGame(). Read it back so the
  // expected score is derived from what the game actually drew, not
  // hand-guessed.
  const p1Card = gameManager.getExpeditionArea()[0];
  const p1CardDef = cardDefs.find((d) => d.id === p1Card.defId);

  // p1 immediately returns to ship with just that one card -> score is
  // exactly that card's value (only one type present).
  gameManager.returnToShip();
  assert.equal(gameManager.getCurrentPlayer().id, 'p2');

  const p2Card = gameManager.getExpeditionArea()[0];
  const p2CardDef = cardDefs.find((d) => d.id === p2Card.defId);

  // Force the Treasure Deck empty before p2's return, so that turn's
  // endTurn() routes straight to GAME_END -> SCORING instead of advancing
  // back to p1 for another round.
  gameState.setTreasureDeck([]);
  gameManager.returnToShip();

  assert.equal(gameManager.getPhase(), gameManager.PHASES.SCORING);

  const p1Score = p1CardDef.value;
  const p2Score = p2CardDef.value;

  const results = gameManager.getResults();
  assert.deepEqual(results.scores, { p1: p1Score, p2: p2Score });

  const expectedWinners =
    p1Score === p2Score ? ['p1', 'p2'].sort() : [p1Score > p2Score ? 'p1' : 'p2'];
  assert.deepEqual([...results.winners].sort(), expectedWinners);

  // Player records were updated in place too (GDD §16: Player.score).
  assert.equal(gameManager.getPlayer('p1').score, p1Score);
  assert.equal(gameManager.getPlayer('p2').score, p2Score);
});

test('GameState.results is null before the game reaches SCORING', () => {
  gameManager.startGame(cardDefs, config, buildHumanPlayers(), {
    treasureSeed: 'score-manager-null-check',
    lostLootSeed: 'score-manager-null-check-lostloot',
  });
  assert.equal(gameManager.getPhase(), gameManager.PHASES.PLAYER_DECISION);
  assert.equal(gameManager.getResults(), null);
});
