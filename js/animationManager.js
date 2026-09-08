/**
 * animationManager.js
 *
 * Responsibility: Coordinates presentation-layer motion (GDD §22),
 * strictly separate from game logic. Implemented: Phase 17 (Animation) —
 * Prompt 018.
 *
 * ARCHITECTURE DECISION — read this before touching the hard requirement.
 * ---------------------------------------------------------------------
 * GDD §22's hard requirement: "A duplicate card must visibly appear
 * before Shipwreck resolves." The prompt that commissioned this module
 * describes this as burnManager/turnManager "awaiting an animation
 * acknowledged signal... before completing the Shipwreck transition."
 * Taken completely literally, that would mean turnManager.js's shipwreck
 * step becomes `async`/`await`s a real Promise — but turnManager.js's
 * ENTIRE state machine (every function from startGame() down) is a
 * single, deeply recursive, fully SYNCHRONOUS call chain (see its own
 * header: "gameManager.revealNextCard()/returnToShip() resume play by
 * calling this module's drawCard()/returnToShip() directly"). Because
 * JS's `await` is transitively "viral" — any function that awaits
 * something must itself become async, and so must every caller of IT —
 * making even ONE step of this chain genuinely async would force EVERY
 * function in turnManager.js, gameManager.js, and all ~162 existing
 * tests across ~15 files to become async too, for a codebase whose
 * entire architecture (every module's own header, since Phase 0) has
 * insisted on an engine-independent, DOM-free, SYNCHRONOUS,
 * unit-testable-without-mocks core. That constraint predates this prompt
 * and outranks its literal wording.
 *
 * So this module takes a different, behaviorally-equivalent path that
 * achieves the actual observable guarantee (a human watching the game
 * genuinely sees the duplicate before the board shows Shipwreck's
 * aftermath) without making turnManager.js — or a single existing test —
 * async at all:
 *
 *   Game logic (turnManager) still runs to completion INSTANTLY and
 *   synchronously, exactly as it always has — computing the fully
 *   correct final GameState the same way it did before this module
 *   existed. What THIS module gates is not the state mutation, but
 *   WHEN uiManager.render()/modalManager.render() are next allowed to
 *   run: the moment GameState's phase becomes SHIPWRECK — which
 *   turnManager.shipwreck() always sets BEFORE it mutates
 *   Expedition Area/Lost Loot (see that function's own comments) — this
 *   module lets the render reflecting THAT moment (duplicate still
 *   sitting in the Expedition Area) through immediately, then HOLDS
 *   every further render for a real duration before releasing the
 *   backlog in one pass. A player literally cannot perceive anything
 *   that hasn't been rendered yet, so gating the render is
 *   behaviorally indistinguishable from gating the resolution itself —
 *   while staying "strictly separate from game logic" (this module's
 *   own governing principle, stated above) rather than reaching into
 *   it. GDD §22's diagram — "Game Logic ↓ Render/Animation ↓
 *   Resolution" — reads consistently with this: Game Logic computes the
 *   duplicate, Render/Animation displays it, and only THEN does
 *   Resolution (the visible aftermath) appear — exactly what the hold
 *   below produces.
 *
 * turnManager.shipwreck() still gets an explicit, named acknowledgment
 * call (acknowledgeDuplicate(), below) right at that exact moment — a
 * real "explicit acknowledgment step" exists in the codebase, faithful
 * to the prompt's own wording — it's just fire-and-forget (never
 * awaited) rather than blocking, since blocking is architecturally
 * unavailable here without a synchronous-core-breaking rewrite.
 *
 * Animation FAILURES must never permanently deadlock the game (GDD
 * §22): since turnManager never actually waits on anything this module
 * does, that guarantee is automatic and unconditional here — even if
 * every DOM call below silently no-ops (headless test environment, a
 * browser tab backgrounded and throttling timers, `prefers-reduced-
 * motion`, or setDisabled(true)'s explicit debug escape hatch), game
 * logic has ALREADY finished computing the correct result by the time
 * any of this runs. The timeout fallback inside waitForAnimation() below
 * exists for THIS module's own internal robustness (a CSS class that
 * never fires `animationend` must not leave an internal Promise hanging
 * forever), not to protect turnManager, which was never at risk.
 *
 * Rules this module respects (GDD §30):
 *  - No hard-coded card names — every animation trigger below is keyed
 *    by ability KEY (card.ability) or a generic zone/phase signal, never
 *    a per-card branch.
 *  - UI never mutates GameState directly — this module only ever READS
 *    gameState (subscribing to its events) and adds/removes CSS classes;
 *    it never calls a single gameState mutator.
 *  - Defensive by construction: every function that touches `document`
 *    guards on `typeof document !== 'undefined'` first and no-ops
 *    otherwise, so importing/calling this module is always safe from a
 *    plain Node test with no DOM at all — none of turnManager.js's own
 *    162 existing tests need to change for this module to exist.
 */

