/**
 * Audio for the 3D build: the 2D build's six sound categories
 * (data/audioMap.json + assets/audio/*.wav) as WebAudio buffers, plus a
 * procedural ocean ambience and UI clicks — no external audio files.
 */

import audioMap from '@data/audioMap.json';
import { appStore } from './store.js';

import revealUrl from '@assets/audio/reveal.wav';
import shipwreckUrl from '@assets/audio/shipwreck.wav';
import returnUrl from '@assets/audio/return-to-ship.wav';
import abilityUrl from '@assets/audio/ability-trigger.wav';
import specialUrl from '@assets/audio/special-ability.wav';
import gameEndUrl from '@assets/audio/game-end.wav';

const FILES = {
  reveal: revealUrl,
  shipwreck: shipwreckUrl,
  returnToShip: returnUrl,
  abilityTrigger: abilityUrl,
  specialAbility: specialUrl,
  gameEnd: gameEndUrl,
};

let ctx = null;
let sfxBus = null;
let musicBus = null;
const buffers = new Map();
let ambienceStarted = false;

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus.connect(ctx.destination);
  musicBus.connect(ctx.destination);
  applyVolumes();
  return ctx;
}

export function applyVolumes() {
  if (!ctx) return;
  const { sfx, music } = appStore.get().settings;
  sfxBus.gain.setTargetAtTime(sfx, ctx.currentTime, 0.05);
  musicBus.gain.setTargetAtTime(music * 0.6, ctx.currentTime, 0.3);
}

appStore.subscribe(applyVolumes);

/** Fetch + decode every clip. Safe to call before a user gesture. */
export async function preloadAudio(onProgress) {
  const c = ensureContext();
  if (!c) return;
  const entries = Object.entries(FILES);
  let done = 0;
  await Promise.all(entries.map(async ([key, url]) => {
    try {
      const res = await fetch(url);
      buffers.set(key, await c.decodeAudioData(await res.arrayBuffer()));
    } catch {
      // a missing clip must never block the game
    }
    onProgress?.(++done / entries.length);
  }));
}

/** Must be called from a user gesture (splash "click to start"). */
export function unlockAudio() {
  const c = ensureContext();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  startAmbience();
}

export function playSfx(key, { rate = 1, gain = 1 } = {}) {
  if (!ctx || ctx.state !== 'running') return;
  const buffer = buffers.get(key);
  if (!buffer) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = (audioMap[key]?.volume ?? 0.5) * gain;
  src.connect(g).connect(sfxBus);
  src.start();
}

/** Short synthesized UI tick (hover / click). */
export function uiTick(kind = 'click') {
  if (!ctx || ctx.state !== 'running') return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const t0 = ctx.currentTime;
  osc.type = kind === 'hover' ? 'sine' : 'triangle';
  osc.frequency.setValueAtTime(kind === 'hover' ? 880 : 520, t0);
  osc.frequency.exponentialRampToValueAtTime(kind === 'hover' ? 1100 : 300, t0 + 0.08);
  g.gain.setValueAtTime(kind === 'hover' ? 0.03 : 0.12, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  osc.connect(g).connect(sfxBus);
  osc.start(t0);
  osc.stop(t0 + 0.13);
}

/** Coin clink for the physics coins. */
export function coinClink(intensity = 1) {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(2400 + Math.random() * 1600, t0);
  g.gain.setValueAtTime(0.015 * Math.min(intensity, 3), t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  osc.connect(g).connect(sfxBus);
  osc.start(t0);
  osc.stop(t0 + 0.1);
}

function startAmbience() {
  if (ambienceStarted || !ctx) return;
  ambienceStarted = true;

  // Ocean: looped brown noise through a slowly swelling low-pass filter.
  const length = ctx.sampleRate * 4;
  const noise = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noise.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  const swell = ctx.createOscillator();
  const swellDepth = ctx.createGain();
  swell.frequency.value = 0.11;
  swellDepth.gain.value = 320;
  swell.connect(swellDepth).connect(filter.frequency);
  const oceanGain = ctx.createGain();
  oceanGain.gain.value = 0.55;
  src.connect(filter).connect(oceanGain).connect(musicBus);
  src.start();
  swell.start();

  // A soft modal pad (D dorian) that drifts between chords.
  const chords = [
    [146.83, 220.0, 293.66, 349.23],
    [130.81, 196.0, 261.63, 329.63],
    [116.54, 174.61, 233.08, 293.66],
    [130.81, 196.0, 246.94, 329.63],
  ];
  const padGain = ctx.createGain();
  padGain.gain.value = 0.05;
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 900;
  padGain.connect(padFilter).connect(musicBus);
  const voices = chords[0].map((f) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = (Math.random() - 0.5) * 12;
    const vg = ctx.createGain();
    vg.gain.value = 0.25;
    o.connect(vg).connect(padGain);
    o.start();
    return o;
  });
  let chordIndex = 0;
  setInterval(() => {
    chordIndex = (chordIndex + 1) % chords.length;
    voices.forEach((o, i) => o.frequency.setTargetAtTime(chords[chordIndex][i], ctx.currentTime, 1.2));
  }, 7000);
}
