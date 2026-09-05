/**
 * uiManager.js
 *
 * Responsibility: Read-only DOM rendering of GameState (GDD §19).
 * Implemented: Phase 12 (UI — Board Rendering) — Prompt 012.
 *
 * This module is a pure "view": it reads GameState via gameState.js's
 * selectors (each already returns a deep copy) and gameManager's rules-only
 * helpers (cardManager.getDefinition / scoreManager.calculateScore, both
 * pure/stateless), then writes DOM. It NEVER calls gameState's mutators,
 * NEVER calls a gameManager gameplay action (revealNextCard/returnToShip —
 * that wiring is Prompt 013), and NEVER inlines an emoji or image path
 * directly — every visual glyph goes through iconManager.resolveIcon().
 *
 * Render strategy: subscribe once to gameState's wildcard event stream
 * (`gameState.on('*', ...)`) and do one full re-render per event, rather
 * than diffing per-zone. At this scale (<=60 cards, <=4 players) a full
 * re-render is simple, correct, and cheap — targeted DOM patching can be
 * introduced later if profiling ever shows a need, but rule 5 ("UI never
 * mutates GameState directly") and the read-only-renderer requirement
 * this Prompt is built around are both easiest to keep true with the
 * simplest possible render loop.
 *
 * English-only placeholder strings below are intentional for Stage B —
 * every one is marked `// TODO(i18n)` so Prompt 016 (Stage C) can find and
 * replace them with data/localization.json keys without re-deriving which
 * strings need it.
 *
 * Rules this module must respect (GDD §30):
 *  - Engine-independent is N/A here (this IS the presentation layer) —
 *    but the reverse must hold: gameState.js/turnManager.js/etc. must
 *    never import this file.
 *  - No hard-coded card names — every icon lookup uses a card
 *    definition's `ability` (falling back to `type`), never a literal
 *    card id/name string.
 *  - UI never mutates GameState directly — this module has zero calls to
 *    any gameState.js mutator or setter.
 */

import { createLogger } from './logger.js';
import * as gameState from './gameState.js';
import * as cardManager from './cardManager.js';
import * as scoreManager from './scoreManager.js';
import * as iconManager from './iconManager.js';

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

  const valueEl = document.createElement('span');
  valueEl.className = 'card__value';
  valueEl.textContent = String(definition.value);
  el.appendChild(valueEl);

  // TODO(i18n): card type name should come from data/localization.json,
  // not the raw `type` string, once Prompt 016 lands.
  el.title = `${definition.type} (${definition.value})`;

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
  title.textContent = text; // TODO(i18n)
  container.appendChild(title);
}

function appendEmptyNote(container, text) {
  const note = document.createElement('p');
  note.className = 'zone__empty';
  note.textContent = text; // TODO(i18n)
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
  appendTitle(container, 'Treasure Deck');

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
  count.textContent = `${deck.length} card${deck.length === 1 ? '' : 's'} remaining`; // TODO(i18n)
  container.appendChild(count);
}

function renderLostLoot() {
  const container = els.lostLoot;
  container.innerHTML = '';
  appendTitle(container, 'Lost Loot');

  const lostLoot = gameState.getLostLoot();
  if (lostLoot.length === 0) {
    appendEmptyNote(container, 'Empty');
    return;
  }
  // Lost Loot is fully visible: Treasure Map (GDD §14.7) lets a player
  // search/select an eligible card from it, which only makes sense if its
  // contents are already known information.
  container.appendChild(renderCardRow(lostLoot, { faceUp: true }));

  const count = document.createElement('p');
  count.className = 'zone__count';
  count.textContent = `${lostLoot.length} card${lostLoot.length === 1 ? '' : 's'}`; // TODO(i18n)
  container.appendChild(count);
}

function renderExpeditionArea() {
  const container = els.expeditionArea;
  container.innerHTML = '';
  appendTitle(container, 'Expedition Area');

  if (gameState.getShieldActive()) {
    const badge = document.createElement('div');
    badge.className = 'card-row';
    const icon = renderIconNode(iconManager.resolveIcon('captainShield'));
    const label = document.createElement('span');
    label.textContent = ' Shield Active'; // TODO(i18n)
    badge.appendChild(icon);
    badge.appendChild(label);
    container.appendChild(badge);
  }

  const expedition = gameState.getExpeditionArea();
  if (expedition.length === 0) {
    appendEmptyNote(container, 'No cards revealed yet');
    return;
  }
  container.appendChild(renderCardRow(expedition, { faceUp: true }));
}

