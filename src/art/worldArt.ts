import type { Res } from '../core/types';
import { PALETTES, type ArtResult } from './buildings';
import { Svg, crystal, flag, groundPad, isoBox, isoCone, isoCylinder, isoPyramid, shade, shadowEllipse, tree } from './svg';

function fr(w: number, h: number, gy: number) {
  const s = new Svg(w, h);
  return { s, cx: w / 2, cy: gy, done: (): ArtResult => ({ svg: s.toString(), w, h, ax: 0.5, ay: gy / h }) };
}

export function campArt(variant: number): ArtResult {
  const { s, cx, cy, done } = fr(170, 150, 118);
  shadowEllipse(s, cx, cy + 2, 70, 22, 0.35);
  s.ellipse(cx, cy, 60, 20, s.rad([[0, '#3a1a4a', 0.9], [1, '#2a1030', 0]]));
  const tent = (x: number, y: number, sc: number, col: string) => {
    s.path(`M${x - 22 * sc},${y} L${x},${y - 36 * sc} L${x + 22 * sc},${y} Z`, s.lin([[0, shade(col, 0.15)], [1, shade(col, -0.45)]], 0, 0, 1, 0), `stroke="${shade(col, -0.7)}" stroke-width="1"`);
    s.path(`M${x - 6 * sc},${y} L${x},${y - 18 * sc} L${x + 6 * sc},${y} Z`, '#0a0610');
    s.line(x, y - 36 * sc, x - 3, y - 44 * sc, '#3a2a2a', 1.5);
    s.line(x, y - 36 * sc, x + 4, y - 42 * sc, '#3a2a2a', 1.5);
  };
  const cols = ['#5a3a5a', '#4a3a2a', '#3a3a4a'];
  tent(cx - 26, cy - 4, 1, cols[variant % 3]);
  tent(cx + 24, cy + 2, 0.85, shade(cols[variant % 3], -0.1));
  // totem with skull
  s.line(cx + 2, cy + 8, cx + 2, cy - 46, '#4a3020', 3.5);
  s.ellipse(cx + 2, cy - 50, 8, 9, '#e8dcc0', 'stroke="#3a2a1a" stroke-width="1"');
  s.circle(cx - 1, cy - 51, 2, '#ff3af0'); s.circle(cx + 5, cy - 51, 2, '#ff3af0');
  // corrupted crystals
  crystal(s, cx - 50, cy + 6, 22, '#c03af0');
  crystal(s, cx + 52, cy + 8, 16, '#c03af0');
  // fire
  s.ellipse(cx + 2, cy + 14, 14, 10, s.rad([[0, '#ff8a2a', 0.6], [1, '#ff4a0a', 0]]));
  s.path(`M${cx - 4},${cy + 16} q4,-14 6,-16 q4,8 6,16 z`, '#ffb040');
  // bones
  s.line(cx - 20, cy + 18, cx - 8, cy + 22, '#e8dcc0', 2.4);
  s.line(cx + 22, cy + 22, cx + 34, cy + 18, '#e8dcc0', 2.4);
  return done();
}

