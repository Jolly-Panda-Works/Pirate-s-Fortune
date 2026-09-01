/**
 * abilities/captainShield.js
 *
 * GDD §14.3 — Captain Shield: retroactive protection for the expedition,
 * a single-resolution ability (never a chain — it never calls the
 * `enqueue` callback it's given).
 * Implemented: Phase 10a (Single-Resolution Abilities) — Prompt 010.
 *
 * Documented edge cases (implemented exactly):
 *  - "A Shield revealed as the first card protects nothing." — checked
 *    here: if this is the very first card of the expedition (the
 *    Expedition Area holds exactly this one card when the handler runs —
 *    revealCard() already added it before RESOLVE_ABILITY), the handler
 *    no-ops. No protection is granted at all, not even for future cards.
 *  - "A second Shield is still a normal duplicate." — this is
 *    turnManager.checkDuplicate()'s responsibility (it explicitly excludes
 *    a Shield-vs-Shield duplicate from ever being absorbed), not this
 *    handler's — a duplicate NEVER reaches RESOLVE_ABILITY in the first
 *    place (GDD §9), so this file has nothing to check for that case.
 *  - "Shield does not grant general immunity to duplicate detection beyond
 *    its specific documented effect." — the flag this handler sets
 *    (gameState.shieldActive) is consumed exactly ONCE, by
 *    burnManager.absorbDuplicateWithShield() (see turnManager.js's
 *    checkDuplicate()), and only for a non-Shield duplicate. It never
 *    suppresses isDuplicate() detection itself — the card IS still
 *    detected as a duplicate; only the Shipwreck aftermath is averted,
 *    once.
 *
 * Design decision (GDD §14.3 doesn't spell out the exact protective
 * mechanism beyond "interacts with duplicate resolution" and the edge
 * cases above): Shield activates a one-time, expedition-scoped flag
 * (gameState.shieldActive, reset automatically whenever the Expedition
 * Area clears) rather than anything permanent or player-scoped — "for
 * the expedition" in the GDD's own wording is taken literally.
 *
 * Rules this module respects (GDD §30):
 *  - Engine-independent (no DOM/browser/Unity APIs in rules code).
 *  - Registered under the ability key from data/cards.json
 *    ("captainShield") via abilityManager — nothing else in the codebase
 *    checks for this ability by name; turnManager.js's exclusion check
 *    compares against the ability KEY, matching how every other
 *    dispatch/comparison in this codebase works (rule 4).
 *  - UI never mutates GameState directly — this module is one of the
 *    sanctioned callers of gameState.js's mutators.
 */

import { createLogger } from '../logger.js';
import * as gameState from '../gameState.js';
import * as abilityManager from '../abilityManager.js';

const log = createLogger('abilities/captainShield');

/**
 * @param {object} context - AbilityContext (GDD §12.1)
 */
function handleCaptainShield(context) {
  const expeditionArea = gameState.getExpeditionArea();

  if (expeditionArea.length === 1) {
    log.info('Captain Shield: revealed as the first card of the expedition — protects nothing', {
      playerId: context.currentPlayer?.id ?? null,
    });
    return;
  }

  gameState.setShieldActive(true);
  log.info('Captain Shield: protection active for the remainder of this expedition', {
    playerId: context.currentPlayer?.id ?? null,
    expeditionSize: expeditionArea.length,
  });
}

abilityManager.registerAbility('captainShield', handleCaptainShield);

export { handleCaptainShield };
