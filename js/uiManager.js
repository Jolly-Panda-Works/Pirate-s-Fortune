/**
 * uiManager.js
 *
 * Responsibility: DOM rendering of GameState (GDD §19), plus wiring the
 * two human decision buttons to input handling.
 * Implemented: Phase 12 (UI — Board Rendering) — Prompt 012.
 * Updated: Phase 13 (Card Interaction) — Prompt 013.
 *
 * Rendering remains read-only exactly as Prompt 012 built it: this
 * module reads GameState via gameState.js's selectors (each already
 * returns a deep copy) and gameManager's rules-only helpers
 * (cardManager.getDefinition / scoreManager.calculateScore, both
 * pure/stateless), then writes DOM. It NEVER calls a gameState.js
 * mutator directly and NEVER inlines an emoji or image path — every
 * visual glyph goes through iconManager.resolveIcon().
 *
 * Prompt 013 scope (GDD §19 "sends user actions to gameManager"): the
 * "Explore Further" / "Return to Ship" buttons now carry a real
 * `click` listener each — but neither listener calls gameManager
 * itself. Both route through inputManager.dispatchAction(), the single
 * seam every action click goes through (see inputManager.js's own
 * header for why), so this file still never imports gameManager.js
 * directly and still has zero calls to any gameplay mutation — it only
 * decides WHEN a button is clickable (via `disabled`, using gameState's
 * read-only selectors), never WHAT happens as a result.
 *
 * Render strategy: one full re-render per GameState event, rather than
 * diffing per-zone. At this scale (<=60 cards, <=4 players) a full
 * re-render is simple, correct, and cheap — targeted DOM patching can be
 * introduced later if profiling ever shows a need. Re-creating every
 * button element on each render also means click listeners never need
 * manual cleanup — the old element (and its listener) is simply dropped
 * along with the rest of the previous render's DOM subtree. Since Prompt
 * 018, this module no longer subscribes to gameState's wildcard event
 * stream itself — see init()'s own comment and animationManager.js's
 * header for why that subscription moved there.
 *
 * Prompt 016 scope (GDD §20 — Localization): every string this module
 * renders now goes through localizationManager.t()/formatNumber() instead
 * of a hard-coded English literal — no leftover English/LTR-only text
 * once Persian is active. This module still never imports gameState.js's
 * mutators and still never reaches into modalManager.js's #modal-root;
 * localizationManager.js is the one new import, used purely for
 * translation/number-formatting lookups (never GameState, never DOM
 * outside what this file already owned). Re-render on a locale switch is
 * wired the same way GameState changes already are (Prompt 018 note
 * above updates WHO owns the underlying subscription, not this
 * mechanism): this file itself has zero knowledge of *when* it gets
 * called, only *what* to draw each time.
 *
 * Prompt 017 scope (GDD §21 / rule 15 — Responsive/Landscape): the
 * orientation gate (initOrientationGate(), all the way at the bottom of
 * this file) is intentionally kept SEPARATE from render()/init() above —
 * it has no GameState dependency at all, runs once at bootstrap plus
 * again on every portrait<->landscape change, and never touches a zone
 * container. All the actual breakpoint reflow (GDD §21's four tiers) is
 * pure CSS (css/responsive.css) against the exact same class names this
 * file already emits — nothing about HOW this module renders a zone
 * changes for Prompt 017, only how css/responsive.css displays what's
 * already there at a given viewport size.
 *
 * Rules this module must respect (GDD §30):
 *  - Engine-independent is N/A here (this IS the presentation layer) —
 *    but the reverse must hold: gameState.js/turnManager.js/etc. must
 *    never import this file.
 *  - No hard-coded card names — every icon lookup uses a card
 *    definition's `ability` (falling back to `type`), never a literal
 *    card id/name string.
 *  - UI never mutates GameState directly — this module has zero calls to
 *    any gameState.js mutator or setter; the only human-triggered
 *    mutations flow through inputManager.dispatchAction() ->
 *    gameManager, exactly as GDD §19 describes ("sends user actions to
 *    gameManager").
 *  - No `alert`/`confirm`/`prompt` anywhere (rule 11) — this file uses
 *    none, and neither does inputManager.js.
 */