export function nodeArt(res: Res, variant: number): ArtResult {
  const { s, cx, cy, done } = fr(150, 130, 100);
  shadowEllipse(s, cx, cy + 2, 60, 18, 0.25);
  if (res === 'food') {
    const pts = [[-50, 0], [0, -24], [50, 0], [0, 24]].map(([x, y]) => [cx + x, cy + y]);
    s.poly(pts, '#7a5a30', 'stroke="#4a3010" stroke-width="1"');
    for (let k = 1; k < 9; k++) {
      const t = k / 9;
      s.line(cx - 50 + 50 * t, cy - 24 * t, cx + 50 * t, cy + 24 - 24 * t, variant % 2 ? '#f0d050' : '#d8c040', 4.2);
    }
    const hay = (x: number, y: number) => s.path(`M${x - 10},${y} Q${x},${y - 22} ${x + 10},${y} Z`, s.lin([[0, '#f6d870'], [1, '#b88a2a']], 0, 0, 1, 0), 'stroke="#8a6a20" stroke-width=".8"');
    hay(cx - 30, cy - 6); hay(cx + 34, cy + 4);
    isoBox(s, cx + 6, cy - 26, 10, 8, 12, '#e6dcc0'); isoPyramid(s, cx + 6, cy - 26, 10, 8, 12, 10, '#a04a2a', 2);
  } else if (res === 'wood') {
    tree(s, cx - 30, cy - 4, 40, 'pine'); tree(s, cx + 26, cy - 10, 46, 'pine'); tree(s, cx, cy - 22, 42, 'pine');
    for (let i = 0; i < 3; i++) {
      s.add(`<rect x="${cx - 26 + i * 14}" y="${cy + 6 - i * 2}" width="24" height="9" rx="4" fill="#8a5a32" stroke="#4a2a12" stroke-width=".8"/>`);
      s.ellipse(cx - 2 + i * 14, cy + 10.5 - i * 2, 3.5, 4.5, '#d8b07a');
    }
  } else if (res === 'stone') {
    const rock = (x: number, y: number, r: number) => {
      s.path(`M${x - r},${y} L${x - r * 0.7},${y - r * 0.9} L${x + r * 0.1},${y - r * 1.3} L${x + r * 0.9},${y - r * 0.7} L${x + r},${y} Z`, s.lin([[0, '#e0dcd2'], [1, '#6a6458']], 0, 0, 1, 1), 'stroke="#3a3428" stroke-width="1"');
      s.path(`M${x - r * 0.7},${y - r * 0.9} L${x + r * 0.1},${y - r * 1.3} L${x},${y - r * 0.4} Z`, '#fff', 'opacity=".25"');
    };
    rock(cx - 22, cy, 26); rock(cx + 24, cy + 4, 20); rock(cx, cy - 12, 22);
    isoBox(s, cx + 40, cy + 12, 6, 5, 7, '#c8c0b0');
  } else {
    const rock = (x: number, y: number, r: number) => {
      s.path(`M${x - r},${y} L${x - r * 0.6},${y - r} L${x + r * 0.4},${y - r * 1.1} L${x + r},${y} Z`, s.lin([[0, '#9a8a6a'], [1, '#4a3a2a']], 0, 0, 1, 1), 'stroke="#2a2010" stroke-width="1"');
      for (let i = 0; i < 4; i++) s.poly([[x - r * 0.4 + i * r * 0.3, y - r * 0.5 - (i % 2) * 6], [x - r * 0.3 + i * r * 0.3, y - r * 0.38 - (i % 2) * 6], [x - r * 0.4 + i * r * 0.3, y - r * 0.26 - (i % 2) * 6], [x - r * 0.5 + i * r * 0.3, y - r * 0.38 - (i % 2) * 6]], '#ffd24a');
    };
    rock(cx - 18, cy, 30); rock(cx + 26, cy + 4, 22);
    s.ellipse(cx, cy - 20, 40, 24, s.rad([[0, '#ffd24a', 0.35], [1, '#ffd24a', 0]]));
  }
  return done();
}

export function ruinArt(variant: number): ArtResult {
  const { s, cx, cy, done } = fr(160, 160, 128);
  shadowEllipse(s, cx, cy, 64, 20, 0.28);
  groundPad(s, cx, cy, 44, 34, '#a8a090', 3);
  const stone = '#c8c0ae';
  const col = (x: number, y: number, h: number, broken = false) => {
    isoCylinder(s, x, y, 7, h, stone, 0, { brick: true });
    if (broken) s.path(`M${x - 7},${y - h} l4,-6 l4,4 l3,-7 l3,9 z`, shade(stone, 0.1));
  };
  col(cx - 34, cy - 10, 60); col(cx + 30, cy - 14, 40 + variant * 6, true); col(cx - 10, cy - 30, 70);
  if (variant !== 1) s.path(`M${cx - 44},${cy - 74} L${cx},${cy - 98} L${cx + 6},${cy - 92} L${cx - 40},${cy - 66} Z`, stone, 'stroke="#5a5448" stroke-width="1"');
  isoBox(s, cx + 22, cy + 18, 10, 8, 6, shade(stone, -0.1));
  isoBox(s, cx - 20, cy + 20, 8, 6, 5, shade(stone, -0.05));
  s.path(`M${cx - 30},${cy - 40} q6,10 2,30`, 'none', 'stroke="#4a8a3a" stroke-width="3" opacity=".8"');
  // treasure glint
  s.circle(cx + 4, cy + 4, 14, s.rad([[0, '#ffe08a', 0.8], [1, '#ffe08a', 0]]));
  isoBox(s, cx + 4, cy + 6, 7, 5, 7, '#8a5a2a');
  return done();
}

