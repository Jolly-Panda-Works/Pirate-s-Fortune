/**
 * iconManager.js
 *
 * Resolves a logical iconKey (e.g. "goldCoin", "action.returnToShip") to
 * whatever the current asset mode says to render — emoji text today,
 * an image path later.
 *
 * This exists so Phase 1 can ship with emoji placeholders (per project
 * standard: "use emoji in the early phase, but design a swap system now")
 * while guaranteeing the eventual swap to real artwork touches only data
 * (data/iconMap.json + data/gameConfig.json's assets.iconMode), never
 * gameplay or UI code. Consistent with the data-driven rule (GDD §2.3 / §30 rule 3).
 *
 * uiManager.js (Phase 12+) must always resolve icons through this module —
 * never inline an emoji or image path directly in a template.
 *
 * Status: architectural stub with real resolution logic wired, since the
 * lookup itself has no gameplay dependency. Data loading (fetching the
 * JSON files) is wired in Phase 1 alongside cardManager.js.
 */

import { createLogger } from './logger.js';

const log = createLogger('iconManager');

let iconMap = null; // populated by init()
let mode = 'emoji';  // mirrors gameConfig.assets.iconMode

/**
 * @param {object} config - parsed data/gameConfig.json
 * @param {object} loadedIconMap - parsed data/iconMap.json
 */
function init(config, loadedIconMap) {
  iconMap = loadedIconMap;
  mode = config?.assets?.iconMode ?? 'emoji';
  log.info(`iconManager initialized in "${mode}" mode`);
}

/**
 * Resolves an iconKey to a render descriptor. UI code branches on `type`,
 * never on the current mode directly, so adding a third mode later
 * (e.g. "sprite") doesn't require touching every call site.
 *
 * @param {string} iconKey
 * @returns {{ type: 'emoji', value: string } | { type: 'image', value: string }}
 */
function resolveIcon(iconKey) {
  if (!iconMap) {
    log.warn('resolveIcon called before init()');
    return { type: 'emoji', value: '❓' };
  }

  const entry = iconMap[iconKey] ?? iconMap._fallback;

  if (mode === 'image' && entry.image) {
    return { type: 'image', value: entry.image };
  }

  // Falls back to emoji even in "image" mode if no image path is set yet,
  // so partially-migrated art sets never render broken icons.
  return { type: 'emoji', value: entry.emoji };
}

export { init, resolveIcon };
