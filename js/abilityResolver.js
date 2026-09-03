/**
 * abilityResolver.js
 *
 * Responsibility: Executes ability contexts and the Resolution Queue
 * (GDD §12/§13).
 * Implemented: Phase 9 (Ability Framework) — Prompt 009.
 * Updated: Phase 10b (Chain Abilities) — Prompt 010b.
 *
 * AbilityContext shape (GDD §12.1):
 *   { source, currentPlayer, targetPlayer, reason, isForced, isGenerated,
 *     parentAbility }
 * `source` is expected to be a card DEFINITION (a data/cards.json entry,
 * not a CardInstance) — its `.ability` key is what selects the handler
 * via abilityManager.getAbility(). Callers (turnManager.js, and later the
 * concrete ability handlers themselves) are responsible for resolving a
 * CardInstance's `defId` to its definition before it becomes a context's
 * `source`.
 *
 * Resolution Queue (GDD §13): resolveAbility() seeds an internal queue
 * with exactly one AbilityContext (the card that just passed the
 * duplicate check) and drains it iteratively:
 *   while queue is not empty:
 *     process next context
 *     generated actions are appended to queue
 * A handler that wants to generate further resolution (Sea Serpent
 * forcing another reveal, Dagger/Anchor introducing another card, etc.)
 * does so by calling the `enqueue` callback it's given, NOT by calling
 * resolveAbility() again. resolveAbility() never calls itself under any
 * code path — this is what structurally guarantees no uncontrolled
 * recursion (rule 10, GDD §13), rather than a depth counter or convention
 * a future change could forget.
 *
 * Prompt 010b — chain-generated cards (GDD §14.4-14.6, Pirate Dagger /
 * Lucky Anchor / Sea Serpent): these abilities don't just want another
 * ability to run — they introduce an actual CardInstance (stolen,
 * replayed, or forcibly drawn) that must go through the FULL Card
 * Resolution Order, same as any normally-revealed card: enter the
 * Expedition Area, get duplicate-checked BEFORE its own ability runs, and
 * either resolve its ability (safe) or halt resolution entirely
 * (duplicate — its own ability never executes, Shipwreck is required).
 * A handler requests this by calling `enqueue({ cardInstance, ... })`
 * (as opposed to a plain `enqueue({ source: someDefinition, ... })`,
 * which just queues another ability invocation with no expedition
 * involvement). The queue-draining loop below is what actually performs
 * the introduce-and-duplicate-check step — NOT the handler and NOT a
 * recursive call to resolveAbility() — so this module now needs limited,
 * direct GameState access (via gameState.js/cardManager.js/burnManager.js)
 * for that one specific responsibility. It still never ends a turn or
 * calls triggerShipwreck() itself: if a chain-generated card duplicates,
 * the loop stops immediately (nothing further in the queue can possibly
 * matter — the expedition is over) and reports which card caused it via
 * the return value's `shipwreckedCard`, leaving the actual Shipwreck
 * aftermath + turnHistory + endTurn() sequence to the caller (turnManager.js
 * already owns exactly that sequence for a normal duplicate — Prompt 010b
 * reuses it rather than duplicating it here).
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - No hard-coded card names — dispatch is entirely abilityManager's
 *    key-based lookup; this module never inspects a card's name.
 *  - UI never mutates GameState directly — this module is one of the
 *    sanctioned callers of gameState.js's mutators (only for the chain-
 *    generated-card introduction step described above), never uiManager.js.
 */

