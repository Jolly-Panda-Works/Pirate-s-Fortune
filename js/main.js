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
 */

import { createLogger } from './logger.js';
import * as gameManager from './gameManager.js';
import * as iconManager from './iconManager.js';
import * as uiManager from './uiManager.js';

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

  const [cardsFile, config, iconMap] = await Promise.all([
    loadJSON('data/cards.json'),
    loadJSON('data/gameConfig.json'),
    loadJSON('data/iconMap.json'),
  ]);
  const cardDefinitions = cardsFile.cards;

  iconManager.init(config, iconMap);
  uiManager.init(cardDefinitions);

  // A default 2-player game (1 human, 1 AI) starts automatically so the
  // board is playable the moment the page loads — no setup step needed.
  gameManager.startGame(
    cardDefinitions,
    config,
    [
      { id: 'p1', name: 'You', isAI: false, shipCargo: [], score: 0 },
      { id: 'p2', name: 'AI Rival', isAI: true, shipCargo: [], score: 0 },
    ],
    { treasureSeed: 'browser-session', lostLootSeed: 'browser-session-lostloot' }
  );

  // Optional debugging convenience only (e.g. inspecting state from the
  // console) — uiManager.js itself never imports gameManager (see its
  // own header); every real click already routes through
  // inputManager.dispatchAction().
  window.gameManager = gameManager;
  window.cardDefinitions = cardDefinitions;

  log.info('Game started — click Explore Further / Return to Ship to play.');
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((err) => log.error('Bootstrap failed', err));
});

