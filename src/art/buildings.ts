import type { BuildingId, FactionId } from '../core/types';
import {
  Svg, banner, crystal, flag, groundPad, iso, isoBox, isoCone, isoCylinder, isoGable, isoPyramid, shade, shadowEllipse, tree,
} from './svg';

export interface Pal { roof: string; stone: string; trim: string; wood: string; banner: string; plaster: string; dark: string }

export const PALETTES: Record<FactionId, Pal> = {
  order: { roof: '#3d63b8', stone: '#d2c8b4', trim: '#f0c75a', wood: '#8a6a48', banner: '#3a5aa8', plaster: '#efe6d2', dark: '#4a4238' },
  wild: { roof: '#4d7d3c', stone: '#bdb39a', trim: '#b8e070', wood: '#7a5a38', banner: '#2f7040', plaster: '#e6dcc0', dark: '#3e3a2c' },
  ash: { roof: '#a33c2a', stone: '#948a80', trim: '#ff9a40', wood: '#5e3e2a', banner: '#8a241a', plaster: '#d8c8b8', dark: '#3a302c' },
};

export interface ArtResult { svg: string; w: number; h: number; ax: number; ay: number }

export function tierOf(level: number): number {
  if (level >= 15) return 4;
  if (level >= 10) return 3;
  if (level >= 5) return 2;
  return 1;
}

function frame(w: number, h: number, groundY: number): { s: Svg; cx: number; cy: number; done: () => ArtResult } {
  const s = new Svg(w, h);
  return { s, cx: w / 2, cy: groundY, done: () => ({ svg: s.toString(), w, h, ax: 0.5, ay: groundY / h }) };
}

const P = iso;

// ——————————————————————————————————————————— individual buildings

function citadel(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(470, 440, 370);
  shadowEllipse(s, cx + 10, cy + 6, 170, 62, 0.4);
  groundPad(s, cx, cy, 120, 120, shade(p.stone, -0.15), 8);
  // outer curtain
  const stone = p.stone;
  isoBox(s, cx, cy - 12, 92, 92, 26 + t * 4, shade(stone, -0.05), { pattern: 'brick', trim: t >= 3 ? p.trim : undefined }, 8);
  // corner towers (back two first)
  const towerH = 70 + t * 10;
  const corners: [number, number][] = [[-92, -92], [92, -92], [-92, 92], [92, 92]];
  const back = corners.filter(([x, y]) => x + y < 0 || (x < 0 && y < 0));
  const front = corners.filter((c) => !back.includes(c));
  const drawTower = ([x, y]: [number, number]) => {
    const [tx, ty] = P(cx, cy - 12, x, y, 0);
    const top = isoCylinder(s, tx, ty, 20, towerH, stone, 8, { brick: true, windows: true, crenel: t < 2, trim: t >= 3 ? p.trim : undefined });
    if (t >= 2) {
      const apex = isoCone(s, tx, top, 24, 34 + t * 4, p.roof);
      if (t >= 3) flag(s, tx, apex + 2, 18, p.banner, p.trim, x > 0 ? 1 : -1);
    }
  };
  back.forEach(drawTower);
  // central keep
  const keepH = 92 + t * 16;
  isoBox(s, cx, cy - 12, 52, 52, keepH, shade(p.plaster, -0.08), { pattern: 'brick', windows: { n: 3, rows: t >= 2 ? 2 : 1 }, trim: t >= 2 ? p.trim : undefined }, 34);
  const roofZ = keepH + 34;
  if (t <= 1) {
    isoPyramid(s, cx, cy - 12, 52, 52, roofZ, 50, p.roof, 6);
  } else {
    isoPyramid(s, cx, cy - 12, 52, 52, roofZ, 40, p.roof, 6);
    // spire tower on top
    const [sx, sy] = P(cx, cy - 12, 0, 0, roofZ + 18);
    const top = isoCylinder(s, sx, sy, 15, 30 + t * 8, shade(p.plaster, -0.05), 0, { windows: true, trim: p.trim });
    const apex = isoCone(s, sx, top, 19, 46 + t * 6, p.roof);
    flag(s, sx, apex + 2, 26, p.banner, p.trim);
    if (t >= 4) crystal(s, sx, apex - 30, 18, '#7fe3ff');
  }
  // gate on front-left face
  const [gx, gy] = P(cx, cy - 12, 0, 92, 8);
  s.path(`M${gx - 16},${gy} L${gx - 16},${gy - 24} Q${gx},${gy - 40} ${gx + 16},${gy - 24} L${gx + 16},${gy} Z`, '#2a1a10', `stroke="${shade(stone, -0.5)}" stroke-width="2"`);
  s.path(`M${gx - 12},${gy} L${gx - 12},${gy - 22} Q${gx},${gy - 35} ${gx + 12},${gy - 22} L${gx + 12},${gy} Z`, s.lin([[0, '#6a4428'], [1, '#3a2414']]));
  for (let i = -8; i <= 8; i += 5.3) s.line(gx + i, gy, gx + i, gy - 26 + Math.abs(i) * 0.5, '#2a1a10', 1);
  banner(s, gx - 30, gy - 44, 12, 26, p.banner, p.trim);
  banner(s, gx + 30, gy - 44, 12, 26, p.banner, p.trim);
  front.forEach(drawTower);
  if (t >= 4) { crystal(s, cx - 140, cy - 10, 26, '#7fe3ff'); crystal(s, cx + 140, cy - 4, 22, '#7fe3ff'); }
  return done();
}

