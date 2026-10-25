/**
 * Pure layout: engine public view -> where every card sits on the board.
 *
 * A flat, rectangular board seen from a fixed camera; no card is ever
 * rotated. Rivals' cargo runs along the top edge, the local player's
 * cargo along the bottom, the Treasure Deck and Lost Loot sit at the
 * left and right, and the current expedition is laid out in the middle.
 */

import { defOf, TYPE_ORDER } from '../data.js';

export const CARD_W = 0.8;
export const CARD_D = 1.12;
export const CARD_T = 0.018;
export const TABLE_Y = 0;

export const BOARD_W = 17;
export const BOARD_D = 10.6;

export const DECK_POS = [-6.6, TABLE_Y, -0.2];
export const LOST_POS = [6.6, TABLE_Y, -0.2];
export const EXPEDITION_Z = -0.2;
export const EXPEDITION_W = 9.6;
export const MY_CARGO_Z = 3.45;
export const RIVAL_CARGO_Z = -3.55;
export const RIVAL_LABEL_Z = -4.85;
export const MY_SCALE = 0.8;
export const RIVAL_SCALE = 0.6;

const EXPEDITION_PER_ROW = 9;
const EXPEDITION_STEP = CARD_W + 0.2;

/** Rivals in seat order after the local player, so turn order reads left → right. */
export function rivalsOf(players, mySeatId) {
  const myIndex = Math.max(0, players.findIndex((p) => p.id === mySeatId));
  const ordered = [];
  for (let i = 1; i < players.length; i++) ordered.push(players[(myIndex + i) % players.length]);
  return ordered;
}

/** Centre x of each rival's area along the top edge. */
export function rivalAreaX(index, count) {
  const usable = BOARD_W - 1.4;
  const w = usable / Math.max(count, 1);
  return -usable / 2 + w * (index + 0.5);
}

export function rivalAreaWidth(count) {
  return (BOARD_W - 1.4) / Math.max(count, 1) - 0.4;
}

/** Where a player's cargo sits — used for coin bursts. */
export function anchorFor(players, mySeatId, playerId) {
  if (playerId === mySeatId) return [0, TABLE_Y, MY_CARGO_Z];
  const rivals = rivalsOf(players, mySeatId);
  const i = rivals.findIndex((p) => p.id === playerId);
  return [rivalAreaX(Math.max(i, 0), rivals.length), TABLE_Y, RIVAL_CARGO_Z];
}

function placeCargo(out, player, centerX, centerZ, scale, stackDir) {
  const byType = new Map();
  for (const card of player.shipCargo) {
    const type = defOf(card)?.type ?? 'goldCoin';
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(card);
  }
  const types = TYPE_ORDER.filter((t) => byType.has(t));
  const colStep = CARD_W * scale + 0.16;
  types.forEach((type, col) => {
    const cards = byType.get(type).sort((a, b) => (defOf(a)?.value ?? 0) - (defOf(b)?.value ?? 0));
    cards.forEach((card, k) => {
      out.set(card.instanceId, {
        pos: [
          centerX + (col - (types.length - 1) / 2) * colStep,
          TABLE_Y + CARD_T / 2 + k * CARD_T * 1.2,
          centerZ + stackDir * k * 0.34 * scale,
        ],
        rotY: 0,
        faceUp: true,
        scale,
        zone: 'cargo',
        ownerId: player.id,
      });
    });
  });
}

/**
 * @returns {Map<string, {pos:number[], rotY:number, faceUp:boolean, scale:number, zone:string, ownerId?:string}>}
 */
export function layoutCards(view, mySeatId) {
  const out = new Map();
  if (!view) return out;
  const { players } = view;

  // Expedition: centred rows.
  const exp = view.expeditionArea;
  exp.forEach((card, i) => {
    const row = Math.floor(i / EXPEDITION_PER_ROW);
    const inRow = Math.min(EXPEDITION_PER_ROW, exp.length - row * EXPEDITION_PER_ROW);
    const col = i % EXPEDITION_PER_ROW;
    out.set(card.instanceId, {
      pos: [(col - (inRow - 1) / 2) * EXPEDITION_STEP, TABLE_Y + CARD_T / 2 + 0.002, EXPEDITION_Z + row * (CARD_D + 0.15)],
      rotY: 0,
      faceUp: true,
      scale: 1,
      zone: 'expedition',
    });
  });

  // Lost Loot: one neat stack, newest on top, slightly fanned so it reads as a pile.
  view.lostLoot.forEach((card, i) => {
    out.set(card.instanceId, {
      pos: [LOST_POS[0], TABLE_Y + CARD_T / 2 + i * CARD_T, LOST_POS[2] + Math.min(i, 12) * -0.012],
      rotY: 0,
      faceUp: true,
      scale: 1,
      zone: 'lost',
    });
  });

  const me = players.find((p) => p.id === mySeatId);
  if (me) placeCargo(out, me, 0, MY_CARGO_Z, MY_SCALE, -1);

  const rivals = me ? rivalsOf(players, mySeatId) : players;
  rivals.forEach((player, i) => {
    placeCargo(out, player, rivalAreaX(i, rivals.length), RIVAL_CARGO_Z, RIVAL_SCALE, 1);
  });

  return out;
}

export function deckTopY(count) {
  return TABLE_Y + Math.max(count, 1) * 0.012;
}