export function riftArt(): ArtResult {
  const { s, cx, cy, done } = fr(200, 200, 150);
  s.ellipse(cx, cy, 80, 28, s.rad([[0, '#ff4af0', 0.55], [1, '#5a1a9a', 0]]));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    crystal(s, cx + Math.cos(a) * 62, cy + Math.sin(a) * 22, 18 + (i % 3) * 6, '#c03af0', false);
  }
  return done();
}

/** separate rotating vortex texture */
export function riftVortex(): ArtResult {
  const s = new Svg(160, 160);
  s.circle(80, 80, 78, s.rad([[0, '#ffffff'], [0.15, '#ffb0f8'], [0.4, '#d03af0'], [0.75, '#4a1a8a', 0.8], [1, '#2a0a4a', 0]]));
  for (let i = 0; i < 5; i++) {
    s.path(`M80,80 Q${80 + 50 * Math.cos(i * 1.25)},${80 + 50 * Math.sin(i * 1.25)} ${80 + 72 * Math.cos(i * 1.25 + 0.9)},${80 + 72 * Math.sin(i * 1.25 + 0.9)}`, 'none', 'stroke="#ffd8ff" stroke-width="3" opacity=".55" stroke-linecap="round"');
  }
  return { svg: s.toString(), w: 160, h: 160, ax: 0.5, ay: 0.5 };
}

export function castleArt(color: string, faction: 'order' | 'wild' | 'ash', level: number, player = false): ArtResult {
  const { s, cx, cy, done } = fr(220, 220, 170);
  const p = { ...PALETTES[faction], banner: color, roof: player ? PALETTES[faction].roof : shade(color, -0.25) };
  shadowEllipse(s, cx, cy + 4, 92, 30, 0.35);
  groundPad(s, cx, cy, 58, 58, shade(p.stone, -0.2), 5);
  const big = level >= 10;
  isoBox(s, cx, cy - 4, 46, 46, 18, p.stone, { pattern: 'brick' }, 5);
  const t = (x: number, y: number) => {
    const [tx, ty] = [cx + (x - y), cy - 4 + (x + y) / 2];
    const top = isoCylinder(s, tx, ty, 11, 40 + (big ? 10 : 0), p.stone, 5, { brick: true });
    isoCone(s, tx, top, 14, 20, p.roof);
  };
  t(-46, -46); t(46, -46);
  isoBox(s, cx, cy - 4, 26, 26, 50 + (big ? 16 : 0), p.plaster, { windows: { n: 2 }, trim: big ? p.trim : undefined }, 18);
  isoPyramid(s, cx, cy - 4, 26, 26, 68 + (big ? 16 : 0), 30, p.roof, 4);
  flag(s, cx, cy - 4 - 98 - (big ? 16 : 0), 26, color, p.trim);
  t(-46, 46); t(46, 46);
  return done();
}

export function titanArt(id: string): ArtResult {
  if (id === 'roc') return rocArt();
  if (id === 'golem') return golemArt();
  return wyrmArt();
}

