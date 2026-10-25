/**
 * Pure layout: engine public view -> where every card sits on the table.
 * The local player always sits at the front (+z); rivals are spread
 * around the round table.
 */

import { defOf, TYPE_ORDER } from '../data.js';

export const CARD_W = 0.8;
export const CARD_D = 1.12;
export const CARD_T = 0.018;
export const TABLE_Y = 0;
export const TABLE_R = 5.2;

export const DECK_POS = [-2.1, TABLE_Y, -1.35];
export const LOST_POS = [2.1, TABLE_Y, -1.35];
const EXPEDITION_Z = 0.45;
const CARGO_R = 3.55;

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export function seatAngle(index, myIndex, count) {
  const rel = (index - myIndex + count) % count;
  return (rel / count) * Math.PI * 2;
}

/** World position of a seat's cargo row centre. */
export function seatAnchor(angle, radius = CARGO_R) {
  return [Math.sin(angle) * radius, TABLE_Y, Math.cos(angle) * radius];
}

function rotateLocal([x, z], angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c + z * s, -x * s + z * c];
}

/**
 * @returns {Map<string, {pos:number[], rotY:number, faceUp:boolean, scale:number, zone:string, ownerId?:string}>}
 */
export function layoutCards(view, mySeatId) {
  const out = new Map();
  if (!view) return out;
  const players = view.players;
  const myIndex = Math.max(0, players.findIndex((p) => p.id === mySeatId));
  const n = players.length;

  // Expedition: centre rows, up to 6 per row.
  const exp = view.expeditionArea;
  const perRow = 7;
  exp.forEach((card, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, exp.length - row * perRow);
    const col = i % perRow;
    const x = (col - (inRow - 1) / 2) * (CARD_W + 0.1);
    out.set(card.instanceId, {
      pos: [x, TABLE_Y + CARD_T / 2 + 0.002, EXPEDITION_Z + row * (CARD_D + 0.12)],
      rotY: 0,
      faceUp: true,
      scale: 1,
      zone: 'expedition',
    });
  });

  // Lost Loot: a messy face-up pile.
  view.lostLoot.forEach((card, i) => {
    const r = hash(card.instanceId);
    const r2 = hash(`${card.instanceId}b`);
    out.set(card.instanceId, {
      pos: [LOST_POS[0] + (r - 0.5) * 0.5, TABLE_Y + CARD_T / 2 + i * CARD_T * 0.9, LOST_POS[2] + (r2 - 0.5) * 0.4],
      rotY: (r - 0.5) * 1.1,
      faceUp: true,
      scale: 0.9,
      zone: 'lost',
    });
  });

  // Ship cargo: one column per card type, cards overlapping toward the centre.
  players.forEach((player, index) => {
    const angle = seatAngle(index, myIndex, n);
    const mine = index === myIndex;
    const scale = mine ? 0.72 : 0.5;
    const byType = new Map();
    for (const card of player.shipCargo) {
      const type = defOf(card)?.type ?? 'goldCoin';
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(card);
    }
    const types = TYPE_ORDER.filter((t) => byType.has(t));
    const colStep = CARD_W * scale + 0.06;
    types.forEach((type, col) => {
      const cards = byType.get(type).sort((a, b) => (defOf(a)?.value ?? 0) - (defOf(b)?.value ?? 0));
      cards.forEach((card, k) => {
        const lx = (col - (types.length - 1) / 2) * colStep;
        const lz = -k * 0.2 * scale;
        const [wx, wz] = rotateLocal([lx, lz], angle);
        const anchor = seatAnchor(angle, mine ? CARGO_R : CARGO_R + 0.25);
        out.set(card.instanceId, {
          pos: [anchor[0] + wx, TABLE_Y + CARD_T / 2 + k * CARD_T * 1.1, anchor[2] + wz],
          rotY: angle,
          faceUp: true,
          scale,
          zone: 'cargo',
          ownerId: player.id,
        });
      });
    });
  });

  return out;
}

export function deckTopY(count) {
  return TABLE_Y + Math.max(count, 1) * 0.012;
}
