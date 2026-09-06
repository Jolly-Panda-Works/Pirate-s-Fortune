/**
 * modalManager.js
 *
 * Responsibility: target-selection UI (GDD §19's "Modals" zone) — the
 * ONLY module that reads/writes into `#modal-root`. Implemented: Phase 14
 * (Modal System) — Prompt 014.
 *
 * Two distinct things render here, both driven purely by GameState (read-
 * only, exactly like uiManager.js):
 *
 *  1. A blocking CHOICE modal whenever gameState.getPendingAbilityChoice()
 *     is non-null — Cannon/Pirate Dagger/Lucky Anchor/Treasure Map paused
 *     mid-resolution (turnManager.js's resolveAbility()) for a human's
 *     real target selection. Clicking an option calls
 *     inputManager.dispatchAction(ACTIONS.CHOOSE_ABILITY_TARGET, option) —
 *     the human resume path (gameManager.chooseAbilityTarget() ->
 *     turnManager.resolveAbilityChoice()). An AI's own deterministic
 *     choice (playerManager.chooseAbilityTarget(), Prompt 015) shares only
 *     the target-context-building logic with this path — it resolves
 *     immediately inside turnManager.resolveAbility() itself and never
 *     reaches this modal at all, since it never pauses. No cancel/skip
 *     button exists here:
 *     resolveAbility() only ever pauses when at least one real eligible
 *     target exists, so a selection is always mandatory once the modal is
 *     showing.
 *  2. A non-blocking PREVIEW panel whenever gameState.getAbilityContext()
 *     holds an active Compass peek for the CURRENT player during
 *     PLAYER_DECISION (GDD §14.1's own "PLAYER_CHOICE" name for what is
 *     mechanically the ordinary Explore Further / Return to Ship decision
 *     — see turnManager.js's own header for why no separate engine phase
 *     exists for it). This is purely informational: it shows what the
 *     next reveal will be, with no buttons of its own (the real
 *     Explore Further / Return to Ship buttons live in uiManager.js's
 *     Actions zone, untouched by this module).
 *
 * Like uiManager.js, this module subscribes ONCE to gameState's wildcard
 * event stream and does a full re-render of `#modal-root` per event —
 * simple, correct, and cheap at this scale (see uiManager.js's own header
 * for the fuller rationale, which applies identically here). uiManager.js
 * itself is completely untouched by anything in this file — the two
 * modules only ever communicate implicitly, through GameState events,
 * never by calling each other.
 *
 * Rules this module must respect (GDD §30):
 *  - No hard-coded card names — every icon lookup uses a card
 *    definition's `ability` (falling back to `type`), never a literal
 *    card id/name string; every option this module renders came from an
 *    ability module's own getEligibleTargets() (abilityManager.js's
 *    registry), never a per-ability if/else here.
 *  - UI never mutates GameState directly — this module has zero calls to
 *    any gameState.js mutator or setter; the only human-triggered
 *    mutation flows through inputManager.dispatchAction() ->
 *    gameManager.chooseAbilityTarget(), exactly as GDD §19 describes.
 *  - No `alert`/`confirm`/`prompt` anywhere (rule 11).
 */

import { createLogger } from './logger.js';
import * as gameState from './gameState.js';
import * as cardManager from './cardManager.js';
import * as iconManager from './iconManager.js';
import * as inputManager from './inputManager.js';

const log = createLogger('modalManager');

const { PHASES } = gameState;

// Populated once by init() — never mutated afterward, only read.
let cardDefinitions = null;

let modalRoot = null;
let mounted = false;

