import { texAt, type TexData } from './textures';
import { hash2, noiseTile } from '../core/rng';
import { CITY_CENTER, CITY_H, CITY_W, GATE, PLOTS, WALL_RX, WALL_RY } from '../data/cityLayout';

export type Pt = { x: number; y: number };

export const ROADS: Pt[][] = [
  [GATE, { x: 900, y: 1060 }, { x: 640, y: 1150 }, { x: 430, y: 1060 }, { x: 260, y: 1180 }],
  [{ x: 640, y: 1150 }, { x: 520, y: 1320 }],
  [GATE, { x: 1080, y: 1200 }, { x: 1250, y: 1390 }, { x: 1400, y: 1500 }],
  [{ x: 1400, y: 1500 }, { x: 1700, y: 1420 }, { x: 2000, y: 1290 }, { x: 2280, y: 1170 }, { x: 2480, y: 940 }, { x: 2600, y: 1070 }],
  [{ x: 2480, y: 940 }, { x: 2380, y: 760 }, { x: 2200, y: 640 }, { x: 2050, y: 620 }, { x: 1900, y: 520 }],
  [{ x: 2380, y: 760 }, { x: 2560, y: 680 }],
  [{ x: 430, y: 1060 }, { x: 380, y: 880 }, { x: 520, y: 800 }, { x: 740, y: 680 }, { x: 900, y: 540 }],
  [{ x: 380, y: 880 }, { x: 290, y: 880 }],
  [GATE, { x: 900, y: 1150 }],
];

export const LAKE = { x: 2350, y: 1560, r: 300 };

function catmull(pts: Pt[], seg = 10): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export const ROAD_PATHS: Pt[][] = ROADS.map((r) => catmull(r));

