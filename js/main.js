/**
 * main.js
 *
 * Application entry point. Loaded as a module from index.html.
 *
 * Phase 0 scope: verify the foundation boots (logger works, DOM mounts exist).
 * No GameState, no deck, no rendering — those arrive in later phases.
 */

import { createLogger } from './logger.js';

const log = createLogger('main');

function bootstrap() {
  const appRoot = document.getElementById('app-root');
  const modalRoot = document.getElementById('modal-root');

  if (!appRoot || !modalRoot) {
    log.error('Required mount points missing from index.html');
    return;
  }

  log.info('Treasure Raiders — Phase 0 foundation loaded. No gameplay wired yet.');
}

document.addEventListener('DOMContentLoaded', bootstrap);
