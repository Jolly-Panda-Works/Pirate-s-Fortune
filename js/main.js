/**
 * main.js
 *
 * Application entry point. Loaded as a module from index.html.
 *
 * Phase 12 scope (Prompt 012 — UI: Board Rendering): loads the real data
 * files, wires up iconManager + uiManager, and starts a default 2-player
 * game (1 human, 1 AI) so the board renders real GameState immediately on
 * load. Real click-to-play input arrives in Prompt 013 — until then, this
 * file's own temporary debug harness (`window.gameManager`) is the ONLY
 * way to advance a human turn: open the browser console and call
 * `gameManager.revealNextCard()` / `gameManager.returnToShip()`.
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

  // Prompt 012 temporary debug harness (Prompt 013 replaces the console
  // calls below with real button clicks): a default 2-player game starts
  // automatically so the board shows real state right away.
  gameManager.startGame(
    cardDefinitions,
    config,
    [
      { id: 'p1', name: 'You', isAI: false, shipCargo: [], score: 0 },
      { id: 'p2', name: 'AI Rival', isAI: true, shipCargo: [], score: 0 },
    ],
    { treasureSeed: 'browser-session', lostLootSeed: 'browser-session-lostloot' }
  );

  // Exposed ONLY so a human can keep playing from the console until
  // Prompt 013 wires the Explore Further / Return to Ship buttons —
  // uiManager.js itself never calls gameManager (see its own header).
  window.gameManager = gameManager;
  window.cardDefinitions = cardDefinitions;

  log.info(
    'Game started. No buttons are wired yet (Prompt 013) — use the console: ' +
      'gameManager.revealNextCard() / gameManager.returnToShip()'
  );
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((err) => log.error('Bootstrap failed', err));
});
