/**
 * Static game data — read straight from the 2D build's data/ files so
 * both builds share one source of truth. scoreManager/cardManager are
 * imported from the original engine purely as read-only helpers (score
 * previews); all rule decisions happen on the server.
 */

import cardsFile from '@data/cards.json';
import gameConfig from '@data/gameConfig.json';
import localization from '@data/localization.json';
import { calculateScore } from '@engine/scoreManager.js';
import { getDefinition } from '@engine/cardManager.js';

export const cardDefinitions = cardsFile.cards;
export { gameConfig, localization };

export const TYPE_ORDER = [
  'goldCoin', 'compass', 'cannon', 'captainShield', 'pirateDagger',
  'luckyAnchor', 'seaSerpent', 'treasureMap', 'treasureChest', 'goldenKey',
];

// Presentation only: one emoji + palette per card TYPE (the 2D build's
// iconMap is keyed by ability, which merges Chest and Key into one icon).
export const TYPE_STYLE = {
  goldCoin: { icon: '🪙', color: '#e8b923', dark: '#7a5a00' },
  compass: { icon: '🧭', color: '#2bb3a3', dark: '#0c4d47' },
  cannon: { icon: '💣', color: '#6c7a89', dark: '#22292f' },
  captainShield: { icon: '🛡️', color: '#3c82d6', dark: '#123a6b' },
  pirateDagger: { icon: '🗡️', color: '#d64541', dark: '#5e1412' },
  luckyAnchor: { icon: '⚓', color: '#4a5fc1', dark: '#1a2357' },
  seaSerpent: { icon: '🐍', color: '#3fa34d', dark: '#13401a' },
  treasureMap: { icon: '🗺️', color: '#b9864a', dark: '#4f3412' },
  treasureChest: { icon: '🧰', color: '#9b59b6', dark: '#3e1a4f' },
  goldenKey: { icon: '🗝️', color: '#f39c12', dark: '#6b3d00' },
};

const defsById = new Map(cardDefinitions.map((d) => [d.id, d]));

export function defOf(defIdOrCard) {
  const id = typeof defIdOrCard === 'string' ? defIdOrCard : defIdOrCard?.defId;
  return defsById.get(id) ?? getDefinition(cardDefinitions, id);
}

export function scoreOf(player) {
  return calculateScore(player, cardDefinitions);
}

/** Score the player would have if the current expedition were banked now. */
export function scoreIfReturned(player, expedition) {
  return calculateScore({ ...player, shipCargo: [...(player?.shipCargo ?? []), ...expedition] }, cardDefinitions);
}

export function isChainAbility(abilityKey) {
  return gameConfig.abilities.chain.includes(abilityKey);
}

export const ABILITY_TYPES = TYPE_ORDER.filter((t) => t !== 'goldCoin');
