/**
 * main.js
 *
 * Application entry point. Loaded as a module from index.html.
 *
 * Phase 12 (Prompt 012 — UI: Board Rendering): loads the real data files
 * and wires up iconManager + uiManager so the board renders real
 * GameState immediately on load.
 * Phase 13 (Prompt 013 — Card Interaction): the Explore Further / Return
 * to Ship buttons uiManager.js renders are now fully clickable — a human
 * player can play an entire game without the console. `window.gameManager`
 * stays exposed below purely as an optional debugging convenience, not
 * because it's required to play.
 * Phase 14 (Prompt 014 — Modal System): also wires up modalManager.js, so
 * targeted abilities (Cannon/Pirate Dagger/Lucky Anchor/Treasure Map) and
 * Compass's preview render into #modal-root and are fully playable too.
 * Phase 15 (Prompt 016 — Localization): also loads data/localization.json
 * and wires up localizationManager.js, BEFORE uiManager.init()/
 * modalManager.init() so their very first render already has real
 * strings rather than empty-locale fallbacks. uiManager.render/
 * modalManager.render are then subscribed to
 * localizationManager.onLocaleChange() — the same decoupled pattern each
 * already uses for gameState.on('*', ...) — so a language switch
 * re-renders both without a page reload.
 * Phase 16 (Prompt 017 — Responsive/Landscape UI): also calls
 * uiManager.initOrientationGate() once, wiring up the portrait-blocking
 * gate (GDD §21/rule 15) against index.html's #orientation-gate. This
 * has no dependency on cardDefinitions/config/localization/GameState at
 * all, so it's wired independently of the rest of bootstrap() below —
 * it would work identically even if every other line here failed.
 * Phase 17 (Prompt 018 — Animation): also wires up animationManager.js,
 * which now owns the GameState wildcard subscription uiManager.js/
 * modalManager.js used to each hold themselves — both modules' `render`
 * are passed in as animationManager.init()'s render TARGETS instead, so
 * animationManager.js can gate WHEN they run (GDD §22's hard requirement:
 * a duplicate must stay visible before Shipwreck's aftermath renders —
 * see animationManager.js's own header for the full architecture
 * rationale). Called after uiManager.init()/modalManager.init() (so
 * their own unconditional first render() already happened) but before
 * gameManager.startGame() (so every GameState event startGame() itself
 * fires is already routed through the gate from the very first turn).
 * Phase 18 (Prompt 019 — Audio): also loads data/audioMap.json and wires
 * up audioManager.js, which owns its own gameState wildcard subscription
 * (mirrors animationManager.js's own pattern) — no render-target wiring
 * needed here since audio has nothing to gate, just play/mute. Called
 * before gameManager.startGame() for the same reason animationManager
 * is: so even the very first turn's sounds are covered.
 * Phase 19 (Prompt 020 — Save System): also wires up saveManager.js —
 * but with DELIBERATELY DIFFERENT ordering from animationManager.js/
 * audioManager.js above. `saveManager.hasSave()` is checked BEFORE the
 * default game auto-starts (so the "Resume Game" button — #save-controls
 * in index.html — can be shown/hidden correctly), but
 * `saveManager.init()` (which wires its own auto-save
 * `gameState.on('*', ...)` subscription — see that module's header) is
 * called AFTER gameManager.startGame() returns, not before. If it were
 * wired first (like animation/audio are), the freshly-auto-started
 * default game's own very first synchronous PLAYER_DECISION pause would
 * immediately auto-save and silently overwrite a returning player's real
 * save before they ever got a chance to see or click "Resume Game" — see
 * saveManager.js's own header for the full rationale. This ordering
 * costs nothing (auto-save doesn't need to capture a game's first,
 * literally-just-started moment anyway) and completely avoids that
 * footgun.
 */