function farm(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(260, 230, 170);
  shadowEllipse(s, cx, cy + 4, 110, 40, 0.22);
  // fields
  const field = (fx: number, fy: number, a: number, b: number, col: string) => {
    const pts = [P(fx, fy, -a, -b), P(fx, fy, a, -b), P(fx, fy, a, b), P(fx, fy, -a, b)];
    s.poly(pts, shade('#7a5a30', -0.05), `stroke="#5a4020" stroke-width="1"`);
    for (let i = -a + 4; i < a; i += 6) s.line(...P(fx, fy, i, -b + 2), ...P(fx, fy, i, b - 2), col, 3.2, 'opacity=".95"');
  };
  field(cx - 40, cy + 6, 34, 26, t >= 2 ? '#e8c24a' : '#9cc84a');
  field(cx + 42, cy + 8, 28, 30, '#c8d85a');
  if (t >= 3) field(cx, cy + 34, 30, 18, '#e8c24a');
  // house
  isoBox(s, cx - 6, cy - 22, 26, 20, 26 + t * 3, p.plaster, { windows: { n: 2 }, pattern: 'none' }, 0);
  isoGable(s, cx - 6, cy - 22, 26, 20, 26 + t * 3, 20, p.roof, 4);
  // timber frame lines
  const [bx, by] = P(cx - 6, cy - 22, -26, 20, 0);
  s.line(bx, by - 2, bx, by - 26 - t * 3, p.wood, 2);
  // hay
  const hay = (hx: number, hy: number, r: number) => {
    s.ellipse(hx, hy, r, r * 0.5, 'rgba(0,0,0,.2)');
    s.path(`M${hx - r},${hy} Q${hx - r},${hy - r * 1.6} ${hx},${hy - r * 1.7} Q${hx + r},${hy - r * 1.6} ${hx + r},${hy} Z`, s.lin([[0, '#f6d870'], [1, '#b88a2a']], 0, 0, 1, 0), 'stroke="#8a6a20" stroke-width=".8"');
  };
  hay(cx + 46, cy - 26, 11);
  if (t >= 2) hay(cx + 66, cy - 16, 9);
  // windmill for tier 3+
  if (t >= 3) {
    const [mx, my] = [cx - 70, cy - 30];
    isoCylinder(s, mx, my, 12, 46, p.plaster, 0, { windows: true });
    s.path(`M${mx - 13},${my - 46} L${mx},${my - 66} L${mx + 13},${my - 46} Z`, p.roof);
    s.group(() => {
      for (let i = 0; i < 4; i++) s.add(`<rect x="-3" y="-38" width="6" height="36" fill="#e8dcc0" stroke="#7a5a30" stroke-width=".8" transform="rotate(${i * 90 + 20})"/>`);
      s.circle(0, 0, 3.5, '#5a3a20');
    }, `transform="translate(${mx},${my - 56})"`);
  }
  // fence
  for (let i = -60; i <= 60; i += 10) {
    const [fx, fy] = P(cx, cy, i, 52, 0);
    s.line(fx, fy, fx, fy - 9, p.wood, 2);
  }
  s.line(...P(cx, cy, -60, 52, 6), ...P(cx, cy, 60, 52, 6), p.wood, 1.6);
  return done();
}

function sawmill(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(250, 230, 175);
  shadowEllipse(s, cx, cy + 4, 100, 36, 0.25);
  groundPad(s, cx, cy, 60, 50, '#8a7050', 3);
  isoBox(s, cx - 8, cy - 8, 36, 26, 30 + t * 3, p.wood, { pattern: 'plank', windows: { n: 2 } });
  isoGable(s, cx - 8, cy - 8, 36, 26, 30 + t * 3, 22, shade(p.roof, -0.1), 4);
  // saw blade
  const [bx, by] = P(cx - 8, cy - 8, 36, 0, 18);
  s.circle(bx + 10, by, 13, s.rad([[0, '#e8e8f0'], [1, '#8a8a9a']]), 'stroke="#4a4a5a" stroke-width="1.2"');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    s.poly([[bx + 10 + Math.cos(a) * 13, by + Math.sin(a) * 13], [bx + 10 + Math.cos(a + 0.2) * 16, by + Math.sin(a + 0.2) * 16], [bx + 10 + Math.cos(a + 0.4) * 13, by + Math.sin(a + 0.4) * 13]], '#9a9aaa');
  }
  s.circle(bx + 10, by, 3, '#4a4a5a');
  // log piles
  const logs = (lx: number, ly: number, n: number) => {
    for (let r = 0; r < n; r++) for (let i = 0; i < n - r; i++) {
      const x = lx + i * 11 + r * 5.5, y = ly - r * 9;
      s.add(`<rect x="${x - 18}" y="${y - 5}" width="22" height="10" rx="4" fill="#8a5a32" stroke="#4a2a12" stroke-width=".8"/>`);
      s.ellipse(x + 4, y, 4, 5, '#d8b07a', 'stroke="#6a4020" stroke-width=".8"');
      s.ellipse(x + 4, y, 1.6, 2, '#a07040');
    }
  };
  logs(cx + 30, cy + 26, 3 + (t >= 3 ? 1 : 0));
  if (t >= 2) logs(cx - 70, cy + 18, 2);
  tree(s, cx - 92, cy - 20, 34, 'pine');
  tree(s, cx + 88, cy - 30, 30, 'pine');
  if (t >= 2) tree(s, cx - 60, cy - 46, 38, 'pine');
  return done();
}

function quarry(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(260, 240, 180);
  shadowEllipse(s, cx, cy + 4, 110, 40, 0.25);
  // rock cliff
  const rock = '#9a948a';
  s.path(`M${cx - 100},${cy} L${cx - 80},${cy - 60} L${cx - 40},${cy - 90} L${cx + 10},${cy - 100} L${cx + 50},${cy - 80} L${cx + 90},${cy - 40} L${cx + 100},${cy} Z`, s.lin([[0, shade(rock, 0.25)], [1, shade(rock, -0.3)]], 0, 0, 1, 1), `stroke="${shade(rock, -0.5)}" stroke-width="1.2"`);
  // facets
  s.path(`M${cx - 40},${cy - 90} L${cx - 20},${cy - 40} L${cx - 80},${cy - 60} Z`, shade(rock, 0.1), 'opacity=".7"');
  s.path(`M${cx + 10},${cy - 100} L${cx + 20},${cy - 50} L${cx + 50},${cy - 80} Z`, shade(rock, -0.15), 'opacity=".8"');
  // cut steps
  for (let i = 0; i < 3; i++) isoBox(s, cx - 10 + i * 8, cy - 4 - i * 2, 40 - i * 10, 18, 14, shade(rock, -0.05 + i * 0.05), {}, i * 14);
  // blocks
  const blk = (bx: number, by: number) => isoBox(s, bx, by, 9, 7, 10, '#c8c0b0');
  blk(cx + 56, cy + 14); blk(cx + 72, cy + 20); blk(cx + 64, cy + 6);
  if (t >= 2) { blk(cx - 66, cy + 20); blk(cx - 52, cy + 26); }
  // crane
  const [kx, ky] = [cx + 70, cy - 10];
  s.line(kx, ky, kx, ky - 80, p.wood, 3.5);
  s.line(kx, ky - 78, kx - 50, ky - 64, p.wood, 3);
  s.line(kx - 46, ky - 65, kx - 46, ky - 30, '#3a3a3a', 1);
  isoBox(s, kx - 46, ky - 22, 6, 5, 8, '#c8c0b0');
  if (t >= 3) { isoBox(s, cx - 60, cy - 14, 22, 16, 22, p.plaster, { windows: { n: 1 } }); isoPyramid(s, cx - 60, cy - 14, 22, 16, 22, 16, p.roof); }
  return done();
}

