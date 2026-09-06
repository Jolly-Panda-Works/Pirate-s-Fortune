/**
 * player-manager.test.js
 *
 * Covers Prompt 015 exit criteria for js/playerManager.js:
 *  - decideAction(): the GDD §15 MVP threshold (explore below 4, return at
 *    4 or more), pure and deterministic for any given expedition size.
 *  - chooseAbilityTarget(): always the first eligible option, deterministic
 *    regardless of option shape (Cannon/Dagger vs Anchor vs Map), and
 *    throws on an empty/invalid options array rather than picking nothing.
 *
 * Both functions are pure (no GameState, no timers), so no beforeEach
 * reset is needed here — unlike every other unit test file in this repo.
 *
 * Run with: node --test tests/unit/player-manager.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as playerManager from '../../js/playerManager.js';

// --- decideAction() ---------------------------------------------------------

test('decideAction: explores when the Expedition Area is empty', () => {
  assert.equal(playerManager.decideAction(0), 'explore');
});

test('decideAction: explores at 1, 2, and 3 cards (below the threshold)', () => {
  assert.equal(playerManager.decideAction(1), 'explore');
  assert.equal(playerManager.decideAction(2), 'explore');
  assert.equal(playerManager.decideAction(3), 'explore');
});

test('decideAction: returns to ship at exactly 4 cards (GDD §15 threshold)', () => {
  assert.equal(playerManager.decideAction(4), 'return');
});

test('decideAction: returns to ship above the threshold too', () => {
  assert.equal(playerManager.decideAction(5), 'return');
  assert.equal(playerManager.decideAction(10), 'return');
});

test('decideAction: is a pure function — repeated calls with the same input agree', () => {
  const results = Array.from({ length: 5 }, () => playerManager.decideAction(3));
  assert.ok(results.every((r) => r === 'explore'));
});

// --- chooseAbilityTarget() ---------------------------------------------------

test('chooseAbilityTarget: picks the first option for a Cannon/Dagger-shaped list', () => {
  const options = [
    { targetPlayerId: 'p2', targetCardId: 'card-1', defId: 'gold_4' },
    { targetPlayerId: 'p3', targetCardId: 'card-2', defId: 'gold_5' },
  ];
  assert.deepEqual(playerManager.chooseAbilityTarget(options), options[0]);
});

test('chooseAbilityTarget: picks the first option for a Lucky Anchor-shaped list', () => {
  const options = [
    { cargoCardId: 'card-9', defId: 'compass_3' },
    { cargoCardId: 'card-10', defId: 'cannon_2' },
  ];
  assert.deepEqual(playerManager.chooseAbilityTarget(options), options[0]);
});

test('chooseAbilityTarget: picks the first option for a Treasure Map-shaped list', () => {
  const options = [
    { targetCardId: 'lost-1', defId: 'dagger_4' },
    { targetCardId: 'lost-2', defId: 'anchor_5' },
  ];
  assert.deepEqual(playerManager.chooseAbilityTarget(options), options[0]);
});

test('chooseAbilityTarget: single-option lists resolve to that one option', () => {
  const options = [{ targetPlayerId: 'p2', targetCardId: 'only-card', defId: 'gold_4' }];
  assert.deepEqual(playerManager.chooseAbilityTarget(options), options[0]);
});

test('chooseAbilityTarget: is deterministic across repeated calls with the same options', () => {
  const options = [
    { targetPlayerId: 'p2', targetCardId: 'a', defId: 'gold_4' },
    { targetPlayerId: 'p2', targetCardId: 'b', defId: 'gold_5' },
  ];
  const first = playerManager.chooseAbilityTarget(options);
  const second = playerManager.chooseAbilityTarget(options);
  assert.deepEqual(first, second);
  assert.deepEqual(first, options[0]);
});

test('chooseAbilityTarget: throws on an empty options array rather than returning undefined', () => {
  assert.throws(() => playerManager.chooseAbilityTarget([]));
});

test('chooseAbilityTarget: throws on a non-array argument', () => {
  assert.throws(() => playerManager.chooseAbilityTarget(null));
  assert.throws(() => playerManager.chooseAbilityTarget(undefined));
});
