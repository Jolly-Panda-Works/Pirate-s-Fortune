/**
 * ability-resolver.test.js
 *
 * Covers Prompt 009 exit criteria for js/abilityManager.js +
 * js/abilityResolver.js (GDD §12/§13):
 *   - abilityManager: registerAbility()/getAbility() round-trip, null/
 *     unregistered keys resolve to null (no-op), duplicate registration
 *     throws.
 *   - abilityResolver: a mock ability that appends a generated context to
 *     the Resolution Queue is processed WITHOUT resolveAbility() ever
 *     calling itself — proven via a call-depth counter that never exceeds
 *     1, not just inferred from the final state.
 *   - A null-ability card (e.g. Gold Coin's shape: `{ ability: null }`)
 *     resolves as a pure no-op — no handler invoked, no throw.
 *
 * Run with: node --test tests/unit/ability-resolver.test.js
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as abilityManager from '../../js/abilityManager.js';
import * as abilityResolver from '../../js/abilityResolver.js';

beforeEach(() => {
  abilityManager.resetRegistry();
});

// ---------------------------------------------------------------------------
// abilityManager.js
// ---------------------------------------------------------------------------

test('registerAbility/getAbility: round-trips a handler by key', () => {
  const handler = () => {};
  abilityManager.registerAbility('mockAbility', handler);
  assert.equal(abilityManager.getAbility('mockAbility'), handler);
  assert.equal(abilityManager.hasAbility('mockAbility'), true);
});

test('getAbility: returns null for a null/undefined key (no-op ability card)', () => {
  assert.equal(abilityManager.getAbility(null), null);
  assert.equal(abilityManager.getAbility(undefined), null);
});

test('getAbility: returns null for a key nothing is registered under', () => {
  assert.equal(abilityManager.getAbility('neverRegistered'), null);
  assert.equal(abilityManager.hasAbility('neverRegistered'), false);
});

test('registerAbility: throws on a duplicate key instead of silently overwriting', () => {
  abilityManager.registerAbility('mockAbility', () => {});
  assert.throws(() => abilityManager.registerAbility('mockAbility', () => {}));
});

test('registerAbility: throws for a non-function handler or an empty key', () => {
  assert.throws(() => abilityManager.registerAbility('mockAbility', 'not a function'));
  assert.throws(() => abilityManager.registerAbility('', () => {}));
});

// ---------------------------------------------------------------------------
// abilityResolver.js — Resolution Queue.
// ---------------------------------------------------------------------------

test('resolveAbility: a null-ability card (Gold Coin\'s shape) resolves as a pure no-op', () => {
  const goldCoinDef = { id: 'goldCoin-v4', type: 'goldCoin', value: 4, ability: null };
  const spy = () => {
    throw new Error('should never be called for a null ability');
  };
  abilityManager.registerAbility('shouldNeverRun', spy);

  let processedCount;
  assert.doesNotThrow(() => {
    processedCount = abilityResolver.resolveAbility(goldCoinDef, { reason: 'reveal' });
  });
  assert.equal(processedCount, 1);
});

test('resolveAbility: an unregistered ability key also no-ops rather than throwing', () => {
  const unregisteredDef = { id: 'mystery-v1', type: 'mystery', value: 1, ability: 'notRegistered' };
  assert.equal(abilityResolver.resolveAbility(unregisteredDef, { reason: 'reveal' }), 1);
});

test('resolveAbility: a mock ability that enqueues a generated context is processed iteratively, never recursively', () => {
  // Call-depth counter: incremented at the START of the handler and
  // decremented at the END. If resolveAbility() ever called itself
  // (recursion) instead of draining its own queue, a nested handler
  // invocation would push this above 1 while the outer one is still on
  // the stack. Because handlers here run strictly one-at-a-time from the
  // while loop, depth must never exceed 1.
  let currentDepth = 0;
  let maxDepthSeen = 0;
  let invocationCount = 0;
  const generatedSourceDef = { id: 'generated-v1', type: 'generated', value: 1, ability: 'mockChainAbility' };

  function mockChainAbility(context, enqueue) {
    currentDepth += 1;
    maxDepthSeen = Math.max(maxDepthSeen, currentDepth);
    invocationCount += 1;

    if (!context.isGenerated) {
      // Only the ORIGINAL (non-generated) invocation enqueues a follow-up,
      // so this terminates after exactly 2 total invocations.
      enqueue({ source: generatedSourceDef, reason: 'forced', parentAbility: 'mockChainAbility' });
    }

    currentDepth -= 1;
  }

  abilityManager.registerAbility('mockChainAbility', mockChainAbility);

  const originSourceDef = { id: 'origin-v1', type: 'origin', value: 1, ability: 'mockChainAbility' };
  const processedCount = abilityResolver.resolveAbility(originSourceDef, { reason: 'reveal' });

  assert.equal(invocationCount, 2, 'the mock ability should run once for itself and once for the generated context');
  assert.equal(maxDepthSeen, 1, 'no nested/recursive handler invocation — never more than one on the call stack at once');
  // processedCount counts EVERY queue item: origin (ability runs, enqueues
  // a follow-up) + generated (ability runs again, isGenerated is now
  // true so it does NOT enqueue further — terminates the chain) = 2.
  assert.equal(processedCount, 2);
});

test('resolveAbility: a chain can generate more than one further context, all still processed iteratively', () => {
  let maxDepthSeen = 0;
  let currentDepth = 0;
  let handlerRunCount = 0;
  const chainLength = 4; // origin + 3 generated hops

  function mockFanOutAbility(context, enqueue) {
    currentDepth += 1;
    maxDepthSeen = Math.max(maxDepthSeen, currentDepth);
    handlerRunCount += 1;

    const hop = (context.parentAbility ? Number(context.parentAbility.split('-')[1]) : 0) + 1;
    if (hop < chainLength) {
      enqueue({
        source: { id: `hop-${hop}`, type: 'hop', value: hop, ability: 'mockFanOutAbility' },
        reason: 'forced',
        parentAbility: `hop-${hop}`,
      });
    }
    currentDepth -= 1;
  }

  abilityManager.registerAbility('mockFanOutAbility', mockFanOutAbility);

  const originDef = { id: 'hop-0', type: 'hop', value: 0, ability: 'mockFanOutAbility' };
  abilityResolver.resolveAbility(originDef, { reason: 'reveal', parentAbility: 'hop-0' });

  assert.equal(handlerRunCount, chainLength);
  assert.equal(maxDepthSeen, 1, 'a multi-hop chain still never nests handler calls');
});

test('resolveAbility: context defaults match the GDD §12.1 AbilityContext shape', () => {
  let capturedContext = null;
  abilityManager.registerAbility('mockShapeCheck', (context) => {
    capturedContext = context;
  });

  const def = { id: 'shape-v1', type: 'shape', value: 1, ability: 'mockShapeCheck' };
  abilityResolver.resolveAbility(def, { currentPlayer: { id: 'p1' } });

  assert.equal(capturedContext.source, def);
  assert.deepEqual(capturedContext.currentPlayer, { id: 'p1' });
  assert.equal(capturedContext.targetPlayer, null);
  assert.equal(capturedContext.reason, 'reveal');
  assert.equal(capturedContext.isForced, false);
  assert.equal(capturedContext.isGenerated, false);
  assert.equal(capturedContext.parentAbility, null);
});