function rocArt(): ArtResult {
  const { s, cx, cy, done } = fr(380, 270, 230);
  shadowEllipse(s, cx, cy, 120, 26, 0.4);
  // lightning aura
  s.ellipse(cx, cy - 110, 150, 100, s.rad([[0, '#5ac8ff', 0.35], [1, '#5ac8ff', 0]]));
  const featherG = s.lin([[0, '#e8f6ff'], [0.4, '#7ab8e8'], [1, '#1a3a6a']], 0, 0, 0, 1);
  for (const d of [-1, 1]) {
    s.group(() => {
      s.path('M0,0 Q60,-80 150,-90 Q130,-70 140,-60 Q110,-56 118,-40 Q90,-40 96,-24 Q66,-24 70,-10 Q40,-8 30,10 Z', featherG, 'stroke="#0e2240" stroke-width="2" stroke-linejoin="round"');
      for (let i = 0; i < 4; i++) s.path(`M${20 + i * 26},${-10 - i * 14} Q${60 + i * 20},${-40 - i * 10} ${100 + i * 12},${-50 - i * 9}`, 'none', 'stroke="#0e2240" stroke-width="1.2" opacity=".5"');
    }, `transform="translate(${cx + d * 18},${cy - 110}) scale(${d},1)"`);
  }
  // tail
  s.path(`M${cx - 20},${cy - 60} L${cx - 40},${cy - 10} L${cx},${cy - 30} L${cx + 40},${cy - 10} L${cx + 20},${cy - 60} Z`, featherG, 'stroke="#0e2240" stroke-width="2"');
  // body
  s.ellipse(cx, cy - 90, 40, 56, s.lin([[0, '#f0faff'], [0.5, '#8ac0e8'], [1, '#2a4a7a']], 0, 0, 1, 1), 'stroke="#0e2240" stroke-width="2"');
  s.path(`M${cx - 26},${cy - 90} Q${cx},${cy - 50} ${cx + 26},${cy - 90}`, 'none', 'stroke="#fff" stroke-width="2" opacity=".5"');
  // legs & talons
  for (const d of [-1, 1]) {
    s.line(cx + d * 14, cy - 40, cx + d * 18, cy - 4, '#e8b84a', 5);
    s.path(`M${cx + d * 18 - 8},${cy} l8,-6 l8,6`, 'none', 'stroke="#2a2a2a" stroke-width="2.5"');
  }
  // head
  s.ellipse(cx, cy - 150, 24, 22, s.lin([[0, '#ffffff'], [1, '#6aa0d8']], 0, 0, 1, 1), 'stroke="#0e2240" stroke-width="2"');
  s.path(`M${cx - 8},${cy - 146} L${cx},${cy - 118} L${cx + 8},${cy - 146} Z`, s.lin([[0, '#ffe08a'], [1, '#c88a1a']]), 'stroke="#5a3a08" stroke-width="1.5"');
  s.path(`M${cx - 16},${cy - 168} L${cx - 28},${cy - 196} L${cx - 6},${cy - 172} M${cx + 16},${cy - 168} L${cx + 28},${cy - 196} L${cx + 6},${cy - 172}`, '#cfe8ff', 'stroke="#0e2240" stroke-width="1.5"');
  for (const d of [-1, 1]) { s.circle(cx + d * 10, cy - 154, 5, '#fff'); s.circle(cx + d * 10, cy - 154, 3, '#5af0ff'); }
  // lightning bolts
  for (const [x, y, sc] of [[cx - 120, cy - 60, 1], [cx + 110, cy - 150, 0.8], [cx + 130, cy - 40, 0.7]] as const) {
    s.path(`M${x},${y} l${10 * sc},${-26 * sc} l${-6 * sc},0 l${12 * sc},${-24 * sc} l${-18 * sc},${30 * sc} l${6 * sc},0 z`, '#fff8b0', 'stroke="#5ac8ff" stroke-width="1.5"');
  }
  return done();
}

