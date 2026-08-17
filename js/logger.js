/**
 * logger.js
 *
 * Tagged diagnostic logging utility.
 * Phase 0 deliverable — this module is fully implemented (not a stub),
 * per GDD §28 Phase 0 goals.
 *
 * Every other module should log through this instead of calling
 * console.* directly, so log verbosity/format can be controlled centrally
 * and so logs stay attributable to the module/system that emitted them.
 *
 * Usage:
 *   import { createLogger } from './logger.js';
 *   const log = createLogger('turnManager');
 *   log.info('Turn started', { playerId });
 */

const LEVELS = Object.freeze({
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  SILENT: 100,
});

let currentLevel = LEVELS.INFO;

/**
 * Sets the global minimum log level. Messages below this level are dropped.
 * @param {keyof typeof LEVELS} levelName
 */
function setLevel(levelName) {
  if (!(levelName in LEVELS)) {
    throw new Error(`logger.setLevel: unknown level "${levelName}"`);
  }
  currentLevel = LEVELS[levelName];
}

function shouldLog(level) {
  return level >= currentLevel;
}

function format(tag, level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] [${tag}] ${message}`;
}

/**
 * Creates a tagged logger bound to a single module/system name.
 * @param {string} tag - e.g. "gameManager", "turnManager", "abilityResolver"
 */
function createLogger(tag) {
  return {
    debug(message, data) {
      if (!shouldLog(LEVELS.DEBUG)) return;
      // eslint-disable-next-line no-console
      console.debug(format(tag, 'DEBUG', message), data ?? '');
    },
    info(message, data) {
      if (!shouldLog(LEVELS.INFO)) return;
      // eslint-disable-next-line no-console
      console.info(format(tag, 'INFO', message), data ?? '');
    },
    warn(message, data) {
      if (!shouldLog(LEVELS.WARN)) return;
      // eslint-disable-next-line no-console
      console.warn(format(tag, 'WARN', message), data ?? '');
    },
    error(message, data) {
      if (!shouldLog(LEVELS.ERROR)) return;
      // eslint-disable-next-line no-console
      console.error(format(tag, 'ERROR', message), data ?? '');
    },
  };
}

export { createLogger, setLevel, LEVELS };
