import { fbm, hash2 } from '../core/rng';

export const enum T {
  Deep = 0, Shallow = 1, Sand = 2, Grass = 3, Forest = 4, Hills = 5, Mountain = 6, Snow = 7, Ash = 8, Swamp = 9, Meadow = 10,
}

export const TERRAIN_NAME = ['Глубокие воды', 'Мелководье', 'Побережье', 'Равнина', 'Лес', 'Холмы', 'Горы', 'Ледяные пики', 'Пепельные пустоши', 'Топи Пустоты', 'Цветущий луг'];
export const MOVE_COST = [Infinity, Infinity, 1.1, 1, 1.3, 1.5, Infinity, Infinity, 1.2, 1.6, 1];

export interface Terrain {
  size: number;
  seed: number;
  t: Uint8Array;
  h: Float32Array;
  start: { x: number; y: number };
  reach: Uint8Array; // 1 if reachable from start
}

export const WORLD_SIZE = 128;

export function passable(tt: number): boolean { return MOVE_COST[tt] < Infinity; }

/** Ash region center (far north-east) and corrupted swamp region (east). */
function regions(size: number) {
  return {
    ash: { x: size * 0.8, y: size * 0.2, r: size * 0.22 },
    swamp: { x: size * 0.78, y: size * 0.7, r: size * 0.16 },
    peaks: { x: size * 0.42, y: size * 0.3, r: size * 0.12 },
  };
}

export function generateTerrain(seed: number, size = WORLD_SIZE): Terrain {
  const t = new Uint8Array(size * size);
  const h = new Float32Array(size * size);
  const R = regions(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size - 0.5, ny = y / size - 0.5;
      const d = Math.sqrt(nx * nx + ny * ny) * 2; // 0 center, ~1.4 corners
      let e = fbm(x / 26, y / 26, seed, 5);
      e = e * 1.15 - Math.pow(Math.max(0, d - 0.55), 1.6) * 1.4 + 0.08;
      // central peaks range for the storm titan
      const pd = Math.hypot(x - R.peaks.x, y - R.peaks.y) / R.peaks.r;
      if (pd < 1) e += (1 - pd) * 0.22;
      const ridge = 1 - Math.abs(fbm(x / 18, y / 18, seed + 7, 3) * 2 - 1);
      e += Math.pow(ridge, 6) * 0.18;
      h[y * size + x] = e;
      const m = fbm(x / 20, y / 20, seed + 33, 4);
      const ad = Math.hypot(x - R.ash.x, y - R.ash.y) / R.ash.r;
      const sd = Math.hypot(x - R.swamp.x, y - R.swamp.y) / R.swamp.r;
      let tt: T;
      if (e < 0.33) tt = T.Deep;
      else if (e < 0.39) tt = T.Shallow;
      else if (e < 0.415) tt = ad < 1 ? T.Ash : T.Sand;
      else if (e < 0.69) {
        if (ad < 1 + (hash2(x, y, seed) - 0.5) * 0.2) tt = T.Ash;
        else if (sd < 1 + (hash2(x, y, seed + 1) - 0.5) * 0.25) tt = m > 0.5 ? T.Swamp : T.Forest;
        else if (m > 0.56) tt = T.Forest;
        else if (m < 0.36 && e < 0.55) tt = T.Meadow;
        else tt = T.Grass;
      } else if (e < 0.77) tt = T.Hills;
      else if (e < 0.86) tt = T.Mountain;
      else tt = T.Snow;
      t[y * size + x] = tt;
    }
  }
  const start = findStart(t, size);
  // carve a small clearing around start
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const xx = start.x + dx, yy = start.y + dy;
    if (dx * dx + dy * dy <= 9) {
      const i = yy * size + xx;
      if (!passable(t[i]) || t[i] === T.Swamp) t[i] = T.Grass;
    }
  }
  const reach = flood(t, size, start);
  return { size, seed, t, h, start, reach };
}