function golemArt(): ArtResult {
  const { s, cx, cy, done } = fr(340, 280, 250);
  shadowEllipse(s, cx, cy, 120, 30, 0.45);
  const rock = (pts: number[][], tone = 0) => s.poly(pts.map(([x, y]) => [cx + x, cy + y]), s.lin([[0, shade('#b8a07a', 0.2 + tone)], [1, shade('#5a4a38', tone)]], 0, 0, 1, 1), 'stroke="#2a2018" stroke-width="2" stroke-linejoin="round"');
  // legs
  rock([[-60, 0], [-70, -60], [-30, -70], [-24, 0]]);
  rock([[24, 0], [30, -70], [70, -60], [60, 0]], -0.1);
  // torso
  rock([[-80, -60], [-90, -150], [-40, -190], [40, -190], [90, -150], [80, -60], [0, -50]]);
  // arms
  rock([[-90, -150], [-130, -120], [-140, -40], [-104, -30], [-96, -110]], 0.05);
  rock([[90, -150], [130, -120], [140, -40], [104, -30], [96, -110]], -0.15);
  rock([[-150, -40], [-150, -10], [-100, -6], [-96, -36]], 0.1);
  rock([[150, -40], [150, -10], [100, -6], [96, -36]], -0.1);
  // head
  rock([[-30, -190], [-36, -226], [0, -244], [36, -226], [30, -190]], 0.15);
  // glowing cracks & eyes
  const glow = '#7fe3ff';
  s.path(`M${cx - 40},${cy - 160} l20,30 l-10,24 l26,30 M${cx + 30},${cy - 170} l-10,40 l20,20`, 'none', `stroke="${glow}" stroke-width="3.5" stroke-linecap="round"`);
  s.ellipse(cx, cy - 120, 30, 30, s.rad([[0, glow, 0.7], [1, glow, 0]]));
  crystal(s, cx, cy - 104, 30, glow, false);
  for (const d of [-1, 1]) { s.circle(cx + d * 13, cy - 216, 6, s.rad([[0, '#fff'], [1, glow]])); }
  // moss & small trees on shoulders
  s.path(`M${cx - 90},${cy - 150} q20,-16 50,-36 q-10,20 -50,36z`, '#4a7a3a', 'opacity=".9"');
  tree(s, cx + 70, cy - 158, 26, 'pine');
  tree(s, cx - 64, cy - 168, 22, 'pine');
  return done();
}

function wyrmArt(): ArtResult {
  const { s, cx, cy, done } = fr(440, 320, 280);
  shadowEllipse(s, cx, cy, 140, 30, 0.45);
  s.ellipse(cx, cy - 110, 170, 120, s.rad([[0, '#ff6a2a', 0.35], [1, '#ff6a2a', 0]]));
  const scale = s.lin([[0, '#ff8a4a'], [0.5, '#a02a14'], [1, '#3a0a06']], 0, 0, 1, 1);
  const wing = s.lin([[0, '#c83a1a', 0.95], [1, '#3a0a06', 0.95]], 0, 0, 0, 1);
  for (const d of [-1, 1]) {
    s.group(() => {
      s.path('M0,0 L60,-120 L170,-150 L150,-110 L170,-70 L130,-60 L140,-20 L90,-20 Z', wing, 'stroke="#1a0402" stroke-width="2.4" stroke-linejoin="round"');
      for (const [x, y] of [[170, -150], [170, -70], [140, -20]]) s.line(60, -120, x, y, '#1a0402', 2.4);
    }, `transform="translate(${cx + d * 24},${cy - 120}) scale(${d},1)"`);
  }
  // tail
  s.path(`M${cx + 30},${cy - 30} Q${cx + 120},${cy - 10} ${cx + 150},${cy - 50} L${cx + 168},${cy - 40} L${cx + 150},${cy - 30} Q${cx + 120},${cy + 10} ${cx + 20},${cy - 10} Z`, scale, 'stroke="#1a0402" stroke-width="2"');
  // body
  s.ellipse(cx, cy - 60, 70, 52, scale, 'stroke="#1a0402" stroke-width="2.4"');
  s.path(`M${cx - 40},${cy - 40} Q${cx},${cy - 14} ${cx + 40},${cy - 40}`, 'none', 'stroke="#ffb06a" stroke-width="3" opacity=".7"');
  for (const d of [-1, 1]) s.path(`M${cx + d * 40},${cy - 20} l${d * 6},24 l${d * -18},0 z`, '#3a0a06', 'stroke="#1a0402" stroke-width="2"');
  // neck & head
  s.path(`M${cx - 30},${cy - 90} Q${cx - 60},${cy - 160} ${cx - 20},${cy - 200} L${cx + 6},${cy - 186} Q${cx - 26},${cy - 150} ${cx + 10},${cy - 96} Z`, scale, 'stroke="#1a0402" stroke-width="2.4"');
  s.path(`M${cx - 40},${cy - 214} L${cx + 30},${cy - 200} L${cx + 46},${cy - 186} L${cx + 6},${cy - 178} L${cx - 26},${cy - 180} Z`, scale, 'stroke="#1a0402" stroke-width="2.4" stroke-linejoin="round"');
  for (const d of [0, 14]) s.path(`M${cx - 30 + d},${cy - 212} l${-14 - d / 2},-30 l${10 + d / 3},26 z`, '#e8dcc8', 'stroke="#3a3020" stroke-width="1.2"');
  s.circle(cx + 6, cy - 202, 4.5, '#ffe04a');
  s.circle(cx + 6, cy - 202, 10, s.rad([[0, '#ffe04a', 0.8], [1, '#ffe04a', 0]]));
  // fire breath
  s.path(`M${cx + 46},${cy - 186} Q${cx + 90},${cy - 200} ${cx + 130},${cy - 170} Q${cx + 100},${cy - 176} ${cx + 110},${cy - 150} Q${cx + 80},${cy - 170} ${cx + 46},${cy - 182} Z`, s.lin([[0, '#fff2a0'], [0.5, '#ff9a2a'], [1, '#ff3a0a', 0.3]], 0, 0, 1, 0));
  // spikes on back
  for (let i = 0; i < 5; i++) s.path(`M${cx - 50 + i * 22},${cy - 104 + Math.abs(i - 2) * 6} l8,-20 l8,20 z`, '#3a0a06');
  return done();
}

