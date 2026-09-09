/**
 * save-manager.test.js
 *
 * Unit-level coverage for js/saveManager.js (GDD §24, Prompt 020):
 *  - serialize()/restore() round-trip a GameState snapshot unchanged.
 *  - restore() never throws on malformed/corrupted data.
 *  - save() is gated by turnManager.isSafeToSave() — blocked at every
 *    unsafe phase, allowed at every safe one (see turnManager.js's own
 *    SAVE_SAFE_PHASES header for the full phase-by-phase rationale).
 *  - save() is a no-op when no game is in progress.
 *  - hasSave()/loadRaw()/clearSave() against a fake localStorage.
 *  - the auto-save `gameState.on('*', ...)` subscription (mirrors
 *    audioManager.js's own FakeAudio-style testability — no jsdom
 *    needed, just a lightweight in-memory localStorage shim).
 *  - a corrupted/unavailable localStorage never throws.
 *
 * The end-to-end "save -> reload -> restore reproduces the exact same
 * GameState, at several different turnManager phases" exit criteria
 * lives in tests/integration/save-restore.test.js, driving a real game
 * through turnManager.js exactly like every other integration test in
 * this suite.
 *
 * Run with: node --test tests/unit/save-manager.test.js
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as gameState from '../../js/gameState.js';
import * as turnManager from '../../js/turnManager.js';
import * as saveManager from '../../js/saveManager.js';

const { PHASES } = gameState;

function makeFakeLocalStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    _store: store,
  };
}

let fakeLocalStorage;

function seedOnePlayerGame(phase = PHASES.PLAYER_DECISION) {
  gameState.initState({
    config: { deck: { totalCards: 60 } },
    players: [{ id: 'p1', name: 'Player 1', isAI: false, shipCargo: [], score: 0 }],
  });
  gameState.setCurrentPlayerIndex(0);
  gameState.setPhase(phase);
}

beforeEach(() => {
  fakeLocalStorage = makeFakeLocalStorage();
  global.localStorage = fakeLocalStorage;
  gameState.resetState();
  gameState.clearAllListeners();
  saveManager.resetForTesting();
});

afterEach(() => {
  saveManager.resetForTesting();
  gameState.clearAllListeners();
  delete global.localStorage;
});

// ---------------------------------------------------------------------------
// serialize() / restore()
// ---------------------------------------------------------------------------

test('serialize() wraps gameState.getStateSnapshot() in a versioned envelope', () => {
  seedOnePlayerGame();
  const saveFile = saveManager.serialize();

  assert.equal(typeof saveFile.schemaVersion, 'number');
  assert.equal(typeof saveFile.savedAt, 'string');
  assert.deepEqual(saveFile.gameState, gameState.getStateSnapshot());
});

test('restore() reproduces the exact snapshot serialize() captured, even after further mutation', () => {
  seedOnePlayerGame();
  gameState.updatePlayer('p1', { score: 7 });
  const expected = gameState.getStateSnapshot();
  const saveFile = saveManager.serialize();

  // Simulate more gameplay happening before the restore.
  gameState.setPhase(PHASES.SCORING);
  gameState.updatePlayer('p1', { score: 999 });

  const restored = saveManager.restore(saveFile);
  assert.equal(restored, true);
  assert.deepEqual(gameState.getStateSnapshot(), expected);
});

test('restore() rejects malformed save data without throwing', () => {
  const before = gameState.getStateSnapshot();

  assert.equal(saveManager.restore(null), false);
  assert.equal(saveManager.restore(undefined), false);
  assert.equal(saveManager.restore('not an object'), false);
  assert.equal(saveManager.restore({}), false);
  assert.equal(saveManager.restore({ gameState: null }), false);
  assert.doesNotThrow(() => saveManager.restore({ schemaVersion: 1, gameState: 'not an object' }));

  // None of the above should have mutated GameState at all.
  assert.deepEqual(gameState.getStateSnapshot(), before);
});

test('restore() still restores a save with a mismatched (but structurally valid) schemaVersion', () => {
  seedOnePlayerGame();
  const expected = gameState.getStateSnapshot();
  const saveFile = { schemaVersion: 999, savedAt: 'whenever', gameState: expected };

  gameState.resetState();
  assert.equal(saveManager.restore(saveFile), true);
  assert.deepEqual(gameState.getStateSnapshot(), expected);
});

// ---------------------------------------------------------------------------
// save() gating — turnManager.isSafeToSave()
// ---------------------------------------------------------------------------

test('save() persists at every SAVE_SAFE_PHASES phase', () => {
  for (const phase of [PHASES.PLAYER_DECISION, PHASES.PLAYER_CHOICE, PHASES.END_TURN, PHASES.GAME_END, PHASES.SCORING]) {
    fakeLocalStorage._store.clear();
    seedOnePlayerGame(phase);
    assert.equal(turnManager.isSafeToSave(), true, `expected ${phase} to be safe`);
    assert.equal(saveManager.save(), true, `expected save() to succeed at ${phase}`);
    assert.equal(fakeLocalStorage._store.size, 1);
  }
});

test('save() refuses to persist at every mid-resolution phase', () => {
  for (const phase of [
    PHASES.GAME_INIT,
    PHASES.PLAYER_TURN_START,
    PHASES.DRAW_CARD,
    PHASES.REVEAL_CARD,
    PHASES.CHECK_DUPLICATE,
    PHASES.SHIPWRECK,
    PHASES.RESOLVE_ABILITY,
    PHASES.RETURN_TO_SHIP,
  ]) {
    fakeLocalStorage._store.clear();
    seedOnePlayerGame(phase);
    assert.equal(turnManager.isSafeToSave(), false, `expected ${phase} to be unsafe`);
    assert.equal(saveManager.save(), false, `expected save() to refuse at ${phase}`);
    assert.equal(fakeLocalStorage._store.size, 0, `expected nothing written for ${phase}`);
  }
});

test('save() is a no-op when no game is in progress, even at a nominally safe phase', () => {
  gameState.resetState(); // players: [] by default
  gameState.setPhase(PHASES.PLAYER_DECISION);
  assert.equal(saveManager.save(), false);
  assert.equal(fakeLocalStorage._store.size, 0);
});

// ---------------------------------------------------------------------------
// hasSave() / loadRaw() / clearSave()
// ---------------------------------------------------------------------------

test('hasSave() is false with nothing saved, true after a successful save()', () => {
  assert.equal(saveManager.hasSave(), false);

  seedOnePlayerGame();
  saveManager.save();

  assert.equal(saveManager.hasSave(), true);
});

test('loadRaw() returns the parsed save file, or null when nothing is saved', () => {
  assert.equal(saveManager.loadRaw(), null);

  seedOnePlayerGame();
  saveManager.save();

  const loaded = saveManager.loadRaw();
  assert.equal(typeof loaded.savedAt, 'string');
  assert.deepEqual(loaded.gameState, gameState.getStateSnapshot());
});

test('loadRaw() treats corrupted (non-JSON) localStorage content as "no save"', () => {
  fakeLocalStorage.setItem('pirateFortune.save', '{not valid json');
  assert.equal(saveManager.loadRaw(), null);
  assert.equal(saveManager.hasSave(), false);
});

test('clearSave() removes a previously saved game', () => {
  seedOnePlayerGame();
  saveManager.save();
  assert.equal(saveManager.hasSave(), true);

  saveManager.clearSave();
  assert.equal(saveManager.hasSave(), false);
});

test('resumeGame() restores whatever is currently saved', () => {
  seedOnePlayerGame(PHASES.PLAYER_DECISION);
  gameState.updatePlayer('p1', { score: 42 });
  saveManager.save();
  const expected = gameState.getStateSnapshot();

  gameState.resetState();
  assert.notDeepEqual(gameState.getStateSnapshot(), expected);

  assert.equal(saveManager.resumeGame(), true);
  assert.deepEqual(gameState.getStateSnapshot(), expected);
});

test('resumeGame() returns false when there is nothing to resume', () => {
  assert.equal(saveManager.resumeGame(), false);
});

// ---------------------------------------------------------------------------
// Auto-save subscription
// ---------------------------------------------------------------------------

test('after init(), a phase change into a safe phase auto-saves', () => {
  seedOnePlayerGame(PHASES.DRAW_CARD); // unsafe — nothing should save yet
  saveManager.init();

  assert.equal(fakeLocalStorage._store.size, 0);

  gameState.setPhase(PHASES.PLAYER_DECISION);

  assert.equal(fakeLocalStorage._store.size, 1);
});

test('after init(), phase changes through unsafe phases never auto-save', () => {
  seedOnePlayerGame(PHASES.PLAYER_DECISION);
  saveManager.init();
  fakeLocalStorage._store.clear(); // ignore the seed's own PLAYER_DECISION save, if any

  for (const phase of [PHASES.DRAW_CARD, PHASES.REVEAL_CARD, PHASES.CHECK_DUPLICATE, PHASES.RESOLVE_ABILITY]) {
    gameState.setPhase(phase);
  }

  assert.equal(fakeLocalStorage._store.size, 0);
});

test('resetForTesting() unsubscribes so a stale auto-save listener never leaks into the next test', () => {
  seedOnePlayerGame(PHASES.PLAYER_DECISION);
  saveManager.init();
  saveManager.resetForTesting();

  fakeLocalStorage._store.clear();
  gameState.setPhase(PHASES.SCORING);

  assert.equal(fakeLocalStorage._store.size, 0, 'no listener should still be attached');
});

// ---------------------------------------------------------------------------
// Defensive behavior with no/corrupted localStorage
// ---------------------------------------------------------------------------

test('every operation is a safe no-op (never throws) with no global localStorage at all', () => {
  delete global.localStorage;
  seedOnePlayerGame();

  assert.doesNotThrow(() => saveManager.save());
  assert.equal(saveManager.save(), false);
  assert.doesNotThrow(() => saveManager.hasSave());
  assert.equal(saveManager.hasSave(), false);
  assert.doesNotThrow(() => saveManager.resumeGame());
  assert.doesNotThrow(() => saveManager.clearSave());
});

test('a localStorage that throws on every call never crashes saveManager', () => {
  global.localStorage = {
    getItem: () => {
      throw new Error('storage disabled');
    },
    setItem: () => {
      throw new Error('storage disabled');
    },
    removeItem: () => {
      throw new Error('storage disabled');
    },
  };
  seedOnePlayerGame();

  assert.doesNotThrow(() => saveManager.save());
  assert.doesNotThrow(() => saveManager.hasSave());
  assert.doesNotThrow(() => saveManager.resumeGame());
  assert.doesNotThrow(() => saveManager.clearSave());
});