function findStart(t: Uint8Array, size: number) {
  const cx = Math.round(size * 0.3), cy = Math.round(size * 0.68);
  for (let r = 0; r < size / 2; r++) {
    for (let a = 0; a < 16; a++) {
      const x = Math.round(cx + Math.cos(a / 16 * Math.PI * 2) * r);
      const y = Math.round(cy + Math.sin(a / 16 * Math.PI * 2) * r);
      if (x < 6 || y < 6 || x >= size - 6 || y >= size - 6) continue;
      let ok = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const tt = t[(y + dy) * size + x + dx];
        if (tt === T.Grass || tt === T.Meadow || tt === T.Forest) ok++;
      }
      if (ok >= 42) return { x, y };
    }
  }
  return { x: cx, y: cy };
}

function flood(t: Uint8Array, size: number, s: { x: number; y: number }): Uint8Array {
  const reach = new Uint8Array(size * size);
  const q = [s.y * size + s.x];
  reach[q[0]] = 1;
  while (q.length) {
    const i = q.pop()!;
    const x = i % size, y = (i / size) | 0;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of nb) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const j = ny * size + nx;
      if (!reach[j] && passable(t[j])) { reach[j] = 1; q.push(j); }
    }
  }
  return reach;
}

/** A* over 8-neighborhood with terrain costs. Returns tile path including start and goal. */
export function findPath(ter: Terrain, sx: number, sy: number, gx: number, gy: number, maxNodes = 40000): { x: number; y: number }[] | null {
  const size = ter.size;
  sx = Math.round(sx); sy = Math.round(sy);
  if (gx < 0 || gy < 0 || gx >= size || gy >= size) return null;
  const goal = gy * size + gx;
  if (!passable(ter.t[goal])) return null;
  const start = sy * size + sx;
  const g = new Float32Array(size * size).fill(Infinity);
  const came = new Int32Array(size * size).fill(-1);
  const closed = new Uint8Array(size * size);
  // binary heap
  const heap: number[] = [];
  const f = new Float32Array(size * size).fill(Infinity);
  const push = (i: number) => {
    heap.push(i);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (f[heap[p]] <= f[heap[c]]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1, r = l + 1;
        let m = c;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };
  const hfn = (i: number) => {
    const x = i % size, y = (i / size) | 0;
    const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
    return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy));
  };
  g[start] = 0;
  f[start] = hfn(start);
  push(start);
  let n = 0;
  while (heap.length && n++ < maxNodes) {
    const cur = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const x = cur % size, y = (cur / size) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const j = ny * size + nx;
      const c = MOVE_COST[ter.t[j]];
      if (c === Infinity || closed[j]) continue;
      if (dx && dy && (!passable(ter.t[y * size + nx]) || !passable(ter.t[ny * size + x]))) continue; // no corner cutting
      const ng = g[cur] + c * (dx && dy ? Math.SQRT2 : 1);
      if (ng < g[j]) {
        g[j] = ng; came[j] = cur; f[j] = ng + hfn(j);
        push(j);
      }
    }
  }
  if (came[goal] === -1 && goal !== start) return null;
  const out: { x: number; y: number }[] = [];
  let c = goal;
  while (c !== -1) {
    out.push({ x: c % size, y: (c / size) | 0 });
    if (c === start) break;
    c = came[c];
  }
  out.reverse();
  return simplify(ter, out);
}

/** Drop intermediate nodes on straight runs to make marches look smooth. */
function simplify(_ter: Terrain, p: { x: number; y: number }[]) {
  if (p.length < 3) return p;
  const out = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const a = out[out.length - 1], b = p[i], c = p[i + 1];
    const d1x = Math.sign(b.x - a.x), d1y = Math.sign(b.y - a.y);
    const d2x = Math.sign(c.x - b.x), d2y = Math.sign(c.y - b.y);
    if (d1x !== d2x || d1y !== d2y) out.push(b);
  }
  out.push(p[p.length - 1]);
  return out;
}

export function pathLength(ter: Terrain, p: { x: number; y: number }[]): number {
  let L = 0;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    // average terrain cost along segment
    let c = 0;
    for (let s = 1; s <= steps; s++) {
      const x = Math.round(a.x + (b.x - a.x) * s / steps), y = Math.round(a.y + (b.y - a.y) * s / steps);
      c += MOVE_COST[ter.t[y * ter.size + x]] || 1;
    }
    L += dist * (steps ? c / steps : 1);
  }
  return L;
}

let cached: Terrain | null = null;
export function getTerrain(seed: number): Terrain {
  if (!cached || cached.seed !== seed) cached = generateTerrain(seed);
  return cached;
}