/** Mountain clusters for the world map */
export function mountainArt(variant: number, snow: boolean): ArtResult {
  const { s, cx, cy, done } = fr(170, 150, 128);
  const base = snow ? '#8a8a9a' : '#8a7a68';
  const peak = (x: number, h: number, w: number) => {
    s.path(`M${x - w},${cy} L${x},${cy - h} L${x + w},${cy} Z`, s.lin([[0, shade(base, 0.25)], [0.5, base], [0.51, shade(base, -0.35)], [1, shade(base, -0.5)]], 0, 0, 1, 0), `stroke="${shade(base, -0.6)}" stroke-width="1.2" stroke-linejoin="round"`);
    if (snow || h > 90) s.path(`M${x - w * 0.3},${cy - h * 0.7} L${x},${cy - h} L${x + w * 0.3},${cy - h * 0.7} L${x + w * 0.12},${cy - h * 0.74} L${x},${cy - h * 0.66} L${x - w * 0.14},${cy - h * 0.75} Z`, '#f4f8ff', 'stroke="#9aa8c0" stroke-width=".8"');
    s.path(`M${x},${cy - h} L${x + w * 0.2},${cy - h * 0.5} L${x + w * 0.1},${cy}`, 'none', `stroke="${shade(base, -0.5)}" stroke-width="1" opacity=".5"`);
  };
  shadowEllipse(s, cx, cy, 80, 18, 0.3);
  const v = variant % 3;
  if (v === 0) { peak(cx - 30, 80, 50); peak(cx + 26, 104, 56); }
  else if (v === 1) { peak(cx, 116, 66); peak(cx - 46, 60, 36); }
  else { peak(cx + 34, 74, 46); peak(cx - 20, 96, 56); peak(cx + 52, 48, 28); }
  return done();
}

export function hillArt(variant: number): ArtResult {
  const { s, cx, cy, done } = fr(140, 80, 66);
  const c = variant % 2 ? '#7a9a4a' : '#6a8a42';
  s.path(`M${cx - 60},${cy} Q${cx - 20},${cy - 50} ${cx + 10},${cy - 36} Q${cx + 40},${cy - 46} ${cx + 60},${cy} Z`, s.lin([[0, shade(c, 0.25)], [1, shade(c, -0.35)]], 0, 0, 1, 1), `stroke="${shade(c, -0.5)}" stroke-width="1"`);
  return done();
}

