/**
 * schema.js — Colyseus synchronized room state.
 *
 * Room/lobby metadata (seats, host, status) is real Schema so Colyseus
 * delta-syncs it automatically. The game board itself travels as the
 * engine's own public view, serialized once per action (`view`) — the
 * engine's state shape stays the single source of truth instead of being
 * mirrored field-by-field into a second schema.
 */

import { Schema, MapSchema, ArraySchema, defineTypes } from '@colyseus/schema';

export class Seat extends Schema {
  constructor() {
    super();
    this.id = '';
    this.sessionId = '';
    this.name = '';
    this.avatar = '';
    this.character = '';
    this.color = '';
    this.isAI = false;
    this.isHost = false;
    this.connected = true;
    this.order = 0;
  }
}
defineTypes(Seat, {
  id: 'string',
  sessionId: 'string',
  name: 'string',
  avatar: 'string',
  character: 'string',
  color: 'string',
  isAI: 'boolean',
  isHost: 'boolean',
  connected: 'boolean',
  order: 'number',
});

export class ChatLine extends Schema {
  constructor() {
    super();
    this.from = '';
    this.text = '';
    this.at = 0;
  }
}
defineTypes(ChatLine, { from: 'string', text: 'string', at: 'number' });

export class RoomState extends Schema {
  constructor() {
    super();
    this.mode = 'online';
    this.status = 'lobby'; // lobby | playing | finished
    this.isPrivate = false;
    this.arena = 'ship';
    this.seats = new MapSchema();
    this.chat = new ArraySchema();
    this.view = '';
    this.version = 0;
    this.gameNumber = 0;
  }
}
defineTypes(RoomState, {
  mode: 'string',
  status: 'string',
  isPrivate: 'boolean',
  arena: 'string',
  seats: { map: Seat },
  chat: [ChatLine],
  view: 'string',
  version: 'number',
  gameNumber: 'number',
});
