/**
 * abilities/index.js
 *
 * Side-effect-only entry point: importing this module registers every
 * implemented ability handler with abilityManager.js. Nothing in this
 * file (or anything importing it) references an ability by name — each
 * abilities/*.js module calls abilityManager.registerAbility() itself,
 * under the ability key from data/cards.json, at import time.
 * Implemented: Phase 10a (Single-Resolution Abilities) — Prompt 010.
 *
 * turnManager.js imports this module once, purely for its side effects,
 * so every game entry point (gameManager.js, and every test that drives
 * a full turn) gets abilities registered automatically without needing
 * to know which ability files currently exist.
 *
 * Grows as later prompts add abilities/*.js files — nothing outside this
 * file needs to change when that happens.
 */

import './compass.js';
import './cannon.js';
import './captainShield.js';
import './pirateDagger.js';
import './luckyAnchor.js';
import './seaSerpent.js';
import './treasureMap.js';
import './treasureChestGoldenKey.js';
