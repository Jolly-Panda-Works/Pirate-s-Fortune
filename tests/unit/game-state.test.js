/**
 * game-state.test.js
 *
 * Covers Prompt 002 exit criteria for js/gameState.js:
 *  - initial state shape matches GDD §6
 *  - selectors never leak a mutable reference back to callers
 *  - every mutation emits an event
 *
 * Run with: node --test tests/unit/game-state.test.js
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as gameState from '../../js/gameState.js';

beforeEach(() => {
  gameState.resetState();
  gameState.clearAllListeners();
});

test('initial state shape matches GDD §6', () => {
  assert.equal(gameState.getPhase(), gameState.PHASES.GAME_INIT);
  assert.deepEqual(gameState.getTreasureDeck(), []);
  assert.deepEqual(gameState.getLostLoot(), []);
  assert.deepEqual(gameState.getExpeditionArea(), []);
  assert.deepEqual(gameState.getPlayers(), []);
  assert.equal(gameState.getCurrentPlayerIndex(), 0);
  assert.equal(gameState.getCurrentPlayer(), null);
  assert.deepEqual(gameState.getTurnHistory(), []);
  assert.equal(gameState.getAbilityContext(), null);
  assert.equal(gameState.getConfig(), null);
});

test('initState seeds config and players', () => {
  const config = { players: { min: 2, max: 4 } };
  const players = [
    { id: 'p1', name: 'Alice', isAI: false, shipCargo: [], score: 0 },
    { id: 'p2', name: 'Bob', isAI: true, shipCargo: [], score: 0 },
  ];
  gameState.initState({ config, players });

  assert.deepEqual(gameState.getConfig(), config);
  assert.deepEqual(gameState.getPlayers(), players);
  assert.equal(gameState.getPhase(), gameState.PHASES.GAME_INIT);
});

test('selectors never leak a mutable reference (arrays)', () => {
  gameState.setTreasureDeck([{ instanceId: 'a#1', defId: 'a', currentZone: 'deck', ownerId: null }]);

  const deckCopy = gameState.getTreasureDeck();
  deckCopy.push({ instanceId: 'intruder', defId: 'x', currentZone: 'deck', ownerId: null });
  deckCopy[0].defId = 'tampered';

  assert.equal(gameState.getTreasureDeck().length, 1, 'mutating a returned array must not affect internal state');
  assert.equal(gameState.getTreasureDeck()[0].defId, 'a', 'mutating a returned object must not affect internal state');
});

test('selectors never leak a mutable reference (single player object)', () => {
  gameState.setPlayers([{ id: 'p1', name: 'Alice', isAI: false, shipCargo: [], score: 0 }]);

  const player = gameState.getPlayer('p1');
  player.score = 999;
  player.shipCargo.push({ instanceId: 'intruder' });

  const reread = gameState.getPlayer('p1');
  assert.equal(reread.score, 0);
  assert.deepEqual(reread.shipCargo, []);
});

test('getStateSnapshot returns a deep copy, not the live state', () => {
  gameState.setExpeditionArea([{ instanceId: 'a#1', defId: 'a', currentZone: 'expedition', ownerId: null }]);
  const snapshot = gameState.getStateSnapshot();
  snapshot.expeditionArea.push({ instanceId: 'intruder' });
  snapshot.phase = 'TAMPERED';

  assert.equal(gameState.getExpeditionArea().length, 1);
  assert.equal(gameState.getPhase(), gameState.PHASES.GAME_INIT);
});

test('setPhase emits a PHASE_CHANGED event with previous/next phase', () => {
  let received = null;
  gameState.on('PHASE_CHANGED', (event) => {
    received = event;
  });

  gameState.setPhase(gameState.PHASES.PLAYER_TURN_START);

  assert.equal(gameState.getPhase(), gameState.PHASES.PLAYER_TURN_START);
  assert.ok(received, 'expected PHASE_CHANGED to be emitted');
  assert.equal(received.type, 'PHASE_CHANGED');
  assert.equal(received.detail.previousPhase, gameState.PHASES.GAME_INIT);
  assert.equal(received.detail.phase, gameState.PHASES.PLAYER_TURN_START);
});

test('every mutator emits an event (observed via wildcard listener)', () => {
  const emittedTypes = [];
  gameState.on('*', (event) => emittedTypes.push(event.type));

  gameState.initState({});
  gameState.setPhase(gameState.PHASES.DRAW_CARD);
  gameState.setTreasureDeck([]);
  gameState.setLostLoot([]);
  gameState.addToLostLoot({ instanceId: 'x#1' });
  gameState.setExpeditionArea([]);
  gameState.addToExpeditionArea({ instanceId: 'y#1' });
  gameState.clearExpeditionArea();
  gameState.setPlayers([{ id: 'p1', name: 'Alice', isAI: false, shipCargo: [], score: 0 }]);
  gameState.updatePlayer('p1', { score: 10 });
  gameState.setCurrentPlayerIndex(0);
  gameState.addTurnHistoryEntry({ turn: 1 });
  gameState.setAbilityContext({ source: 'x' });
  gameState.clearAbilityContext();

  const expectedTypes = [
    'INIT_STATE',
    'PHASE_CHANGED',
    'TREASURE_DECK_SET',
    'LOST_LOOT_SET',
    'LOST_LOOT_ADDED',
    'EXPEDITION_AREA_SET',
    'EXPEDITION_AREA_CARD_ADDED',
    'EXPEDITION_AREA_CLEARED',
    'PLAYERS_SET',
    'PLAYER_UPDATED',
    'CURRENT_PLAYER_CHANGED',
    'TURN_HISTORY_APPENDED',
    'ABILITY_CONTEXT_SET',
    'ABILITY_CONTEXT_CLEARED',
  ];

  assert.deepEqual(emittedTypes, expectedTypes);
});

test('updatePlayer merges a patch without touching other fields', () => {
  gameState.setPlayers([{ id: 'p1', name: 'Alice', isAI: false, shipCargo: [], score: 0 }]);
  gameState.updatePlayer('p1', { score: 42 });

  const player = gameState.getPlayer('p1');
  assert.equal(player.score, 42);
  assert.equal(player.name, 'Alice');
});

test('off() stops a listener from receiving further events', () => {
  let count = 0;
  const handler = () => {
    count += 1;
  };
  gameState.on('PHASE_CHANGED', handler);
  gameState.setPhase(gameState.PHASES.DRAW_CARD);
  gameState.off('PHASE_CHANGED', handler);
  gameState.setPhase(gameState.PHASES.REVEAL_CARD);

  assert.equal(count, 1);
});
