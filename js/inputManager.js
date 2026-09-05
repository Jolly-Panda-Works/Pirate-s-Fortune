/**
 * inputManager.js
 *
 * Responsibility: the SINGLE seam every human player action click routes
 * through (GDD §19 — UI "sends user actions to gameManager", never
 * mutates GameState itself). Implemented: Phase 13 (Card Interaction) —
 * Prompt 013. Extended: Phase 14 (Modal System) — Prompt 014.
 *
 * uiManager.js and modalManager.js both wire DOM click listeners, but
 * every one of them calls dispatchAction() here rather than reaching
 * into gameManager directly — this is what the prompt means by "route
 * action clicks through a single function so future features (undo,
 * input logging) have one seam to hook into": one add here (a log line,
 * an undo-stack push, telemetry...) covers every current and future
 * action, instead of needing to touch every individual
 * addEventListener call site across both files.
 *
 * This module is the ONLY place outside gameManager.js/turnManager.js
 * itself that decides which gameManager mutation an action name maps to.
 * It never touches the DOM (no `document`/`window` references) — that
 * split keeps uiManager.js/modalManager.js renderers and this module a
 * pure dispatcher, matching the project's existing manager-per-concern
 * discipline.
 *
 * Rules this module must respect (GDD §30):
 *  - No hard-coded card names — N/A here (this module never inspects a
 *    card), but kept for consistency with every other manager's header.
 *  - UI never mutates GameState directly — this module never imports
 *    gameState.js; the ONLY three mutation entry points it uses are
 *    gameManager.revealNextCard() / gameManager.returnToShip() /
 *    gameManager.chooseAbilityTarget(), exactly as the prompts specify.
 *  - No `alert`/`confirm`/`prompt` (rule 11) — this module never uses
 *    them, and logs (rather than surfaces via a blocking dialog) any
 *    action attempted out of turn.
 */

import { createLogger } from './logger.js';
import * as gameManager from './gameManager.js';

const log = createLogger('inputManager');

/**
 * Controlled vocabulary for the action names uiManager.js's buttons pass
 * to dispatchAction() — avoids typo'd string literals scattered across
 * both files.
 */
const ACTIONS = Object.freeze({
  EXPLORE_FURTHER: 'exploreFurther',
  RETURN_TO_SHIP: 'returnToShip',
  CHOOSE_ABILITY_TARGET: 'chooseAbilityTarget',
});

/**
 * The single seam every human action click routes through.
 *
 * gameManager's own guards (assertAwaitingHumanDecision /
 * assertAwaitingAbilityChoice) already throw if called with no decision
 * pending or during an AI turn — uiManager.js's buttons are also
 * `disabled` in that situation (Prompt 012), and modalManager.js (Prompt
 * 014) only ever renders options that came straight from
 * gameState.getPendingAbilityChoice() in the first place, so this should
 * never actually fire out of turn in normal use. The try/catch here is a
 * defensive backstop only (e.g. a stray double-click racing a
 * re-render), never a substitute for those checks, and never surfaces
 * anything via alert/confirm/prompt (rule 11) — it just logs.
 *
 * @param {string} actionName - one of ACTIONS
 * @param {object} [payload] - CHOOSE_ABILITY_TARGET's selection object;
 *   unused by the other two actions
 */
function dispatchAction(actionName, payload) {
  log.debug('dispatchAction', { actionName, payload });

  switch (actionName) {
    case ACTIONS.EXPLORE_FURTHER:
      try {
        gameManager.revealNextCard();
      } catch (err) {
        log.warn('Explore Further rejected', { message: err.message });
      }
      return;

    case ACTIONS.RETURN_TO_SHIP:
      try {
        gameManager.returnToShip();
      } catch (err) {
        log.warn('Return to Ship rejected', { message: err.message });
      }
      return;

    case ACTIONS.CHOOSE_ABILITY_TARGET:
      try {
        gameManager.chooseAbilityTarget(payload);
      } catch (err) {
        log.warn('Ability target selection rejected', { message: err.message });
      }
      return;

    default:
      log.warn(`dispatchAction: unrecognized action "${actionName}"`);
  }
}

export { ACTIONS, dispatchAction };

export default { ACTIONS, dispatchAction };