function goldmine(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(250, 230, 175);
  shadowEllipse(s, cx, cy + 4, 100, 38, 0.25);
  const hill = '#7a6a50';
  s.path(`M${cx - 100},${cy + 4} Q${cx - 70},${cy - 90} ${cx},${cy - 96} Q${cx + 70},${cy - 90} ${cx + 100},${cy + 4} Z`, s.lin([[0, shade(hill, 0.2)], [1, shade(hill, -0.35)]], 0, 0, 1, 1), `stroke="${shade(hill, -0.5)}" stroke-width="1.2"`);
  s.path(`M${cx - 60},${cy - 50} q20,-18 40,-10 q-10,12 -40,10z`, '#5a8a3a', 'opacity=".8"');
  // entrance
  s.path(`M${cx - 26},${cy - 6} L${cx - 26},${cy - 40} Q${cx},${cy - 62} ${cx + 26},${cy - 40} L${cx + 26},${cy - 6} Z`, '#1a120a', `stroke="${p.wood}" stroke-width="6"`);
  s.line(cx - 30, cy - 44, cx + 30, cy - 44, p.wood, 6);
  // glow inside
  s.ellipse(cx, cy - 20, 18, 14, s.rad([[0, '#ffd24a', 0.8], [1, '#ffd24a', 0]]));
  // rails
  s.line(cx - 8, cy - 6, cx - 30, cy + 40, '#5a4a3a', 2);
  s.line(cx + 8, cy - 6, cx - 12, cy + 44, '#5a4a3a', 2);
  for (let i = 0; i < 5; i++) s.line(cx - 10 - i * 4.4, cy + 2 + i * 9, cx + 6 - i * 4.2, cy + 2 + i * 9, '#7a5a3a', 2);
  // cart with gold
  const [kx, ky] = [cx - 26, cy + 30];
  isoBox(s, kx, ky, 12, 9, 12, '#6a4a2a', {}, 4);
  for (let i = 0; i < 6; i++) s.circle(kx - 8 + i * 3.6, ky - 16 - (i % 2) * 3, 3.5, s.rad([[0, '#fff3a0'], [1, '#d8a020']]));
  // gold veins
  for (const [gx, gy] of [[cx + 50, cy - 40], [cx - 56, cy - 26], [cx + 30, cy - 70], [cx - 20, cy - 76]]) {
    s.poly([[gx, gy - 6], [gx + 4, gy], [gx, gy + 5], [gx - 4, gy]], '#ffd24a', 'stroke="#a07010" stroke-width=".6"');
  }
  if (t >= 2) { isoBox(s, cx + 62, cy - 8, 18, 14, 20, p.wood, { pattern: 'plank', windows: { n: 1 } }); isoGable(s, cx + 62, cy - 8, 18, 14, 20, 14, p.roof); }
  if (t >= 3) crystal(s, cx + 36, cy - 84, 20, '#ffd24a');
  return done();
}

function militaryHall(kind: 'barracks' | 'stable' | 'range', t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(270, 240, 180);
  shadowEllipse(s, cx, cy + 4, 112, 40, 0.25);
  groundPad(s, cx, cy, 70, 52, '#a08a68', 3);
  if (kind === 'range') {
    // shed
    isoBox(s, cx - 34, cy - 20, 26, 18, 26, p.wood, { pattern: 'plank', windows: { n: 1 } });
    isoGable(s, cx - 34, cy - 20, 26, 18, 26, 16, p.roof, 3);
    // targets
    const target = (tx: number, ty: number) => {
      s.line(tx - 6, ty, tx - 2, ty - 20, p.wood, 2); s.line(tx + 6, ty, tx + 2, ty - 20, p.wood, 2);
      s.ellipse(tx, ty - 24, 11, 12, '#f0e6d0', 'stroke="#5a3a20" stroke-width="1"');
      s.ellipse(tx, ty - 24, 7.5, 8, '#d83a2a');
      s.ellipse(tx, ty - 24, 4, 4.5, '#f0e6d0');
      s.ellipse(tx, ty - 24, 1.8, 2, '#d83a2a');
    };
    target(cx + 40, cy - 10); target(cx + 60, cy + 4); if (t >= 2) target(cx + 20, cy + 20);
    // tower
    const top = isoCylinder(s, cx - 76, cy + 6, 13, 50 + t * 8, p.stone, 0, { brick: true, crenel: true, windows: true });
    if (t >= 2) { const a = isoCone(s, cx - 76, top - 6, 16, 26, p.roof); flag(s, cx - 76, a + 2, 14, p.banner, p.trim); }
    // arrows rack
    for (let i = 0; i < 5; i++) s.line(cx - 8 + i * 3, cy + 26, cx - 6 + i * 3, cy + 6, '#6a4a2a', 1.2);
    return done();
  }
  const long = kind === 'stable';
  const a = long ? 56 : 44, b = long ? 24 : 30, h = 30 + t * 5;
  isoBox(s, cx, cy - 10, a, b, h, kind === 'stable' ? p.wood : p.stone, { pattern: kind === 'stable' ? 'plank' : 'brick', windows: { n: long ? 4 : 3, rows: t >= 3 ? 2 : 1 }, trim: t >= 3 ? p.trim : undefined });
  isoGable(s, cx, cy - 10, a, b, h, 24, p.roof, 4);
  if (kind === 'stable') {
    // stall doors
    for (let i = 0; i < 3; i++) {
      const [dx, dy] = P(cx, cy - 10, -a + 18 + i * 36, b, 0);
      s.path(`M${dx - 7},${dy - 3} l14,7 l0,-18 l-14,-7 z`, '#3a2414');
    }
    // horse
    const hx = cx + 58, hy = cy + 26;
    s.ellipse(hx, hy + 2, 16, 4, 'rgba(0,0,0,.25)');
    s.path(`M${hx - 14},${hy - 14} q2,-8 14,-8 q8,0 12,-8 l4,2 q-2,8 -6,14 l0,14 l-3,0 l0,-10 l-14,0 l0,10 l-3,0 z`, '#7a4a2a', 'stroke="#3a2010" stroke-width=".8"');
    s.path(`M${hx + 12},${hy - 22} l4,-4 l2,3 z`, '#3a2010');
    // hay
    s.path(`M${cx - 80},${cy + 20} q10,-20 24,0 z`, '#e8c050', 'stroke="#a0802a" stroke-width=".7"');
  } else {
    // barracks: banners, weapon rack, dummies
    const [fx, fy] = P(cx, cy - 10, 0, b, 0);
    s.path(`M${fx - 8},${fy + 2} l0,-22 q8,-10 16,0 l0,22 z`, '#2a1a10');
    banner(s, fx - 22, fy - h + 6, 10, 22, p.banner, p.trim);
    banner(s, fx + 22, fy - h + 16, 10, 22, p.banner, p.trim);
    for (const dx of [cx + 66, cx + 84]) {
      const dy = cy + 18 + (dx - cx - 66) * 0.3;
      s.line(dx, dy, dx, dy - 22, p.wood, 2);
      s.line(dx - 8, dy - 16, dx + 8, dy - 16, p.wood, 2);
      s.ellipse(dx, dy - 24, 5, 6, '#c8a870', 'stroke="#6a4a2a" stroke-width=".8"');
    }
    // weapon rack
    s.line(cx - 76, cy + 22, cx - 50, cy + 30, p.wood, 2);
    for (let i = 0; i < 4; i++) s.line(cx - 72 + i * 7, cy + 24 + i * 2, cx - 70 + i * 7, cy + 2 + i * 2, '#b0b0c0', 1.6);
    if (t >= 2) {
      const top = isoCylinder(s, cx - 60, cy - 30, 12, 60 + t * 6, p.stone, 0, { brick: true, windows: true, crenel: t < 3, trim: t >= 3 ? p.trim : undefined });
      if (t >= 3) { const ap = isoCone(s, cx - 60, top, 15, 24, p.roof); flag(s, cx - 60, ap + 2, 14, p.banner, p.trim); }
    }
  }
  return done();
}