import { createLogger } from './logger.js';
import * as abilityManager from './abilityManager.js';
import * as gameState from './gameState.js';
import * as cardManager from './cardManager.js';
import * as burnManager from './burnManager.js';

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
 * further AbilityContexts that ability's handler generates — including,
 * per Prompt 010b, actual chain-generated CardInstances that must run the
 * full Card Resolution Order.
 *
 * @param {object|null} cardDefinition - the resolving card's definition
 *   (an entry from data/cards.json `.cards`, or null/undefined — treated
 *   the same as a null-ability card, i.e. a no-op). May be omitted if the
 *   caller instead supplies `context.source` directly.
 * @param {object} [context] - a partial AbilityContext (GDD §12.1);
 *   missing fields are filled via buildContext(). `context.source`
 *   defaults to `cardDefinition` when not explicitly given.
 * @param {Array<object>} [cardDefinitions] - parsed data/cards.json
 *   `.cards` — REQUIRED whenever a handler may enqueue a chain-generated
 *   `cardInstance` (Dagger/Anchor/Sea Serpent), since the queue-draining
 *   loop needs it to resolve that CardInstance's own definition/ability
 *   and to run the duplicate check. Safe to omit for abilities that never
 *   generate a card (Compass/Cannon/Captain Shield/Treasure Map's own
 *   trigger/Treasure Chest + Golden Key).
 * @returns {{processedCount: number, shipwreckedCard: object|null}}
 *   processedCount: how many AbilityContexts were processed (1 for a
 *   single-resolution ability or a no-op null-ability card, more if the
 *   queue grew) — primarily useful for tests/logging, not gameplay logic.
 *   shipwreckedCard: null unless a chain-generated card turned out to be
 *   a duplicate, in which case this is that CardInstance — the caller
 *   (turnManager.js) is responsible for treating this exactly like a
 *   normal duplicate (its own shipwreck() step), since resolveAbility()
 *   itself never ends a turn.
 */
function resolveAbility(cardDefinition, context = {}, cardDefinitions = []) {
  const initialContext = buildContext({
    source: cardDefinition ?? context.source ?? null,
    ...context,
  });

  const queue = [initialContext];

  /**
   * Given to every handler as its second argument. Handlers call this to
   * extend the SAME queue this function is already draining, instead of
   * calling resolveAbility() again. Two shapes are supported:
   *   - `{ source: someDefinition, ... }` — queue another plain ability
   *     invocation (no expedition involvement).
   *   - `{ cardInstance: someCardInstance, ... }` — queue a chain-
   *     generated card that must go through the full Card Resolution
   *     Order (Prompt 010b) before its own ability (if any) runs.
   * @param {object} generatedContext - partial AbilityContext; missing
   *   fields filled via buildContext(), `isGenerated` defaults to true
   *   here specifically (this context exists BECAUSE another ability
   *   generated it) unless the handler explicitly overrides it.
   */
  function enqueue(generatedContext = {}) {
    queue.push(buildContext({ isGenerated: true, ...generatedContext }));
  }

  let processedCount = 0;
  let shipwreckedCard = null;

  while (queue.length > 0) {
    const current = queue.shift();
    processedCount += 1;

    if (current.cardInstance) {
      // Prompt 010b: a chain-generated card — introduce it into the
      // Expedition Area and run the SAME duplicate check a normally-
      // revealed card gets, before ever considering its own ability.
      // Always resets ownerId to null on entry (matching how a freshly
      // drawn deck card behaves) regardless of which zone it came from —
      // a stolen/replayed card is "at risk" again, not still owned by
      // whoever it came from.
      const introducedCard = cardManager.moveInstance(
        current.cardInstance,
        cardManager.ZONES.EXPEDITION,
        null
      );
      gameState.addToExpeditionArea(introducedCard);

      const isDuplicate = burnManager.isDuplicate(
        introducedCard,
        gameState.getExpeditionArea(),
        cardDefinitions
      );

      if (isDuplicate) {
        log.info('resolveAbility: a chain-generated card duplicated — halting the queue', {
          defId: introducedCard.defId,
          reason: current.reason,
          parentAbility: current.parentAbility,
        });
        shipwreckedCard = introducedCard;
        break;
      }

      const introducedDef = cardManager.getDefinition(cardDefinitions, introducedCard.defId);
      const introducedAbilityKey = introducedDef?.ability ?? null;

      log.debug('resolveAbility: chain-generated card resolved safely', {
        defId: introducedCard.defId,
        reason: current.reason,
        ability: introducedAbilityKey,
      });

      if (introducedAbilityKey !== null) {
        const introducedHandler = abilityManager.getAbility(introducedAbilityKey);
        if (introducedHandler) {
          introducedHandler(
            buildContext({
              source: introducedDef,
              currentPlayer: current.currentPlayer,
              targetPlayer: current.targetPlayer,
              reason: current.reason,
              isGenerated: true,
              parentAbility: current.parentAbility,
            }),
            enqueue
          );
        } else {
          log.warn(
            `resolveAbility: no handler registered for chain-generated ability key "${introducedAbilityKey}" — skipping`,
            { defId: introducedCard.defId }
          );
        }
      }
      continue;
    }

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

  return { processedCount, shipwreckedCard };
}

export { resolveAbility, buildContext };

export default { resolveAbility, buildContext };
