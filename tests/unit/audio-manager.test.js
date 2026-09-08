/**
 * audio-manager.test.js
 *
 * Covers Prompt 019's exit criteria (GDD §23): each of the six sound
 * categories triggers exactly once per real occurrence (no duplicate/
 * missing triggers), and mute fully silences playback — including
 * already-in-flight sound, not just future sounds.
 *
 * Unlike animationManager.js's own trigger functions (which needed a
 * real `document` for `querySelector`, and so were pushed outside
 * node:test's scope — see animation-manager.test.js's header),
 * audioManager.js's playback path only needs a global `Audio`
 * constructor, not a DOM. A lightweight FakeAudio class below stands in
 * for it, so the full dispatch-and-classify logic — the part this
 * module actually owns — genuinely is testable here, headlessly. Only
 * mountMuteToggle()/refreshMuteButtonState() (real `document` calls) are
 * left untested by this suite, consistent with every other Stage D
 * UI-facing function in this codebase.
 *
 * Run with: node --test tests/unit/audio-manager.test.js
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as gameState from '../../js/gameState.js';
import * as audioManager from '../../js/audioManager.js';

const audioMap = {
  reveal: { file: 'assets/audio/reveal.wav', volume: 0.5 },
  shipwreck: { file: 'assets/audio/shipwreck.wav', volume: 0.6 },
  returnToShip: { file: 'assets/audio/return-to-ship.wav', volume: 0.5 },
  abilityTrigger: { file: 'assets/audio/ability-trigger.wav', volume: 0.5 },
  specialAbility: { file: 'assets/audio/special-ability.wav', volume: 0.55 },
  gameEnd: { file: 'assets/audio/game-end.wav', volume: 0.6 },
};

const gameConfig = {
  abilities: {
    singleResolution: ['compass', 'cannon', 'captainShield'],
    chain: ['pirateDagger', 'luckyAnchor', 'seaSerpent', 'treasureMap', 'treasureChestGoldenKey'],
  },
};

/** Every FakeAudio instance ever constructed during a test, in order. */
let constructedAudio = [];

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.volume = 1;
    this.paused = false;
    this.currentTime = 0;
    this._listeners = {};
    constructedAudio.push(this);
  }

  addEventListener(name, handler) {
    (this._listeners[name] ??= []).push(handler);
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

/** Minimal in-memory localStorage stand-in. */
function makeFakeLocalStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

let fakeLocalStorage;

beforeEach(() => {
  constructedAudio = [];
  global.Audio = FakeAudio;
  fakeLocalStorage = makeFakeLocalStorage();
  global.localStorage = fakeLocalStorage;

  gameState.resetState();
  gameState.clearAllListeners();
  audioManager.resetForTesting();
});

afterEach(() => {
  audioManager.resetForTesting();
  gameState.clearAllListeners();
  delete global.Audio;
  delete global.localStorage;
});

test('card reveal (EXPEDITION_AREA_CARD_ADDED) plays the "reveal" sound exactly once', () => {
  audioManager.init(gameConfig, audioMap);
  gameState.addToExpeditionArea({ instanceId: 'card-1', defId: 'goldCoin-v4' });

  assert.equal(constructedAudio.length, 1);
  assert.equal(constructedAudio[0].src, audioMap.reveal.file);
});

test('entering SHIPWRECK plays the "shipwreck" sound exactly once', () => {
  audioManager.init(gameConfig, audioMap);
  gameState.setPhase(gameState.PHASES.SHIPWRECK);

  assert.equal(constructedAudio.length, 1);
  assert.equal(constructedAudio[0].src, audioMap.shipwreck.file);
});

test('entering RETURN_TO_SHIP plays the "returnToShip" sound exactly once', () => {
  audioManager.init(gameConfig, audioMap);
  gameState.setPhase(gameState.PHASES.RETURN_TO_SHIP);

  assert.equal(constructedAudio.length, 1);
  assert.equal(constructedAudio[0].src, audioMap.returnToShip.file);
});

test('an unrelated phase change plays nothing', () => {
  audioManager.init(gameConfig, audioMap);
  gameState.setPhase(gameState.PHASES.PLAYER_DECISION);
  gameState.setPhase(gameState.PHASES.DRAW_CARD);
  gameState.setPhase(gameState.PHASES.CHECK_DUPLICATE);

  assert.equal(constructedAudio.length, 0);
});

test('RESULTS_SET (game completion) plays the "gameEnd" sound exactly once', () => {
  audioManager.init(gameConfig, audioMap);
  gameState.setResults({ winners: ['p1'] });

  assert.equal(constructedAudio.length, 1);
  assert.equal(constructedAudio[0].src, audioMap.gameEnd.file);
});

test('playAbility() with a singleResolution ability key plays the "abilityTrigger" sound', () => {
  audioManager.init(gameConfig, audioMap);
  audioManager.playAbility('cannon');

  assert.equal(constructedAudio.length, 1);
  assert.equal(constructedAudio[0].src, audioMap.abilityTrigger.file);
});

test('playAbility() with a chain ability key plays the "specialAbility" sound', () => {
  audioManager.init(gameConfig, audioMap);
  audioManager.playAbility('pirateDagger');

  assert.equal(constructedAudio.length, 1);
  assert.equal(constructedAudio[0].src, audioMap.specialAbility.file);
});

test('playAbility() classifies every configured ability key correctly, both groups', () => {
  audioManager.init(gameConfig, audioMap);

  for (const key of gameConfig.abilities.singleResolution) {
    constructedAudio = [];
    audioManager.playAbility(key);
    assert.equal(constructedAudio[0]?.src, audioMap.abilityTrigger.file, `"${key}" should play abilityTrigger`);
  }

  for (const key of gameConfig.abilities.chain) {
    constructedAudio = [];
    audioManager.playAbility(key);
    assert.equal(constructedAudio[0]?.src, audioMap.specialAbility.file, `"${key}" should play specialAbility`);
  }
});

test('an unknown ability key falls back to "abilityTrigger" rather than throwing', () => {
  audioManager.init(gameConfig, audioMap);
  assert.doesNotThrow(() => audioManager.playAbility('someBrandNewAbility'));
  assert.equal(constructedAudio[0]?.src, audioMap.abilityTrigger.file);
});

test('while muted, no sound category plays and no Audio element is constructed', () => {
  audioManager.init(gameConfig, audioMap);
  audioManager.setMuted(true);

  gameState.addToExpeditionArea({ instanceId: 'card-1', defId: 'goldCoin-v4' });
  gameState.setPhase(gameState.PHASES.SHIPWRECK);
  gameState.setResults({ winners: ['p1'] });
  audioManager.playAbility('cannon');

  assert.equal(constructedAudio.length, 0);
});

test('muting mid-playback stops every currently in-flight sound (not just future ones)', () => {
  audioManager.init(gameConfig, audioMap);
  gameState.addToExpeditionArea({ instanceId: 'card-1', defId: 'goldCoin-v4' });

  assert.equal(constructedAudio.length, 1);
  assert.equal(constructedAudio[0].paused, false, 'sanity check: it was actually playing');

  audioManager.setMuted(true);

  assert.equal(constructedAudio[0].paused, true, 'setMuted(true) must pause already-in-flight audio, not just gate future play() calls');
});

test('unmuting after a mute allows playback to resume triggering again', () => {
  audioManager.init(gameConfig, audioMap);
  audioManager.setMuted(true);
  gameState.setPhase(gameState.PHASES.SHIPWRECK);
  assert.equal(constructedAudio.length, 0);

  audioManager.setMuted(false);
  gameState.setPhase(gameState.PHASES.RETURN_TO_SHIP);
  assert.equal(constructedAudio.length, 1);
});

test('toggleMute() flips isMuted() each call', () => {
  audioManager.init(gameConfig, audioMap);
  assert.equal(audioManager.isMuted(), false);

  audioManager.toggleMute();
  assert.equal(audioManager.isMuted(), true);

  audioManager.toggleMute();
  assert.equal(audioManager.isMuted(), false);
});

test('mute state is persisted to localStorage and read back on the next init()', () => {
  audioManager.init(gameConfig, audioMap);
  audioManager.setMuted(true);
  audioManager.resetForTesting();

  // A fresh init() (simulating a page reload) should come back up muted.
  audioManager.init(gameConfig, audioMap);
  assert.equal(audioManager.isMuted(), true);

  gameState.setPhase(gameState.PHASES.SHIPWRECK);
  assert.equal(constructedAudio.length, 0, 'should still be muted after reload, silencing gameplay sound immediately');
});

test('a corrupted/unavailable localStorage never throws and defaults to unmuted', () => {
  global.localStorage = {
    getItem: () => {
      throw new Error('storage disabled');
    },
    setItem: () => {
      throw new Error('storage disabled');
    },
  };

  assert.doesNotThrow(() => audioManager.init(gameConfig, audioMap));
  assert.equal(audioManager.isMuted(), false);
  assert.doesNotThrow(() => audioManager.setMuted(true));
});

test('playback functions never throw when no global Audio exists (headless-safe)', () => {
  delete global.Audio;
  audioManager.init(gameConfig, audioMap);

  assert.doesNotThrow(() => gameState.addToExpeditionArea({ instanceId: 'card-1', defId: 'goldCoin-v4' }));
  assert.doesNotThrow(() => gameState.setPhase(gameState.PHASES.SHIPWRECK));
  assert.doesNotThrow(() => audioManager.playAbility('cannon'));
});

test('resetForTesting() unsubscribes from gameState so a stale listener never leaks into the next test', () => {
  audioManager.init(gameConfig, audioMap);
  audioManager.resetForTesting();

  // No init() called again — nothing should be listening anymore.
  gameState.setPhase(gameState.PHASES.SHIPWRECK);
  assert.equal(constructedAudio.length, 0);
});