export function treeArt(kind: 'pine' | 'oak' | 'dead' | 'birch' | 'ash', variant: number): ArtResult {
  const { s, cx, cy, done } = fr(70, 90, 82);
  tree(s, cx, cy, 40 + (variant % 3) * 6, kind, (variant % 4 - 1.5) * 0.06);
  return done();
}

export function rockArt(variant: number, tint = '#9a948a'): ArtResult {
  const { s, cx, cy, done } = fr(50, 40, 34);
  const r = 12 + (variant % 3) * 4;
  s.ellipse(cx + 3, cy, r, r * 0.3, 'rgba(0,0,0,.25)');
  s.path(`M${cx - r},${cy} L${cx - r * 0.6},${cy - r * 0.8} L${cx + r * 0.2},${cy - r} L${cx + r},${cy - r * 0.3} L${cx + r * 0.9},${cy} Z`, s.lin([[0, shade(tint, 0.3)], [1, shade(tint, -0.4)]], 0, 0, 1, 1), `stroke="${shade(tint, -0.6)}" stroke-width="1"`);
  return done();
}

/** Small soldier figure for marching legions */
export function soldierArt(color: string, kind: 'inf' | 'arc' | 'cav' | 'mag'): ArtResult {
  const { s, cx, cy, done } = fr(36, 46, 42);
  s.ellipse(cx, cy, 9, 3, 'rgba(0,0,0,.35)');
  if (kind === 'cav') {
    s.path(`M${cx - 12},${cy - 12} q2,-6 12,-6 q8,0 10,-6 l3,1 q-1,6 -4,10 l0,12 l-2,0 l0,-8 l-14,0 l0,8 l-2,0 z`, '#6a4a2a', 'stroke="#2a1a0a" stroke-width=".8"');
    s.rect(cx - 4, cy - 26, 7, 10, color, 'stroke="#1a1a1a" stroke-width=".8"');
    s.circle(cx, cy - 29, 3.4, '#e8c8a8', 'stroke="#1a1a1a" stroke-width=".8"');
    s.line(cx + 4, cy - 34, cx + 4, cy - 12, '#c8c8d0', 1.4);
  } else {
    s.rect(cx - 2.5, cy - 8, 2, 8, '#3a2a1a'); s.rect(cx + 0.5, cy - 8, 2, 8, '#3a2a1a');
    s.path(`M${cx - 6},${cy - 7} L${cx - 5},${cy - 20} Q${cx},${cy - 23} ${cx + 5},${cy - 20} L${cx + 6},${cy - 7} Z`, kind === 'mag' ? '#5a3a8a' : color, 'stroke="#1a1a1a" stroke-width=".8"');
    s.circle(cx, cy - 25, 4, '#e8c8a8', 'stroke="#1a1a1a" stroke-width=".8"');
    if (kind === 'inf') { s.path(`M${cx - 10},${cy - 18} h7 v8 q-3.5,4 -7,0 z`, shade(color, 0.2), 'stroke="#1a1a1a" stroke-width=".8"'); s.line(cx + 6, cy - 30, cx + 6, cy - 6, '#c8c8d0', 1.4); s.path(`M${cx - 4},${cy - 27} q4,-5 8,0`, '#9aa0aa'); }
    if (kind === 'arc') { s.path(`M${cx + 6},${cy - 26} q6,8 0,16`, 'none', 'stroke="#7a4a1a" stroke-width="1.4"'); s.path(`M${cx - 4},${cy - 27} q4,-6 8,0 z`, '#3a5a2a'); }
    if (kind === 'mag') { s.line(cx + 6, cy - 30, cx + 6, cy - 4, '#6a4a2a', 1.4); s.circle(cx + 6, cy - 31, 2.6, '#c27bff'); s.path(`M${cx - 5},${cy - 27} L${cx},${cy - 36} L${cx + 5},${cy - 27} Z`, '#5a3a8a'); }
  }
  return done();
}

export function bannerArt(color: string): ArtResult {
  const { s, cx, cy, done } = fr(40, 70, 66);
  flag(s, cx - 6, cy, 50, color, '#ffd76a');
  return done();
}