function spire(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(220, 400, 350);
  shadowEllipse(s, cx, cy + 4, 70, 26, 0.3);
  groundPad(s, cx, cy, 44, 44, shade(p.stone, -0.2), 5);
  const purple = '#6a4ab8';
  let top = isoCylinder(s, cx, cy - 4, 30, 50, shade(p.stone, -0.1), 5, { brick: true, windows: true });
  top = isoCylinder(s, cx, top, 22, 60 + t * 10, '#4a3a6a', 0, { windows: true, trim: '#c8a2ff' });
  top = isoCylinder(s, cx, top, 16, 30 + t * 6, '#5a4a7a', 0, { trim: '#c8a2ff' });
  const ap = isoCone(s, cx, top, 20, 40, purple);
  // floating crystal & runes
  crystal(s, cx, ap - 14, 28 + t * 3, '#c27bff');
  s.ellipse(cx, cy - 40, 50, 18, 'none', 'stroke="#c27bff" stroke-width="1.4" opacity=".55" stroke-dasharray="4 5"');
  if (t >= 2) {
    for (const [ox, oy] of [[-46, -100], [44, -130]]) crystal(s, cx + ox, cy + oy, 14, '#a8f0ff');
  }
  return done();
}

function academy(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(270, 270, 205);
  shadowEllipse(s, cx, cy + 4, 108, 40, 0.25);
  groundPad(s, cx, cy, 70, 56, shade(p.stone, -0.05), 5);
  isoBox(s, cx, cy - 6, 52, 40, 40 + t * 4, p.plaster, { pattern: 'brick', windows: { n: 4, rows: t >= 2 ? 2 : 1 }, trim: p.trim }, 5);
  // columns front
  for (let i = 0; i < 5; i++) {
    const [x, y] = P(cx, cy - 6, -46 + i * 23, 44, 5);
    s.rect(x - 3, y - 36, 6, 36, s.lin([[0, '#fff'], [1, '#bdb6a6']], 0, 0, 1, 0), 'stroke="#8a8270" stroke-width=".6"');
  }
  const z = 45 + t * 4;
  // dome
  const [dx, dy] = P(cx, cy - 6, 0, 0, z);
  s.ellipse(dx, dy, 44, 22, shade(p.stone, 0.1), `stroke="${shade(p.stone, -0.5)}" stroke-width="1"`);
  s.path(`M${dx - 38},${dy} A38,40 0 0 1 ${dx + 38},${dy} A38,19 0 0 1 ${dx - 38},${dy}`, s.lin([[0, shade(p.roof, 0.35)], [0.5, p.roof], [1, shade(p.roof, -0.45)]], 0, 0, 1, 0), `stroke="${shade(p.roof, -0.6)}" stroke-width="1"`);
  for (let i = -2; i <= 2; i++) s.path(`M${dx + i * 14},${dy + 2} Q${dx + i * 8},${dy - 30} ${dx},${dy - 40}`, 'none', `stroke="${shade(p.roof, -0.4)}" stroke-width=".8" opacity=".6"`);
  s.circle(dx, dy - 42, 5, p.trim);
  if (t >= 2) {
    s.line(dx, dy - 46, dx, dy - 70, '#5a4a3a', 2);
    // armillary
    s.ellipse(dx, dy - 74, 10, 10, 'none', `stroke="${p.trim}" stroke-width="1.6"`);
    s.ellipse(dx, dy - 74, 10, 4, 'none', `stroke="${p.trim}" stroke-width="1.4"`);
    s.circle(dx, dy - 74, 2.6, '#7fe3ff');
  }
  banner(s, cx - 68, cy - 52, 12, 30, p.banner, p.trim);
  return done();
}

