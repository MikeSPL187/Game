import { mulberry32, randInt } from '../core/rng';
import type { AiLord, Res, WorldObject } from '../core/types';
import { LORD_NAMES, TITANS, nodeAmount } from '../data/world';
import { campTroops } from '../data/world';
import { getTerrain, passable, T, type Terrain } from './terrain';

export const TARGET_COUNTS = { camp: 70, node: 80, ruin: 22, rift: 4 };

export function distFromStart(ter: Terrain, x: number, y: number): number {
  return Math.hypot(x - ter.start.x, y - ter.start.y);
}

/** Difficulty level by distance from the player's start. */
export function zoneLevel(ter: Terrain, x: number, y: number): number {
  const d = distFromStart(ter, x, y);
  return Math.max(1, Math.min(25, Math.round(1 + Math.pow(d / 4.2, 1.12))));
}

export function isFree(ter: Terrain, objs: WorldObject[], x: number, y: number, spacing = 2): boolean {
  if (x < 2 || y < 2 || x >= ter.size - 2 || y >= ter.size - 2) return false;
  const i = y * ter.size + x;
  if (!ter.reach[i] || !passable(ter.t[i])) return false;
  for (const o of objs) {
    const sp = o.kind === 'city' || o.kind === 'lord' || o.kind === 'titan' ? spacing + 2 : spacing;
    if (Math.abs(o.x - x) <= sp && Math.abs(o.y - y) <= sp) return false;
  }
  return true;
}

export function randomFreeTile(ter: Terrain, objs: WorldObject[], rnd: () => number, near?: { x: number; y: number; r: number; min?: number }): { x: number; y: number } | null {
  for (let i = 0; i < 400; i++) {
    let x: number, y: number;
    if (near) {
      const a = rnd() * Math.PI * 2;
      const r = (near.min ?? 0) + rnd() * (near.r - (near.min ?? 0));
      x = Math.round(near.x + Math.cos(a) * r);
      y = Math.round(near.y + Math.sin(a) * r);
    } else {
      x = randInt(rnd, 3, ter.size - 4);
      y = randInt(rnd, 3, ter.size - 4);
    }
    if (isFree(ter, objs, x, y)) return { x, y };
  }
  return null;
}

const RES_BY_TERRAIN: Partial<Record<number, Res[]>> = {
  [T.Forest]: ['wood', 'wood', 'food'],
  [T.Grass]: ['food', 'food', 'wood', 'stone'],
  [T.Meadow]: ['food', 'food', 'gold'],
  [T.Hills]: ['stone', 'stone', 'gold'],
  [T.Sand]: ['stone', 'gold'],
  [T.Ash]: ['gold', 'stone'],
  [T.Swamp]: ['wood', 'gold'],
};

export function makeNode(ter: Terrain, id: number, x: number, y: number, rnd: () => number): WorldObject {
  const opts = RES_BY_TERRAIN[ter.t[y * ter.size + x]] ?? ['food', 'wood'];
  const res = opts[Math.floor(rnd() * opts.length)];
  const lvl = Math.max(1, Math.min(8, Math.round(zoneLevel(ter, x, y) / 3 + rnd() * 1.5)));
  const amt = nodeAmount(lvl, res);
  return { id, kind: 'node', x, y, level: lvl, res, amount: amt, max: amt, occupant: null, variant: Math.floor(rnd() * 3) };
}

export function makeCamp(ter: Terrain, id: number, x: number, y: number, rnd: () => number): WorldObject {
  const lvl = Math.max(1, Math.min(25, zoneLevel(ter, x, y) + randInt(rnd, -1, 1)));
  return { id, kind: 'camp', x, y, level: lvl, variant: Math.floor(rnd() * 3) };
}

