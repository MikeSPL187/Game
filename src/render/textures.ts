import { Texture } from 'pixi.js';
import type { ArtResult } from '../art/buildings';
import { svgUrl } from '../art/svg';
import { artEntry, artUrl } from '../art/manifest';
import { reportError } from '../core/errors';

export interface Baked {
  tex: Texture; ax: number; ay: number; w: number; h: number;
  /** raster asset name when this texture comes from art/ (not procedural) */
  raster?: string;
  /** the decoded image, kept for shadow / outline baking */
  img?: HTMLImageElement;
}

const bank = new Map<string, Baked>();
const pending = new Map<string, Promise<Baked>>();

/** Global art resolution multiplier (art pixels → texture pixels). */
export let ART_RES = Math.min(2, Math.max(1, (window.devicePixelRatio || 1) * 0.85));
export function setArtRes(v: number) { ART_RES = v; }

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

export async function bake(key: string, art: ArtResult | (() => ArtResult), res = ART_RES): Promise<Baked> {
  const have = bank.get(key);
  if (have) return have;
  const p = pending.get(key);
  if (p) return p;
  const job = (async () => {
    const a = typeof art === 'function' ? art() : art;
    const img = await loadImage(svgUrl(a.svg));
    const c = document.createElement('canvas');
    c.width = Math.ceil(a.w * res);
    c.height = Math.ceil(a.h * res);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const tex = Texture.from(c);
    tex.source.scaleMode = 'linear';
    const b: Baked = { tex, ax: a.ax, ay: a.ay, w: a.w, h: a.h };
    bank.set(key, b);
    pending.delete(key);
    return b;
  })();
  pending.set(key, job);
  return job;
}

export function get(key: string): Baked | undefined { return bank.get(key); }

export function canvasTexture(c: HTMLCanvasElement): Texture {
  const t = Texture.from(c);
  t.source.scaleMode = 'linear';
  return t;
}

/**
 * Raster asset when the manifest has it, procedural art otherwise.
 * A failed download falls back to the procedural version, so a missing file never breaks a scene.
 */
export async function bakeOr(key: string, artName: string | null, art: ArtResult | (() => ArtResult), res = ART_RES): Promise<Baked> {
  const have = bank.get(key);
  if (have) return have;
  const e = artName ? artEntry(artName) : undefined;
  if (!e || !artName) return bake(key, art, res);
  const p = pending.get(key);
  if (p) return p;
  const job = (async () => {
    try {
      const img = await loadImage(artUrl(artName));
      const tex = Texture.from(img);
      tex.source.scaleMode = 'linear';
      const b: Baked = { tex, ax: e.ax, ay: e.ay, w: e.size, h: (e.size * e.h) / e.w, raster: artName, img };
      bank.set(key, b);
      pending.delete(key);
      return b;
    } catch (err) {
      reportError('art:' + artName, err);
      pending.delete(key);
      return bake(key, art, res);
    }
  })();
  pending.set(key, job);
  return job;
}

const shadows = new Map<string, Texture>();
/** Soft black silhouette of a raster sprite (blurred by down/up-scaling — ctx.filter is missing in some WebViews). */
export function shadowTexture(b: Baked): Texture | null {
  if (!b.raster || !b.img) return null;
  const have = shadows.get(b.raster);
  if (have) return have;
  const w = Math.max(8, Math.round(b.img.width / 4)), h = Math.max(8, Math.round(b.img.height / 4));
  const small = document.createElement('canvas');
  small.width = w; small.height = h;
  const g = small.getContext('2d')!;
  g.drawImage(b.img, 0, 0, w, h);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  const tiny = document.createElement('canvas');
  tiny.width = Math.max(4, w >> 2); tiny.height = Math.max(4, h >> 2);
  const t = tiny.getContext('2d')!;
  t.imageSmoothingQuality = 'high';
  t.drawImage(small, 0, 0, tiny.width, tiny.height);
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const o = out.getContext('2d')!;
  o.imageSmoothingQuality = 'high';
  o.globalAlpha = 0.6; o.drawImage(small, 0, 0);
  o.globalAlpha = 1; o.drawImage(tiny, 0, 0, w, h);
  const tex = canvasTexture(out);
  shadows.set(b.raster, tex);
  return tex;
}

export interface TexData { w: number; h: number; d: Uint8ClampedArray; mean: [number, number, number]; canvas: HTMLCanvasElement }
/** Pixels of a raster texture asset (tex_*), or null when it has not been generated yet. */
export async function loadTexData(name: string): Promise<TexData | null> {
  if (!artEntry(name)) return null;
  try {
    const img = await loadImage(artUrl(name));
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    return { w: c.width, h: c.height, d, mean: [r / n, gg / n, b / n], canvas: c };
  } catch (err) { reportError('tex:' + name, err); return null; }
}
/** Wrapped texel lookup. */
export function texAt(t: TexData, x: number, y: number): [number, number, number] {
  const xi = ((Math.floor(x) % t.w) + t.w) % t.w, yi = ((Math.floor(y) % t.h) + t.h) % t.h;
  const i = (yi * t.w + xi) * 4;
  return [t.d[i], t.d[i + 1], t.d[i + 2]];
}