function infirmary(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(250, 230, 175);
  shadowEllipse(s, cx, cy + 4, 100, 38, 0.22);
  groundPad(s, cx, cy, 60, 48, '#b0a080', 3);
  isoBox(s, cx - 6, cy - 12, 36, 28, 32 + t * 4, '#efe8dc', { pattern: 'none', windows: { n: 3, rows: t >= 3 ? 2 : 1 }, trim: t >= 2 ? '#d84a3a' : undefined });
  isoGable(s, cx - 6, cy - 12, 36, 28, 32 + t * 4, 22, shade(p.roof, 0.05), 4, true);
  // cross banner
  const [bx, by] = P(cx - 6, cy - 12, 0, 28, 20 + t * 2);
  s.rect(bx - 8, by - 8, 16, 16, '#fff', 'stroke="#c0b8a8" stroke-width=".8"');
  s.rect(bx - 2, by - 6, 4, 12, '#d83a3a'); s.rect(bx - 6, by - 2, 12, 4, '#d83a3a');
  // tents
  const tent = (tx: number, ty: number, col: string) => {
    s.ellipse(tx, ty, 18, 6, 'rgba(0,0,0,.2)');
    s.path(`M${tx - 18},${ty} L${tx},${ty - 24} L${tx + 18},${ty} Z`, s.lin([[0, shade(col, 0.2)], [1, shade(col, -0.25)]], 0, 0, 1, 0), `stroke="${shade(col, -0.5)}" stroke-width=".8"`);
    s.path(`M${tx - 4},${ty} L${tx},${ty - 14} L${tx + 4},${ty} Z`, '#3a2a1a');
  };
  tent(cx + 58, cy + 18, '#e8dcc0');
  if (t >= 2) tent(cx - 62, cy + 22, '#e8dcc0');
  // herbs
  for (let i = 0; i < 6; i++) s.circle(cx + 20 + i * 6, cy + 34 - i * 2, 3.2, i % 2 ? '#5aa84a' : '#7ac85a');
  return done();
}

function tavern(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(250, 260, 195);
  shadowEllipse(s, cx, cy + 4, 96, 36, 0.25);
  groundPad(s, cx, cy, 56, 46, '#9a8060', 3);
  isoBox(s, cx, cy - 8, 38, 30, 28, p.stone, { pattern: 'brick', windows: { n: 2 } });
  isoBox(s, cx, cy - 8, 40, 32, 26 + t * 4, p.plaster, { windows: { n: 3 }, pattern: 'none' }, 28);
  // timber beams
  for (let i = 0; i <= 4; i++) { const [x, y] = P(cx, cy - 8, -40 + i * 20, 32, 28); s.line(x, y, x, y - 26 - t * 4, p.wood, 2.2); }
  for (let i = 0; i <= 3; i++) { const [x, y] = P(cx, cy - 8, 40, 32 - i * 21.3, 28); s.line(x, y, x, y - 26 - t * 4, shade(p.wood, -0.2), 2.2); }
  isoGable(s, cx, cy - 8, 40, 32, 54 + t * 4, 26, p.roof, 5);
  // chimney
  const [chx, chy] = P(cx, cy - 8, -20, -10, 70 + t * 4);
  s.rect(chx - 5, chy - 14, 10, 22, shade(p.stone, -0.2), `stroke="${shade(p.stone, -0.5)}" stroke-width=".8"`);
  // sign
  const [sx, sy] = P(cx, cy - 8, -40, 32, 40);
  s.line(sx - 2, sy, sx - 22, sy + 10, '#3a2a1a', 2);
  s.add(`<rect x="${sx - 32}" y="${sy + 10}" width="20" height="14" rx="2" fill="#7a4a22" stroke="#3a2010" stroke-width="1"/>`);
  s.path(`M${sx - 26},${sy + 13} h8 v6 q-4,4 -8,0 z`, '#ffd27a');
  // barrels
  const barrel = (bx: number, by: number) => {
    s.ellipse(bx, by, 7, 3.5, 'rgba(0,0,0,.25)');
    s.add(`<rect x="${bx - 7}" y="${by - 15}" width="14" height="15" rx="4" fill="#8a5a2a" stroke="#4a2a12" stroke-width=".8"/>`);
    s.line(bx - 7, by - 11, bx + 7, by - 11, '#3a3a3a', 1.2); s.line(bx - 7, by - 4, bx + 7, by - 4, '#3a3a3a', 1.2);
    s.ellipse(bx, by - 15, 7, 2.6, '#a07040');
  };
  barrel(cx + 50, cy + 20); barrel(cx + 64, cy + 14);
  if (t >= 2) { barrel(cx + 56, cy + 30); }
  if (t >= 3) banner(s, cx + 30, cy - 60, 12, 26, p.banner, p.trim);
  return done();
}

function warehouse(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(260, 230, 175);
  shadowEllipse(s, cx, cy + 4, 104, 38, 0.25);
  groundPad(s, cx, cy, 64, 50, '#9a8a70', 3);
  isoBox(s, cx - 4, cy - 10, 48, 32, 32 + t * 4, p.stone, { pattern: 'brick', trim: t >= 3 ? p.trim : undefined });
  isoGable(s, cx - 4, cy - 10, 48, 32, 32 + t * 4, 22, p.roof, 4);
  const [dx, dy] = P(cx - 4, cy - 10, 0, 32, 0);
  s.path(`M${dx - 14},${dy - 6} l28,14 l0,-28 l-28,-14 z`, '#4a2a14', 'stroke="#2a1a0a" stroke-width="1"');
  s.line(dx - 14, dy - 20, dx + 14, dy - 6, '#2a1a0a', 1.2);
  const crate = (x: number, y: number, k = 8) => { isoBox(s, x, y, k, k, k * 1.6, '#b08850', { pattern: 'plank' }); };
  crate(cx + 56, cy + 18); crate(cx + 70, cy + 10); crate(cx + 62, cy + 6, 6);
  crate(cx - 66, cy + 20);
  if (t >= 2) { crate(cx - 52, cy + 28); crate(cx - 58, cy + 14, 6); }
  // sacks
  for (let i = 0; i < 3; i++) s.ellipse(cx + 30 + i * 9, cy + 34 - i * 3, 6, 5, '#d8c8a0', 'stroke="#8a7a5a" stroke-width=".8"');
  return done();
}