import { createLogger } from './logger.js';
import * as gameState from './gameState.js';
import * as cardManager from './cardManager.js';
import * as scoreManager from './scoreManager.js';
import * as iconManager from './iconManager.js';
import * as inputManager from './inputManager.js';
import * as localizationManager from './localizationManager.js';

const log = createLogger('uiManager');

const { PHASES } = gameState;

// Populated once by init() — card definitions never change mid-game, so a
// module-private reference (never mutated, only read) is safe and avoids
// threading `cardDefinitions` through every render function's arguments.
let cardDefinitions = null;

// DOM mount points, resolved once by init(). Never re-queried per render.
const els = {
  opponents: null,
  treasureDeck: null,
  expeditionArea: null,
  lostLoot: null,
  shipCargo: null,
  actions: null,
};

let mounted = false;

// ---------------------------------------------------------------------------
// Small rendering helpers
// ---------------------------------------------------------------------------

/**
 * Every icon in the UI is resolved through iconManager — never an inline
 * emoji/path — so a future art swap (data/iconMap.json's iconMode) never
 * requires touching this file (data-driven rule, GDD §30 rule 3).
 * @param {{type: 'emoji'|'image', value: string}} icon
 * @returns {HTMLElement}
 */
function renderIconNode(icon) {
  if (icon.type === 'image') {
    const img = document.createElement('img');
    img.className = 'card__icon card__icon--image';
    img.src = icon.value;
    img.alt = '';
    return img;
  }
  const span = document.createElement('span');
  span.className = 'card__icon card__icon--emoji';
  span.textContent = icon.value;
  return span;
}

/**
 * Renders one CardInstance as a `.card` element.
 *
 * Icon resolution deliberately uses `definition.ability ?? definition.type`
 * as the iconKey — this is what lets Treasure Chest and Golden Key (two
 * distinct `type`s that share one `ability`, `treasureChestGoldenKey`)
 * resolve to the single matching data/iconMap.json entry without either
 * this file or iconMap.json needing a type-specific special case, and lets
 * every other ability-bearing card resolve by its own ability key while
 * Gold Coin (the only card with `ability: null`) falls back to its `type`.
 *
 * @param {object} instance - a CardInstance (GDD §4.2): {instanceId, defId, ...}
 * @param {{faceUp?: boolean}} [options]
 * @returns {HTMLElement}
 */
function createCardElement(instance, { faceUp = true } = {}) {
  const el = document.createElement('div');
  el.dataset.instanceId = instance.instanceId;

  if (!faceUp) {
    el.className = 'card card--face-down';
    el.appendChild(renderIconNode(iconManager.resolveIcon('zone.treasureDeck')));
    return el;
  }

  el.className = 'card card--face-up';
  const definition = cardManager.getDefinition(cardDefinitions, instance.defId);

  if (!definition) {
    log.warn('createCardElement: unknown defId — rendering fallback icon', instance.defId);
    el.appendChild(renderIconNode(iconManager.resolveIcon('_fallback')));
    return el;
  }

  const iconKey = definition.ability ?? definition.type;
  el.appendChild(renderIconNode(iconManager.resolveIcon(iconKey)));

  // Phase 21 (Prompt 021 — Polish, Slay the Spire-style "is this card
  // dangerous/defensive/beneficial" visual language): exposes the SAME
  // iconKey already computed above as a data attribute purely for
  // css/cards.css to key a PERSISTENT border accent off of (unlike
  // css/animations.css's own `card--ability-*` classes, which
  // animationManager.js only applies transiently during the ~500ms
  // resolution glow — see that file's own header). Data-driven, not a
  // hard-coded per-card branch here (rule 4): a new ability only ever
  // needs one new 3-line color rule in cards.css, never a uiManager.js
  // change, exactly like animations.css's own ability-glow palette
  // already works. Gold Coin (no `ability`, iconKey falls back to its
  // `type`) intentionally has no matching CSS rule — plain treasure
  // stays visually neutral, since (see this file's own commit notes)
  // every card type is equally duplicate-risky in this game; there is no
  // fundamentally "safer" card the way Slay the Spire has Skills vs
  // Attacks, so this only differentiates the 8 abilities' own effect
  // category (offensive/defensive/beneficial), reusing the exact same
  // categorization animations.css's glow palette already reasoned
  // through.
  el.dataset.abilityKey = iconKey;

  const valueEl = document.createElement('span');
  valueEl.className = 'card__value';
  valueEl.textContent = localizationManager.formatNumber(definition.value);
  el.appendChild(valueEl);

  // Localized card type name (GDD §20) — never the raw `type` string.
  el.title = localizationManager.t('cards.tooltip', {
    type: localizationManager.t(`cardTypes.${definition.type}`),
    value: localizationManager.formatNumber(definition.value),
  });

  return el;
}

