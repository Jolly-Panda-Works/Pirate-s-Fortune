/**
 * PirateRoom.js — one table of Pirate's Fortune.
 *
 * Modes:
 *  - solo:   private, one human + 1-3 AI rivals, starts on join, supports
 *            resuming a saved snapshot (the 3D build's equivalent of the
 *            2D build's localStorage "Resume Game").
 *  - online: matchmaking (quick match) or private (room code); the host
 *            fills empty seats with AI and starts the voyage.
 *
 * The server is authoritative: clients only ever send intents
 * (explore / return / choose) and the unchanged engine decides.
 */

import { Room } from 'colyseus';
import { randomUUID } from 'node:crypto';

import { RoomState, Seat, ChatLine } from './schema.js';
import { runInRoom, takeOverSeat, toPublicView, cardDefinitions, gameConfig, PHASES } from './engineHost.js';

const MIN_PLAYERS = gameConfig.players.min;
const MAX_PLAYERS = gameConfig.players.max;
const RECONNECT_SECONDS = 45;

const AI_CREW = [
  { name: 'Blackbeard', avatar: '☠️', color: '#c0392b' },
  { name: 'Anne Bonny', avatar: '🦜', color: '#16a085' },
  { name: 'Calico Jack', avatar: '🦑', color: '#8e44ad' },
  { name: 'Grace O\'Malley', avatar: '🐙', color: '#d35400' },
  { name: 'Captain Kidd', avatar: '🐊', color: '#2c3e50' },
];

const AVATARS = new Set(['☠️', '🏴‍☠️', '🦜', '🦑', '🐙', '🐊', '🦈', '🐒', '🦀', '👑', '💀', '⚓', '🧜']);

function cleanName(raw, fallback) {
  const name = String(raw ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 18);
  return name || fallback;
}

export class PirateRoom extends Room {
  onCreate(options = {}) {
    this.mode = options.mode === 'solo' ? 'solo' : 'online';
    this.maxClients = this.mode === 'solo' ? 1 : MAX_PLAYERS;
    this.engineSnapshot = null;
    this.seatCounter = 0;
    this.pendingResume = null;

    const state = new RoomState();
    state.mode = this.mode;
    state.isPrivate = this.mode === 'solo' || Boolean(options.private);
    this.setState(state);

    if (state.isPrivate) this.setPrivate(true);
    this.setMetadata({ mode: this.mode, host: '' });

    if (this.mode === 'solo') {
      this.soloAiCount = Math.min(Math.max(Number(options.aiCount) || 1, 1), MAX_PLAYERS - 1);
      this.pendingResume = this.validateResume(options.resume);
    }

    this.onMessage('explore', (client) => this.act(client, (gm) => gm.revealNextCard()));
    this.onMessage('return', (client) => this.act(client, (gm) => gm.returnToShip()));
    this.onMessage('choose', (client, option) => this.act(client, (gm) => gm.chooseAbilityTarget(option)));
    this.onMessage('start', (client) => this.hostOnly(client, () => this.startVoyage()));
    this.onMessage('rematch', (client) => this.hostOnly(client, () => this.startVoyage()));
    this.onMessage('addBot', (client) => this.hostOnly(client, () => this.addBot()));
    this.onMessage('removeSeat', (client, seatId) => this.hostOnly(client, () => this.removeBot(seatId)));
    this.onMessage('chat', (client, text) => this.chat(client, text));
    this.onMessage('sync', (client) => this.sendSync(client));
  }

  onAuth(client, options) {
    if (this.state.status !== 'lobby' && this.mode === 'online') {
      throw new Error('This voyage has already set sail.');
    }
    return true;
  }