export function generateWorld(seed: number): { objects: WorldObject[]; lords: AiLord[]; nextId: number; ter: Terrain } {
  const ter = getTerrain(seed);
  const rnd = mulberry32(seed ^ 0x9e3779b9);
  const objs: WorldObject[] = [];
  let id = 1;
  objs.push({ id: id++, kind: 'city', x: ter.start.x, y: ter.start.y, level: 1 });

  // Titans at fixed narrative distances
  const titanSpots = [
    { t: TITANS[0], d: 22, prefer: [T.Hills, T.Grass, T.Meadow] },
    { t: TITANS[1], d: 48, prefer: [T.Hills, T.Sand, T.Grass] },
    { t: TITANS[2], d: 80, prefer: [T.Ash] },
  ];
  for (const ts of titanSpots) {
    let best: { x: number; y: number; score: number } | null = null;
    for (let i = 0; i < 3000; i++) {
      const x = randInt(rnd, 4, ter.size - 5), y = randInt(rnd, 4, ter.size - 5);
      if (!isFree(ter, objs, x, y, 4)) continue;
      const d = distFromStart(ter, x, y);
      const tt = ter.t[y * ter.size + x];
      const score = -Math.abs(d - ts.d) + (ts.prefer.includes(tt) ? 6 : 0);
      if (!best || score > best.score) best = { x, y, score };
    }
    if (best) objs.push({ id: id++, kind: 'titan', x: best.x, y: best.y, level: ts.t.level, titanId: ts.t.id, hp: 1 });
  }

  // AI lords — spread out at increasing distance
  const lords: AiLord[] = [];
  const lordDist = [20, 30, 42, 55, 68, 82];
  LORD_NAMES.forEach((ln, i) => {
    let best: { x: number; y: number; score: number } | null = null;
    for (let k = 0; k < 2500; k++) {
      const x = randInt(rnd, 5, ter.size - 6), y = randInt(rnd, 5, ter.size - 6);
      if (!isFree(ter, objs, x, y, 6)) continue;
      const d = distFromStart(ter, x, y);
      const minOther = Math.min(99, ...objs.filter((o) => o.kind === 'lord').map((o) => Math.hypot(o.x - x, o.y - y)));
      const score = -Math.abs(d - lordDist[i]) + Math.min(minOther, 25) * 0.3;
      if (!best || score > best.score) best = { x, y, score };
    }
    if (!best) return;
    const objId = id++;
    const citadel = Math.min(22, 3 + i * 3 + randInt(rnd, 0, 1));
    objs.push({ id: objId, kind: 'lord', x: best.x, y: best.y, level: citadel, lordId: 'lord' + i });
    lords.push({
      id: 'lord' + i, name: ln.name, faction: ln.faction, color: ln.color, objId, citadel,
      power: 0, troops: {}, heroLevel: 5 + citadel * 2, nextRaidAt: 0, defeats: 0, wallHp: 1, lastGrow: 0,
      attitude: 'hostile',
    });
  });

  // Rifts, ruins, camps, nodes
  for (let i = 0; i < TARGET_COUNTS.rift; i++) {
    const p = randomFreeTile(ter, objs, rnd, { x: ter.start.x, y: ter.start.y, r: 90, min: 26 });
    if (p) objs.push({ id: id++, kind: 'rift', x: p.x, y: p.y, level: Math.min(25, zoneLevel(ter, p.x, p.y) + 2), hp: 1 });
  }
  for (let i = 0; i < TARGET_COUNTS.ruin; i++) {
    const p = randomFreeTile(ter, objs, rnd, i < 5 ? { x: ter.start.x, y: ter.start.y, r: 14, min: 4 } : undefined);
    if (p) objs.push({ id: id++, kind: 'ruin', x: p.x, y: p.y, level: zoneLevel(ter, p.x, p.y), variant: Math.floor(rnd() * 3) });
  }
  // guaranteed easy content near start
  for (let i = 0; i < 6; i++) {
    const p = randomFreeTile(ter, objs, rnd, { x: ter.start.x, y: ter.start.y, r: 9, min: 4 });
    if (p) { const c = makeCamp(ter, id++, p.x, p.y, rnd); c.level = 1 + Math.floor(i / 2); objs.push(c); }
  }
  for (let i = 0; i < 6; i++) {
    const p = randomFreeTile(ter, objs, rnd, { x: ter.start.x, y: ter.start.y, r: 10, min: 4 });
    if (p) { const n = makeNode(ter, id++, p.x, p.y, rnd); n.level = 1; n.res = (['food', 'wood', 'stone', 'food', 'wood', 'gold'] as Res[])[i]; n.amount = n.max = nodeAmount(1, n.res); objs.push(n); }
  }
  while (objs.filter((o) => o.kind === 'camp').length < TARGET_COUNTS.camp) {
    const p = randomFreeTile(ter, objs, rnd);
    if (!p) break;
    objs.push(makeCamp(ter, id++, p.x, p.y, rnd));
  }
  while (objs.filter((o) => o.kind === 'node').length < TARGET_COUNTS.node) {
    const p = randomFreeTile(ter, objs, rnd);
    if (!p) break;
    objs.push(makeNode(ter, id++, p.x, p.y, rnd));
  }
  return { objects: objs, lords, nextId: id, ter };
}

export function lordTroops(citadel: number, rnd: () => number) {
  const tier = citadel >= 18 ? 4 : citadel >= 11 ? 3 : citadel >= 5 ? 2 : 1;
  const base = campTroops(Math.min(25, citadel + 2));
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(base)) out[k.slice(0, 3) + tier] = Math.round(v! * (1.6 + rnd() * 0.4));
  return out;
}

/** Fog helpers: fog array holds 0 = hidden, 1 = explored */
export function reveal(fog: Uint8Array, size: number, cx: number, cy: number, r: number): boolean {
  let changed = false;
  const r2 = r * r;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(size - 1, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(size - 1, Math.ceil(cx + r)); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        const i = y * size + x;
        if (!fog[i]) { fog[i] = 1; changed = true; }
      }
    }
  }
  return changed;
}

export function encodeFog(f: Uint8Array): string {
  // run-length encode as base36 pairs
  const out: string[] = [];
  let cur = f[0], run = 0;
  for (let i = 0; i < f.length; i++) {
    if (f[i] === cur) run++;
    else { out.push(cur + ':' + run.toString(36)); cur = f[i]; run = 1; }
  }
  out.push(cur + ':' + run.toString(36));
  return out.join(',');
}

export function decodeFog(s: string, size: number): Uint8Array {
  const f = new Uint8Array(size * size);
  if (!s) return f;
  let i = 0;
  for (const part of s.split(',')) {
    const [v, r] = part.split(':');
    const n = parseInt(r, 36);
    f.fill(Number(v), i, i + n);
    i += n;
  }
  return f;
}
