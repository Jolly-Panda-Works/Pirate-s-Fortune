/**
 * Sailor characters and arenas — shared by the server (validation, AI
 * crew) and the client (3D models, pickers). Presentation only; nothing
 * here affects the rules engine.
 *
 * `model` names the character mesh in client/public/models/characters.glb
 * (exported from the licensed Synty POLYGON Pirate Pack by
 * tools/assets/export_synty.py). The other look fields drive the
 * procedural stand-in shown while that file loads.
 */

export const CHARACTERS = [
  {
    id: 'redbeard',
    model: 'Character_Pirate_Captain_01',
    icon: '🧔',
    name: { en: 'Captain Redbeard', fa: 'کاپیتان ریش‌قرمز' },
    color: '#c0392b',
    skin: '#e0ac69', hair: '#a5341b', beard: 'full',
    hat: 'tricorn', hatColor: '#1c1c1c', trim: '#d4a63a',
    shirt: '#f2e6c9', coat: '#8e1b1b', pants: '#2b2b3a',
    extras: ['earring'],
  },
  {
    id: 'anne',
    model: 'Character_Female_Pirate_01',
    icon: '👩',
    name: { en: 'Anne the Quartermaster', fa: 'آنِ سرپرست' },
    color: '#16a085',
    skin: '#f1c27d', hair: '#3b2414', beard: 'none', longHair: true,
    hat: 'bandana', hatColor: '#16a085', trim: '#0e6655',
    shirt: '#fdf2e9', coat: '#5d4037', pants: '#3e2723',
    extras: ['earring'],
  },
  {
    id: 'barnaby',
    model: 'Character_Pirate_Seaman_01',
    icon: '👴',
    name: { en: 'Old Salt Barnaby', fa: 'بارنابیِ کهنه‌کار' },
    color: '#7f8c8d',
    skin: '#c68642', hair: '#d9d9d9', beard: 'long',
    hat: 'beanie', hatColor: '#34495e', trim: '#2c3e50',
    shirt: '#2e86c1', coat: null, pants: '#4e342e',
    extras: ['pipe'],
  },
  {
    id: 'bones',
    model: 'Character_Skeleton_01',
    icon: '💀',
    name: { en: 'Mister Bones', fa: 'آقای استخوان' },
    color: '#bdc3c7',
    skin: '#ece4cf', hair: null, beard: 'none', skeleton: true,
    hat: 'bicorne', hatColor: '#2c2c2c', trim: '#c0c0c0',
    shirt: '#5b2c6f', coat: '#2c2c2c', pants: '#1a1a1a',
    extras: ['eyepatch'],
  },
  {
    id: 'mei',
    model: 'Character_Female_Wench_01',
    icon: '🧭',
    name: { en: 'Rosa the Barmaid', fa: 'رُزا، ساقی میخانه' },
    color: '#8e44ad',
    skin: '#f3d3b0', hair: '#111111', beard: 'none', longHair: true,
    hat: 'none', hatColor: '#8e44ad', trim: '#d4a63a',
    shirt: '#8e44ad', coat: '#2e1a47', pants: '#1f1f2e',
    extras: ['spyglass'],
  },
  {
    id: 'hook',
    model: 'Character_Pirate_First_Mate_01',
    icon: '🪝',
    name: { en: 'Hook Morgan', fa: 'مورگانِ قلاب‌دست' },
    color: '#2c3e50',
    skin: '#d8a47f', hair: '#2b1b0e', beard: 'goatee',
    hat: 'tricorn', hatColor: '#2c3e50', trim: '#ecf0f1',
    shirt: '#ecf0f1', coat: '#1b2631', pants: '#212f3c',
    extras: ['hook', 'eyepatch'],
  },
  {
    id: 'tom',
    model: 'Character_Pirate_Deckhand_01',
    icon: '💪',
    name: { en: 'Deckhand Tom', fa: 'تام، ملوان عرشه' },
    color: '#d35400',
    skin: '#8d5524', hair: '#1a1a1a', beard: 'stubble', big: true,
    hat: 'bandana', hatColor: '#c0392b', trim: '#922b21',
    shirt: '#f5f5f5', coat: null, pants: '#2e4053', stripes: '#c0392b',
    extras: ['earring'],
  },
  {
    id: 'grace',
    model: 'Character_Governors_Daughter_01',
    icon: '🦜',
    name: { en: 'Lady Grace', fa: 'بانو گریس' },
    color: '#e67e22',
    skin: '#f6d7b0', hair: '#c0661d', beard: 'none', longHair: true,
    hat: 'feather', hatColor: '#5d2e0f', trim: '#e74c3c',
    shirt: '#fbeee6', coat: '#1e8449', pants: '#3b2a1a',
    extras: ['parrot'],
  },
  // More crew from the POLYGON Pirate Pack (procedural fields are only the
  // loading-time fallback look).
  { id: 'blackbeard', model: 'Character_Pirate_blackbeard_01', icon: '⚔️', name: { en: 'Blackbeard', fa: 'ریش‌سیاه' }, color: '#1c1c1c',
    skin: '#d8a47f', hair: '#111111', beard: 'long', hat: 'tricorn', hatColor: '#111111', trim: '#d4a63a', shirt: '#ecf0f1', coat: '#2c2c2c', pants: '#1a1a1a', extras: [] },
  { id: 'rattles', model: 'Character_Skeleton_02', icon: '☠️', name: { en: 'Rattles', fa: 'تلق‌تلوق' }, color: '#95a5a6',
    skin: '#ece4cf', hair: null, beard: 'none', skeleton: true, hat: 'bandana', hatColor: '#7b241c', trim: '#922b21', shirt: '#4d5656', coat: null, pants: '#1a1a1a', extras: [] },
  { id: 'ghost', model: 'Character_Skeleton_03', icon: '👻', name: { en: 'The Ghost Captain', fa: 'کاپیتان شبح' }, color: '#5dade2',
    skin: '#ece4cf', hair: null, beard: 'none', skeleton: true, hat: 'tricorn', hatColor: '#1b2631', trim: '#5dade2', shirt: '#1b2631', coat: '#17202a', pants: '#1a1a1a', extras: [] },
  { id: 'navy', model: 'Character_English_Captain_01', icon: '🎖️', name: { en: 'Navy Captain', fa: 'کاپیتان نیروی دریایی' }, color: '#1f3a93',
    skin: '#f1c27d', hair: '#ecf0f1', beard: 'none', hat: 'bicorne', hatColor: '#1c1c1c', trim: '#d4a63a', shirt: '#ecf0f1', coat: '#1f3a93', pants: '#ecf0f1', extras: [] },
  { id: 'governor', model: 'Character_English_Govenor_02', icon: '🎩', name: { en: 'The Governor', fa: 'فرماندار' }, color: '#7d3c98',
    skin: '#f6d7b0', hair: '#ecf0f1', beard: 'none', hat: 'none', hatColor: '#111', trim: '#d4a63a', shirt: '#ecf0f1', coat: '#7d3c98', pants: '#2c2c2c', extras: [] },
  { id: 'redcoat', model: 'Character_English_Soldier_01', icon: '💂', name: { en: 'Marine Sergeant', fa: 'گروهبان تفنگدار' }, color: '#c0392b',
    skin: '#f1c27d', hair: '#5d4037', beard: 'none', hat: 'tricorn', hatColor: '#111', trim: '#ecf0f1', shirt: '#ecf0f1', coat: '#c0392b', pants: '#ecf0f1', extras: [] },
  { id: 'gentleman', model: 'Character_Gentleman_01', icon: '🧐', name: { en: 'The Gentleman', fa: 'آقای محترم' }, color: '#784212',
    skin: '#e0ac69', hair: '#3b2414', beard: 'none', hat: 'none', hatColor: '#111', trim: '#d4a63a', shirt: '#fdf2e9', coat: '#784212', pants: '#3e2723', extras: [] },
];

export const CHARACTER_IDS = CHARACTERS.map((c) => c.id);
export const DEFAULT_CHARACTER = 'redbeard';

export function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export const ARENAS = [
  { id: 'ship', name: { en: "Ship's Cabin", fa: 'کابین کشتی' }, icon: '⚓' },
  { id: 'tavern', name: { en: 'The Rusty Anchor Tavern', fa: 'میخانه‌ی لنگر زنگ‌زده' }, icon: '🍺' },
];

export const ARENA_IDS = ARENAS.map((a) => a.id);
export const DEFAULT_ARENA = 'ship';