// English-only ability copy for Stage B (Prompt 016/Stage C replaces
// these with data/localization.json keys) — kept as one small lookup
// table rather than inline per-branch strings so it's obvious at a
// glance every targeted ability has copy, and easy to find/replace later.
const ABILITY_COPY = {
  cannon: {
    title: 'Cannon', // TODO(i18n)
    prompt: "Choose a rival's card to destroy.", // TODO(i18n)
  },
  pirateDagger: {
    title: 'Pirate Dagger', // TODO(i18n)
    prompt: "Choose a rival's card to steal.", // TODO(i18n)
  },
  luckyAnchor: {
    title: 'Lucky Anchor', // TODO(i18n)
    prompt: 'Choose a card from your own Ship Cargo to replay.', // TODO(i18n)
  },
  treasureMap: {
    title: 'Treasure Map', // TODO(i18n)
    prompt: 'Choose a card from Lost Loot to retrieve.', // TODO(i18n)
  },
};

// ---------------------------------------------------------------------------
// Small rendering helpers (mirrors uiManager.js's own — see its header for
// why every icon goes through iconManager.resolveIcon() rather than an
// inline emoji/path)
// ---------------------------------------------------------------------------

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
 * Renders one eligible-target option (from an ability's own
 * getEligibleTargets() — always a plain object carrying at least
 * `defId`, plus whichever of `targetCardId`/`targetPlayerId`/
 * `cargoCardId` that ability's own shape uses) as a clickable card
 * button. Every field this function reads comes from the option object
 * itself — never a hard-coded per-ability branch (rule 4).
 *
 * @param {object} option - one entry from pending.options
 * @returns {HTMLElement}
 */
function createOptionButton(option) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'card card--face-up modal-option';

  const definition = cardManager.getDefinition(cardDefinitions, option.defId);
  if (definition) {
    const iconKey = definition.ability ?? definition.type;
    button.appendChild(renderIconNode(iconManager.resolveIcon(iconKey)));

    const valueEl = document.createElement('span');
    valueEl.className = 'card__value';
    valueEl.textContent = String(definition.value);
    button.appendChild(valueEl);

    // TODO(i18n): card type name should come from data/localization.json.
    button.title = `${definition.type} (${definition.value})`;
  } else {
    log.warn('createOptionButton: unknown defId — rendering fallback icon', option.defId);
    button.appendChild(renderIconNode(iconManager.resolveIcon('_fallback')));
  }

  button.addEventListener('click', () => {
    inputManager.dispatchAction(inputManager.ACTIONS.CHOOSE_ABILITY_TARGET, option);
  });

  return button;
}

/**
 * Cannon/Pirate Dagger options carry a `targetPlayerId` — grouping the
 * choice list by rival makes it clear whose card each option belongs to.
 * Lucky Anchor/Treasure Map options have no `targetPlayerId` at all, so
 * they render as one flat, ungrouped row instead — this function reads
 * that directly off the data rather than branching on the ability key
 * itself (rule 4).
 *
 * @param {Array<object>} options
 * @returns {HTMLElement}
 */
function renderOptionList(options) {
  const container = document.createElement('div');

  const hasPlayerGroups = options.some((option) => option.targetPlayerId !== undefined);
  if (!hasPlayerGroups) {
    const row = document.createElement('div');
    row.className = 'card-row';
    for (const option of options) {
      row.appendChild(createOptionButton(option));
    }
    container.appendChild(row);
    return container;
  }

  const groups = new Map(); // targetPlayerId -> options[]
  for (const option of options) {
    if (!groups.has(option.targetPlayerId)) groups.set(option.targetPlayerId, []);
    groups.get(option.targetPlayerId).push(option);
  }

  for (const [targetPlayerId, groupOptions] of groups) {
    const player = gameState.getPlayer(targetPlayerId);
    const groupTitle = document.createElement('p');
    groupTitle.className = 'modal-group__title';
    groupTitle.textContent = player ? player.name : targetPlayerId; // TODO(i18n)
    container.appendChild(groupTitle);

    const row = document.createElement('div');
    row.className = 'card-row';
    for (const option of groupOptions) {
      row.appendChild(createOptionButton(option));
    }
    container.appendChild(row);
  }

  return container;
}

