import { useEffect, useRef } from 'preact/hooks';
import { portraitUrl } from '../art/portraits';
import { mulberry32 } from '../core/rng';
import type { BattleRound, Report } from '../core/types';
import { HERO_BY_ID } from '../data/heroes';
import { TITAN_BY_ID } from '../data/world';
import { sfx } from '../audio/audio';
import { ga } from './core';
import { artEntry, artUrl, hasArt } from '../art/manifest';
import { unitArtName } from '../art/artMap';

/**
 * Animated battle replay. The simulation already stored the troops left per type after every round,
 * so the replay is a faithful (if abstracted) re-enactment: sprites fall when the type really lost men,
 * skills and titan strikes appear on the round they happened.
 */

const W = 960, H = 270;
export const ROUND_MS = 900;
const TYPES = ['inf', 'cav', 'arc', 'mag', 'beast'] as const;
type Variant = 'me' | 'foe' | 'void';
const SIDE_COL: Record<Variant, string> = { me: '#3a78e0', foe: '#d04a32', void: '#7a3ab8' };

// ———————————————————————————————————————— sprite painters (facing right, origin = feet)
type Painter = (c: CanvasRenderingContext2D, col: string) => void;

const dark = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

function shadow(c: CanvasRenderingContext2D, rx: number) {
  c.fillStyle = 'rgba(0,0,0,.28)';
  c.beginPath(); c.ellipse(0, 0, rx, rx * 0.32, 0, 0, Math.PI * 2); c.fill();
}
function head(c: CanvasRenderingContext2D, x: number, y: number, helm: string) {
  c.fillStyle = '#e8c49a'; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
  c.fillStyle = helm; c.beginPath(); c.arc(x, y - 0.5, 4.4, Math.PI, 0); c.fill();
}