  onJoin(client, options = {}) {
    const profile = options.profile ?? {};
    const seat = new Seat();
    seat.id = this.pendingResume?.humanId ?? `seat-${++this.seatCounter}`;
    seat.sessionId = client.sessionId;
    seat.name = cleanName(profile.name, `Pirate ${this.seatCounter}`);
    seat.avatar = AVATARS.has(profile.avatar) ? profile.avatar : '☠️';
    seat.color = /^#[0-9a-f]{6}$/i.test(profile.color ?? '') ? profile.color : '#f1c40f';
    seat.isHost = this.humanSeats().length === 0;
    seat.order = this.state.seats.size;
    this.state.seats.set(seat.id, seat);
    if (seat.isHost) this.setMetadata({ ...this.metadata, host: seat.name });

    this.sendSync(client);

    if (this.mode === 'solo') {
      if (this.pendingResume) this.resumeVoyage(this.pendingResume);
      else {
        for (let i = 0; i < this.soloAiCount; i++) this.addBot();
        this.startVoyage();
      }
    }
  }

  async onLeave(client, consented) {
    const seat = this.seatFor(client);
    if (!seat) return;
    seat.connected = false;

    if (!consented) {
      try {
        await this.allowReconnection(client, RECONNECT_SECONDS);
        seat.connected = true;
        this.sendSync(client);
        return;
      } catch {
        // fall through: gone for good
      }
    }
    this.seatLost(seat);
  }

  // -------------------------------------------------------------------------

  humanSeats() {
    return [...this.state.seats.values()].filter((s) => !s.isAI);
  }

  orderedSeats() {
    return [...this.state.seats.values()].sort((a, b) => a.order - b.order);
  }

  seatFor(client) {
    return [...this.state.seats.values()].find((s) => s.sessionId === client.sessionId);
  }

  hostOnly(client, fn) {
    const seat = this.seatFor(client);
    if (!seat?.isHost) return client.send('notice', { key: 'errors.hostOnly' });
    fn();
  }

  addBot() {
    if (this.state.status !== 'lobby' && this.state.status !== 'finished') return;
    if (this.state.seats.size >= MAX_PLAYERS) return;
    const used = new Set([...this.state.seats.values()].map((s) => s.name));
    const crew = AI_CREW.find((c) => !used.has(c.name)) ?? AI_CREW[0];
    const seat = new Seat();
    seat.id = `seat-${++this.seatCounter}`;
    seat.sessionId = '';
    seat.name = crew.name;
    seat.avatar = crew.avatar;
    seat.color = crew.color;
    seat.isAI = true;
    seat.order = this.state.seats.size;
    this.state.seats.set(seat.id, seat);
  }

  removeBot(seatId) {
    const seat = this.state.seats.get(seatId);
    if (!seat || !seat.isAI || this.state.status === 'playing') return;
    this.state.seats.delete(seatId);
    this.orderedSeats().forEach((s, i) => { s.order = i; });
  }

  chat(client, text) {
    const seat = this.seatFor(client);
    const clean = String(text ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 160);
    if (!seat || !clean) return;
    const line = new ChatLine();
    line.from = seat.name;
    line.text = clean;
    line.at = Date.now();
    this.state.chat.push(line);
    while (this.state.chat.length > 30) this.state.chat.shift();
  }

  startVoyage() {
    if (this.state.status === 'playing') return;
    const seats = this.orderedSeats();
    if (seats.length < MIN_PLAYERS) return;

    const players = seats.map((s) => ({ id: s.id, name: s.name, isAI: s.isAI, shipCargo: [], score: 0 }));
    const seed = randomUUID();
    const result = runInRoom(null, (gm) => {
      gm.startGame(cardDefinitions, gameConfig, players, { treasureSeed: seed, lostLootSeed: `${seed}-lost` });
    });

    this.state.status = 'playing';
    this.state.gameNumber += 1;
    if (this.mode === 'online') this.lock();
    this.commit(result, { fresh: true });
  }