export function distToRoads(x: number, y: number): number {
  let best = Infinity;
  for (const path of ROAD_PATHS) for (const p of path) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export function inWall(x: number, y: number, margin = 0): boolean {
  return Math.abs(x - CITY_CENTER.x) / (WALL_RX + margin) + Math.abs(y - CITY_CENTER.y) / (WALL_RY + margin / 2) < 1;
}

let LN: ((x: number, y: number) => number) | null = null;
export function lakeDist(x: number, y: number): number {
  LN ??= noiseTile(99, 128, 3, 4);
  const n = LN(x * 0.2, y * 0.2);
  const dx = (x - LAKE.x) / 1.6, dy = y - LAKE.y;
  return Math.sqrt(dx * dx + dy * dy) / (LAKE.r * (0.75 + n * 0.5));
}

/** Paint the city ground into a canvas at the given scale. */
export interface GroundTex { grass: TexData | null; plaza: TexData | null; road: TexData | null }

export function paintCityGround(scale = 0.5, tex: GroundTex = { grass: null, plaza: null, road: null }): HTMLCanvasElement {
  const W = Math.round(CITY_W * scale), H = Math.round(CITY_H * scale);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const N1 = noiseTile(7, 256, 4, 8), N2 = noiseTile(13, 256, 2, 8), N3 = noiseTile(21, 256, 3, 8);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = px / scale, y = py / scale;
      const n = N1(x * 0.145, y * 0.145);
      const n2 = N2(x * 0.8, y * 0.8);
      // grass (generated texture when available, light noise on top breaks up the repetition)
      let r = 88 + n * 50 + n2 * 14, g = 128 + n * 46 + n2 * 16, b = 52 + n * 18;
      if (tex.grass) { const [tr, tg, tb] = texAt(tex.grass, x * 0.5, y * 0.5); const m = 0.85 + n * 0.3; r = tr * m; g = tg * m; b = tb * m; }
      // dry patches
      const dry = N3(x * 0.107, y * 0.107);
      if (dry > 0.58) { const t = Math.min(1, (dry - 0.58) * 5); r += 30 * t; g += 12 * t; b += 4 * t; }
      // inner city stone
      if (inWall(x, y, -24)) {
        const tile = (Math.floor((x + y * 2) / 46) + Math.floor((x - y * 2) / 46)) & 1;
        if (tex.plaza) {
          // iso-projected sampling so the paving runs along the city axes
          const [tr, tg, tb] = texAt(tex.plaza, (x + y * 2) * 0.35, (x - y * 2) * 0.35);
          r = tr; g = tg; b = tb;
        } else {
          const s = 150 + n * 30 + n2 * 20 + tile * 8;
          r = s * 1.02; g = s * 0.97; b = s * 0.86;
          const gx = ((x + y * 2) % 46 + 46) % 46, gy = ((x - y * 2) % 46 + 46) % 46;
          if (gx < 2.5 || gy < 2.5) { r *= 0.78; g *= 0.78; b *= 0.78; }
        }
      } else if (inWall(x, y, 30)) {
        // packed earth ring around the wall
        r = r * 0.6 + 138 * 0.4; g = g * 0.6 + 116 * 0.4; b = b * 0.6 + 80 * 0.4;
      }
      // lake
      const ld = lakeDist(x, y);
      if (ld < 1.12) {
        if (ld < 1) {
          const depth = Math.min(1, (1 - ld) * 2.2);
          r = 70 - depth * 40 + n2 * 10; g = 150 - depth * 50 + n2 * 10; b = 170 - depth * 20;
          if (ld > 0.9) { r += 40; g += 40; b += 30; }
        } else { r = 196 + n2 * 20; g = 178 + n2 * 20; b = 128; }
      }
      // edge vignette (dense forest feel)
      const ex = Math.min(x, CITY_W - x) / 260, ey = Math.min(y, CITY_H - y) / 220;
      const v = Math.min(1, Math.min(ex, ey));
      r *= 0.55 + 0.45 * v; g *= 0.6 + 0.4 * v; b *= 0.6 + 0.4 * v;
      const i = (py * W + px) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.scale(scale, scale);
  // roads
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const roadPat = tex.road ? ctx.createPattern(tex.road.canvas, 'repeat') : null;
  for (const pass of (roadPat ? [[58, 'rgba(70,52,30,.45)'], [46, 'pattern']] : [[58, 'rgba(70,52,30,.45)'], [46, '#a88a5c'], [30, '#c2a575']]) as [number, string][]) {
    ctx.strokeStyle = pass[1] === 'pattern' ? roadPat! : pass[1];
    ctx.lineWidth = pass[0];
    for (const path of ROAD_PATHS) {
      ctx.beginPath();
      path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    }
  }
  // road pebbles
  if (!roadPat) ctx.fillStyle = 'rgba(90,70,40,.35)';
  if (!roadPat) for (const path of ROAD_PATHS) for (let i = 0; i < path.length; i++) {
    const p = path[i];
    for (let k = 0; k < 3; k++) {
      const h = hash2(i, k, path.length);
      ctx.beginPath(); ctx.arc(p.x + (h - 0.5) * 40, p.y + (hash2(k, i, 3) - 0.5) * 20, 1.6 + h * 2, 0, 7); ctx.fill();
    }
  }
  // building pads shadows (soft dark under plots for grounding)
  for (const p of PLOTS) {
    const grd = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 150);
    grd.addColorStop(0, 'rgba(40,30,10,.18)');
    grd.addColorStop(1, 'rgba(40,30,10,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 170, 85, 0, 0, Math.PI * 2); ctx.fill();
  }
  // flowers & grass speckles
  for (let i = 0; i < (tex.grass ? 0 : 2600); i++) {
    const x = hash2(i, 1, 5) * CITY_W, y = hash2(i, 2, 5) * CITY_H;
    if (inWall(x, y, 30) || lakeDist(x, y) < 1.15 || distToRoads(x, y) < 30) continue;
    const t = hash2(i, 3, 5);
    ctx.fillStyle = t < 0.15 ? '#f4e46a' : t < 0.25 ? '#f0a0c8' : t < 0.32 ? '#ffffff' : t < 0.4 ? '#c890ff' : 'rgba(40,80,20,.35)';
    ctx.beginPath(); ctx.arc(x, y, t < 0.4 ? 3 : 4, 0, 7); ctx.fill();
  }
  ctx.restore();
  return c;
}