function watchtower(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(180, 320, 280);
  shadowEllipse(s, cx, cy + 4, 50, 18, 0.3);
  if (t <= 1) {
    // wooden tower
    for (const [x1, x2] of [[-22, -12], [22, 12]]) s.line(cx + x1, cy, cx + x2, cy - 120, p.wood, 4);
    for (let i = 0; i < 5; i++) { const y = cy - 20 - i * 22; s.line(cx - 20 + i * 1.6, y, cx + 20 - i * 1.6, y - 10, shade(p.wood, -0.2), 2); }
    isoBox(s, cx, cy - 120, 18, 18, 10, p.wood, { pattern: 'plank' });
    isoPyramid(s, cx, cy - 120, 18, 18, 26, 18, p.roof, 2);
  } else {
    const top = isoCylinder(s, cx, cy, 22, 110 + t * 14, p.stone, 0, { brick: true, windows: true, trim: t >= 3 ? p.trim : undefined });
    const top2 = isoCylinder(s, cx, top, 28, 16, shade(p.stone, 0.05), 0, { crenel: true });
    const ap = isoCone(s, cx, top2 - 4, 26, 34, p.roof);
    flag(s, cx, ap + 2, 20, p.banner, p.trim);
  }
  // beacon fire
  const fy = t <= 1 ? cy - 160 : cy - 110 - t * 14 - 30;
  s.ellipse(cx + 26, fy + 8, 16, 16, s.rad([[0, '#ffb040', 0.7], [1, '#ff6020', 0]]));
  s.path(`M${cx + 20},${fy + 12} q6,-18 6,-20 q4,8 6,20 z`, '#ff8a2a');
  return done();
}

function sanctum(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(320, 280, 200);
  shadowEllipse(s, cx, cy + 6, 130, 46, 0.25);
  // circular platform
  for (let i = 0; i < 2; i++) {
    const r = 108 - i * 18, z = i * 10;
    s.ellipse(cx, cy - z + 8, r, r / 2, shade(p.stone, -0.35));
    s.rect(cx - r, cy - z - 2, r * 2, 10, shade(p.stone, -0.3));
    s.ellipse(cx, cy - z - 2, r, r / 2, s.lin([[0, shade(p.stone, 0.15)], [1, shade(p.stone, -0.1)]]), `stroke="${shade(p.stone, -0.5)}" stroke-width="1"`);
  }
  // rune circle
  s.ellipse(cx, cy - 12, 70, 35, 'none', 'stroke="#7fe3ff" stroke-width="2.2" opacity=".85"');
  s.ellipse(cx, cy - 12, 56, 28, 'none', 'stroke="#7fe3ff" stroke-width="1.2" stroke-dasharray="6 4" opacity=".8"');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    s.add(`<text x="${cx + Math.cos(a) * 63}" y="${cy - 12 + Math.sin(a) * 31.5 + 3}" font-size="9" fill="#bff4ff" text-anchor="middle" font-family="serif">${'ᚠᚢᚦᚨᚱᚲᚷᚹ'[i]}</text>`);
  }
  s.ellipse(cx, cy - 12, 50, 25, s.rad([[0, '#7fe3ff', 0.45], [1, '#7fe3ff', 0]]));
  // pillars
  const pillars = 6;
  const back: number[] = [], front: number[] = [];
  for (let i = 0; i < pillars; i++) { const a = (i / pillars) * Math.PI * 2 + 0.3; (Math.sin(a) < 0 ? back : front).push(a); }
  const pillar = (a: number) => {
    const x = cx + Math.cos(a) * 92, y = cy - 6 + Math.sin(a) * 46;
    const top = isoCylinder(s, x, y, 8, 54 + t * 8, p.stone, 0, { brick: true });
    s.ellipse(x, top - 2, 11, 5.5, p.trim);
    crystal(s, x, top - 6, 12, '#7fe3ff', t >= 2);
  };
  back.forEach(pillar);
  // central floating crystal
  crystal(s, cx, cy - 60 - t * 6, 44 + t * 4, '#7fe3ff');
  front.forEach(pillar);
  return done();
}

function wallGate(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(280, 260, 200);
  const stone = t <= 1 ? p.wood : p.stone;
  // two towers + arch
  const tower = (x: number) => {
    if (t <= 1) {
      isoBox(s, x, cy, 16, 16, 64, stone, { pattern: 'plank' });
      isoPyramid(s, x, cy, 16, 16, 64, 20, p.roof, 3);
    } else {
      const top = isoCylinder(s, x, cy, 22, 70 + t * 10, stone, 0, { brick: true, windows: true, crenel: t < 3, trim: t >= 3 ? p.trim : undefined });
      if (t >= 3) { const ap = isoCone(s, x, top, 26, 32, p.roof); flag(s, x, ap + 2, 18, p.banner, p.trim); }
    }
  };
  shadowEllipse(s, cx, cy + 6, 110, 40, 0.3);
  const towerAt = (dx: number) => { const save = cy; tower2(cx + dx, save + dx * 0.5); };
  const tower2 = (x: number, y: number) => {
    if (t <= 1) {
      isoBox(s, x, y, 16, 16, 64, stone, { pattern: 'plank' });
      isoPyramid(s, x, y, 16, 16, 64, 20, p.roof, 3);
    } else {
      const top = isoCylinder(s, x, y, 22, 70 + t * 10, stone, 0, { brick: true, windows: true, crenel: t < 3, trim: t >= 3 ? p.trim : undefined });
      if (t >= 3) { const ap = isoCone(s, x, top, 26, 32, p.roof); flag(s, x, ap + 2, 18, p.banner, p.trim); }
    }
  };
  void tower;
  towerAt(-62);
  // gatehouse
  isoBox(s, cx, cy - 4, 40, 18, 52 + t * 6, stone, { pattern: t <= 1 ? 'plank' : 'brick', trim: t >= 3 ? p.trim : undefined });
  const [gx, gy] = P(cx, cy - 4, 0, 18, 0);
  s.path(`M${gx - 18},${gy + 9} L${gx - 18},${gy - 22} Q${gx},${gy - 46} ${gx + 18},${gy - 18} L${gx + 18},${gy + 9} Z`, '#1e140c');
  for (let i = -14; i <= 14; i += 7) s.line(gx + i, gy + 6 + i * 0.3, gx + i, gy - 24 + Math.abs(i) * 0.4, '#5a5a62', 1.6);
  for (let k = 0; k < 3; k++) s.line(gx - 16, gy - 14 + k * 9, gx + 16, gy - 6 + k * 9, '#5a5a62', 1.2);
  if (t >= 2) banner(s, gx, gy - 66 - t * 6, 16, 30, p.banner, p.trim);
  towerAt(62);
  return done();
}