  resumeVoyage(resume) {
    this.pendingResume = null;
    for (const p of resume.snapshot.players) {
      if (this.state.seats.has(p.id)) continue;
      const seat = new Seat();
      const crew = AI_CREW.find((c) => c.name === p.name) ?? AI_CREW[this.state.seats.size % AI_CREW.length];
      seat.id = p.id;
      seat.name = p.name;
      seat.avatar = crew.avatar;
      seat.color = crew.color;
      seat.isAI = true;
      seat.order = resume.snapshot.players.findIndex((x) => x.id === p.id);
      this.state.seats.set(seat.id, seat);
    }
    const human = this.state.seats.get(resume.humanId);
    if (human) human.order = resume.snapshot.players.findIndex((x) => x.id === resume.humanId);

    const result = runInRoom(resume.snapshot, () => {});
    this.state.status = result.snapshot.phase === PHASES.SCORING ? 'finished' : 'playing';
    this.state.gameNumber += 1;
    this.commit(result, { fresh: true });
  }

  validateResume(resume) {
    const snap = resume?.snapshot;
    if (!snap || !Array.isArray(snap.players) || !Array.isArray(snap.treasureDeck)) return null;
    const human = snap.players.filter((p) => !p.isAI);
    if (human.length !== 1) return null;
    if (![PHASES.PLAYER_DECISION, PHASES.PLAYER_CHOICE].includes(snap.phase)) return null;
    return { snapshot: snap, humanId: human[0].id };
  }

  act(client, fn) {
    const seat = this.seatFor(client);
    if (this.state.status !== 'playing' || !seat) return;
    const view = this.engineSnapshot;
    const current = view?.players[view.currentPlayerIndex];
    if (!current || current.id !== seat.id) {
      return client.send('notice', { key: 'errors.notYourTurn' });
    }
    let result;
    try {
      result = runInRoom(this.engineSnapshot, fn);
    } catch (err) {
      return client.send('notice', { key: 'errors.invalidAction', detail: err.message });
    }
    this.commit(result);
  }

  seatLost(seat) {
    if (this.state.status === 'playing' && !seat.isAI) {
      seat.isAI = true;
      seat.sessionId = '';
      seat.name = `${seat.name} 🤖`;
      this.commit(takeOverSeat(this.engineSnapshot, seat.id));
    } else if (this.state.status !== 'playing') {
      this.state.seats.delete(seat.id);
      this.orderedSeats().forEach((s, i) => { s.order = i; });
    }

    if (seat.isHost) {
      seat.isHost = false;
      const next = this.humanSeats().find((s) => s.connected);
      if (next) {
        next.isHost = true;
        this.setMetadata({ ...this.metadata, host: next.name });
      }
    }
    if (this.humanSeats().filter((s) => s.connected).length === 0) this.disconnect();
  }

  /**
   * Stores the engine's new snapshot, publishes the public view through
   * Schema sync, and broadcasts the replay frames for the 3D animation.
   */
  commit(result, { fresh = false } = {}) {
    this.engineSnapshot = result.snapshot;
    const view = toPublicView(result.snapshot);
    this.state.version += 1;
    this.state.view = JSON.stringify(view);
    if (result.snapshot.phase === PHASES.SCORING) {
      this.state.status = 'finished';
      if (this.mode === 'online') this.unlock();
    }

    this.broadcast('frames', { version: this.state.version, fresh, frames: result.frames, view });

    if (this.mode === 'solo') {
      const human = this.humanSeats()[0];
      const client = this.clients.find((c) => c.sessionId === human?.sessionId);
      if (client) {
        if (result.safeToSave && result.snapshot.phase !== PHASES.SCORING) {
          client.send('save', { snapshot: result.snapshot, savedAt: Date.now() });
        } else if (result.snapshot.phase === PHASES.SCORING) {
          client.send('save', null);
        }
      }
    }
  }

  sendSync(client) {
    if (!this.engineSnapshot) return;
    client.send('frames', {
      version: this.state.version,
      fresh: true,
      frames: [],
      view: toPublicView(this.engineSnapshot),
    });
  }
}
