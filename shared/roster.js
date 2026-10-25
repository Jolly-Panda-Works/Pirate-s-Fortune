/**
 * Sailor characters and arenas — shared by the server (validation, AI
 * crew) and the client (3D models, pickers). Presentation only; nothing
 * here affects the rules engine.
 *
 * Every look is built procedurally (client/src/three/Sailor.jsx) from the
 * fields below, so a licensed model pack can later replace a character
 * by id without touching gameplay.
 */

export const CHARACTERS = [
  {
    id: 'redbeard',
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
    icon: '🧭',
    name: { en: 'Mei the Navigator', fa: 'مِی، ناوبر' },
    color: '#8e44ad',
    skin: '#f3d3b0', hair: '#111111', beard: 'none', longHair: true,
    hat: 'none', hatColor: '#8e44ad', trim: '#d4a63a',
    shirt: '#8e44ad', coat: '#2e1a47', pants: '#1f1f2e',
    extras: ['spyglass'],
  },
  {
    id: 'hook',
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
    icon: '💪',
    name: { en: 'Bosun Big Tom', fa: 'تامِ گنده، سرملوان' },
    color: '#d35400',
    skin: '#8d5524', hair: '#1a1a1a', beard: 'stubble', big: true,
    hat: 'bandana', hatColor: '#c0392b', trim: '#922b21',
    shirt: '#f5f5f5', coat: null, pants: '#2e4053', stripes: '#c0392b',
    extras: ['earring'],
  },
  {
    id: 'grace',
    icon: '🦜',
    name: { en: "Grace O'Malley", fa: 'گریس اومالی' },
    color: '#e67e22',
    skin: '#f6d7b0', hair: '#c0661d', beard: 'none', longHair: true,
    hat: 'feather', hatColor: '#5d2e0f', trim: '#e74c3c',
    shirt: '#fbeee6', coat: '#1e8449', pants: '#3b2a1a',
    extras: ['parrot'],
  },
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
