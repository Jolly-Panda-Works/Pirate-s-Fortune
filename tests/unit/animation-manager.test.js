/**
 * animation-manager.test.js
 *
 * Covers Prompt 018's actual hard requirement (GDD §22: "a duplicate card
 * must visibly appear before Shipwreck resolves") at the ONE layer of
 * js/animationManager.js that's genuinely testable without a real DOM:
 * the render-gating hold itself. See animationManager.js's own header
 * for the full architecture rationale — this file doesn't touch a single
 * `document` API, only gameState.js's event system (DOM-free, exactly
 * like every other engine-layer test in this suite) plus Node's built-in
 * `mock.timers` (stable since Node 20) standing in for real time.
 *
 * The DOM-touching trigger functions (playCardReveal, playCollection,
 * playAbilityTrigger, waitForAnimation, acknowledgeDuplicate's own
 * `document.querySelector` half) stay OUTSIDE this suite's scope, exactly
 * like every other Stage B/C/D UI-facing function in this codebase (see
 * mvp-progress.md's Prompt 012/013 note) — those are verified instead via
 * a one-off DOM-shim script, matching Prompt 015-017's own precedent.
 *
 * Run with: node --test tests/unit/animation-manager.test.js
 */

import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import * as gameState from '../../js/gameState.js';
import * as animationManager from '../../js/animationManager.js';

beforeEach(() => {
  animationManager.resetForTesting();
  gameState.resetState();
  gameState.clearAllListeners();
  mock.timers.enable({ apis: ['setTimeout'] });
});

afterEach(() => {
  animationManager.resetForTesting();
  mock.timers.reset();
});

test('a render target fires immediately for an ordinary (non-Shipwreck) phase change', () => {
  const renderCalls = [];
  animationManager.init([() => renderCalls.push('render')]);

  gameState.setPhase(gameState.PHASES.PLAYER_DECISION);

  assert.equal(renderCalls.length, 1, 'render should fire synchronously for a non-Shipwreck phase change');
});

test('multiple render targets all fire on each ungated render pass', () => {
  const calls = [];
  animationManager.init([() => calls.push('a'), () => calls.push('b')]);

  gameState.setPhase(gameState.PHASES.PLAYER_DECISION);

  assert.deepEqual(calls, ['a', 'b'], 'every render target should fire, in the order given to init()');
});

test('GDD §22 hard requirement: entering SHIPWRECK renders immediately, then holds further renders', () => {
  const renderCalls = [];
  animationManager.init([() => renderCalls.push(gameState.getPhase())]);

  gameState.setPhase(gameState.PHASES.SHIPWRECK);
  assert.deepEqual(renderCalls, ['SHIPWRECK'], 'the SHIPWRECK phase change itself must render immediately — this is the actual "duplicate visible" frame');

  // Simulate what turnManager.shipwreck() does next in the SAME
  // synchronous tick: mutate GameState further (moving cards to Lost
  // Loot) and change phase again via endTurn().
  gameState.setPhase(gameState.PHASES.END_TURN);
  assert.deepEqual(
    renderCalls,
    ['SHIPWRECK'],
    'a render reflecting END_TURN must NOT fire yet — it would show the post-Shipwreck state before a human ever perceived the duplicate'
  );
});

test('the held render releases automatically once the hold duration elapses', () => {
  const renderCalls = [];
  animationManager.init([() => renderCalls.push(gameState.getPhase())]);

  gameState.setPhase(gameState.PHASES.SHIPWRECK);
  gameState.setPhase(gameState.PHASES.END_TURN);
  assert.equal(renderCalls.length, 1, 'still only the SHIPWRECK render before the hold elapses');

  mock.timers.tick(1000); // > DUPLICATE_VISIBLE_HOLD_MS (900ms)

  assert.deepEqual(
    renderCalls,
    ['SHIPWRECK', 'END_TURN'],
    'exactly one more render should fire once the hold elapses, reflecting the LATEST GameState by then'
  );
});