/**
 * Renders the blocking target-selection modal for a pending ability
 * choice (Prompt 014's PLAYER_CHOICE pause).
 * @param {object} pending - gameState.getPendingAbilityChoice()'s value
 */
function renderChoiceModal(pending) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const panel = document.createElement('div');
  panel.className = 'modal-panel';

  const copy = ABILITY_COPY[pending.ability] ?? { title: pending.ability, prompt: 'Choose a target.' };

  const title = document.createElement('h2');
  title.className = 'modal-panel__title';
  title.textContent = copy.title;
  panel.appendChild(title);

  const promptEl = document.createElement('p');
  promptEl.className = 'modal-panel__prompt';
  promptEl.textContent = copy.prompt;
  panel.appendChild(promptEl);

  panel.appendChild(renderOptionList(pending.options));

  overlay.appendChild(panel);
  modalRoot.appendChild(overlay);
}

/**
 * Renders the non-blocking Compass preview panel (GDD §14.1) — only
 * while phase is PLAYER_DECISION and the active abilityContext is a
 * Compass peek belonging to the CURRENT player (turnManager.js's
 * resolveAbility() now clears abilityContext at the start of every new
 * ability resolution, so a stale peek from an earlier reveal can never
 * leak in here — see its own header for why).
 */
function renderCompassPreview() {
  const context = gameState.getAbilityContext();
  if (!context || context.ability !== 'compass') return;

  const current = gameState.getCurrentPlayer();
  if (!current || context.playerId !== current.id) return;

  const panel = document.createElement('div');
  panel.className = 'modal-preview';

  const label = document.createElement('p');
  label.className = 'modal-preview__label';
  label.textContent = 'Compass reveals the next card:'; // TODO(i18n)
  panel.appendChild(label);

  if (context.peekedDefId) {
    const definition = cardManager.getDefinition(cardDefinitions, context.peekedDefId);
    const card = document.createElement('div');
    card.className = 'card card--face-up';
    if (definition) {
      const iconKey = definition.ability ?? definition.type;
      card.appendChild(renderIconNode(iconManager.resolveIcon(iconKey)));
      const valueEl = document.createElement('span');
      valueEl.className = 'card__value';
      valueEl.textContent = String(definition.value);
      card.appendChild(valueEl);
    }
    panel.appendChild(card);
  } else {
    const empty = document.createElement('p');
    empty.className = 'zone__empty';
    empty.textContent = 'The Treasure Deck is empty.'; // TODO(i18n)
    panel.appendChild(empty);
  }

  modalRoot.appendChild(panel);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Full re-render of `#modal-root` from the current GameState. A pending
 * ability choice always takes priority over the Compass preview — they
 * can never genuinely overlap in practice (a fresh RESOLVE_ABILITY clears
 * abilityContext before a NEW pause could be set — see resolveAbility()'s
 * own header — so by the time a choice is pending, any earlier preview
 * is already gone), but the explicit precedence keeps this function
 * correct even if that invariant ever changes.
 */
function render() {
  if (!mounted) {
    log.warn('render() called before init() — ignoring');
    return;
  }

  modalRoot.innerHTML = '';

  const pending = gameState.getPendingAbilityChoice();
  if (pending) {
    renderChoiceModal(pending);
    return;
  }

  if (gameState.getPhase() === PHASES.PLAYER_DECISION) {
    renderCompassPreview();
  }
}

/**
 * Mounts modalManager onto `#modal-root` (already present in index.html)
 * and subscribes to every future GameState change.
 * @param {Array<object>} cardDefinitionsParam - parsed data/cards.json `.cards`
 */
function init(cardDefinitionsParam) {
  cardDefinitions = cardDefinitionsParam;
  modalRoot = document.getElementById('modal-root');

  if (!modalRoot) {
    log.error('init: #modal-root is missing from index.html');
    return;
  }

  mounted = true;
  gameState.on('*', render);
  render();
  log.info('modalManager mounted');
}

export { init, render };

export default { init, render };
