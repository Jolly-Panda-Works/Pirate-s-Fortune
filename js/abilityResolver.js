/**
 * abilityResolver.js
 *
 * Responsibility: Executes ability contexts and the Resolution Queue
 * (GDD §12/§13).
 * Implemented: Phase 9 (Ability Framework) — Prompt 009.
 *
 * AbilityContext shape (GDD §12.1):
 *   { source, currentPlayer, targetPlayer, reason, isForced, isGenerated,
 *     parentAbility }
 * `source` is expected to be a card DEFINITION (a data/cards.json entry,
 * not a CardInstance) — its `.ability` key is what selects the handler
 * via abilityManager.getAbility(). Callers (turnManager.js, and later the
 * concrete ability handlers themselves) are responsible for resolving a
 * CardInstance's `defId` to its definition before it becomes a context's
 * `source` — this module never touches `defId`/cardManager itself, to
 * stay a pure orchestration layer over abilityManager's registry.
 *
 * Resolution Queue (GDD §13): resolveAbility() seeds an internal queue
 * with exactly one AbilityContext (the card that just passed the
 * duplicate check) and drains it iteratively:
 *   while queue is not empty:
 *     process next context
 *     generated actions are appended to queue
 * A handler that wants to generate further resolution (Sea Serpent
 * forcing another reveal, Dagger/Anchor introducing another card, etc. —
 * concrete versions arrive in Prompt 010b) does so by calling the
 * `enqueue` callback it's given, NOT by calling resolveAbility() again.
 * resolveAbility() never calls itself under any code path — this is what
 * structurally guarantees no uncontrolled recursion (rule 10, GDD §13),
 * rather than a depth counter or convention a future change could forget.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - No hard-coded card names — dispatch is entirely abilityManager's
 *    key-based lookup; this module never inspects a card's name/type.
 *  - UI never mutates GameState directly — this module doesn't touch
 *    GameState at all (handlers that need to, in later prompts, do so
 *    themselves, the same way burnManager/collectManager do).
 */

import { createLogger } from './logger.js';
import * as abilityManager from './abilityManager.js';

const log = createLogger('abilityResolver');

/**
 * Fills in every GDD §12.1 AbilityContext field with a safe default,
 * then overlays whatever the caller/handler actually supplied — so every
 * context flowing through the queue has a complete, predictable shape
 * regardless of how much a given caller bothered to specify.
 * @param {object} [overrides]
 * @returns {object} a complete AbilityContext
 */
function buildContext(overrides = {}) {
  return {
    source: null,
    currentPlayer: null,
    targetPlayer: null,
    reason: 'reveal',
    isForced: false,
    isGenerated: false,
    parentAbility: null,
    ...overrides,
  };
}

/**
 * Resolves one card's ability, plus (iteratively, never recursively) any
 * further AbilityContexts that ability's handler generates.
 *
 * @param {object|null} cardDefinition - the resolving card's definition
 *   (an entry from data/cards.json `.cards`, or null/undefined — treated
 *   the same as a null-ability card, i.e. a no-op). May be omitted if the
 *   caller instead supplies `context.source` directly.
 * @param {object} [context] - a partial AbilityContext (GDD §12.1);
 *   missing fields are filled via buildContext(). `context.source`
 *   defaults to `cardDefinition` when not explicitly given.
 * @returns {number} how many AbilityContexts were processed (1 for a
 *   single-resolution ability or a no-op null-ability card, more if the
 *   queue grew) — primarily useful for tests/logging, not gameplay logic.
 */
function resolveAbility(cardDefinition, context = {}) {
  const initialContext = buildContext({
    source: cardDefinition ?? context.source ?? null,
    ...context,
  });

  const queue = [initialContext];

  /**
   * Given to every handler as its second argument. Handlers call this to
   * extend the SAME queue this function is already draining, instead of
   * calling resolveAbility() again — this is the whole mechanism that
   * makes chain abilities (Sea Serpent generating another Sea Serpent,
   * etc.) safe without recursion.
   * @param {object} generatedContext - partial AbilityContext; missing
   *   fields filled via buildContext(), `isGenerated` defaults to true
   *   here specifically (this context exists BECAUSE another ability
   *   generated it) unless the handler explicitly overrides it.
   */
  function enqueue(generatedContext = {}) {
    queue.push(buildContext({ isGenerated: true, ...generatedContext }));
  }

  let processedCount = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    processedCount += 1;

    const abilityKey = current.source?.ability ?? null;
    if (abilityKey === null) {
      log.debug('resolveAbility: no-op (null ability)', {
        defId: current.source?.id ?? null,
        reason: current.reason,
      });
      continue;
    }

    const handler = abilityManager.getAbility(abilityKey);
    if (!handler) {
      log.warn(`resolveAbility: no handler registered for ability key "${abilityKey}" — skipping`, {
        defId: current.source?.id ?? null,
      });
      continue;
    }

    log.debug('resolveAbility: invoking handler', {
      abilityKey,
      defId: current.source?.id ?? null,
      reason: current.reason,
      isGenerated: current.isGenerated,
    });
    handler(current, enqueue);
  }

  return processedCount;
}

export { resolveAbility, buildContext };

export default { resolveAbility, buildContext };
