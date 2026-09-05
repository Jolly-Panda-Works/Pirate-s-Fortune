/**
 * abilityManager.js
 *
 * Responsibility: Registers ability handlers by ability key (GDD §12),
 * and (Prompt 014) an optional per-ability "eligible targets" query
 * function for abilities that need real player target selection.
 * Implemented: Phase 9 (Ability Framework) — Prompt 009.
 * Extended: Phase 14 (Modal System) — Prompt 014.
 *
 * A tiny registry — nothing else. This is the ONLY sanctioned way an
 * ability key (data/cards.json `ability`, e.g. "compass"/"cannon"/etc.)
 * gets connected to the function(s) that implement it. abilityResolver.js
 * looks the HANDLER up here; turnManager.js looks the (optional)
 * ELIGIBILITY function up here. Neither ever branches on a card's
 * name/type/ability key itself (rule 4/rule 9 — "no large conditional
 * chain based on card names", GDD §12).
 *
 * The eligibility registry is what lets turnManager.js decide, generically
 * and without a per-ability if/else, whether a just-revealed card's
 * ability needs to pause for a human's target selection (Prompt 014's
 * modal system) or can resolve immediately: an ability with nothing
 * registered under getEligibleTargets (Compass, Captain Shield, Sea
 * Serpent, Treasure Chest + Golden Key, and Gold Coin's null ability)
 * simply never needs one — GDD §14.6/§14.8 both resolve automatically,
 * and Compass/Captain Shield need no target at all.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - No hard-coded card names — registration/lookup is by ability KEY
 *    (a string), never a card's display name.
 *  - UI never mutates GameState directly — this module doesn't touch
 *    GameState at all.
 */

import { createLogger } from './logger.js';

const log = createLogger('abilityManager');

// Module-private registries: ability key (string) -> function.
const registry = new Map();
const eligibilityRegistry = new Map();

/**
 * Registers a handler function under an ability key. Concrete ability
 * modules (js/abilities/*.js) call this once each at module load time —
 * e.g. `abilityManager.registerAbility('compass', handleCompass);`
 *
 * Registering the same key twice is treated as a caller bug (most likely
 * a duplicate import or a copy-paste key collision) and throws rather
 * than silently overwriting a handler.
 *
 * @param {string} key - ability key, matching a data/cards.json `ability`
 *   value (e.g. "compass") and a gameConfig.json abilities list entry
 * @param {(context: object, enqueue: (ctx: object) => void) => void} handlerFn
 *   - see abilityResolver.js for the exact (context, enqueue) contract
 * @param {{getEligibleTargets?: (...args: any[]) => Array<object>}} [options]
 *   - Prompt 014: for abilities that need real target selection, a pure
 *   function returning every currently-eligible option (shape is the
 *   ability's own choice — see e.g. abilities/cannon.js's own
 *   getEligibleTargets for its exact option shape). Abilities that never
 *   need a target (Compass, Captain Shield, Sea Serpent, Treasure Chest +
 *   Golden Key) simply omit this.
 */
function registerAbility(key, handlerFn, options = {}) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('abilityManager.registerAbility: key must be a non-empty string');
  }
  if (typeof handlerFn !== 'function') {
    throw new Error(`abilityManager.registerAbility: handler for "${key}" must be a function`);
  }
  if (registry.has(key)) {
    throw new Error(`abilityManager.registerAbility: ability key "${key}" is already registered`);
  }
  registry.set(key, handlerFn);

  if (options.getEligibleTargets !== undefined) {
    if (typeof options.getEligibleTargets !== 'function') {
      throw new Error(`abilityManager.registerAbility: getEligibleTargets for "${key}" must be a function`);
    }
    eligibilityRegistry.set(key, options.getEligibleTargets);
  }

  log.debug('Ability registered', { key, hasEligibility: eligibilityRegistry.has(key) });
}

/**
 * Looks up a registered handler by ability key.
 * @param {string|null|undefined} key
 * @returns {Function|null} the handler, or null if `key` is null/undefined
 *   (a card with no ability, e.g. Gold Coin — a legitimate no-op, not an
 *   error) or if nothing is registered under that key.
 */
function getAbility(key) {
  if (key === null || key === undefined) {
    return null;
  }
  return registry.get(key) ?? null;
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function hasAbility(key) {
  return registry.has(key);
}

/**
 * @param {string|null|undefined} key
 * @returns {boolean} whether `key` has a registered eligibility function —
 *   i.e. whether this ability ever needs a real target selection at all.
 */
function needsTargetSelection(key) {
  if (key === null || key === undefined) return false;
  return eligibilityRegistry.has(key);
}

/**
 * Computes the currently-eligible target options for a targeted ability.
 * @param {string|null|undefined} key
 * @param {...any} args - forwarded verbatim to the registered
 *   getEligibleTargets function (e.g. the current player's id)
 * @returns {Array<object>|null} the eligible options, or null if `key`
 *   has no registered eligibility function (meaning: this ability never
 *   needs target selection at all — distinct from an empty array, which
 *   means the ability DOES need one but nothing is currently eligible).
 */
function getEligibleTargets(key, ...args) {
  if (key === null || key === undefined) return null;
  const fn = eligibilityRegistry.get(key);
  if (!fn) return null;
  return fn(...args);
}

/**
 * Clears every registered handler/eligibility function. Intended for test
 * isolation only — real gameplay code should never need to unregister an
 * ability.
 */
function resetRegistry() {
  registry.clear();
  eligibilityRegistry.clear();
}

export { registerAbility, getAbility, hasAbility, needsTargetSelection, getEligibleTargets, resetRegistry };

export default {
  registerAbility,
  getAbility,
  hasAbility,
  needsTargetSelection,
  getEligibleTargets,
  resetRegistry,
};
