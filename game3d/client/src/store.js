/**
 * Tiny external store (no extra state library) + the app-wide store and
 * the localStorage-backed profile / settings / solo-save persistence.
 */

import { useSyncExternalStore } from 'react';

export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      subs.forEach((fn) => fn());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

/** Selector must return a primitive or an existing reference. */
export function useStore(store, selector = (s) => s) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const KEYS = { profile: 'pf3d.profile', settings: 'pf3d.settings', save: 'pf3d.save' };

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode) — the game still works
  }
}

const DEFAULT_STATS = { played: 0, wins: 0, bestScore: 0, totalScore: 0, cardsSecured: 0, shipwrecks: 0, history: [] };

const DEFAULT_PROFILE = {
  name: 'Sailor',
  avatar: '☠️',
  color: '#f1c40f',
  createdAt: Date.now(),
  stats: DEFAULT_STATS,
};

const DEFAULT_SETTINGS = {
  locale: (navigator.language ?? '').startsWith('fa') ? 'fa' : 'en',
  music: 0.45,
  sfx: 0.8,
  quality: 'high',
  animSpeed: 1,
  shake: true,
};

function readSave() {
  try {
    const raw = localStorage.getItem(KEYS.save);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const appStore = createStore({
  screen: 'boot', // boot | splash | menu | solo | online | lobby | game | profile | settings | howto | credits
  returnTo: 'menu',
  overlay: null, // settings | howto (opened from pause)
  profile: read(KEYS.profile, DEFAULT_PROFILE),
  settings: read(KEYS.settings, DEFAULT_SETTINGS),
  save: readSave(),
  serverOnline: null,
  toasts: [],
});

export function go(screen, extra = {}) {
  appStore.set({ screen, ...extra });
}

export function updateSettings(patch) {
  const settings = { ...appStore.get().settings, ...patch };
  write(KEYS.settings, settings);
  appStore.set({ settings });
}

export function updateProfile(patch) {
  const profile = { ...appStore.get().profile, ...patch };
  write(KEYS.profile, profile);
  appStore.set({ profile });
}

export function setSave(save) {
  write(KEYS.save, save);
  appStore.set({ save });
}

export function recordGame({ score, won, mode, opponents, secured, shipwrecks }) {
  const { profile } = appStore.get();
  const s = { ...DEFAULT_STATS, ...profile.stats };
  const history = [{ at: Date.now(), score, won, mode, opponents }, ...(s.history ?? [])].slice(0, 12);
  updateProfile({
    stats: {
      played: s.played + 1,
      wins: s.wins + (won ? 1 : 0),
      bestScore: Math.max(s.bestScore, score),
      totalScore: s.totalScore + score,
      cardsSecured: s.cardsSecured + secured,
      shipwrecks: s.shipwrecks + shipwrecks,
      history,
    },
  });
}

export function resetStats() {
  updateProfile({ stats: DEFAULT_STATS });
}

let toastId = 0;
export function toast(text, tone = 'info', ms = 3200) {
  const id = ++toastId;
  appStore.set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }));
  setTimeout(() => appStore.set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), ms);
}
