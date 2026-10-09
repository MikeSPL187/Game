import { Texture } from 'pixi.js';
import type { ArtResult } from '../art/buildings';
import { svgUrl } from '../art/svg';

export interface Baked { tex: Texture; ax: number; ay: number; w: number; h: number }

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