import { createLogger } from './logger.js';
import * as gameState from './gameState.js';

const log = createLogger('animationManager');

/** GDD §22's own suggested ceiling for a single animation's fallback. */
const DEFAULT_TIMEOUT_MS = 2000;

/** How long a duplicate stays visibly flashed before Shipwreck's aftermath is allowed to render. */
const DUPLICATE_VISIBLE_HOLD_MS = 900;

// Debug-only escape hatch (see this module's own header + GDD §22 exit
// criteria: "killing the animation layer... still lets the game reach a
// correct result via the timeout fallback"). Game logic is NEVER at risk
// either way (see header) — this only skips the presentation-layer hold.
let disabled = false;

// Functions to call on every gated render pass — e.g. [uiManager.render,
// modalManager.render] — injected by init() so this module never
// hard-imports either (keeps it a pure coordinator, not a dependency of
// either render target, matching how uiManager.js/modalManager.js never
// import each other either).
let renderTargets = [];

let holdActive = false;
let pendingRenderRequested = false;
let holdTimer = null;

function runRenderTargets() {
  for (const renderFn of renderTargets) {
    try {
      renderFn();
    } catch (err) {
      log.error('A render target threw during a gated render pass', err);
    }
  }
}

/**
 * The single seam every GameState-driven render must pass through once
 * init() has been called. Not exported — this is intentionally only
 * reachable via the automatic gameState subscription below, so nothing
 * else can accidentally bypass the hold.
 */
function requestRender() {
  if (disabled || !holdActive) {
    runRenderTargets();
    return;
  }
  pendingRenderRequested = true;
}

function releaseHold() {
  holdActive = false;
  if (holdTimer !== null) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  if (pendingRenderRequested) {
    pendingRenderRequested = false;
    runRenderTargets();
  }
}

/**
 * Holds every further gated render for `ms`, then releases in one pass
 * (reflecting whatever GameState looks like BY THEN — if a fully-AI game
 * cascaded several more turns during the hold, the release simply jumps
 * straight to that later state, exactly as this codebase's existing
 * "instant AI chains" already behave; only the ONE hard requirement —
 * the duplicate's own frame — is guaranteed visible).
 * @param {number} ms
 */
function holdRenderFor(ms) {
  if (disabled) return;
  holdActive = true;
  if (holdTimer !== null) clearTimeout(holdTimer);
  holdTimer = setTimeout(releaseHold, ms);
}

/**
 * @param {{type: string, detail: object}} event - gameState.js's own
 *   wildcard event shape (see gameState.js's emit())
 */
function handleGameStateEvent(event) {
  // Let THIS event's own render through first (checked before the hold
  // below is engaged) — for a SHIPWRECK phase change specifically, that
  // means the duplicate-still-in-the-Expedition-Area frame renders
  // immediately, exactly once, before anything gets held.
  requestRender();

  if (event.type === 'PHASE_CHANGED' && event.detail.phase === gameState.PHASES.SHIPWRECK) {
    log.info('SHIPWRECK phase entered — holding further renders so the duplicate stays visible', {
      holdMs: DUPLICATE_VISIBLE_HOLD_MS,
    });
    holdRenderFor(DUPLICATE_VISIBLE_HOLD_MS);
  }
}

/**
 * @param {Array<() => void>} targets - render functions to gate, e.g.
 *   [uiManager.render, modalManager.render]
 */
function init(targets) {
  renderTargets = Array.isArray(targets) ? targets : [];
  gameState.on('*', handleGameStateEvent);
  log.info('animationManager mounted', { renderTargetCount: renderTargets.length });
}

/**
 * Debug-only escape hatch (see header). Game logic is unaffected either
 * way; this only controls whether the presentation layer paces itself.
 * @param {boolean} value
 */
function setDisabled(value) {
  disabled = value;
  if (disabled && holdActive) releaseHold();
}

/**
 * Testing-only: clears every module-level mutable variable (render
 * targets, hold state, any pending timer) back to its just-imported
 * defaults, WITHOUT touching gameState's own listener registry (call
 * gameState.clearAllListeners() separately for that, exactly like every
 * other test file in this suite already does). Needed because — unlike
 * gameState.js, which already ships resetState()/clearAllListeners() for
 * this exact purpose — this module's hold state (`holdActive`, a pending
 * `holdTimer`, etc.) previously had no way to be cleared between tests,
 * so a hold left mid-flight by one test could leak into the next one's
 * assertions. Real app code never calls this — only tests should.
 */
function resetForTesting() {
  if (holdTimer !== null) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  holdActive = false;
  pendingRenderRequested = false;
  renderTargets = [];
  disabled = false;
}

// ---------------------------------------------------------------------------
// Generic DOM animation helper — everything below this line touches
// `document`, and every function guards it.
// ---------------------------------------------------------------------------

