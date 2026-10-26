/**
 * engineHost.js — the server's view of shared/engineCore.js, plus the card
 * data and config read from disk.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { setLevel } from '../js/logger.js';
import * as core from '../shared/engineCore.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadJSON(relative) {
  return JSON.parse(readFileSync(path.join(ROOT, relative), 'utf8'));
}

setLevel(process.env.ENGINE_LOG_LEVEL ?? 'ERROR');

export const cardDefinitions = loadJSON('data/cards.json').cards;
export const gameConfig = loadJSON('data/gameConfig.json');

export const { runInRoom, takeOverSeat, toPublicView, PHASES } = core;

export function warmUp() {
  core.warmUp(cardDefinitions, gameConfig);
}