import { createLogger } from './logger.js';
import * as gameManager from './gameManager.js';
import * as iconManager from './iconManager.js';
import * as uiManager from './uiManager.js';
import * as modalManager from './modalManager.js';
import * as localizationManager from './localizationManager.js';
import * as animationManager from './animationManager.js';
import * as audioManager from './audioManager.js';
import * as saveManager from './saveManager.js';

const log = createLogger('main');

/**
 * @param {string} path
 * @returns {Promise<object>}
 */
async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load "${path}": ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function bootstrap() {
  const appRoot = document.getElementById('app-root');
  const modalRoot = document.getElementById('modal-root');

  if (!appRoot || !modalRoot) {
    log.error('Required mount points missing from index.html');
    return;
  }

  const [cardsFile, config, iconMap, localizationData, audioMap] = await Promise.all([
    loadJSON('data/cards.json'),
    loadJSON('data/gameConfig.json'),
    loadJSON('data/iconMap.json'),
    loadJSON('data/localization.json'),
    loadJSON('data/audioMap.json'),
  ]);
  const cardDefinitions = cardsFile.cards;

  iconManager.init(config, iconMap);
  localizationManager.init(localizationData);
  uiManager.init(cardDefinitions);
  modalManager.init(cardDefinitions);
  uiManager.initOrientationGate();
  animationManager.init([uiManager.render, modalManager.render]);
  audioManager.init(config, audioMap);

  // A language switch never touches GameState, so it can't reuse
  // gameState's own pub/sub — this is the one place both re-render loops
  // are wired to something other than a GameState event.
  localizationManager.onLocaleChange(() => uiManager.render());
  localizationManager.onLocaleChange(() => modalManager.render());

  // A default 2-player game (1 human, 1 AI) starts automatically so the
  // board is playable the moment the page loads — no setup step needed.
  // saveManager.hasSave() is checked BEFORE this call (see this file's
  // own header comment above for why) purely to decide whether the
  // "Resume Game" button should be shown — it does NOT block or delay
  // the default game's own auto-start.
  const resumeAvailable = saveManager.hasSave();

  gameManager.startGame(
    cardDefinitions,
    config,
    [
      { id: 'p1', name: 'You', isAI: false, shipCargo: [], score: 0 },
      { id: 'p2', name: 'AI Rival', isAI: true, shipCargo: [], score: 0 },
    ],
    { treasureSeed: 'browser-session', lostLootSeed: 'browser-session-lostloot' }
  );

  // Wired AFTER startGame() returns — see this file's own header comment
  // for why that ordering matters here (unlike animationManager/
  // audioManager above, which are both wired BEFORE).
  saveManager.init();

  // "Resume Game" affordance (GDD §24 deliverable): a single button,
  // hidden by default in index.html, shown only when a save from a
  // previous session exists. Clicking it discards whatever the default
  // auto-started game above has done so far and replaces GameState with
  // the saved snapshot in one step — the existing render pipeline
  // (animationManager.js's gameState subscription) picks the change up
  // automatically via restoreStateSnapshot()'s own STATE_RESTORED event,
  // no extra wiring needed here beyond hiding the button afterward.
  const resumeButton = document.getElementById('resume-game-button');
  if (resumeButton) {
    resumeButton.hidden = !resumeAvailable;
    resumeButton.addEventListener('click', () => {
      const resumed = saveManager.resumeGame();
      if (resumed) {
        resumeButton.hidden = true;
        log.info('Resumed a previously saved game.');
      } else {
        log.warn('Resume Game was clicked but no valid save was found.');
        resumeButton.hidden = true;
      }
    });
  }

  // Optional debugging convenience only (e.g. inspecting state from the
  // console) — uiManager.js itself never imports gameManager (see its
  // own header); every real click already routes through
  // inputManager.dispatchAction().
  window.gameManager = gameManager;
  window.cardDefinitions = cardDefinitions;
  window.saveManager = saveManager;

  log.info('Game started — click Explore Further / Return to Ship to play.');
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((err) => log.error('Bootstrap failed', err));
});