/**
 * @param {Array<object>} instances - CardInstance[]
 * @param {{faceUp?: boolean}} [options]
 * @returns {HTMLElement} a `.card-row` container with one child per instance
 */
function renderCardRow(instances, options) {
  const row = document.createElement('div');
  row.className = 'card-row';
  for (const instance of instances) {
    row.appendChild(createCardElement(instance, options));
  }
  return row;
}

function appendTitle(container, text) {
  const title = document.createElement('h2');
  title.className = 'zone__title';
  title.textContent = text;
  container.appendChild(title);
}

function appendEmptyNote(container, text) {
  const note = document.createElement('p');
  note.className = 'zone__empty';
  note.textContent = text;
  container.appendChild(note);
}

// ---------------------------------------------------------------------------
// Zone renderers (GDD §19: Treasure Deck, Lost Loot, Expedition Area,
// Ship Cargo, Opponents, Actions — "Modals" is the 7th zone but is owned
// entirely by modalManager.js / #modal-root, Prompt 014, and is never
// touched from here).
// ---------------------------------------------------------------------------

function renderTreasureDeck() {
  const container = els.treasureDeck;
  container.innerHTML = '';
  appendTitle(container, localizationManager.t('zones.treasureDeck'));

  const deck = gameState.getTreasureDeck();
  const pile = document.createElement('div');
  pile.className = 'card-pile';
  if (deck.length > 0) {
    // Only the top card's BACK is ever shown — the Treasure Deck is a
    // hidden, shuffled draw pile (GDD §5.3); nothing about its contents
    // is player-visible information.
    pile.appendChild(createCardElement(deck[0], { faceUp: false }));
  }
  container.appendChild(pile);

  const count = document.createElement('p');
  count.className = 'zone__count';
  const countKey = deck.length === 1 ? 'zones.treasureDeckCountOne' : 'zones.treasureDeckCountOther';
  count.textContent = localizationManager.t(countKey, { count: localizationManager.formatNumber(deck.length) });
  container.appendChild(count);
}

function renderLostLoot() {
  const container = els.lostLoot;
  container.innerHTML = '';
  appendTitle(container, localizationManager.t('zones.lostLoot'));

  const lostLoot = gameState.getLostLoot();
  if (lostLoot.length === 0) {
    appendEmptyNote(container, localizationManager.t('zones.lostLootEmpty'));
    return;
  }
  // Lost Loot is fully visible: Treasure Map (GDD §14.7) lets a player
  // search/select an eligible card from it, which only makes sense if its
  // contents are already known information.
  container.appendChild(renderCardRow(lostLoot, { faceUp: true }));

  const count = document.createElement('p');
  count.className = 'zone__count';
  const countKey = lostLoot.length === 1 ? 'zones.lostLootCountOne' : 'zones.lostLootCountOther';
  count.textContent = localizationManager.t(countKey, { count: localizationManager.formatNumber(lostLoot.length) });
  container.appendChild(count);
}

function renderExpeditionArea() {
  const container = els.expeditionArea;
  container.innerHTML = '';
  appendTitle(container, localizationManager.t('zones.expeditionArea'));

  if (gameState.getShieldActive()) {
    const badge = document.createElement('div');
    badge.className = 'card-row';
    const icon = renderIconNode(iconManager.resolveIcon('captainShield'));
    const label = document.createElement('span');
    label.textContent = localizationManager.t('combat.shieldActive');
    badge.appendChild(icon);
    badge.appendChild(label);
    container.appendChild(badge);
  }

  const expedition = gameState.getExpeditionArea();
  if (expedition.length === 0) {
    appendEmptyNote(container, localizationManager.t('zones.expeditionEmpty'));
    return;
  }
  container.appendChild(renderCardRow(expedition, { faceUp: true }));
}

