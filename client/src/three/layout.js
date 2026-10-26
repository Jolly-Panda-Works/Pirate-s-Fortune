/**
 * Pure layout: engine public view -> where every card sits on the board.
 *
 * A rectangular table with one player per side (the game has at most 4):
 * the local player at the bottom (nearest the camera), rivals clockwise on
 * the left, top and right. Each player's Ship Cargo lies along their own
 * edge; the Treasure Deck and Lost Loot sit above the expedition in the
 * middle. Cards are never rotated, so everything reads from the player's
 * seat.
 */

import { defOf, TYPE_ORDER } from '../data.js';

export const CARD_W = 0.8;
export const CARD_D = 1.12;
export const CARD_T = 0.018;
export const TABLE_Y = 0;

export const BOARD_W = 18;
export const BOARD_D = 12;

export const DECK_POS = [-4.7, TABLE_Y, -2.35];
export const LOST_POS = [4.7, TABLE_Y, -2.35];
export const EXPEDITION_Z = 0;
export const EXPEDITION_W = 8.2;

/** Distance from the board edge to where a sailor sits. */
const SEAT_OFFSET = 1.55;

const EXPEDITION_PER_ROW = 7;
const EXPEDITION_STEP = CARD_W + 0.24;

/**
 * Per side: cargo zone centre/size, card scale, how cards stack, and where
 * that side's sailor sits (position + yaw so they face the table).
 */
export const SIDES = {
  bottom: {
    zone: { x: 0, z: 4.55, w: 12, d: 1.9 }, scale: 0.72, axis: 'row', stack: [0, -1],
    // a little further back than rivals so your own hat never hides your cargo
    seat: { pos: [0, 0, BOARD_D / 2 + SEAT_OFFSET + 1.5], yaw: Math.PI },
  },
  top: {
    zone: { x: 0, z: -4.55, w: 12, d: 1.8 }, scale: 0.6, axis: 'row', stack: [0, 1],
    seat: { pos: [0, 0, -BOARD_D / 2 - SEAT_OFFSET], yaw: 0 },
  },
  left: {
    zone: { x: -7.45, z: 0.1, w: 2.6, d: 7.6 }, scale: 0.55, axis: 'column', stack: [1, 0],
    seat: { pos: [-BOARD_W / 2 - SEAT_OFFSET, 0, 0], yaw: Math.PI / 2 },
  },
  right: {
    zone: { x: 7.45, z: 0.1, w: 2.6, d: 7.6 }, scale: 0.55, axis: 'column', stack: [-1, 0],
    seat: { pos: [BOARD_W / 2 + SEAT_OFFSET, 0, 0], yaw: -Math.PI / 2 },
  },
};

const RIVAL_SIDES = {
  1: ['top'],
  2: ['left', 'right'],
  3: ['left', 'top', 'right'],
};

/**
 * Which side every player sits on. The local player is always at the
 * bottom; rivals follow clockwise in turn order. A spectator sees the
 * first player at the bottom.
 * @returns {Array<{player: object, side: string}>}
 */
export function seatsOf(players, mySeatId) {
  if (!players.length) return [];
  const myIndex = Math.max(0, players.findIndex((p) => p.id === mySeatId));
  const ordered = [];
  for (let i = 0; i < players.length; i++) ordered.push(players[(myIndex + i) % players.length]);
  const rivalSides = RIVAL_SIDES[ordered.length - 1] ?? [];
  return ordered.map((player, i) => ({ player, side: i === 0 ? 'bottom' : rivalSides[i - 1] }));
}

/** Where a player's cargo sits — used for coin bursts. */
export function anchorFor(players, mySeatId, playerId) {
  const seat = seatsOf(players, mySeatId).find((s) => s.player.id === playerId);
  const zone = SIDES[seat?.side ?? 'bottom'].zone;
  return [zone.x, TABLE_Y, zone.z];
}

function placeCargo(out, player, side) {
  const { zone, scale, axis, stack } = SIDES[side];
  const byType = new Map();
  for (const card of player.shipCargo) {
    const type = defOf(card)?.type ?? 'goldCoin';
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(card);
  }
  const types = TYPE_ORDER.filter((t) => byType.has(t));
  const along = axis === 'row' ? CARD_W * scale + 0.16 : CARD_D * scale + 0.08;
  types.forEach((type, i) => {
    const cards = byType.get(type).sort((a, b) => (defOf(a)?.value ?? 0) - (defOf(b)?.value ?? 0));
    const offset = (i - (types.length - 1) / 2) * along;
    cards.forEach((card, k) => {
      // same-type cards overlap toward the table centre, values still visible
      const shift = k * 0.34 * scale;
      const x = axis === 'row' ? zone.x + offset + stack[0] * shift : zone.x + stack[0] * (shift - 0.25 * scale);
      const z = axis === 'row' ? zone.z + stack[1] * shift : zone.z + offset;
      out.set(card.instanceId, {
        pos: [x, TABLE_Y + CARD_T / 2 + k * CARD_T * 1.2, z],
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
  const placed = new Map();
  // Mid-ability frames can briefly list one card in two zones; the first
  // zone written (expedition, then lost loot, then cargo) wins.
  const out = { set: (id, v) => { if (!placed.has(id)) placed.set(id, v); } };
  if (!view) return placed;

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

  for (const { player, side } of seatsOf(view.players, mySeatId)) placeCargo(out, player, side);
  return placed;
}

export function deckTopY(count) {
  return TABLE_Y + Math.max(count, 1) * 0.012;
}
