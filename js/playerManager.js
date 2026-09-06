/**
 * playerManager.js
 *
 * Responsibility: Handles player and AI-related logic (GDD §15/§17).
 * Implemented: Phase 19 (AI) — Prompt 015, pulled forward into Stage B
 * (per docs/prompts/stage-b-minimal-ui.md) because the MVP requires at
 * least one AI opponent to be playable at all.
 *
 * This module owns every decision an AI player makes. It replaces the two
 * Stage A/B placeholder AI stubs that used to live directly inside
 * turnManager.js:
 *  - the Prompt 005 threshold Explore-Further/Return-to-Ship decision
 *    (`aiDecision()` + `AI_RETURN_THRESHOLD`), now `decideAction()` below;
 *  - the "AI never targets, always resolves untargeted" fallback Prompt
 *    014 deliberately left in place for `current.isAI` (see that
 *    Prompt's own header note in turnManager.js: "real AI targeting is
 *    Prompt 015's own 'same code path, different input source'"), now
 *    `chooseAbilityTarget()` below.
 *
 * Both functions are pure and synchronous by design (GDD §17: "prioritize
 * legal and stable behavior over sophisticated balancing" for the first
 * implementation) — no timers, no GameState reads/writes, no randomness.
 * turnManager.js calls straight through to them from the exact same
 * synchronous call stack a human's equivalent action would otherwise
 * occupy (playerDecision()/resolveAbility()), so an AI's whole turn — or,
 * for an all-AI game, the whole game — still resolves deterministically
 * in one pass, unit-testable with zero mocks/timers.
 *
 * A future, smarter AI (GDD §17: expedition size, secured cargo, deck
 * composition, risk, score) only ever needs to change the BODIES of the
 * two functions below — turnManager.js's call sites never need to change
 * again, since they already just ask this module "what does the AI do
 * here?" and act on the answer.
 *
 * UI-layer note (not this module's concern): any "watch the AI think"
 * pacing — a short artificial delay between AI actions so a human can
 * follow what happened — belongs ONLY in the UI layer (uiManager.js /
 * animationManager.js, Prompt 017+), driven off the same GameState events
 * a human turn already emits. It must never be added here: a delay inside
 * this module would make AI decisions asynchronous and untestable without
 * timers, which is exactly what the rest of this codebase's rules
 * (engine-independent, synchronous, deterministic core logic) forbid.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - No hard-coded card names — dispatch via card.ability keys only;
 *    chooseAbilityTarget() below never inspects which ability the
 *    options came from, only the generic option shape
 *    abilityManager.getEligibleTargets() already produced.
 *  - UI never mutates GameState directly (moot here — this module never
 *    touches GameState at all, exactly like abilityManager.js).
 */

import { createLogger } from './logger.js';

const log = createLogger('playerManager');

/**
 * MVP AI threshold (GDD §15 "MVP AI"):
 *
 *   Expedition < 3 cards  -> Explore Further
 *   Expedition >= 4 cards -> Return to Ship
 *
 * The GDD's own example leaves an exact size of 3 unstated (a gap between
 * "< 3" and ">= 4"); resolving that gap toward "still explore at 3" (i.e.
 * return once the Expedition Area size reaches this threshold, explore at
 * every smaller size including 3) is the only reading consistent with the
 * placeholder Prompt 005 already shipped and every existing test that
 * depends on its exact behavior (e.g. explore-vs-return.test.js's AI
 * exploring to exactly 4 cards before returning) — Prompt 015 replaces
 * WHERE this constant lives, not what it does.
 */
const AI_RETURN_THRESHOLD = 4;

/**
 * The MVP AI's Explore Further / Return to Ship decision (GDD §15).
 * Pure function of the current Expedition Area size, so it's trivially
 * testable/deterministic on its own — no GameState import needed here.
 *
 * @param {number} expeditionSize - gameState.getExpeditionArea().length
 * @returns {'explore'|'return'}
 */
function decideAction(expeditionSize) {
  const decision = expeditionSize >= AI_RETURN_THRESHOLD ? 'return' : 'explore';
  log.debug('AI decision (GDD §15 MVP threshold)', { expeditionSize, decision });
  return decision;
}

/**
 * The MVP AI's targeted-ability selection (GDD §17 "Ability targeting").
 * "Pick the first eligible target deterministically for MVP, no smart
 * targeting yet" (Prompt 015) — `options` is always whatever a targeted
 * ability's own `getEligibleTargets()` produced (Cannon/Pirate
 * Dagger/Lucky Anchor/Treasure Map — see abilityManager.js), a flat array
 * already filtered down to legal choices, so "first" is always safe and
 * never needs re-validating here.
 *
 * This is deliberately the exact same option shape/contract a human's
 * click-driven selection carries into turnManager.js's
 * resolveAbilityChoice() — turnManager.js's resolveAbility() feeds the AI
 * branch through that SAME target-context-building logic afterward, so
 * neither this function nor any ability handler ever needs to know
 * whether a choice came from a human or an AI (GDD §17, "same code path,
 * different input source").
 *
 * @param {Array<object>} options - non-empty; each entry one of the
 *   option shapes an ability's own getEligibleTargets() returns (e.g.
 *   `{targetPlayerId, targetCardId, defId}` for Cannon/Dagger,
 *   `{cargoCardId, defId}` for Anchor, `{targetCardId, defId}` for Map)
 * @returns {object} the chosen option — always `options[0]` for MVP
 */
function chooseAbilityTarget(options) {
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error('playerManager.chooseAbilityTarget: options must be a non-empty array');
  }
  const selection = options[0];
  log.debug('AI ability target selected (deterministic — first eligible option, GDD §17)', {
    selection,
  });
  return selection;
}

export { decideAction, chooseAbilityTarget };

export default { decideAction, chooseAbilityTarget };