function renderShipCargo() {
  const container = els.shipCargo;
  container.innerHTML = '';

  const current = gameState.getCurrentPlayer();
  const title = current
    ? localizationManager.t('zones.shipCargoTitle', { name: current.name })
    : localizationManager.t('zones.shipCargo');
  appendTitle(container, title);

  if (!current || current.shipCargo.length === 0) {
    appendEmptyNote(container, localizationManager.t('zones.shipCargoEmpty'));
  } else {
    container.appendChild(renderCardRow(current.shipCargo, { faceUp: true }));
  }

  if (current && cardDefinitions) {
    const score = scoreManager.calculateScore(current, cardDefinitions);
    const scoreLine = document.createElement('p');
    scoreLine.className = 'zone__count';
    scoreLine.textContent = localizationManager.t('zones.currentScorePreview', {
      score: localizationManager.formatNumber(score),
    });
    container.appendChild(scoreLine);
  }
}

function renderOpponents() {
  const container = els.opponents;
  container.innerHTML = '';
  appendTitle(container, localizationManager.t('zones.opponents'));

  const players = gameState.getPlayers();
  const currentIndex = gameState.getCurrentPlayerIndex();

  if (players.length <= 1) {
    appendEmptyNote(container, localizationManager.t('zones.noOpponentsYet'));
    return;
  }

  const list = document.createElement('div');
  list.className = 'opponent-list';

  players.forEach((player, index) => {
    if (index === currentIndex) return; // the active player has their own big zone below

    const card = document.createElement('div');
    card.className = 'opponent';
    card.dataset.playerId = player.id;

    const name = document.createElement('p');
    name.className = 'opponent__name';
    name.textContent = player.isAI
      ? localizationManager.t('players.aiSuffix', { name: player.name })
      : player.name;
    card.appendChild(name);

    if (player.shipCargo.length === 0) {
      appendEmptyNote(card, localizationManager.t('zones.shipCargoEmpty'));
    } else {
      // Phase 21 (Prompt 021 — Polish, Hearthstone-style opponent
      // compression, GDD §21's own "collapsing rival-player areas at
      // smaller breakpoints"): BOTH a full card row (`.opponent__cards`)
      // AND a compact "N cards" summary (`.opponent__summary`) are
      // rendered unconditionally here — following this file's own
      // established responsive philosophy (see this file's Prompt 017
      // header note: "layout REFLOW... never rendering logic changes,
      // only how much space/what size"). css/responsive.css alone
      // decides which one is actually visible at a given breakpoint
      // (full detail at XL/MD where there's room; the compact summary at
      // SM/XS, where scanning every individual rival card face
      // previously competed for the same handful of pixels the
      // Expedition Area needs most). No uiManager.js change is ever
      // needed again for a narrower/wider tier to want a different one
      // of these two shown — only a responsive.css rule.
      const cardsWrap = document.createElement('div');
      cardsWrap.className = 'opponent__cards';
      cardsWrap.appendChild(renderCardRow(player.shipCargo, { faceUp: true }));
      card.appendChild(cardsWrap);

      const summary = document.createElement('p');
      summary.className = 'opponent__summary';
      const summaryIcon = renderIconNode(iconManager.resolveIcon('zone.shipCargo'));
      summary.appendChild(summaryIcon);
      const countKey = player.shipCargo.length === 1 ? 'zones.opponentCardCountOne' : 'zones.opponentCardCountOther';
      summary.appendChild(
        document.createTextNode(
          localizationManager.t(countKey, { count: localizationManager.formatNumber(player.shipCargo.length) })
        )
      );
      card.appendChild(summary);
    }

    if (cardDefinitions) {
      const score = scoreManager.calculateScore(player, cardDefinitions);
      const scoreLine = document.createElement('p');
      scoreLine.className = 'zone__count';
      scoreLine.textContent = localizationManager.t('zones.scorePreview', {
        score: localizationManager.formatNumber(score),
      });
      card.appendChild(scoreLine);
    }

    list.appendChild(card);
  });

  container.appendChild(list);
}