test('several GameState changes during the hold are collapsed into a single release render (not one per event)', () => {
  const renderCalls = [];
  animationManager.init([() => renderCalls.push(gameState.getPhase())]);

  gameState.setPhase(gameState.PHASES.SHIPWRECK);
  gameState.setPhase(gameState.PHASES.END_TURN);
  gameState.setPhase(gameState.PHASES.PLAYER_TURN_START);
  gameState.setPhase(gameState.PHASES.DRAW_CARD);
  gameState.setPhase(gameState.PHASES.PLAYER_DECISION);

  assert.equal(renderCalls.length, 1, 'still only the initial SHIPWRECK render while held');

  mock.timers.tick(1000);

  assert.deepEqual(
    renderCalls,
    ['SHIPWRECK', 'PLAYER_DECISION'],
    'the release should render exactly once more, reflecting the final state, not once per queued event'
  );
});

test('a second Shipwreck occurring after the first hold already released still holds correctly', () => {
  const renderCalls = [];
  animationManager.init([() => renderCalls.push(gameState.getPhase())]);

  gameState.setPhase(gameState.PHASES.SHIPWRECK);
  gameState.setPhase(gameState.PHASES.END_TURN); // held — mirrors turnManager.shipwreck() always calling endTurn() right after
  mock.timers.tick(1000);
  assert.equal(renderCalls.length, 2, 'first Shipwreck cycle: immediate render + one release render reflecting END_TURN');

  gameState.setPhase(gameState.PHASES.CHECK_DUPLICATE); // ungated, renders immediately
  gameState.setPhase(gameState.PHASES.SHIPWRECK); // gated again
  gameState.setPhase(gameState.PHASES.END_TURN); // held

  assert.equal(renderCalls.length, 4, 'CHECK_DUPLICATE + second SHIPWRECK both rendered immediately, END_TURN held');

  mock.timers.tick(1000);
  assert.equal(renderCalls.length, 5, 'second hold released exactly once more');
});

test('setDisabled(true) makes every render fire immediately, even a Shipwreck one — debug escape hatch', () => {
  const renderCalls = [];
  animationManager.init([() => renderCalls.push(gameState.getPhase())]);
  animationManager.setDisabled(true);

  gameState.setPhase(gameState.PHASES.SHIPWRECK);
  gameState.setPhase(gameState.PHASES.END_TURN);

  assert.deepEqual(
    renderCalls,
    ['SHIPWRECK', 'END_TURN'],
    'with the animation layer disabled, every render fires immediately — game logic was never at risk either way (see animationManager.js header)'
  );
});

test('setDisabled(true) mid-hold immediately releases any already-pending render', () => {
  const renderCalls = [];
  animationManager.init([() => renderCalls.push(gameState.getPhase())]);

  gameState.setPhase(gameState.PHASES.SHIPWRECK);
  gameState.setPhase(gameState.PHASES.END_TURN); // held
  assert.equal(renderCalls.length, 1);

  animationManager.setDisabled(true);

  assert.deepEqual(renderCalls, ['SHIPWRECK', 'END_TURN'], 'disabling mid-hold should flush the pending render right away');
});

test('a render target throwing is caught and logged, never breaking a sibling render target', () => {
  const calls = [];
  animationManager.init([
    () => {
      throw new Error('boom');
    },
    () => calls.push('second target still ran'),
  ]);

  assert.doesNotThrow(() => gameState.setPhase(gameState.PHASES.PLAYER_DECISION));
  assert.deepEqual(calls, ['second target still ran']);
});

test('waitForAnimation resolves without throwing when there is no DOM element (headless-safe)', async () => {
  await assert.doesNotReject(animationManager.waitForAnimation(null, 'some-class'));
  await assert.doesNotReject(animationManager.waitForAnimation(undefined, 'some-class'));
});

test('acknowledgeDuplicate never throws even with no matching DOM element (headless-safe)', async () => {
  await assert.doesNotReject(animationManager.acknowledgeDuplicate({ instanceId: 'does-not-exist' }));
});

test('playCollection resolves for an empty array without throwing', async () => {
  await assert.doesNotReject(animationManager.playCollection([]));
});

test('playAbilityTrigger resolves without throwing for a single card object (not wrapped in an array)', async () => {
  await assert.doesNotReject(animationManager.playAbilityTrigger('cannon', { instanceId: 'card-1' }));
});
