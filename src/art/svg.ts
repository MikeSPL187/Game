/** Tiny SVG authoring kit with isometric primitives and auto-managed gradients. */

let gid = 0;

export function shade(hex: string, amt: number): string {
  // amt -1..1 : darken/lighten
  const c = hex.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t;
  const g = ((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t;
  const bl = (pa & 255) * (1 - t) + (pb & 255) * t;
  return '#' + [r, g, bl].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export class Svg {
  defs: string[] = [];
  body: string[] = [];
  constructor(public w: number, public h: number) {}

  lin(stops: [number, string, number?][], x1 = 0, y1 = 0, x2 = 0, y2 = 1): string {
    const id = 'g' + gid++;
    this.defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`);
    return `url(#${id})`;
  }
  rad(stops: [number, string, number?][], cx = 0.5, cy = 0.5, r = 0.5, fx?: number, fy?: number): string {
    const id = 'g' + gid++;
    this.defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${fx != null ? ` fx="${fx}" fy="${fy}"` : ''}>${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`);
    return `url(#${id})`;
  }
  blur(std: number): string {
    const id = 'f' + gid++;
    this.defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${std}"/></filter>`);
    return `url(#${id})`;
  }
  glowFilter(std: number, color: string): string {
    const id = 'f' + gid++;
    this.defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="${std}"/><feFlood flood-color="${color}"/><feComposite operator="in" in2=""/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
    return `url(#${id})`;
  }
  add(s: string) { this.body.push(s); return this; }
  path(d: string, fill: string, extra = '') { return this.add(`<path d="${d}" fill="${fill}" ${extra}/>`); }
  poly(pts: number[][], fill: string, extra = '') { return this.add(`<polygon points="${pts.map((p) => p.map((v) => +v.toFixed(1)).join(',')).join(' ')}" fill="${fill}" ${extra}/>`); }
  ellipse(cx: number, cy: number, rx: number, ry: number, fill: string, extra = '') { return this.add(`<ellipse cx="${+cx.toFixed(1)}" cy="${+cy.toFixed(1)}" rx="${+rx.toFixed(1)}" ry="${+ry.toFixed(1)}" fill="${fill}" ${extra}/>`); }
  circle(cx: number, cy: number, r: number, fill: string, extra = '') { return this.ellipse(cx, cy, r, r, fill, extra); }
  rect(x: number, y: number, w: number, h: number, fill: string, extra = '') { return this.add(`<rect x="${+x.toFixed(1)}" y="${+y.toFixed(1)}" width="${+w.toFixed(1)}" height="${+h.toFixed(1)}" fill="${fill}" ${extra}/>`); }
  line(x1: number, y1: number, x2: number, y2: number, stroke: string, w = 1, extra = '') { return this.add(`<line x1="${+x1.toFixed(1)}" y1="${+y1.toFixed(1)}" x2="${+x2.toFixed(1)}" y2="${+y2.toFixed(1)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`); }
  group(inner: () => void, extra = '') { this.add(`<g ${extra}>`); inner(); this.add('</g>'); return this; }

  toString() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}"><defs>${this.defs.join('')}</defs>${this.body.join('')}</svg>`;
  }
}

export function svgUrl(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ——————————————————————————————————————————— isometric helpers
// iso projection: x axis → (1, .5), y axis → (-1, .5), z → (0, -1)
export const iso = (cx: number, cy: number, x: number, y: number, z = 0): [number, number] => [cx + (x - y), cy + (x + y) * 0.5 - z];

export interface BoxOpts {
  top?: string; left?: string; right?: string; stroke?: string;
  pattern?: 'brick' | 'plank' | 'none';
  windows?: { n: number; color?: string; rows?: number };
  trim?: string;
}

/** Iso box centred at (cx,cy) ground with half extents a (x), b (y) and height h, base elevated by z0 */
export function isoBox(s: Svg, cx: number, cy: number, a: number, b: number, h: number, color: string, o: BoxOpts = {}, z0 = 0) {
  const P = (x: number, y: number, z: number) => iso(cx, cy, x, y, z + z0);
  const top = o.top ?? shade(color, 0.25);
  const left = o.left ?? color;
  const right = o.right ?? shade(color, -0.3);
  const stroke = o.stroke ?? shade(color, -0.6);
  const lf = [P(-a, b, 0), P(a, b, 0), P(a, b, h), P(-a, b, h)];
  const rf = [P(a, b, 0), P(a, -b, 0), P(a, -b, h), P(a, b, h)];
  const tf = [P(-a, -b, h), P(a, -b, h), P(a, b, h), P(-a, b, h)];
  const lg = s.lin([[0, shade(left, 0.08)], [1, shade(left, -0.12)]], 0, 0, 0, 1);
  const rg = s.lin([[0, shade(right, 0.05)], [1, shade(right, -0.15)]], 0, 0, 0, 1);
  s.poly(lf, lg, `stroke="${stroke}" stroke-width="1" stroke-linejoin="round"`);
  s.poly(rf, rg, `stroke="${stroke}" stroke-width="1" stroke-linejoin="round"`);
  if (o.pattern === 'brick' && h > 8) {
    const rows = Math.floor(h / 7);
    for (let i = 1; i < rows; i++) {
      const z = (h / rows) * i;
      s.line(...P(-a, b, z), ...P(a, b, z), shade(left, -0.25), 0.7, 'opacity=".55"');
      s.line(...P(a, b, z), ...P(a, -b, z), shade(right, -0.3), 0.7, 'opacity=".55"');
      const off = i % 2 ? 0 : 0.5;
      const n = Math.max(2, Math.round((2 * a) / 12));
      for (let k = 0; k < n; k++) {
        const x = -a + ((k + off) / n) * 2 * a;
        s.line(...P(x, b, z), ...P(x, b, z - h / rows), shade(left, -0.25), 0.6, 'opacity=".4"');
      }
    }
  }
  if (o.pattern === 'plank') {
    const n = Math.max(3, Math.round((2 * a) / 7));
    for (let k = 1; k < n; k++) {
      const x = -a + (k / n) * 2 * a;
      s.line(...P(x, b, 0), ...P(x, b, h), shade(left, -0.28), 0.8, 'opacity=".6"');
    }
    const m = Math.max(3, Math.round((2 * b) / 7));
    for (let k = 1; k < m; k++) {
      const y = -b + (k / m) * 2 * b;
      s.line(...P(a, y, 0), ...P(a, y, h), shade(right, -0.3), 0.8, 'opacity=".6"');
    }
  }
  s.poly(tf, top, `stroke="${stroke}" stroke-width="1" stroke-linejoin="round"`);
  if (o.trim) {
    s.add(`<polyline points="${[P(-a, b, h), P(a, b, h), P(a, -b, h)].map((p) => p.join(',')).join(' ')}" fill="none" stroke="${o.trim}" stroke-width="2.2"/>`);
  }
  if (o.windows && h > 14) {
    const rows = o.windows.rows ?? 1;
    const wc = o.windows.color ?? '#ffd27a';
    for (let r = 0; r < rows; r++) {
      const zc = h * ((r + 0.6) / (rows + 0.2));
      for (let i = 0; i < o.windows.n; i++) {
        const x = -a + ((i + 0.5) / o.windows.n) * 2 * a;
        windowOn(s, P, x, b, zc, 'L', wc);
      }
      const nb = Math.max(1, Math.round(o.windows.n * b / a));
      for (let i = 0; i < nb; i++) {
        const y = b - ((i + 0.5) / nb) * 2 * b;
        windowOn(s, P, a, y, zc, 'R', shade(wc, -0.25));
      }
    }
  }
}

function windowOn(s: Svg, P: (x: number, y: number, z: number) => [number, number], x: number, y: number, z: number, side: 'L' | 'R', color: string) {
  const ww = 3.2, wh = 5.5;
  const pts = side === 'L'
    ? [P(x - ww, y, z - wh), P(x + ww, y, z - wh), P(x + ww, y, z + wh), P(x - ww, y, z + wh)]
    : [P(x, y + ww, z - wh), P(x, y - ww, z - wh), P(x, y - ww, z + wh), P(x, y + ww, z + wh)];
  s.poly(pts, '#2a1d14');
  const inset = pts.map(([px, py], i) => [px + (i === 0 || i === 3 ? 0.8 : -0.8) * (side === 'L' ? 1 : 1), py + (i < 2 ? -0.8 : 0.8)]);
  s.poly(inset, color, 'opacity=".95"');
}

/** Pyramid roof over box (a,b) at height z */
export function isoPyramid(s: Svg, cx: number, cy: number, a: number, b: number, z: number, rh: number, color: string, overhang = 3) {
  const A = a + overhang, B = b + overhang;
  const P = (x: number, y: number, zz: number) => iso(cx, cy, x, y, zz);
  const apex = P(0, 0, z + rh);
  const lf = [P(-A, B, z), P(A, B, z), apex];
  const rf = [P(A, B, z), P(A, -B, z), apex];
  const stroke = shade(color, -0.55);
  s.poly(lf, s.lin([[0, shade(color, 0.15)], [1, shade(color, -0.05)]], 0, 0, 1, 1), `stroke="${stroke}" stroke-width="1" stroke-linejoin="round"`);
  s.poly(rf, s.lin([[0, shade(color, -0.25)], [1, shade(color, -0.4)]], 0, 0, 1, 1), `stroke="${stroke}" stroke-width="1" stroke-linejoin="round"`);
  // tile lines
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    const l1 = P(-A * (1 - t), B * (1 - t), z + rh * t), l2 = P(A * (1 - t), B * (1 - t), z + rh * t), r2 = P(A * (1 - t), -B * (1 - t), z + rh * t);
    s.add(`<polyline points="${[l1, l2, r2].map((p) => p.join(',')).join(' ')}" fill="none" stroke="${shade(color, -0.45)}" stroke-width=".8" opacity=".55"/>`);
  }
  return apex;
}

/** Gable roof with ridge along X axis */
export function isoGable(s: Svg, cx: number, cy: number, a: number, b: number, z: number, rh: number, color: string, overhang = 3, alongY = false) {
  const A = a + overhang, B = b + overhang;
  const P = (x: number, y: number, zz: number) => iso(cx, cy, x, y, zz);
  const stroke = shade(color, -0.55);
  if (!alongY) {
    // ridge from (-A,0) to (A,0); visible: front slope (y>0) and right gable end (x=A)
    const slope = [P(-A, B, z), P(A, B, z), P(A, 0, z + rh), P(-A, 0, z + rh)];
    const gable = [P(A, B, z), P(A, -B, z), P(A, 0, z + rh)];
    s.poly(gable, s.lin([[0, shade(color, -0.1)], [1, shade(color, -0.35)]]), `stroke="${stroke}" stroke-width="1"`);
    s.poly(slope, s.lin([[0, shade(color, 0.12)], [1, shade(color, -0.15)]], 0, 0, 0, 1), `stroke="${stroke}" stroke-width="1" stroke-linejoin="round"`);
    const n = Math.round(A / 5);
    for (let i = 1; i < n * 2; i++) {
      const x = -A + (i / (n * 2)) * 2 * A;
      s.line(...P(x, B, z), ...P(x, 0, z + rh), shade(color, -0.35), 0.8, 'opacity=".5"');
    }
    s.line(...P(-A, 0, z + rh), ...P(A, 0, z + rh), shade(color, 0.3), 1.6);
  } else {
    const slope = [P(A, B, z), P(A, -B, z), P(0, -B, z + rh), P(0, B, z + rh)];
    const gable = [P(-A, B, z), P(A, B, z), P(0, B, z + rh)];
    s.poly(gable, s.lin([[0, shade(color, 0.05)], [1, shade(color, -0.2)]]), `stroke="${stroke}" stroke-width="1"`);
    s.poly(slope, s.lin([[0, shade(color, -0.12)], [1, shade(color, -0.35)]], 0, 0, 0, 1), `stroke="${stroke}" stroke-width="1" stroke-linejoin="round"`);
    const n = Math.round(B / 5);
    for (let i = 1; i < n * 2; i++) {
      const y = -B + (i / (n * 2)) * 2 * B;
      s.line(...P(A, y, z), ...P(0, y, z + rh), shade(color, -0.5), 0.8, 'opacity=".5"');
    }
    s.line(...P(0, -B, z + rh), ...P(0, B, z + rh), shade(color, 0.3), 1.6);
  }
}

/** Cylinder (round tower) */
export function isoCylinder(s: Svg, cx: number, cy: number, r: number, h: number, color: string, z0 = 0, opts: { brick?: boolean; windows?: boolean; crenel?: boolean; trim?: string } = {}) {
  const yb = cy - z0, yt = cy - z0 - h;
  const g = s.lin([[0, shade(color, 0.12)], [0.35, shade(color, 0.05)], [0.75, shade(color, -0.25)], [1, shade(color, -0.42)]], 0, 0, 1, 0);
  const stroke = shade(color, -0.6);
  s.path(`M${cx - r},${yt} L${cx - r},${yb} A${r},${r / 2} 0 0 0 ${cx + r},${yb} L${cx + r},${yt} Z`, g, `stroke="${stroke}" stroke-width="1"`);
  if (opts.brick) {
    const rows = Math.floor(h / 7);
    for (let i = 1; i < rows; i++) {
      const y = yb - (h / rows) * i;
      s.path(`M${cx - r},${y} A${r},${r / 2} 0 0 0 ${cx + r},${y}`, 'none', `stroke="${shade(color, -0.35)}" stroke-width=".7" opacity=".5"`);
    }
  }
  if (opts.windows && h > 20) {
    for (const f of [-0.45, 0.2]) {
      const wx = cx + f * r;
      const wy = yb - h * 0.55 + Math.abs(f) * 3;
      s.rect(wx - 2.5, wy - 5, 5, 9, '#2a1d14');
      s.rect(wx - 1.6, wy - 4, 3.2, 7, f < 0 ? '#ffd27a' : '#e0a650');
    }
  }
  s.ellipse(cx, yt, r, r / 2, shade(color, 0.2), `stroke="${stroke}" stroke-width="1"`);
  if (opts.trim) s.path(`M${cx - r},${yt} A${r},${r / 2} 0 0 0 ${cx + r},${yt}`, 'none', `stroke="${opts.trim}" stroke-width="2.2"`);
  if (opts.crenel) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const ang = Math.PI * (i / (n - 1));
      const x = cx - Math.cos(ang) * r * 0.92;
      const y = yt + Math.sin(ang) * r * 0.46;
      s.rect(x - 2.6, y - 6, 5.2, 6.5, shade(color, i < n / 2 ? 0.1 : -0.2), `stroke="${stroke}" stroke-width=".6"`);
    }
  }
  return yt;
}

export function isoCone(s: Svg, cx: number, yTop: number, r: number, h: number, color: string) {
  const g = s.lin([[0, shade(color, 0.2)], [0.45, shade(color, 0)], [1, shade(color, -0.45)]], 0, 0, 1, 0);
  s.path(`M${cx - r},${yTop} A${r},${r / 2} 0 0 0 ${cx + r},${yTop} L${cx},${yTop - h} Z`, g, `stroke="${shade(color, -0.6)}" stroke-width="1" stroke-linejoin="round"`);
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    const rr = r * (1 - t);
    s.path(`M${cx - rr},${yTop - h * t} A${rr},${rr / 2} 0 0 0 ${cx + rr},${yTop - h * t}`, 'none', `stroke="${shade(color, -0.4)}" stroke-width=".8" opacity=".6"`);
  }
  return yTop - h;
}

export function flag(s: Svg, x: number, y: number, h: number, color: string, accent = '#ffd76a', dir = 1) {
  s.line(x, y, x, y - h, '#3a2a1a', 2);
  s.circle(x, y - h - 1.5, 2, accent);
  const fy = y - h + 2;
  s.path(`M${x},${fy} q${8 * dir},-3 ${16 * dir},2 q${-3 * dir},5 ${0},10 q${-8 * dir},-4 ${-16 * dir},-1 Z`, s.lin([[0, shade(color, 0.15)], [1, shade(color, -0.25)]], 0, 0, 1, 0), `stroke="${shade(color, -0.5)}" stroke-width=".7"`);
  s.path(`M${x + 4 * dir},${fy + 3} l${4 * dir},1 l${-1 * dir},3 z`, accent, 'opacity=".9"');
}

export function banner(s: Svg, x: number, y: number, w: number, h: number, color: string, accent: string) {
  s.path(`M${x - w / 2},${y} h${w} v${h} l${-w / 2},${-h * 0.22} l${-w / 2},${h * 0.22} Z`, s.lin([[0, shade(color, 0.12)], [1, shade(color, -0.3)]]), `stroke="${shade(color, -0.5)}" stroke-width=".8"`);
  s.rect(x - w / 2 - 1.5, y - 2, w + 3, 3, '#5a3a20');
  s.circle(x, y + h * 0.4, w * 0.22, accent, 'opacity=".9"');
}

export function shadowEllipse(s: Svg, cx: number, cy: number, rx: number, ry: number, op = 0.35) {
  s.ellipse(cx, cy, rx, ry, s.rad([[0, '#000', op], [0.7, '#000', op * 0.6], [1, '#000', 0]]));
}

/** Diamond ground pad (stone or dirt) */
export function groundPad(s: Svg, cx: number, cy: number, a: number, b: number, color: string, edge = 4) {
  const P = (x: number, y: number, z = 0) => iso(cx, cy, x, y, z);
  s.poly([P(-a, b, 0), P(a, b, 0), P(a, b, -edge), P(-a, b, -edge)], shade(color, -0.25));
  s.poly([P(a, b, 0), P(a, -b, 0), P(a, -b, -edge), P(a, b, -edge)], shade(color, -0.4));
  s.poly([P(-a, -b), P(a, -b), P(a, b), P(-a, b)], s.lin([[0, shade(color, 0.12)], [1, shade(color, -0.08)]]), `stroke="${shade(color, -0.4)}" stroke-width="1"`);
}

export function crystal(s: Svg, x: number, y: number, h: number, color: string, glow = true) {
  if (glow) s.ellipse(x, y - h * 0.5, h * 0.9, h * 0.9, s.rad([[0, color, 0.55], [1, color, 0]]));
  const w = h * 0.32;
  s.poly([[x, y - h], [x + w, y - h * 0.55], [x + w * 0.6, y], [x - w * 0.6, y], [x - w, y - h * 0.55]], s.lin([[0, shade(color, 0.6)], [0.5, color], [1, shade(color, -0.4)]], 0, 0, 1, 1), `stroke="${shade(color, 0.7)}" stroke-width=".8"`);
  s.poly([[x, y - h], [x + w, y - h * 0.55], [x + w * 0.6, y], [x, y - h * 0.05]], shade(color, -0.3), 'opacity=".55"');
  s.line(x - w * 0.4, y - h * 0.6, x - w * 0.1, y - h * 0.85, '#fff', 1.2, 'opacity=".8"');
}

export function tree(s: Svg, x: number, y: number, size: number, kind: 'pine' | 'oak' | 'dead' | 'birch' | 'ash', tint = 0) {
  if (kind === 'pine') {
    s.ellipse(x + size * 0.15, y, size * 0.45, size * 0.16, 'rgba(0,0,0,.28)');
    s.rect(x - size * 0.06, y - size * 0.35, size * 0.12, size * 0.35, '#5a3a22');
    const c = shade('#2f6a3a', tint);
    for (let i = 0; i < 3; i++) {
      const w = size * (0.5 - i * 0.11), yy = y - size * (0.25 + i * 0.32);
      s.poly([[x - w, yy], [x + w, yy], [x, yy - size * 0.55]], s.lin([[0, shade(c, 0.2)], [0.5, c], [1, shade(c, -0.4)]], 0, 0, 1, 0), `stroke="${shade(c, -0.55)}" stroke-width=".7"`);
    }
  } else if (kind === 'oak' || kind === 'birch') {
    s.ellipse(x + size * 0.15, y, size * 0.5, size * 0.17, 'rgba(0,0,0,.28)');
    s.path(`M${x - size * 0.07},${y} L${x - size * 0.05},${y - size * 0.55} L${x + size * 0.05},${y - size * 0.55} L${x + size * 0.08},${y} Z`, kind === 'birch' ? '#e8e2d6' : '#5a3a22');
    const c = shade(kind === 'birch' ? '#6aa04a' : '#3f7a3a', tint);
    const blobs = [[0, -0.8, 0.42], [-0.28, -0.62, 0.3], [0.28, -0.6, 0.32], [0.05, -1.05, 0.3]];
    for (const [bx, by, br] of blobs) s.circle(x + bx * size, y + by * size, br * size, s.rad([[0, shade(c, 0.3)], [0.7, c], [1, shade(c, -0.35)]], 0.35, 0.3, 0.7), `stroke="${shade(c, -0.5)}" stroke-width=".6"`);
  } else if (kind === 'dead' || kind === 'ash') {
    const c = kind === 'ash' ? '#2a2220' : '#5a4a3a';
    s.ellipse(x + size * 0.1, y, size * 0.3, size * 0.1, 'rgba(0,0,0,.25)');
    s.path(`M${x - 2},${y} L${x - 1},${y - size * 0.7} L${x - size * 0.3},${y - size} M${x - 1},${y - size * 0.5} L${x + size * 0.3},${y - size * 0.85} M${x},${y - size * 0.7} L${x + 2},${y - size * 1.05}`, 'none', `stroke="${c}" stroke-width="${Math.max(1.5, size * 0.07)}" stroke-linecap="round"`);
  }
}
