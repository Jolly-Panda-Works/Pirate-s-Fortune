/**
 * Networking (Colyseus) + turn replay.
 *
 * The server sends, per action, the list of engine events ("frames")
 * with the public view after each one. This module replays them with
 * per-event timing so the 3D scene can animate every reveal, ability,
 * shipwreck and AI decision — the network equivalent of the 2D build's
 * animationManager render gate.
 */

import { Client } from 'colyseus.js';

import { createLocalSoloRoom } from './localRoom.js';

import { appStore, createStore, go, recordGame, setSave, toast } from './store.js';
import { t, cardTypeName } from './i18n.js';
import { defOf, scoreOf } from './data.js';
import { playSfx } from './audio.js';
import { isChainAbility } from './data.js';

const proto = location.protocol === 'https:' ? 'wss' : 'ws';

/** True inside the Android (Capacitor) app, where the page itself is not served by the game server. */
export const isNativeApp = Boolean(window.Capacitor?.isNativePlatform?.());

/** Build-time default: VITE_SERVER_URL, else the dev server, else the host that served the page. */
export function defaultServerUrl() {
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  if (isNativeApp) return '';
  return import.meta.env.DEV ? `${proto}://${location.hostname}:2567` : `${proto}://${location.host}`;
}

/** Accepts "192.168.1.5", "192.168.1.5:2567", "http://host:2567" or "ws://…". */
export function normalizeServerUrl(raw) {
  let url = String(raw ?? '').trim().replace(/\/+$/, '');
  if (!url) return '';
  url = url.replace(/^http(s?):\/\//i, 'ws$1://');
  if (!/^wss?:\/\//i.test(url)) url = `ws://${url}`;
  if (!/:\d+$/.test(url.replace(/^wss?:\/\//i, '')) && url.startsWith('ws://')) url += ':2567';
  return url;
}

export function serverUrl() {
  return appStore.get().settings.serverUrl || defaultServerUrl();
}

function httpUrl() {
  return serverUrl().replace(/^ws/, 'http');
}

let client = null;
let clientUrl = '';
function getClient() {
  const url = serverUrl();
  if (!client || clientUrl !== url) {
    client = new Client(url);
    clientUrl = url;
  }
  return client;
}

// ---------------------------------------------------------------------------
// FX bus — one-shot visual/audio events for the 3D scene.
// ---------------------------------------------------------------------------

const fxListeners = new Set();
export const fxBus = {
  on(fn) {
    fxListeners.add(fn);
    return () => fxListeners.delete(fn);
  },
  emit(event) {
    fxListeners.forEach((fn) => fn(event));
  },
};

// ---------------------------------------------------------------------------
// Game store
// ---------------------------------------------------------------------------

const EMPTY_ROOM = { roomId: '', mode: '', status: 'idle', arena: 'ship', isPrivate: false, seats: [], chat: [], gameNumber: 0, mySeatId: '' };

export const gameStore = createStore({
  room: EMPTY_ROOM,
  connection: 'idle', // idle | connecting | connected | reconnecting | lost
  view: null,
  version: 0,
  busy: false, // replaying frames
  banner: null,
  paused: false,
});

let room = null;
let queue = [];
let timer = null;
let tracking = { gameKey: '', secured: 0, shipwrecks: 0, recorded: false };

export function currentRoom() {
  return room;
}

// ---------------------------------------------------------------------------
// Server health / room list
// ---------------------------------------------------------------------------

export async function checkServer() {
  if (!serverUrl()) {
    appStore.set({ serverOnline: false });
    return false;
  }
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${httpUrl()}/health`, { signal: ctrl.signal });
    clearTimeout(timeout);
    const ok = res.ok;
    appStore.set({ serverOnline: ok });
    return ok;
  } catch {
    appStore.set({ serverOnline: false });
    return false;
  }
}

export async function listRooms() {
  try {
    const res = await fetch(`${httpUrl()}/rooms`);
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Joining
// ---------------------------------------------------------------------------

function profilePayload() {
  const { name, character, color } = appStore.get().profile;
  return { name, character, color };
}

async function join(factory, nextScreen) {
  await leaveRoom();
  gameStore.set({ connection: 'connecting', view: null, version: 0, busy: false, banner: null, paused: false, room: EMPTY_ROOM });
  try {
    const r = await factory();
    attach(r);
    go(nextScreen);
    return true;
  } catch (err) {
    gameStore.set({ connection: 'idle' });
    const message = String(err?.message ?? err);
    toast(/full|locked|sail/i.test(message) ? t('errors.roomFull') : t('errors.join', { detail: message }), 'error', 4500);
    checkServer();
    return false;
  }
}

// Solo games run the rules engine inside the app (localRoom.js): no server needed,
// so they work offline on Android too. Multiplayer below uses the Colyseus server.
export function playSolo(aiCount, arena) {
  return join(async () => createLocalSoloRoom({ aiCount, arena, profile: profilePayload() }), 'game');
}

export function resumeSolo() {
  const save = appStore.get().save;
  if (!save) return Promise.resolve(false);
  return join(async () => createLocalSoloRoom({ resume: save, profile: profilePayload() }), 'game');
}

export function quickMatch() {
  return join(() => getClient().joinOrCreate('pirate', { mode: 'online', profile: profilePayload() }), 'lobby');
}

export function createPrivate() {
  return join(() => getClient().create('pirate', { mode: 'online', private: true, profile: profilePayload() }), 'lobby');
}

export function joinByCode(code) {
  return join(() => getClient().joinById(code.trim(), { profile: profilePayload() }), 'lobby');
}

export async function leaveRoom() {
  stopQueue();
  const r = room;
  room = null;
  sessionStorage.removeItem('pf3d.reconnect');
  if (r) {
    try {
      await r.leave(true);
    } catch {
      // already gone
    }
  }
  gameStore.set({ room: EMPTY_ROOM, connection: 'idle', view: null, busy: false, banner: null });
}

export function send(type, payload) {
  room?.send(type, payload);
}

// ---------------------------------------------------------------------------
// Room wiring
// ---------------------------------------------------------------------------

function attach(r) {
  room = r;
  sessionStorage.setItem('pf3d.reconnect', r.reconnectionToken);
  gameStore.set({ connection: 'connected' });

  r.onStateChange((state) => syncRoom(r, state));
  r.onMessage('frames', enqueue);
  r.onMessage('save', (save) => setSave(save));
  r.onMessage('notice', (msg) => toast(t(msg.key), 'warn'));
  r.onError((code, message) => toast(`${code}: ${message}`, 'error'));
  r.onLeave((code) => {
    if (room !== r) return;
    if (code === 1000) return; // we left on purpose
    reconnect(r.reconnectionToken);
  });
}

function syncRoom(r, state) {
  const json = state.toJSON();
  const seats = Object.values(json.seats ?? {}).sort((a, b) => a.order - b.order);
  const me = seats.find((s) => s.sessionId === r.sessionId);
  gameStore.set({
    room: {
      roomId: r.roomId,
      mode: json.mode,
      status: json.status,
      arena: json.arena,
      isPrivate: json.isPrivate,
      seats,
      chat: json.chat ?? [],
      gameNumber: json.gameNumber,
      mySeatId: me?.id ?? gameStore.get().room.mySeatId,
    },
  });

  const screen = appStore.get().screen;
  if (json.status === 'playing' && screen === 'lobby') go('game');
}

async function reconnect(token) {
  gameStore.set({ connection: 'reconnecting' });
  stopQueue();
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((res) => setTimeout(res, 1000 + attempt * 750));
    try {
      const r = await getClient().reconnect(token);
      attach(r);
      r.send('sync');
      return;
    } catch {
      // keep trying
    }
  }
  gameStore.set({ connection: 'lost' });
  toast(t('game.reconnectFailed'), 'error', 6000);
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

function stopQueue() {
  clearTimeout(timer);
  timer = null;
  queue = [];
  gameStore.set({ busy: false });
}

function enqueue(msg) {
  const gameKey = `${gameStore.get().room.roomId}:${msg.fresh ? 'fresh' : ''}`;
  if (msg.fresh) {
    stopQueue();
    if (msg.frames.length === 0) {
      applyView(msg.view, msg.version);
      afterIdle();
      return;
    }
    gameStore.set({ view: msg.frames[0].view });
    tracking = { gameKey, secured: 0, shipwrecks: 0, recorded: false };
  }
  queue.push(...msg.frames.map((f) => ({ ...f, version: msg.version })));
  queue.push({ type: 'FINAL', view: msg.view, version: msg.version });
  if (!timer) pump();
}

function applyView(view, version) {
  gameStore.set({ view, version });
}

function pump() {
  const frame = queue.shift();
  if (!frame) {
    timer = null;
    gameStore.set({ busy: false });
    afterIdle();
    return;
  }
  gameStore.set({ busy: true });
  const prev = gameStore.get().view;
  applyView(frame.view, frame.version);
  const duration = react(frame, prev);
  const speed = appStore.get().settings.animSpeed || 1;
  timer = setTimeout(pump, duration / speed);
}

/** Skip the remaining replay (no FX), jump to the latest view. */
export function skipReplay() {
  if (!queue.length) return;
  const last = queue[queue.length - 1];
  for (const frame of queue) track(frame);
  clearTimeout(timer);
  queue = [];
  timer = null;
  applyView(last.view, last.version);
  gameStore.set({ busy: false, banner: null });
  afterIdle();
}

function playerName(view, id) {
  return view?.players.find((p) => p.id === id)?.name ?? '?';
}

function currentOf(view) {
  return view?.players[view.currentPlayerIndex];
}

function showBanner(text, sub, tone = 'info', ms = 1400) {
  const id = Date.now() + Math.random();
  gameStore.set({ banner: { id, text, sub, tone } });
  setTimeout(() => {
    if (gameStore.get().banner?.id === id) gameStore.set({ banner: null });
  }, ms);
}

function track(frame) {
  const mySeatId = gameStore.get().room.mySeatId;
  if (frame.type === 'TURN_HISTORY_APPENDED' && frame.detail.added?.playerId === mySeatId) {
    if (frame.detail.added.decision === 'return') tracking.secured += frame.detail.added.cardsSecured ?? 0;
    if (frame.detail.added.decision === 'shipwreck') tracking.shipwrecks += 1;
  }
}

/**
 * Side effects of one frame (sound, FX, banners). Returns how long to
 * hold this frame on screen before the next one, in ms.
 */
function react(frame, prev) {
  const { view } = frame;
  const mySeatId = gameStore.get().room.mySeatId;
  const current = currentOf(view);
  track(frame);

  switch (frame.type) {
    case 'EXPEDITION_AREA_CARD_ADDED': {
      playSfx('reveal');
      fxBus.emit({ kind: 'reveal', card: frame.detail.added, playerId: current?.id });
      return 750;
    }
    case 'EXPEDITION_AREA_CLEARED':
      return 650;
    case 'LOST_LOOT_ADDED':
      return 250;
    case 'PLAYER_UPDATED':
      return 320;
    case 'ABILITY_CONTEXT_SET':
      return 300;
    case 'SHIELD_ACTIVE_SET': {
      if (frame.detail.active) {
        fxBus.emit({ kind: 'shield', playerId: current?.id });
        return 500;
      }
      if (frame.phase === 'CHECK_DUPLICATE') {
        showBanner(t('game.shieldAbsorbed'), '', 'good');
        fxBus.emit({ kind: 'shieldBreak', playerId: current?.id });
        playSfx('abilityTrigger', { rate: 0.8 });
        return 1200;
      }
      return 0;
    }
    case 'TURN_HISTORY_APPENDED': {
      const entry = frame.detail.added;
      if (entry?.decision === 'return' && entry.cardsSecured > 0) {
        fxBus.emit({ kind: 'return', playerId: entry.playerId, count: entry.cardsSecured });
      }
      return 0;
    }
    case 'PHASE_CHANGED':
      return reactPhase(frame, prev, current, mySeatId);
    default:
      return 0;
  }
}

function reactPhase(frame, prev, current, mySeatId) {
  const { view } = frame;
  switch (frame.detail.phase) {
    case 'PLAYER_TURN_START': {
      const mine = current?.id === mySeatId;
      showBanner(mine ? t('game.yourTurn') : t('game.theirTurn', { name: current?.name ?? '' }), t('game.round', { count: view.turnCount + 1 }), mine ? 'gold' : 'info', 1100);
      fxBus.emit({ kind: 'turn', playerId: current?.id });
      return 1000;
    }
    case 'SHIPWRECK': {
      const dup = view.expeditionArea[view.expeditionArea.length - 1];
      const def = dup ? defOf(dup) : null;
      playSfx('shipwreck');
      showBanner(t('game.shipwreck'), def ? t('game.duplicate', { type: cardTypeName(def.type) }) : '', 'bad', 1700);
      fxBus.emit({ kind: 'shipwreck', card: dup, playerId: current?.id });
      return 1800;
    }
    case 'RESOLVE_ABILITY': {
      const card = view.expeditionArea[view.expeditionArea.length - 1];
      const def = card ? defOf(card) : null;
      if (!def?.ability || def.ability === 'treasureChestGoldenKey') return 0;
      playSfx(isChainAbility(def.ability) ? 'specialAbility' : 'abilityTrigger');
      showBanner(t(`cardTypes.${def.type}`), t(`howTo.abilities.${def.type}`), 'magic', 1300);
      fxBus.emit({ kind: 'ability', ability: def.ability, type: def.type, card, playerId: current?.id });
      return 1100;
    }
    case 'RETURN_TO_SHIP': {
      if (view.expeditionArea.length > 0) playSfx('returnToShip');
      return 300;
    }
    case 'PLAYER_DECISION':
      return current?.isAI ? 500 : 0;
    case 'SCORING':
      playSfx('gameEnd');
      fxBus.emit({ kind: 'gameEnd' });
      return 700;
    default:
      return 0;
  }
}

function afterIdle() {
  const { view, room: r } = gameStore.get();
  if (!view || view.phase !== 'SCORING' || !view.results || tracking.recorded) return;
  tracking.recorded = true;
  const me = view.players.find((p) => p.id === r.mySeatId);
  if (!me) return;
  recordGame({
    score: view.results.scores?.[me.id] ?? scoreOf(me),
    won: (view.results.winners ?? []).includes(me.id),
    mode: r.mode,
    opponents: view.players.filter((p) => p.id !== me.id).map((p) => p.name),
    secured: tracking.secured,
    shipwrecks: tracking.shipwrecks,
  });
}

/** Called when a rematch starts so the next game is recorded too. */
export function resetTracking() {
  tracking = { gameKey: '', secured: 0, shipwrecks: 0, recorded: false };
}

export { playerName };