function forge(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(270, 260, 195);
  shadowEllipse(s, cx, cy + 4, 108, 40, 0.28);
  groundPad(s, cx, cy, 66, 52, '#7a6a58', 4);
  // main smithy
  const h = 34 + t * 4;
  isoBox(s, cx - 10, cy - 12, 40, 30, h, t <= 1 ? p.wood : p.stone, { pattern: t <= 1 ? 'plank' : 'brick', trim: t >= 3 ? p.trim : undefined });
  isoGable(s, cx - 10, cy - 12, 40, 30, h, 22, shade(p.roof, -0.15), 4);
  // open forge mouth with fire on the front face
  const [fx, fy] = iso(cx - 10, cy - 12, 4, 30, 0);
  const fire = t >= 4 ? '#7fe3ff' : '#ff8a2a';
  s.path(`M${fx - 16},${fy + 8} L${fx - 16},${fy - 18} Q${fx},${fy - 32} ${fx + 16},${fy - 10} L${fx + 16},${fy + 16} Z`, '#1a0e08');
  s.ellipse(fx, fy, 22, 16, s.rad([[0, fire, 0.95], [0.5, fire, 0.5], [1, fire, 0]]));
  s.path(`M${fx - 8},${fy + 8} q4,-16 8,-20 q4,10 8,22 z`, t >= 4 ? '#d8faff' : '#ffd36a');
  // chimney
  const [chx, chy] = iso(cx - 10, cy - 12, -24, -6, h + 16);
  isoBox(s, chx, chy + 26, 7, 7, 30 + t * 4, shade(p.stone, -0.2), { pattern: 'brick' });
  s.ellipse(chx, chy - 8 - t * 4, 9, 6, s.rad([[0, fire, 0.7], [1, fire, 0]]));
  if (t >= 2) {
    const [c2x, c2y] = iso(cx - 10, cy - 12, 22, -10, h + 12);
    isoBox(s, c2x, c2y + 24, 6, 6, 26, shade(p.stone, -0.25), { pattern: 'brick' });
  }
  // anvil
  const ax = cx + 52, ay = cy + 14;
  s.ellipse(ax, ay + 2, 16, 5, 'rgba(0,0,0,.3)');
  s.rect(ax - 5, ay - 10, 10, 12, '#4a3a2a');
  s.path(`M${ax - 16},${ay - 10} L${ax + 14},${ay - 10} L${ax + 20},${ay - 16} L${ax - 12},${ay - 16} Z`, s.lin([[0, '#c8ccd8'], [1, '#5a5e6a']]), 'stroke="#20242c" stroke-width="1"');
  s.line(ax + 4, ay - 18, ax + 16, ay - 30, '#6a4a2a', 2.4);
  s.rect(ax + 12, ay - 36, 10, 7, '#8a8e9a', 'transform="rotate(-35 ' + (ax + 17) + ' ' + (ay - 32) + ')"');
  // weapon rack
  s.line(cx - 78, cy + 20, cx - 52, cy + 30, p.wood, 2.4);
  for (let i = 0; i < 4; i++) s.line(cx - 74 + i * 7, cy + 22 + i * 2.4, cx - 72 + i * 7, cy - 4 + i * 2.4, i % 2 ? '#c8ccd8' : '#9aa0aa', 2);
  // quench barrel
  s.ellipse(cx + 20, cy + 34, 8, 3.5, 'rgba(0,0,0,.25)');
  s.add(`<rect x="${cx + 12}" y="${cy + 18}" width="16" height="16" rx="4" fill="#7a4a22" stroke="#3a2010" stroke-width=".8"/>`);
  s.ellipse(cx + 20, cy + 18, 8, 3, '#3a7ab8');
  if (t >= 3) banner(s, cx - 30, cy - h - 10, 12, 24, p.banner, p.trim);
  if (t >= 4) crystal(s, cx + 70, cy - 10, 18, '#7fe3ff');
  return done();
}

/** Embassy: council hall with a round tower and banners of the allied houses. */
function embassy(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(280, 280, 210);
  shadowEllipse(s, cx, cy + 4, 112, 42, 0.25);
  groundPad(s, cx, cy, 70, 56, shade(p.stone, -0.08), 5);
  // plaza flagstones
  s.ellipse(cx + 34, cy + 22, 34, 14, shade(p.stone, 0.12), `stroke="${shade(p.stone, -0.35)}" stroke-width=".8"`);
  // tower behind the hall
  const [tx, ty] = iso(cx - 6, cy - 14, -26, -18, 0);
  const top = isoCylinder(s, tx, ty, 13, 62 + t * 8, p.stone, 0, { brick: true, windows: true, crenel: t >= 3, trim: t >= 2 ? p.trim : undefined });
  if (t < 3) isoCone(s, tx, top, 15, 26, p.roof);
  flag(s, tx, t < 3 ? top - 26 : top - 6, 22, p.banner, p.trim);
  // hall
  const h = 30 + t * 4;
  isoBox(s, cx - 6, cy - 14, 44, 30, h, p.plaster, { pattern: 'none', windows: { n: 3, rows: t >= 3 ? 2 : 1 }, trim: p.trim });
  isoGable(s, cx - 6, cy - 14, 44, 30, h, 24, p.roof, 4);
  // gate arch on the front face
  const [gx, gy] = iso(cx - 6, cy - 14, 0, 30, 0);
  s.path(`M${gx - 8},${gy + 4} L${gx - 8},${gy - 12} Q${gx},${gy - 22} ${gx + 8},${gy - 8} L${gx + 8},${gy + 8} Z`, '#2a1d14', `stroke="${p.trim}" stroke-width="1.4"`);
  // allied house banners on poles along the plaza
  const houses = ['#c84a3a', '#3a7ad8', '#4aa85a', '#d8a83a', '#8a4ad8', '#3ab8b8'];
  const n = 2 + t;
  for (let i = 0; i < n; i++) {
    const bx = cx + 6 + i * 14, by = cy + 30 - i * 7;
    s.line(bx, by, bx, by - 40, '#3a2a1a', 2);
    s.circle(bx, by - 41, 2, p.trim);
    banner(s, bx + 6, by - 38, 10, 20, houses[i % houses.length], '#f0e6c8');
  }
  // round council table / fountain in the plaza
  s.ellipse(cx + 34, cy + 20, 12, 6, shade(p.stone, -0.2), `stroke="${shade(p.stone, -0.5)}" stroke-width=".8"`);
  s.ellipse(cx + 34, cy + 18, 9, 4.4, t >= 4 ? '#7fe3ff' : '#5a9ad8');
  if (t >= 4) crystal(s, cx + 34, cy + 14, 14, '#7fe3ff');
  if (t >= 2) banner(s, cx - 66, cy - 44, 12, 28, p.banner, p.trim);
  return done();
}

