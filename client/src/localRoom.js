/**
 * Offline solo table: the same rules engine the server uses
 * (shared/engineCore.js → ../js/*), running inside the browser / Android
 * app, so playing against AI captains never needs a server.
 *
 * It mimics the part of a Colyseus Room that net.js uses (onStateChange,
 * onMessage, send, leave …), so the HUD, replay and save flow are the same
 * for online and offline games.
 */

import { runInRoom, toPublicView, warmUp, PHASES } from '../../shared/engineCore.js';
import { CHARACTERS, characterById, ARENA_IDS, DEFAULT_ARENA } from '../../shared/roster.js';
import { cardDefinitions, gameConfig } from './data.js';

const MAX_PLAYERS = gameConfig.players.max;
let warmed = false;

function randomSeed() {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();
}

function cleanName(raw) {
  return String(raw ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 18) || 'Captain';
}

class LocalSoloRoom {
  constructor({ aiCount = 1, arena, resume, profile = {} }) {
    if (!warmed) {
      // turnManager remembers the card definitions of the last startGame();
      // a warm-up game makes resuming a saved snapshot work straight away.
      warmUp(cardDefinitions, gameConfig);
      warmed = true;
    }
    this.roomId = 'offline';
    this.sessionId = 'local-player';
    this.reconnectionToken = '';
    this.handlers = new Map();
    this.stateListeners = new Set();
    this.leaveListeners = new Set();
    this.engineSnapshot = null;
    this.state = {
      mode: 'solo',
      status: 'lobby',
      isPrivate: true,
      arena: ARENA_IDS.includes(arena) ? arena : DEFAULT_ARENA,
      seats: {},
      chat: [],
      view: '',
      version: 0,
      gameNumber: 0,
    };

    const character = characterById(profile.character);
    const human = {
      id: resume?.snapshot?.players.find((p) => !p.isAI)?.id ?? 'seat-1',
      sessionId: this.sessionId,
      name: cleanName(profile.name),
      character: character.id,
      avatar: character.icon,
      color: /^#[0-9a-f]{6}$/i.test(profile.color ?? '') ? profile.color : character.color,
      isAI: false,
      isHost: true,
      connected: true,
      order: 0,
    };
    this.state.seats[human.id] = human;

    if (resume?.snapshot && this.validResume(resume.snapshot)) {
      this.pending = () => this.resumeVoyage(resume.snapshot, human.id);
    } else {
      const count = Math.min(Math.max(Number(aiCount) || 1, 1), MAX_PLAYERS - 1);
      for (let i = 0; i < count; i++) this.addBot();
      this.pending = () => this.startVoyage();
    }
    // Let net.js attach its listeners before the first game events arrive.
    setTimeout(() => this.pending?.(), 0);
  }

  // ---------------------------------------------------- Colyseus-like API
  onStateChange(fn) {
    this.stateListeners.add(fn);
    fn(this.stateProxy());
  }

  onMessage(type, fn) {
    this.handlers.set(type, fn);
  }

  onError() {}

  onLeave(fn) {
    this.leaveListeners.add(fn);
  }

  send(type, payload) {
    switch (type) {
      case 'explore': return this.act((gm) => gm.revealNextCard());
      case 'return': return this.act((gm) => gm.returnToShip());
      case 'choose': return this.act((gm) => gm.chooseAbilityTarget(payload));
      case 'rematch': return this.startVoyage();
      case 'sync': return this.sendSync();
      default: return undefined;
    }
  }

  async leave() {
    this.pending = null;
    this.leaveListeners.forEach((fn) => fn(1000));
  }

  // ---------------------------------------------------------- internals
  stateProxy() {
    const state = this.state;
    return { toJSON: () => JSON.parse(JSON.stringify(state)) };
  }

  emitState() {
    const proxy = this.stateProxy();
    this.stateListeners.forEach((fn) => fn(proxy));
  }

  message(type, payload) {
    this.handlers.get(type)?.(payload);
  }

  seatList() {
    return Object.values(this.state.seats).sort((a, b) => a.order - b.order);
  }

  addBot() {
    const used = new Set(this.seatList().map((s) => s.character));
    const free = CHARACTERS.filter((c) => !used.has(c.id));
    const crew = free[Math.floor(Math.random() * free.length)] ?? CHARACTERS[0];
    const id = `seat-${this.seatList().length + 1}`;
    this.state.seats[id] = {
      id, sessionId: '', name: crew.name.en, character: crew.id, avatar: crew.icon,
      color: crew.color, isAI: true, isHost: false, connected: true, order: this.seatList().length,
    };
  }

  startVoyage() {
    const players = this.seatList().map((s) => ({ id: s.id, name: s.name, isAI: s.isAI, shipCargo: [], score: 0 }));
    const seed = randomSeed();
    const result = runInRoom(null, (gm) => {
      gm.startGame(cardDefinitions, gameConfig, players, { treasureSeed: seed, lostLootSeed: `${seed}-lost` });
    });
    this.state.status = 'playing';
    this.state.gameNumber += 1;
    this.commit(result, true);
  }

  validResume(snapshot) {
    return Array.isArray(snapshot.players)
      && snapshot.players.filter((p) => !p.isAI).length === 1
      && [PHASES.PLAYER_DECISION, PHASES.PLAYER_CHOICE].includes(snapshot.phase);
  }

  resumeVoyage(snapshot, humanId) {
    snapshot.players.forEach((p, order) => {
      if (p.id === humanId) {
        this.state.seats[humanId].order = order;
        return;
      }
      const crew = CHARACTERS.find((c) => c.name.en === p.name) ?? CHARACTERS[order % CHARACTERS.length];
      this.state.seats[p.id] = {
        id: p.id, sessionId: '', name: p.name, character: crew.id, avatar: crew.icon,
        color: crew.color, isAI: true, isHost: false, connected: true, order,
      };
    });
    const result = runInRoom(snapshot, () => {});
    this.state.status = 'playing';
    this.state.gameNumber += 1;
    this.commit(result, true);
  }

  act(fn) {
    if (this.state.status !== 'playing' || !this.engineSnapshot) return;
    const current = this.engineSnapshot.players[this.engineSnapshot.currentPlayerIndex];
    if (current?.isAI) return;
    let result;
    try {
      result = runInRoom(this.engineSnapshot, fn);
    } catch (err) {
      this.message('notice', { key: 'errors.invalidAction', detail: err.message });
      return;
    }
    this.commit(result, false);
  }

  commit(result, fresh) {
    this.engineSnapshot = result.snapshot;
    const view = toPublicView(result.snapshot);
    this.state.version += 1;
    this.state.view = JSON.stringify(view);
    if (result.snapshot.phase === PHASES.SCORING) this.state.status = 'finished';
    this.emitState();
    this.message('frames', { version: this.state.version, fresh, frames: result.frames, view });
    if (result.snapshot.phase === PHASES.SCORING) this.message('save', null);
    else if (result.safeToSave) this.message('save', { snapshot: result.snapshot, savedAt: Date.now() });
  }

  sendSync() {
    if (!this.engineSnapshot) return;
    this.message('frames', { version: this.state.version, fresh: true, frames: [], view: toPublicView(this.engineSnapshot) });
  }
}

export function createLocalSoloRoom(options) {
  return new LocalSoloRoom(options);
}