const HUMAN: Record<string, Painter> = {
  inf(c, col) {
    shadow(c, 9);
    c.fillStyle = '#3a2e26'; c.fillRect(-4, -9, 3, 9); c.fillRect(1, -9, 3, 9);
    c.fillStyle = col; c.beginPath(); c.roundRect(-6, -21, 12, 13, 3); c.fill();
    head(c, 0, -25, '#b8c2cc');
    c.strokeStyle = '#7a5a3a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-7, -4); c.lineTo(9, -38); c.stroke();
    c.fillStyle = '#d8dde4'; c.beginPath(); c.moveTo(9, -38); c.lineTo(7, -32); c.lineTo(11, -33); c.fill();
    c.fillStyle = dark(col, 0.7); c.strokeStyle = '#e8c060'; c.lineWidth = 1;
    c.beginPath(); c.roundRect(3, -22, 8, 14, 2); c.fill(); c.stroke();
  },
  arc(c, col) {
    shadow(c, 8);
    c.fillStyle = '#3a2e26'; c.fillRect(-4, -9, 3, 9); c.fillRect(1, -9, 3, 9);
    c.fillStyle = dark(col, 0.85); c.beginPath(); c.roundRect(-5, -20, 10, 12, 3); c.fill();
    c.fillStyle = '#e8c49a'; c.beginPath(); c.arc(0, -24, 3.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#4a6a3a'; c.beginPath(); c.moveTo(-5, -23); c.quadraticCurveTo(0, -33, 5, -24); c.lineTo(3, -26); c.closePath(); c.fill();
    c.strokeStyle = '#8a5a2a'; c.lineWidth = 1.8; c.beginPath(); c.arc(5, -17, 10, -1.2, 1.2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(8.6, -26.3); c.lineTo(8.6, -7.7); c.stroke();
  },
  mag(c, col) {
    shadow(c, 8);
    c.fillStyle = dark(col, 0.75); c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.lineTo(3, -20); c.lineTo(-3, -20); c.closePath(); c.fill();
    c.fillStyle = '#e8c49a'; c.beginPath(); c.arc(0, -23, 3.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = dark(col, 0.5); c.beginPath(); c.moveTo(-6, -24); c.lineTo(6, -24); c.lineTo(1, -37); c.closePath(); c.fill();
    c.strokeStyle = '#6a4a2a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(8, 0); c.lineTo(9, -30); c.stroke();
    const g = c.createRadialGradient(9, -32, 0, 9, -32, 7);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#9ae8ff'); g.addColorStop(1, 'rgba(120,200,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(9, -32, 7, 0, Math.PI * 2); c.fill();
  },
  cav(c, col) {
    shadow(c, 15);
    c.strokeStyle = '#4a3020'; c.lineWidth = 2.2;
    for (const x of [-9, -5, 6, 10]) { c.beginPath(); c.moveTo(x, -10); c.lineTo(x + (x < 0 ? -1 : 1), 0); c.stroke(); }
    c.fillStyle = '#7a5032'; c.beginPath(); c.ellipse(0, -14, 13, 6.5, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(9, -17); c.lineTo(15, -27); c.lineTo(20, -25); c.lineTo(14, -14); c.closePath(); c.fill();
    c.fillStyle = '#3a2416'; c.beginPath(); c.moveTo(10, -20); c.lineTo(14, -28); c.lineTo(12, -19); c.fill();
    c.fillStyle = col; c.fillRect(-9, -18, 16, 4);
    c.fillStyle = col; c.beginPath(); c.roundRect(-4, -31, 9, 12, 3); c.fill();
    head(c, 0, -34, '#b8c2cc');
    c.strokeStyle = '#d8c8a0'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-4, -22); c.lineTo(30, -30); c.stroke();
  },
};

const VOID: Record<string, Painter> = {
  inf(c, col) {
    shadow(c, 10);
    c.fillStyle = '#251530'; c.beginPath(); c.ellipse(0, -13, 10, 13, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = col; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#3a2048'; for (const a of [-0.9, -0.3, 0.3]) { c.beginPath(); c.moveTo(Math.sin(a) * 9, -13 - Math.cos(a) * 12); c.lineTo(Math.sin(a) * 15, -13 - Math.cos(a) * 18); c.lineTo(Math.sin(a + 0.3) * 9, -13 - Math.cos(a + 0.3) * 12); c.fill(); }
    c.fillStyle = '#ff5af0'; c.beginPath(); c.arc(3, -17, 1.6, 0, Math.PI * 2); c.arc(7, -16, 1.6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#251530'; c.lineWidth = 3; c.beginPath(); c.moveTo(6, -10); c.lineTo(13, -4); c.stroke();
  },
  arc(c, col) {
    shadow(c, 8);
    c.fillStyle = '#2a1838'; c.beginPath(); c.moveTo(-8, 0); c.quadraticCurveTo(-10, -20, 2, -22); c.quadraticCurveTo(10, -18, 8, 0); c.closePath(); c.fill();
    c.strokeStyle = col; c.lineWidth = 1; c.stroke();
    c.strokeStyle = '#5a3a78'; c.lineWidth = 1.4; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-6 + i * 3, -16 + i); c.lineTo(-10 + i * 3, -26 + i * 2); c.stroke(); }
    c.fillStyle = '#7fffb0'; c.beginPath(); c.arc(5, -15, 1.8, 0, Math.PI * 2); c.fill();
  },
  mag(c, col) {
    const g = c.createRadialGradient(0, -18, 0, 0, -18, 12);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#d68aff'); g.addColorStop(1, 'rgba(140,60,220,0)');
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(0, 0, 6, 2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = g; c.beginPath(); c.arc(0, -18, 12, 0, Math.PI * 2); c.fill();
    c.strokeStyle = col; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-3, -10); c.quadraticCurveTo(-8, -4, -4, 0); c.stroke();
  },
  cav(c, col) {
    shadow(c, 14);
    c.strokeStyle = '#1e1028'; c.lineWidth = 2.4;
    for (const x of [-9, -4, 6, 10]) { c.beginPath(); c.moveTo(x, -8); c.lineTo(x + 2, 0); c.stroke(); }
    c.fillStyle = '#2a1838'; c.beginPath(); c.ellipse(0, -12, 13, 6, -0.1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(9, -16); c.lineTo(20, -18); c.lineTo(22, -12); c.lineTo(11, -9); c.closePath(); c.fill();
    c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.ellipse(0, -12, 13, 6, -0.1, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#3a2048'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-8 + i * 4, -17); c.lineTo(-10 + i * 4, -24); c.lineTo(-5 + i * 4, -17); c.fill(); }
    c.fillStyle = '#ff5af0'; c.beginPath(); c.arc(18, -15, 1.5, 0, Math.PI * 2); c.fill();
  },
  beast(c, col) {
    // hunched stone-and-void giant: legs, torso, long arms, horned head, glowing core
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 0, 46, 11, 0, 0, Math.PI * 2); c.fill();
    const body = c.createLinearGradient(-30, -90, 30, 0);
    body.addColorStop(0, '#5a4a5e'); body.addColorStop(1, '#2a1e2e');
    c.fillStyle = body; c.strokeStyle = col; c.lineWidth = 1.6;
    // legs
    c.beginPath(); c.moveTo(-20, 0); c.lineTo(-16, -30); c.lineTo(-4, -30); c.lineTo(-8, 0); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(6, 0); c.lineTo(4, -30); c.lineTo(17, -30); c.lineTo(20, 0); c.closePath(); c.fill(); c.stroke();
    // back arm
    c.beginPath(); c.moveTo(-18, -66); c.quadraticCurveTo(-36, -44, -30, -14); c.lineTo(-22, -14); c.quadraticCurveTo(-24, -40, -8, -58); c.closePath(); c.fill(); c.stroke();
    // torso
    c.beginPath(); c.moveTo(-22, -28); c.quadraticCurveTo(-30, -70, -6, -84); c.quadraticCurveTo(22, -88, 26, -60); c.quadraticCurveTo(28, -40, 18, -28); c.closePath(); c.fill(); c.stroke();
    // shoulder crystals
    c.fillStyle = '#7fe3ff';
    for (const [x, y, h] of [[-10, -82, 16], [0, -86, 22], [10, -84, 14]] as const) { c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x, y - h); c.lineTo(x + 4, y); c.closePath(); c.fill(); }
    // head
    c.fillStyle = '#4a3a4e'; c.beginPath(); c.ellipse(24, -70, 11, 9, 0.2, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#d8c8a8'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(20, -77); c.quadraticCurveTo(16, -90, 24, -94); c.stroke();
    c.fillStyle = '#ffd86a'; c.beginPath(); c.arc(28, -72, 2.2, 0, Math.PI * 2); c.arc(33, -69, 2, 0, Math.PI * 2); c.fill();
    // front arm with a huge fist
    c.fillStyle = body; c.strokeStyle = col; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(14, -62); c.quadraticCurveTo(36, -50, 34, -22); c.lineTo(24, -22); c.quadraticCurveTo(24, -42, 6, -50); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#3a2a3e'; c.beginPath(); c.ellipse(30, -16, 10, 8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    // glowing core
    const g = c.createRadialGradient(4, -56, 0, 4, -56, 22);
    g.addColorStop(0, 'rgba(220,250,255,.95)'); g.addColorStop(0.3, 'rgba(127,227,255,.6)'); g.addColorStop(1, 'rgba(127,227,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(4, -56, 22, 0, Math.PI * 2); c.fill();
  },
};

/** Bake every sprite once at 2× for crisp scaling. */
const spriteCache = new Map<string, HTMLCanvasElement>();
const rasterLoading = new Set<string>();

/** Shift blue cloth to red for enemy human armies (one raster set serves both sides). */
function recolorFoe(c: CanvasRenderingContext2D, w: number, h: number) {
  const d = c.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
    if (dd < 0.08 || mx !== b) continue;
    const s = dd / (1 - Math.abs(2 * l - 1) || 1);
    if (s < 0.25) continue;
    let hue = (60 * ((r - g) / dd) + 240) % 360;
    if (hue < 190 || hue > 265) continue;
    hue = 2; // red
    const C = (1 - Math.abs(2 * l - 1)) * s, X = C * (1 - Math.abs(((hue / 60) % 2) - 1)), m = l - C / 2;
    p[i] = (C + m) * 255; p[i + 1] = (X + m) * 255; p[i + 2] = m * 255;
  }
  c.putImageData(d, 0, 0);
}

/** Raster unit art (art/unit_*.webp) replaces the painted sprite once it has loaded. */
function rasterSprite(type: string, v: Variant): HTMLCanvasElement | null {
  if (type === 'beast') return null;
  const name = unitArtName(`${v === 'void' ? 'void' : 'order'}_${type}`);
  if (!hasArt(name)) return null;
  const k = 'r' + type + v;
  const have = spriteCache.get(k);
  if (have) return have;
  if (!rasterLoading.has(k)) {
    rasterLoading.add(k);
    const e = artEntry(name)!;
    const im = new Image();
    im.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = 96; cv.height = 96;
      const c = cv.getContext('2d')!;
      // fit to ~40 logical px tall with the feet on the sprite origin (24, 44)
      const sc = Math.min(80 / im.height, 88 / im.width);
      const dw = im.width * sc, dh = im.height * sc;
      c.imageSmoothingQuality = 'high';
      c.drawImage(im, 48 - e.ax * dw, 88 - e.ay * dh, dw, dh);
      if (v === 'foe') recolorFoe(c, 96, 96);
      spriteCache.set(k, cv);
    };
    im.src = artUrl(name);
  }
  return null;
}

function sprite(type: string, v: Variant): HTMLCanvasElement {
  const r = rasterSprite(type, v);
  if (r) return r;
  const k = type + v;
  let cv = spriteCache.get(k);
  if (cv) return cv;
  const big = type === 'beast';
  const w = big ? 110 : 48, h = big ? 110 : 48;
  cv = document.createElement('canvas');
  cv.width = w * 2; cv.height = h * 2;
  const c = cv.getContext('2d')!;
  c.scale(2, 2); c.translate(w / 2, h - 4);
  const set = v === 'void' || type === 'beast' ? VOID : HUMAN;
  (set[type] ?? set.inf)(c, SIDE_COL[v]);
  spriteCache.set(k, cv);
  return cv;
}

// ———————————————————————————————————————— scene model
interface Unit { side: 0 | 1; type: number; x: number; y: number; alive: boolean; dieAt: number; seed: number }
interface Shot { from: [number, number]; to: [number, number]; t0: number; t1: number; kind: 'arrow' | 'orb' | 'void' }
interface Spark { x: number; y: number; t0: number; col: string }
interface Floater { x: number; y: number; t0: number; text: string; col: string }
interface Banner { side: 0 | 1; title: string; sub: string; img: HTMLImageElement | null; t0: number; col: string }
interface Wave { x: number; y: number; t0: number; col: string }

const imgCache = new Map<string, HTMLImageElement>();
function img(url: string): HTMLImageElement {
  let i = imgCache.get(url);
  if (!i) { i = new Image(); i.src = url; imgCache.set(url, i); }
  return i;
}

function background(theme: 'field' | 'void' | 'titan' | 'siege', seed: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  const sky = c.createLinearGradient(0, 0, 0, 90);
  const skyCols: Record<string, [string, string]> = { field: ['#5a8ac8', '#bcd4e8'], void: ['#2a1640', '#7a4a9a'], titan: ['#2a3040', '#6a7080'], siege: ['#c8783a', '#f0c890'] };
  sky.addColorStop(0, skyCols[theme][0]); sky.addColorStop(1, skyCols[theme][1]);
  c.fillStyle = sky; c.fillRect(0, 0, W, 90);
  // far hills
  const rnd = mulberry32(seed);
  c.fillStyle = theme === 'void' ? '#3a2850' : theme === 'titan' ? '#3a4048' : '#5a7a58';
  c.beginPath(); c.moveTo(0, 90);
  for (let x = 0; x <= W; x += 40) c.lineTo(x, 70 + Math.sin(x * 0.013 + seed) * 10 + rnd() * 6);
  c.lineTo(W, 90); c.closePath(); c.fill();
  const ground = c.createLinearGradient(0, 80, 0, H);
  const gc: Record<string, [string, string]> = { field: ['#6a9a4a', '#4a7034'], void: ['#4a3a50', '#2a2030'], titan: ['#5a6050', '#3a4034'], siege: ['#8a9a5a', '#5a6a3a'] };
  ground.addColorStop(0, gc[theme][0]); ground.addColorStop(1, gc[theme][1]);
  c.fillStyle = ground; c.fillRect(0, 84, W, H - 84);
  // texture: tufts and stones
  for (let i = 0; i < 160; i++) {
    const x = rnd() * W, y = 90 + rnd() * (H - 90);
    c.fillStyle = rnd() < 0.8 ? `rgba(0,0,0,${0.05 + rnd() * 0.06})` : `rgba(255,255,255,${0.05 + rnd() * 0.05})`;
    c.beginPath(); c.ellipse(x, y, 2 + rnd() * 6, 1 + rnd() * 2, 0, 0, Math.PI * 2); c.fill();
  }
  if (theme === 'void') {
    const g = c.createRadialGradient(W * 0.82, 60, 0, W * 0.82, 60, 120);
    g.addColorStop(0, 'rgba(200,120,255,.6)'); g.addColorStop(1, 'rgba(200,120,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  if (theme === 'siege') {
    // palisade behind the defenders
    for (let x = W - 120; x < W; x += 9) {
      c.fillStyle = '#7a5a3a'; c.fillRect(x, 40, 8, 70);
      c.fillStyle = '#5a3a22'; c.beginPath(); c.moveTo(x, 40); c.lineTo(x + 4, 32); c.lineTo(x + 8, 40); c.fill();
    }
  }
  // dust haze in the middle where the lines meet
  const hz = c.createRadialGradient(W / 2, 170, 0, W / 2, 170, 160);
  hz.addColorStop(0, 'rgba(255,240,210,.18)'); hz.addColorStop(1, 'rgba(255,240,210,0)');
  c.fillStyle = hz; c.fillRect(0, 0, W, H);
  return cv;
}

const COL_X = [0, 1, 2, 3]; // inf, cav, arc, mag → column from the front line

function buildUnits(side: 0 | 1, comp: number[], maxSprites: number, seed: number): Unit[] {
  const rnd = mulberry32(seed);
  const tot = comp.slice(0, 4).reduce((a, b) => a + b, 0);
  const out: Unit[] = [];
  for (let t = 0; t < 4; t++) {
    if (comp[t] <= 0) continue;
    const n = Math.max(1, Math.round((maxSprites * comp[t]) / Math.max(1, tot)));
    const cols = Math.max(1, Math.ceil(n / 7));
    for (let i = 0; i < n; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const depth = COL_X[t] * 62 + col * 24 + (row % 2) * 10;
      const fx = side === 0 ? 425 - depth : 535 + depth;
      const y = 110 + row * 21 + (rnd() - 0.5) * 6;
      out.push({ side, type: t, x: fx + (rnd() - 0.5) * 8, y, alive: true, dieAt: 0, seed: rnd() });
    }
  }
  return out;
}

export interface ReplayOpts { r: Report; myIsAttacker: boolean; speed: number; skip: boolean; onRound: (i: number) => void; onEnd: () => void }

export function BattleReplay(p: ReplayOpts) {
  const ref = useRef<HTMLCanvasElement>(null);
  const opts = useRef(p);
  opts.current = p;
  useEffect(() => {
    const cv = ref.current!;
    const low = ga?.game?.s.settings.quality === 'low';
    const scale = low ? 1 : 2;
    cv.width = W * scale; cv.height = H * scale;
    const c = cv.getContext('2d')!;
    const r = p.r;
    const rounds: BattleRound[] = r.rounds ?? [];
    const aStart = r.attacker?.start ?? 1, dStart = r.defender?.start ?? 1;
    const comp = r.comp && r.comp.a.length ? r.comp : { a: [aStart, 0, 0, 0, 0], d: [dStart, 0, 0, 0, 0] };
    const roundComp = (rd: BattleRound | undefined, side: 0 | 1): number[] => {
      if (!rd) return side ? comp.d : comp.a;
      const arr = side ? rd.td : rd.ta;
      if (arr) return arr;
      const base = side ? comp.d : comp.a, tot = side ? dStart : aStart, cur = side ? rd.d : rd.a;
      return base.map((v) => (v * cur) / Math.max(1, tot));
    };
    const voidSide = (k?: string) => k === 'monster' || k === 'titan';
    const variant: [Variant, Variant] = [
      voidSide(r.attacker?.kind) ? 'void' : p.myIsAttacker ? 'me' : 'foe',
      voidSide(r.defender?.kind) ? 'void' : p.myIsAttacker ? 'foe' : 'me',
    ];
    const isTitan = r.defender?.kind === 'titan';
    const theme = isTitan ? 'titan' : r.defender?.name === 'Эфирный разлом' ? 'void' : r.kind === 'defense' ? 'siege' : 'field';
    const bg = background(theme, r.id % 97);
    const maxSprites = low ? 26 : 44;
    const units = [...buildUnits(0, comp.a, maxSprites, r.id * 3 + 1), ...buildUnits(1, comp.d, maxSprites, r.id * 7 + 2)];
    const startSprites = [0, 1].map((s) => [0, 1, 2, 3].map((t) => units.filter((u) => u.side === s && u.type === t).length));
    const beastStart = comp.d[4] ?? 0;
    const shots: Shot[] = [], sparks: Spark[] = [], floaters: Floater[] = [], banners: Banner[] = [], waves: Wave[] = [];
    const summons: { side: 0 | 1; t0: number }[] = [];
    let shakeT = -1e9;
    const rnd = mulberry32(r.id * 31 + 5);
    const total = rounds.length * ROUND_MS + 700;
    let t = 0, last = performance.now(), applied = -1, started = -1, raf = 0, ended = false;
    const center = (side: 0 | 1): [number, number] => [side ? 660 : 300, 170];

    const startRound = (i: number) => {
      const rd = rounds[i];
      const t0 = i * ROUND_MS;
      for (const side of [0, 1] as const) {
        const enemies = units.filter((u) => u.side !== side && u.alive);
        const shooters = units.filter((u) => u.side === side && u.alive && (u.type === 2 || u.type === 3));
        for (const s of shooters) {
          if (rnd() > 0.55 || !enemies.length) continue;
          const e = enemies[Math.floor(rnd() * enemies.length)];
          const dl = rnd() * ROUND_MS * 0.15;
          const kind = variant[side] === 'void' ? 'void' : s.type === 2 ? 'arrow' : 'orb';
          const t1 = t0 + dl + ROUND_MS * 0.4;
          shots.push({ from: [s.x + (side ? -8 : 8), s.y - 22], to: [e.x, e.y - 14], t0: t0 + dl, t1, kind });
          sparks.push({ x: e.x, y: e.y - 14, t0: t1, col: kind === 'arrow' ? '#ffe8a0' : '#bff4ff' });
        }
        if (side === 1 && beastStart > 0 && (rd?.td?.[4] ?? 1) > 0 && i % 2 === 0) {
          waves.push({ x: center(0)[0], y: 175, t0: t0 + ROUND_MS * 0.3, col: '#c27bff' });
        }
      }
      for (const e of rd?.events ?? []) {
        const [s, kind, id, name] = e.split('|');
        const side: 0 | 1 = s === 'A' ? 0 : 1;
        const friendly = (side === 0) === p.myIsAttacker;
        if (kind === 'titan') {
          shakeT = t0;
          summons.push({ side, t0 });
          const [cx, cy] = center(side ? 0 : 1);
          waves.push({ x: cx, y: cy, t0: t0 + 120, col: '#7fe3ff' });
          banners.push({ side, title: TITAN_BY_ID[id]?.name ?? name, sub: 'Удар титана', img: null, t0, col: '#7fe3ff' });
          sfx('alarm');
        } else {
          const hd = HERO_BY_ID[id];
          const sk = hd?.skill;
          const col = sk?.heal ? '#7ae86a' : sk?.defBuff ? '#ffd86a' : sk?.atkBuff ? '#ff9a4a' : '#9ae0ff';
          banners.push({ side, title: name, sub: hd?.name ?? '', img: img(portraitUrl(id)), t0, col: friendly ? col : '#ff8a7a' });
          const [cx, cy] = center(sk?.dmg ? (side ? 0 : 1) : side);
          waves.push({ x: cx, y: cy, t0: t0 + 200, col });
          sfx('levelup');
        }
      }
      if (i % 2 === 0) sfx('battle');
    };

    const applyRound = (i: number) => {
      const rd = rounds[i];
      const tNow = i * ROUND_MS + ROUND_MS * 0.45;
      for (const side of [0, 1] as const) {
        const prev = roundComp(rounds[i - 1], side), cur = roundComp(rd, side), start = side ? comp.d : comp.a;
        let lost = 0;
        for (let ty = 0; ty < 4; ty++) {
          lost += Math.max(0, prev[ty] - cur[ty]);
          const want = start[ty] > 0 ? (cur[ty] >= 1 ? Math.max(1, Math.ceil((startSprites[side][ty] * cur[ty]) / start[ty])) : 0) : 0;
          const alive = units.filter((u) => u.side === side && u.type === ty && u.alive);
          // front ranks fall first, with some randomness
          alive.sort((a, b) => (side ? a.x - b.x : b.x - a.x) + (a.seed - b.seed) * 40);
          for (let k = 0; k < alive.length - want; k++) { alive[k].alive = false; alive[k].dieAt = tNow + rnd() * 200; sparks.push({ x: alive[k].x, y: alive[k].y - 14, t0: tNow, col: '#fff2c0' }); }
        }
        lost += Math.max(0, (prev[4] ?? 0) - (cur[4] ?? 0));
        if (lost >= 1) {
          const [cx] = center(side);
          floaters.push({ x: cx + (rnd() - 0.5) * 60, y: 96, t0: tNow, text: `−${Math.round(lost).toLocaleString('ru-RU')}`, col: (side === 0) === p.myIsAttacker ? '#ff8a7a' : '#ffe08a' });
        }
      }
      opts.current.onRound(i + 1);
    };

    const draw = () => {
      c.setTransform(scale, 0, 0, scale, 0, 0);
      const sh = t - shakeT < 500 ? (1 - (t - shakeT) / 500) * 7 : 0;
      c.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
      c.drawImage(bg, 0, 0);
      const ri = Math.floor(t / ROUND_MS), ph = (t % ROUND_MS) / ROUND_MS;
      const fighting = ri < rounds.length;
      // titan/beast on the defender side
      if (beastStart > 0) {
        const curB = roundComp(rounds[Math.min(ri, rounds.length) - 1], 1)[4] ?? beastStart;
        const bx = 800, by = 200;
        const bob = fighting ? Math.sin(t / 260) * 2 : 0;
        c.save(); c.translate(bx, by + bob); c.scale(-1.2, 1.2);
        c.globalAlpha = curB >= 1 ? 1 : 0.35;
        c.drawImage(sprite('beast', 'void'), -55, -106, 110, 110);
        c.restore();
        c.globalAlpha = 1;
        c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(bx - 50, 52, 100, 8);
        c.fillStyle = '#c27bff'; c.fillRect(bx - 49, 53, 98 * Math.max(0, curB / beastStart), 6);
      }
      // a tamed titan rises behind its army for the strike
      for (const sm of summons) {
        const k = (t - sm.t0) / 1300;
        if (k < 0 || k > 1) continue;
        const a = k < 0.2 ? k / 0.2 : k > 0.75 ? (1 - k) / 0.25 : 1;
        const x = sm.side ? 860 : 100, y = 215 - Math.min(1, k * 4) * 12;
        c.save(); c.globalAlpha = a * 0.92; c.translate(x, y); c.scale(sm.side ? -1.4 : 1.4, 1.4);
        c.drawImage(sprite('beast', 'void'), -55, -106, 110, 110);
        c.restore();
      }
      c.globalAlpha = 1;
      const vis = units.filter((u) => u.alive || t - u.dieAt < 700).sort((a, b) => a.y - b.y);
      for (const u of vis) {
        const dir = u.side ? -1 : 1;
        let ox = 0, oy = 0, rot = 0, alpha = 1;
        if (u.alive && fighting) {
          if (u.type <= 1) ox = Math.max(0, Math.sin(Math.min(1, ph / 0.5) * Math.PI)) * (u.type === 1 ? 22 : 12) * dir;
          oy = -Math.abs(Math.sin((t / 140) + u.seed * 6)) * 1.5;
        } else if (!u.alive) {
          const k = Math.min(1, Math.max(0, (t - u.dieAt) / 450));
          rot = -dir * k * 1.4; alpha = 1 - Math.max(0, (t - u.dieAt - 250) / 450);
          if (t < u.dieAt) { rot = 0; alpha = 1; }
        }
        c.save();
        c.globalAlpha = Math.max(0, alpha);
        c.translate(u.x + ox, u.y + oy);
        c.rotate(rot);
        c.scale(dir * 0.9, 0.9);
        c.drawImage(sprite(TYPES[u.type], variant[u.side]), -24, -44, 48, 48);
        c.restore();
      }
      c.globalAlpha = 1;
      // projectiles
      for (const s of shots) {
        if (t < s.t0 || t > s.t1) continue;
        const k = (t - s.t0) / (s.t1 - s.t0);
        const x = s.from[0] + (s.to[0] - s.from[0]) * k;
        const y = s.from[1] + (s.to[1] - s.from[1]) * k - Math.sin(k * Math.PI) * (s.kind === 'arrow' ? 46 : 18);
        if (s.kind === 'arrow') {
          const dx = s.to[0] - s.from[0], dy = (s.to[1] - s.from[1]) - Math.cos(k * Math.PI) * 46 * Math.PI;
          const a = Math.atan2(dy, dx);
          c.save(); c.translate(x, y); c.rotate(a);
          c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-8, 0); c.lineTo(4, 0); c.stroke();
          c.fillStyle = '#e0e0e0'; c.beginPath(); c.moveTo(6, 0); c.lineTo(3, -2); c.lineTo(3, 2); c.fill();
          c.restore();
        } else {
          const col = s.kind === 'orb' ? 'rgba(140,220,255,' : 'rgba(210,120,255,';
          const g = c.createRadialGradient(x, y, 0, x, y, 8);
          g.addColorStop(0, '#fff'); g.addColorStop(0.4, col + '0.9)'); g.addColorStop(1, col + '0)');
          c.fillStyle = g; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
        }
      }
      // impact sparks
      for (const sp of sparks) {
        const k = (t - sp.t0) / 300;
        if (k < 0 || k > 1) continue;
        c.strokeStyle = sp.col; c.globalAlpha = 1 - k; c.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + sp.x;
          c.beginPath(); c.moveTo(sp.x + Math.cos(a) * 3 * k * 4, sp.y + Math.sin(a) * 3 * k * 4); c.lineTo(sp.x + Math.cos(a) * 18 * k, sp.y + Math.sin(a) * 18 * k); c.stroke();
        }
      }
      c.globalAlpha = 1;
      // shock waves (skills, titan strikes)
      for (const w of waves) {
        const k = (t - w.t0) / 700;
        if (k < 0 || k > 1) continue;
        c.strokeStyle = w.col; c.globalAlpha = (1 - k) * 0.9; c.lineWidth = 6 * (1 - k) + 1;
        c.beginPath(); c.ellipse(w.x, w.y, 30 + k * 170, (30 + k * 170) * 0.36, 0, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = (1 - k) * 0.25; c.fillStyle = w.col; c.fill();
      }
      c.globalAlpha = 1;
      // floating losses
      c.textAlign = 'center'; c.font = '800 20px Nunito, sans-serif';
      for (const f of floaters) {
        const k = (t - f.t0) / 1100;
        if (k < 0 || k > 1) continue;
        c.globalAlpha = 1 - k * k;
        c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(f.text, f.x, f.y - k * 30);
        c.fillStyle = f.col; c.fillText(f.text, f.x, f.y - k * 30);
      }
      c.globalAlpha = 1;
      // skill / titan banners
      const live = banners.filter((b) => t - b.t0 >= 0 && t - b.t0 < 1400);
      const perSide: [number, number] = [0, 0];
      for (const b of live) {
        const k = (t - b.t0) / 1400;
        const slide = Math.min(1, k * 6) * (k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1);
        const bw = 230, bh = 46;
        const x = b.side === 0 ? -bw + slide * (bw + 12) : W - slide * (bw + 12);
        const y = 12 + perSide[b.side]++ * 52;
        c.globalAlpha = Math.max(0, slide);
        c.fillStyle = 'rgba(10,14,24,.82)'; c.beginPath(); c.roundRect(x, y, bw, bh, 10); c.fill();
        c.strokeStyle = b.col; c.lineWidth = 2; c.stroke();
        if (b.img && b.img.complete && b.img.naturalWidth) { c.save(); c.beginPath(); c.roundRect(x + 4, y + 4, 38, 38, 8); c.clip(); c.drawImage(b.img, x - 2, y + 2, 50, 62); c.restore(); }
        else { c.fillStyle = b.col; c.beginPath(); c.arc(x + 23, y + 23, 14, 0, Math.PI * 2); c.fill(); }
        c.textAlign = 'left'; c.fillStyle = b.col; c.font = '800 15px Nunito, sans-serif'; c.fillText(b.title, x + 50, y + 21);
        c.fillStyle = '#c8ccd8'; c.font = '600 12px Nunito, sans-serif'; c.fillText(b.sub, x + 50, y + 37);
      }
      c.globalAlpha = 1;
    };

    const frame = (now: number) => {
      const o = opts.current;
      const dt = Math.min(100, now - last); last = now;
      if (o.skip) t = total; else t = Math.min(total, t + dt * o.speed);
      const ri = Math.min(rounds.length - 1, Math.floor(t / ROUND_MS));
      while (started < ri) { started++; if (!o.skip) startRound(started); }
      const ai = Math.min(rounds.length - 1, Math.floor((t - ROUND_MS * 0.45) / ROUND_MS));
      while (applied < ai) { applied++; applyRound(applied); }
      draw();
      if (t >= total && !ended) { ended = true; o.onEnd(); }
      if (!ended || t - total < 1000) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [p.r.id]);
  return <canvas ref={ref} class="battle-canvas" style={{ width: '100%', aspectRatio: `${W} / ${H}`, borderRadius: 12, display: 'block', boxShadow: 'inset 0 0 0 1px rgba(232,184,74,.35), 0 6px 18px rgba(0,0,0,.45)' }} />;
}
