/**
 * Card faces painted onto canvases (no image assets needed, works
 * offline, follows the active language). Cached per defId + locale.
 */

import * as THREE from 'three';
import { cardDefinitions, TYPE_STYLE } from '../data.js';
import { translate, formatNumber } from '../i18n.js';

const W = 320;
const H = 448;
const cache = new Map();
let backTexture = null;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function finish(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  // BoxGeometry's +y face maps the texture's top edge to +z (toward the
  // seated player); turn it so the card reads upright from the seat.
  tex.center.set(0.5, 0.5);
  tex.rotation = Math.PI;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function parchment(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#f6e7c1');
  g.addColorStop(0.5, '#ecd59f');
  g.addColorStop(1, '#d9b977');
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, W, H, 26);
  ctx.fill();
  // speckles
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(110,70,20,${Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function getFaceTexture(defId, locale) {
  const key = `${defId}:${locale}`;
  if (cache.has(key)) return cache.get(key);
  const def = cardDefinitions.find((d) => d.id === defId);
  const style = TYPE_STYLE[def?.type] ?? { icon: '❓', color: '#888', dark: '#333' };
  const fa = locale === 'fa';
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  parchment(ctx);

  // coloured frame
  ctx.lineWidth = 14;
  ctx.strokeStyle = style.color;
  roundRect(ctx, 10, 10, W - 20, H - 20, 20);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = style.dark;
  roundRect(ctx, 22, 22, W - 44, H - 44, 14);
  ctx.stroke();

  // header band
  ctx.fillStyle = style.dark;
  roundRect(ctx, 22, 22, W - 44, 64, 14);
  ctx.fill();
  ctx.fillStyle = '#fff6dc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const name = translate(locale, `cardTypes.${def?.type}`);
  ctx.font = fa ? '700 30px Vazirmatn, Tahoma, sans-serif' : '400 36px "Pirata One", Georgia, serif';
  ctx.fillText(name, W / 2, 56, W - 70);

  // medallion
  const cx = W / 2;
  const cy = 226;
  const rg = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy, 110);
  rg.addColorStop(0, '#fffbe9');
  rg.addColorStop(1, style.color);
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(cx, cy, 98, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = style.dark;
  ctx.stroke();

  ctx.font = '120px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.fillText(style.icon, cx, cy + 8);

  // value coins in corners
  const value = formatNumber(def?.value ?? '?', locale);
  for (const [x, y] of [[54, 128], [W - 54, H - 54]]) {
    ctx.fillStyle = '#f4c542';
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#7a5a00';
    ctx.stroke();
    ctx.fillStyle = '#3b2a00';
    ctx.font = fa ? '700 34px Vazirmatn, sans-serif' : '800 34px Inter, sans-serif';
    ctx.fillText(value, x, y + 2);
  }

  // ability ribbon
  if (def?.ability) {
    ctx.fillStyle = style.dark;
    ctx.globalAlpha = 0.85;
    roundRect(ctx, 40, 352, W - 140, 40, 12);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff6dc';
    ctx.font = fa ? '700 20px Vazirmatn, sans-serif' : '600 19px Inter, sans-serif';
    ctx.fillText(fa ? 'توانایی ✦' : '✦ ABILITY', 40 + (W - 140) / 2, 373);
  }

  const tex = finish(canvas);
  cache.set(key, tex);
  return tex;
}

export function getBackTexture() {
  if (backTexture) return backTexture;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#16324f');
  g.addColorStop(1, '#0a1626');
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, W, H, 26);
  ctx.fill();
  ctx.strokeStyle = '#d4a63a';
  ctx.lineWidth = 10;
  roundRect(ctx, 14, 14, W - 28, H - 28, 18);
  ctx.stroke();
  // rope pattern
  ctx.strokeStyle = 'rgba(212,166,58,0.25)';
  ctx.lineWidth = 2;
  for (let i = -H; i < W + H; i += 22) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
  }
  ctx.fillStyle = '#d4a63a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '130px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  ctx.fillText('☠️', W / 2, H / 2 - 20);
  ctx.font = '400 40px "Pirata One", Georgia, serif';
  ctx.fillText("Pirate's Fortune", W / 2, H - 70);
  backTexture = finish(canvas);
  return backTexture;
}

/** Paints every face up-front (loading screen progress). */
export async function prewarmCardTextures(locale, onProgress) {
  getBackTexture();
  const defs = cardDefinitions;
  for (let i = 0; i < defs.length; i++) {
    getFaceTexture(defs[i].id, locale);
    if (i % 6 === 5) {
      onProgress?.((i + 1) / defs.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  onProgress?.(1);
}

export function clearCardTextureCache() {
  cache.forEach((tex) => tex.dispose());
  cache.clear();
}