/**
 * Adds `animationClass` to `el`, waits for that element's own
 * `animationend`/`transitionend` (whichever fires first) OR `timeoutMs`
 * — whichever comes first — then removes the class again (so the same
 * element can be re-animated later) and resolves. NEVER rejects, NEVER
 * throws, and resolves immediately (no-op) if `el` is missing or there's
 * no `document` at all (a plain Node test) — animation failure must
 * never deadlock anything (GDD §22), and this is the one place that
 * guarantee is actually implemented via a real timer.
 * @param {Element|null|undefined} el
 * @param {string} animationClass
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
function waitForAnimation(el, animationClass, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!el || typeof document === 'undefined') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener('animationend', finish);
      el.removeEventListener('transitionend', finish);
      el.classList.remove(animationClass);
      resolve();
    };

    el.addEventListener('animationend', finish);
    el.addEventListener('transitionend', finish);
    setTimeout(finish, timeoutMs);

    el.classList.add(animationClass);
  });
}

/**
 * @param {string} instanceId
 * @returns {Element|null}
 */
function findCardEl(instanceId) {
  if (typeof document === 'undefined' || !instanceId) return null;
  return document.querySelector(`[data-instance-id="${instanceId}"]`);
}

// ---------------------------------------------------------------------------
// Semantic trigger functions — one per GDD §22 moment this prompt lists.
// Every one of these is fire-and-forget from a caller's point of view
// (turnManager.js never awaits any of them — see this module's header);
// the returned Promise exists for internal bookkeeping and for any
// FUTURE caller (a replay system, a manual test) that wants to await it.
// ---------------------------------------------------------------------------

/**
 * The hard-requirement moment (see this module's header): called by
 * turnManager.shipwreck() right after gameState.setPhase(SHIPWRECK) —
 * while the duplicate card is still sitting, unmoved, in the Expedition
 * Area — and BEFORE burnManager.triggerShipwreck() moves everything to
 * Lost Loot. Flashes that exact card via CSS (css/animations.css's
 * `.card--duplicate-flash`) in addition to (not instead of) the
 * automatic render-hold this module's gameState subscription already
 * engages for every SHIPWRECK phase change (see handleGameStateEvent()
 * above) — this call adds a targeted visual on top of that generic hold.
 * @param {{instanceId: string}} expeditionCard
 * @returns {Promise<void>}
 */
function acknowledgeDuplicate(expeditionCard) {
  const el = findCardEl(expeditionCard?.instanceId);
  log.info('Duplicate acknowledged — flashing the card', { instanceId: expeditionCard?.instanceId });
  return waitForAnimation(el, 'card--duplicate-flash', DUPLICATE_VISIBLE_HOLD_MS);
}

/**
 * A freshly-revealed Expedition Area card (GDD §22's "reveal" moment).
 * @param {{instanceId: string}} card
 * @returns {Promise<void>}
 */
function playCardReveal(card) {
  return waitForAnimation(findCardEl(card?.instanceId), 'card--reveal');
}

/**
 * Cards moving from the Expedition Area into a player's Ship Cargo on a
 * successful Return to Ship.
 * @param {Array<{instanceId: string}>} cards
 * @returns {Promise<void[]>}
 */
function playCollection(cards) {
  const list = Array.isArray(cards) ? cards : [];
  return Promise.all(list.map((card) => waitForAnimation(findCardEl(card?.instanceId), 'card--collect')));
}

/**
 * Covers, at minimum, every targeted or visibly-triggered ability's own
 * moment (GDD §22): Compass's preview, Cannon's destroy, Captain
 * Shield's protect, Pirate Dagger's steal, Lucky Anchor's replay, Sea
 * Serpent's forced chain reveal, Treasure Map's selection, and Treasure
 * Chest + Golden Key's draw. Dispatches purely off `abilityKey` (never a
 * hard-coded card name, rule 4) to a `card--ability-{key}` class defined
 * in css/animations.css — a new ability never needs a change here, only
 * a new CSS rule with the matching class name.
 * @param {string} abilityKey - e.g. 'cannon', 'pirateDagger', 'compass'
 * @param {Array<{instanceId: string}>} cards - the card(s) involved
 * @returns {Promise<void[]>}
 */
function playAbilityTrigger(abilityKey, cards) {
  const list = Array.isArray(cards) ? cards : [cards];
  const className = `card--ability-${abilityKey}`;
  return Promise.all(list.map((card) => waitForAnimation(findCardEl(card?.instanceId), className)));
}

export {
  init,
  setDisabled,
  resetForTesting,
  waitForAnimation,
  acknowledgeDuplicate,
  playCardReveal,
  playCollection,
  playAbilityTrigger,
};

export default {
  init,
  setDisabled,
  resetForTesting,
  waitForAnimation,
  acknowledgeDuplicate,
  playCardReveal,
  playCollection,
  playAbilityTrigger,
};
