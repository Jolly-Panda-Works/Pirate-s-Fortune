import test from 'node:test';
import assert from 'node:assert/strict';

import { runInRoom, takeOverSeat, cardDefinitions, gameConfig, PHASES, warmUp } from './engineHost.js';

function newGame(seed, players) {
  return runInRoom(null, (gm) => gm.startGame(cardDefinitions, gameConfig, players, {
    treasureSeed: seed,
    lostLootSeed: `${seed}-lost`,
  }));
}

function humanStep(snapshot, decide) {
  return runInRoom(snapshot, (gm) => {
    if (gm.getPhase() === PHASES.PLAYER_CHOICE) {
      gm.chooseAbilityTarget(gm.getPendingAbilityChoice().options[0]);
    } else {
      decide(gm);
    }
  });
}

const humanVsAi = [
  { id: 'h', name: 'Human', isAI: false, shipCargo: [], score: 0 },
  { id: 'ai', name: 'Bot', isAI: true, shipCargo: [], score: 0 },
];

test('two interleaved rooms stay isolated and match a solo run', () => {
  warmUp();
  const decide = (gm) => (gm.getExpeditionArea().length >= 2 ? gm.returnToShip() : gm.revealNextCard());

  // Reference: one room alone.
  let solo = newGame('iso', humanVsAi);
  while (solo.snapshot.phase !== PHASES.SCORING) solo = humanStep(solo.snapshot, decide);

  // Same seed again, interleaved with an unrelated room.
  let a = newGame('iso', humanVsAi);
  let b = newGame('other', humanVsAi);
  while (a.snapshot.phase !== PHASES.SCORING) {
    a = humanStep(a.snapshot, decide);
    if (b.snapshot.phase !== PHASES.SCORING) b = humanStep(b.snapshot, (gm) => gm.returnToShip());
  }

  assert.deepEqual(a.snapshot.results, solo.snapshot.results);
  assert.deepEqual(
    a.snapshot.players.map((p) => p.score),
    solo.snapshot.players.map((p) => p.score)
  );
});

test('frames are recorded for replay and hide nothing the view needs', () => {
  const { frames, snapshot } = newGame('frames', humanVsAi);
  assert.ok(frames.length > 0);
  assert.equal(snapshot.phase, PHASES.PLAYER_DECISION);
  assert.ok(frames.some((f) => f.type === 'EXPEDITION_AREA_CARD_ADDED'));
  assert.equal(typeof frames[0].view.treasureDeckCount, 'number');
  assert.equal(frames[0].view.treasureDeck, undefined);
});

test('invalid actions throw and leave the snapshot alone', () => {
  const { snapshot } = newGame('invalid', humanVsAi);
  assert.throws(() => runInRoom(snapshot, (gm) => gm.chooseAbilityTarget({})));
});

test('a departed human is taken over by the engine AI', () => {
  const both = [
    { id: 'h1', name: 'One', isAI: false, shipCargo: [], score: 0 },
    { id: 'h2', name: 'Two', isAI: false, shipCargo: [], score: 0 },
  ];
  let r = newGame('takeover', both);
  r = takeOverSeat(r.snapshot, 'h1');
  assert.equal(r.snapshot.players[0].isAI, true);
  // Play continues with h2 only; the game must still finish.
  let guard = 0;
  while (r.snapshot.phase !== PHASES.SCORING && guard++ < 500) {
    r = humanStep(r.snapshot, (gm) => gm.returnToShip());
  }
  assert.equal(r.snapshot.phase, PHASES.SCORING);
});