/** Wall segment along an iso axis — used for the ring around the city. */
export function wallSegment(t: number, p: Pal, len: number, axis: 'x' | 'y'): ArtResult {
  const h = t <= 1 ? 34 : 40 + t * 4;
  const w = Math.ceil(len * 1.1 + 40), H = Math.ceil(len * 0.55 + h + 50);
  const s = new Svg(w, H);
  const cx = w / 2, cy = H - len * 0.275 - 16;
  const stone = t <= 1 ? p.wood : p.stone;
  const a = axis === 'x' ? len / 2 : 7, b = axis === 'y' ? len / 2 : 7;
  if (t <= 1) {
    // palisade stakes
    const n = Math.round(len / 7);
    for (let i = 0; i <= n; i++) {
      const f = -len / 2 + (i / n) * len;
      const [x, y] = axis === 'x' ? iso(cx, cy, f, 0) : iso(cx, cy, 0, f);
      s.path(`M${x - 3.5},${y} L${x - 3.5},${y - h} L${x},${y - h - 7} L${x + 3.5},${y - h} L${x + 3.5},${y} Z`, s.lin([[0, shade(stone, 0.1)], [1, shade(stone, -0.35)]], 0, 0, 1, 0), `stroke="${shade(stone, -0.55)}" stroke-width=".7"`);
    }
    s.line(...(axis === 'x' ? iso(cx, cy, -len / 2, 0, h * 0.4) : iso(cx, cy, 0, -len / 2, h * 0.4)), ...(axis === 'x' ? iso(cx, cy, len / 2, 0, h * 0.4) : iso(cx, cy, 0, len / 2, h * 0.4)), shade(stone, -0.4), 2.5);
  } else {
    isoBox(s, cx, cy, a, b, h, stone, { pattern: 'brick', trim: t >= 3 ? p.trim : undefined });
    // crenellations
    const n = Math.round(len / 14);
    for (let i = 0; i < n; i++) {
      const f = -len / 2 + ((i + 0.5) / n) * len;
      if (axis === 'x') isoBox(s, ...iso(cx, cy, f, 0), 4, 7, 7, shade(stone, 0.05), {}, h);
      else isoBox(s, ...iso(cx, cy, 0, f), 7, 4, 7, shade(stone, 0.05), {}, h);
    }
  }
  return { svg: s.toString(), w, h: H, ax: 0.5, ay: cy / H };
}

export function wallTower(t: number, p: Pal): ArtResult {
  const { s, cx, cy, done } = frame(90, 200, 180);
  const stone = t <= 1 ? p.wood : p.stone;
  shadowEllipse(s, cx, cy + 4, 30, 12, 0.3);
  if (t <= 1) {
    isoBox(s, cx, cy, 12, 12, 52, stone, { pattern: 'plank' });
    isoPyramid(s, cx, cy, 12, 12, 52, 18, p.roof, 2);
  } else {
    const top = isoCylinder(s, cx, cy, 16, 62 + t * 8, stone, 0, { brick: true, windows: true, crenel: t < 3, trim: t >= 3 ? p.trim : undefined });
    if (t >= 3) isoCone(s, cx, top, 19, 26, p.roof);
  }
  return done();
}

export function constructionSite(size: number): ArtResult {
  const { s, cx, cy, done } = frame(220, 200, 150);
  const a = 40 * size;
  groundPad(s, cx, cy, a, a * 0.8, '#9a8462', 3);
  // scaffolding
  const wood = '#a07a4a';
  const poles: [number, number][] = [[-a + 8, a * 0.8 - 8], [a - 8, a * 0.8 - 8], [a - 8, -a * 0.8 + 8], [-a + 8, -a * 0.8 + 8]];
  for (const [x, y] of poles) { const [px, py] = iso(cx, cy, x, y); s.line(px, py, px, py - 56, wood, 3); }
  for (const z of [20, 40]) {
    const pts = poles.map(([x, y]) => iso(cx, cy, x, y, z));
    s.add(`<polyline points="${[...pts, pts[0]].map((q) => q.join(',')).join(' ')}" fill="none" stroke="${wood}" stroke-width="2.2"/>`);
  }
  isoBox(s, cx, cy, a * 0.55, a * 0.45, 16, '#c8bca0', { pattern: 'brick' });
  // stone pile + crane rope
  isoBox(s, cx + a * 0.9, cy + 10, 7, 6, 8, '#c8c0b0');
  s.line(cx - 10, cy - 70, cx - 10, cy - 30, '#3a3a3a', 1);
  return done();
}

export function buildingArt(type: BuildingId, level: number, faction: FactionId): ArtResult {
  const t = tierOf(level);
  const p = PALETTES[faction];
  switch (type) {
    case 'citadel': return citadel(t, p);
    case 'farm': return farm(t, p);
    case 'sawmill': return sawmill(t, p);
    case 'quarry': return quarry(t, p);
    case 'goldmine': return goldmine(t, p);
    case 'barracks': return militaryHall('barracks', t, p);
    case 'stable': return militaryHall('stable', t, p);
    case 'range': return militaryHall('range', t, p);
    case 'spire': return spire(t, p);
    case 'academy': return academy(t, p);
    case 'infirmary': return infirmary(t, p);
    case 'tavern': return tavern(t, p);
    case 'warehouse': return warehouse(t, p);
    case 'wall': return wallGate(t, p);
    case 'watchtower': return watchtower(t, p);
    case 'sanctum': return sanctum(t, p);
    case 'forge': return forge(t, p);
    case 'embassy': return embassy(t, p);
  }
}
