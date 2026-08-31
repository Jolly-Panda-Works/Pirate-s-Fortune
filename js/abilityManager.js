/**
 * abilityManager.js
 *
 * Responsibility: Registers ability handlers by ability key (GDD §12).
 * Implemented: Phase 9 (Ability Framework) — Prompt 009.
 *
 * A tiny registry — nothing else. This is the ONLY sanctioned way an
 * ability key (data/cards.json `ability`, e.g. "compass"/"cannon"/etc.,
 * arriving concretely in Prompt 010/010b) gets connected to the function
 * that implements it. abilityResolver.js looks handlers up here; it never
 * branches on a card's name/type/ability key itself (rule 4/rule 9 —
 * "no large conditional chain based on card names", GDD §12).
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

// Module-private registry: ability key (string) -> handler function.
const registry = new Map();

/**
 * Registers a handler function under an ability key. Concrete ability
 * modules (js/abilities/*.js, arriving Prompt 010/010b) call this once
 * each at module load time — e.g.
 *   abilityManager.registerAbility('compass', handleCompass);
 *
 * Registering the same key twice is treated as a caller bug (most likely
 * a duplicate import or a copy-paste key collision) and throws rather
 * than silently overwriting a handler.
 *
 * @param {string} key - ability key, matching a data/cards.json `ability`
 *   value (e.g. "compass") and a gameConfig.json abilities list entry
 * @param {(context: object, enqueue: (ctx: object) => void) => void} handlerFn
 *   - see abilityResolver.js for the exact (context, enqueue) contract
 */
function registerAbility(key, handlerFn) {
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
  log.debug('Ability registered', { key });
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
 * Clears every registered handler. Intended for test isolation only —
 * real gameplay code should never need to unregister an ability.
 */
function resetRegistry() {
  registry.clear();
}

export { registerAbility, getAbility, hasAbility, resetRegistry };

export default { registerAbility, getAbility, hasAbility, resetRegistry };