function renderShipCargo() {
  const container = els.shipCargo;
  container.innerHTML = '';

  const current = gameState.getCurrentPlayer();
  // TODO(i18n): player-name interpolation should go through the
  // localization layer once Prompt 016 lands.
  appendTitle(container, current ? `${current.name} — Ship Cargo` : 'Ship Cargo');

  if (!current || current.shipCargo.length === 0) {
    appendEmptyNote(container, 'No cards secured yet');
  } else {
    container.appendChild(renderCardRow(current.shipCargo, { faceUp: true }));
  }

  if (current && cardDefinitions) {
    const score = scoreManager.calculateScore(current, cardDefinitions);
    const scoreLine = document.createElement('p');
    scoreLine.className = 'zone__count';
    scoreLine.textContent = `Current score preview: ${score}`; // TODO(i18n)
    container.appendChild(scoreLine);
  }
}

function renderOpponents() {
  const container = els.opponents;
  container.innerHTML = '';
  appendTitle(container, 'Opponents');

  const players = gameState.getPlayers();
  const currentIndex = gameState.getCurrentPlayerIndex();

  if (players.length <= 1) {
    appendEmptyNote(container, 'No opponents yet');
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
    // TODO(i18n): "(AI)" suffix should be a localization key.
    name.textContent = player.isAI ? `${player.name} (AI)` : player.name;
    card.appendChild(name);

    if (player.shipCargo.length === 0) {
      appendEmptyNote(card, 'No cards secured yet');
    } else {
      card.appendChild(renderCardRow(player.shipCargo, { faceUp: true }));
    }

    if (cardDefinitions) {
      const score = scoreManager.calculateScore(player, cardDefinitions);
      const scoreLine = document.createElement('p');
      scoreLine.className = 'zone__count';
      scoreLine.textContent = `Score preview: ${score}`; // TODO(i18n)
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
      // TODO(i18n): pluralization ("Winner"/"Winners") needs a real
      // localization plural rule once Prompt 016 lands.
      const label = results.winners.length > 1 ? 'Winners' : 'Winner';
      banner.textContent = `Game Over — ${label}: ${winnerNames}`; // TODO(i18n)
    } else {
      banner.textContent = 'Game Over'; // TODO(i18n)
    }
    container.appendChild(banner);
    return;
  }

  const status = document.createElement('p');
  status.className = 'status-line';
  if (current) {
    // TODO(i18n): player-name interpolation + phase label both need the
    // localization layer once Prompt 016 lands.
    status.textContent = `Turn: ${current.name}${current.isAI ? ' (AI)' : ''} — Phase: ${phase}`;
  } else {
    status.textContent = `Phase: ${phase}`;
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
  exploreBtn.appendChild(document.createTextNode(' Explore Further')); // TODO(i18n)
  // No click handler wired here on purpose — this Prompt is a read-only
  // renderer only. Prompt 013 wires this button to gameManager.revealNextCard().

  const returnIcon = renderIconNode(iconManager.resolveIcon('action.returnToShip'));
  const returnBtn = document.createElement('button');
  returnBtn.type = 'button';
  returnBtn.id = 'action-return-to-ship';
  returnBtn.className = 'action-button';
  returnBtn.disabled = !canDecide;
  returnBtn.appendChild(returnIcon);
  returnBtn.appendChild(document.createTextNode(' Return to Ship')); // TODO(i18n)
  // No click handler wired here either — see above; Prompt 013 wires this
  // one to gameManager.returnToShip().

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

  // Wildcard subscription (GDD §6.1 pub/sub) — one full re-render per
  // GameState event, rather than a per-event-type handler map. Never
  // polls: this is the ONLY place uiManager.js reacts to state changes.
  gameState.on('*', render);

  render();
  log.info('uiManager mounted');
}

export { init, render };

export default { init, render };