function renderActions() {
  const container = els.actions;
  container.innerHTML = '';

  const phase = gameState.getPhase();
  const current = gameState.getCurrentPlayer();

  if (phase === PHASES.SCORING) {
    const results = gameState.getResults();
    const banner = document.createElement('p');
    banner.className = 'results-banner';
    if (results) {
      const winnerNames = results.winners
        .map((id) => gameState.getPlayer(id)?.name ?? id)
        .join(', ');
      const label = results.winners.length > 1
        ? localizationManager.t('results.winnerPlural')
        : localizationManager.t('results.winnerSingular');
      banner.textContent = localizationManager.t('results.gameOverBanner', { label, names: winnerNames });
    } else {
      banner.textContent = localizationManager.t('results.gameOverPlain');
    }
    container.appendChild(banner);
    return;
  }

  const status = document.createElement('p');
  status.className = 'status-line';
  const phaseLabel = localizationManager.t(`status.phases.${phase}`);
  if (current) {
    const name = current.isAI
      ? localizationManager.t('players.aiSuffix', { name: current.name })
      : current.name;
    status.textContent = localizationManager.t('status.turnLine', { name, phase: phaseLabel });
  } else {
    status.textContent = localizationManager.t('status.phaseOnly', { phase: phaseLabel });
  }
  container.appendChild(status);

  const bar = document.createElement('div');
  bar.className = 'action-bar';

  const canDecide = phase === PHASES.PLAYER_DECISION && current && !current.isAI;

  const exploreIcon = renderIconNode(iconManager.resolveIcon('action.exploreFurther'));
  const exploreBtn = document.createElement('button');
  exploreBtn.type = 'button';
  exploreBtn.id = 'action-explore-further';
  exploreBtn.className = 'action-button';
  exploreBtn.disabled = !canDecide;
  exploreBtn.appendChild(exploreIcon);
  exploreBtn.appendChild(document.createTextNode(localizationManager.t('actions.exploreFurther')));
  // Routed through inputManager's single seam (see its own header) —
  // this file never calls gameManager directly.
  exploreBtn.addEventListener('click', () => inputManager.dispatchAction(inputManager.ACTIONS.EXPLORE_FURTHER));

  const returnIcon = renderIconNode(iconManager.resolveIcon('action.returnToShip'));
  const returnBtn = document.createElement('button');
  returnBtn.type = 'button';
  returnBtn.id = 'action-return-to-ship';
  returnBtn.className = 'action-button';
  returnBtn.disabled = !canDecide;
  returnBtn.appendChild(returnIcon);
  returnBtn.appendChild(document.createTextNode(localizationManager.t('actions.returnToShip')));
  // Routed through inputManager's single seam (see its own header) —
  // this file never calls gameManager directly.
  returnBtn.addEventListener('click', () => inputManager.dispatchAction(inputManager.ACTIONS.RETURN_TO_SHIP));

  bar.appendChild(exploreBtn);
  bar.appendChild(returnBtn);
  container.appendChild(bar);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Full re-render of every zone from the current GameState. Safe to call
 * any time after init() — reads only, never throws on an empty/default
 * GameState (every zone renderer handles the "nothing yet" case).
 */
function render() {
  if (!mounted) {
    log.warn('render() called before init() — ignoring');
    return;
  }
  renderOpponents();
  renderTreasureDeck();
  renderExpeditionArea();
  renderLostLoot();
  renderShipCargo();
  renderActions();
}

/**
 * Mounts uiManager onto the zone containers already present in index.html
 * (Prompt 012 fills those in — this function never creates them itself,
 * so a missing container is treated as a setup error, not silently
 * papered over) and subscribes to every future GameState change.
 *
 * @param {Array<object>} cardDefinitionsParam - parsed data/cards.json `.cards`
 */
function init(cardDefinitionsParam) {
  cardDefinitions = cardDefinitionsParam;

  els.opponents = document.getElementById('zone-opponents');
  els.treasureDeck = document.getElementById('zone-treasure-deck');
  els.expeditionArea = document.getElementById('zone-expedition-area');
  els.lostLoot = document.getElementById('zone-lost-loot');
  els.shipCargo = document.getElementById('zone-ship-cargo');
  els.actions = document.getElementById('zone-actions');

  const missing = Object.entries(els)
    .filter(([, el]) => !el)
    .map(([name]) => name);

  if (missing.length > 0) {
    log.error('init: missing zone mount point(s) in index.html', missing);
    return;
  }

  mounted = true;

  // Prompt 018: this module no longer subscribes to GameState directly —
  // animationManager.js now owns that subscription (see its own header)
  // so it can GATE when render() actually runs, holding it during a
  // Shipwreck's duplicate-visible window (GDD §22's hard requirement).
  // main.js wires `render` into animationManager.init()'s render targets
  // instead. This file still has ZERO knowledge of animation timing —
  // it only knows how to draw whatever GameState currently is, exactly
  // as before.

  render();
  log.info('uiManager mounted');
}

export { init, render, initOrientationGate };

export default { init, render, initOrientationGate };

// ---------------------------------------------------------------------------
// Orientation gate (Phase 16 — Prompt 017, GDD §21 / rule 15: "Landscape
// is the intended gameplay orientation"). Deliberately isolated down here,
// well below render()/init() and everything GameState-driven above it —
// this has NOTHING to do with GameState (no gameState import needed for
// any of it) and must never be confused with a GameState-triggered
// re-render. It only ever runs once, at bootstrap, and again on every
// portrait<->landscape change afterward.
// ---------------------------------------------------------------------------

let orientationGateEl = null;
let orientationAppRootEl = null;
let orientationModalRootEl = null;

/**
 * Shows/hides #orientation-gate and blocks/unblocks the board underneath.
 * Blocking is TWO layers, not one, per the prompt's own "aria-hidden the
 * board or disable pointer-events" — both together, not either/or:
 * `aria-hidden` alone never stops a mouse/touch click from still reaching
 * a button underneath, and `pointer-events: none` alone (css/responsive.css's
 * `.app-root--blocked`/`.modal-root--blocked`) never stops a screen reader
 * from still announcing it. Genuinely blocking interaction needs both.
 * @param {boolean} isPortrait
 */
function updateOrientationGate(isPortrait) {
  if (!orientationGateEl) return;

  orientationGateEl.hidden = !isPortrait;

  if (orientationAppRootEl) {
    orientationAppRootEl.setAttribute('aria-hidden', String(isPortrait));
    orientationAppRootEl.classList.toggle('app-root--blocked', isPortrait);
  }
  if (orientationModalRootEl) {
    orientationModalRootEl.setAttribute('aria-hidden', String(isPortrait));
    orientationModalRootEl.classList.toggle('modal-root--blocked', isPortrait);
  }
}

/**
 * Wires up #orientation-gate (already present in index.html — Prompt 016)
 * against the standard `matchMedia('(orientation: portrait)')` signal,
 * which fires on an actual device rotation exactly the same way it fires
 * on a plain browser-window resize past the width/height crossover — GDD
 * §21 doesn't distinguish the two, and neither does this function. Call
 * once at bootstrap (main.js); this is a permanent subscription for the
 * lifetime of the page, unlike gameState.on('*', render) there's no
 * corresponding "unmount" step anywhere else in this codebase either.
 */
function initOrientationGate() {
  orientationGateEl = document.getElementById('orientation-gate');
  orientationAppRootEl = document.getElementById('app-root');
  orientationModalRootEl = document.getElementById('modal-root');

  if (!orientationGateEl) {
    log.warn('initOrientationGate: #orientation-gate is missing from index.html — gate disabled');
    return;
  }

  const query = window.matchMedia('(orientation: portrait)');
  updateOrientationGate(query.matches);
  query.addEventListener('change', (event) => updateOrientationGate(event.matches));

  log.info('Orientation gate wired up', { startedPortrait: query.matches });
}
