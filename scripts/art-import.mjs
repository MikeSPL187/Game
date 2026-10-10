// Imports generated art into the game.
//
//   node scripts/art-import.mjs                 process every image in art/incoming
//        (files named by asset, e.g. bld_farm_order_t1.png, or by ChatGPT sheet code, e.g. S03.png)
//   node scripts/art-import.mjs --only bld_x    process one asset
//   node scripts/art-import.mjs --in <dir>      read from another folder
//   node scripts/art-import.mjs --placeholders <dir> name1 name2 …
//        render the current procedural art of those assets on a grey background
//        (a stand-in for generated images, used to test the pipeline)
//
// For each image: cut out a flat background (when there is no alpha), trim margins, downscale,
// encode WebP into public/art and record size + anchor in src/data/art-manifest.json.
// Sprites that replace procedural art are matched to it: same footprint width, same ground point,
// so a new building stands exactly where the old one did. Fine-tune in art/overrides.json:
//   { "bld_citadel_order_t3": { "scale": 1.1, "dx": 0, "dy": 0.01, "fx": [{ "kind": "smoke", "x": 0.4, "y": 0.2 }] } }
import { createServer } from 'vite';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const IN = opt('--in') ?? 'art/incoming';
const ONLY = opt('--only');
const PLACEHOLDERS = opt('--placeholders');
const MANIFEST = 'src/data/art-manifest.json';
const OUT = 'public/art';

let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }
const exe = process.env.CHROME_PATH ?? ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));

const server = await createServer({ configFile: 'vite.config.ts', appType: 'custom', logLevel: 'error', server: { port: 0, host: '127.0.0.1' } });
server.middlewares.use('/__art', (_req, res) => { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><meta charset="utf-8"><body></body>'); });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page:', e.message));
await page.goto(base + '__art');
await page.addScriptTag({ type: 'module', content: "import * as m from '/src/art/artMap.ts'; import * as s from '/src/art/svg.ts'; window.__art = { ...m, ...s };" });
await page.waitForFunction(() => window.__art);

// ———————————————————————————————————————— in-page helpers (run in Chromium)
await page.evaluate(() => {
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('cannot decode image')); i.src = src; });
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const ctx = (c) => c.getContext('2d', { willReadFrequently: true });

  /** generators leave the body at alpha ≈ 250 and a faint haze around it: snap both */
  function cleanAlpha(c) {
    const g = ctx(c), im = g.getImageData(0, 0, c.width, c.height), p = im.data;
    for (let i = 3; i < p.length; i += 4) { if (p[i] >= 240) p[i] = 255; else if (p[i] < 12) p[i] = 0; }
    g.putImageData(im, 0, 0);
  }

  function hasAlpha(c) {
    const d = ctx(c).getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) n++;
    return n > (c.width * c.height) * 0.01;
  }

  /** flood-fill the flat background from the borders with a soft edge and colour decontamination */
  /**
   * ChatGPT sometimes "draws" transparency: a grey/white checkerboard baked into an RGB image.
   * Background = neutral (unsaturated) light pixels connected to the border; edge pixels get alpha
   * from their distance to the nearer checker tone and are un-blended from it.
   */
  function removeChecker(c, cols) {
    const w = c.width, h = c.height, g = ctx(c), im = g.getImageData(0, 0, w, h), p = im.data;
    const lums = cols.map(([r, gg, b]) => (r + gg + b) / 3).sort((a, b) => a - b);
    const dark = lums[Math.floor(lums.length * 0.1)], light = lums[Math.floor(lums.length * 0.9)];
    const sat = (i) => Math.max(p[i * 4], p[i * 4 + 1], p[i * 4 + 2]) - Math.min(p[i * 4], p[i * 4 + 1], p[i * 4 + 2]);
    const lum = (i) => (p[i * 4] + p[i * 4 + 1] + p[i * 4 + 2]) / 3;
    const isBg = (i) => sat(i) <= 12 && lum(i) >= dark - 14;
    const bg = new Uint8Array(w * h), stack = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const i = stack.pop();
      if (bg[i] || !isBg(i)) continue;
      bg[i] = 1;
      const x = i % w, y = (i / w) | 0;
      if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w);
    }
    // enclosed pockets (between a crane and a tree, inside an arch): a region of neutral pixels that
    // alternates between exactly the two checker tones is background too; real white/grey parts are not bimodal
    const seen2 = new Uint8Array(w * h);
    for (let s0 = 0; s0 < w * h; s0++) {
      if (bg[s0] || seen2[s0] || !isBg(s0)) continue;
      const region = [], st = [s0];
      seen2[s0] = 1;
      while (st.length) {
        const i = st.pop();
        region.push(i);
        const x = i % w, y = (i / w) | 0;
        for (const k of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (k >= 0 && !seen2[k] && !bg[k] && isBg(k)) { seen2[k] = 1; st.push(k); }
      }
      if (region.length < 40) continue;
      let nd = 0, nl = 0;
      for (const i of region) { const L = lum(i); if (Math.abs(L - dark) <= 10) nd++; else if (Math.abs(L - light) <= 10) nl++; }
      // resampled checkers are blurry (many in-between greys), so only require both tones to be well present
      if (nd / region.length > 0.15 && nl / region.length > 0.15) for (const i of region) bg[i] = 1;
    }
    for (let i = 0; i < w * h; i++) {
      if (bg[i]) { p[i * 4 + 3] = 0; continue; }
      const x = i % w, y = (i / w) | 0;
      const near = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
      if (!near) continue;
      const t = Math.abs(lum(i) - dark) < Math.abs(lum(i) - light) ? dark : light;
      const d = Math.hypot(p[i * 4] - t, p[i * 4 + 1] - t, p[i * 4 + 2] - t);
      const a = Math.min(1, Math.max(0.15, d / 90));
      for (let k = 0; k < 3; k++) p[i * 4 + k] = Math.max(0, Math.min(255, (p[i * 4 + k] - t * (1 - a)) / a));
      p[i * 4 + 3] = Math.round(255 * a);
    }
    g.putImageData(im, 0, 0);
    return [Math.round(dark), Math.round(light), -1];
  }

  function removeBackground(c) {
    const w = c.width, h = c.height, g = ctx(c), im = g.getImageData(0, 0, w, h), p = im.data;
    const border = [];
    for (let x = 0; x < w; x += 4) border.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y += 4) border.push(y * w, y * w + w - 1);
    const cols = border.map((i) => [p[i * 4], p[i * 4 + 1], p[i * 4 + 2]]);
    const lumsB = cols.map(([r, gg, b]) => (r + gg + b) / 3).sort((a, b) => a - b);
    const neutral = cols.filter(([r, gg, b]) => Math.max(r, gg, b) - Math.min(r, gg, b) <= 12).length / cols.length;
    if (neutral > 0.9 && lumsB[Math.floor(lumsB.length * 0.9)] - lumsB[Math.floor(lumsB.length * 0.1)] > 18) return removeChecker(c, cols);
    const med = [0, 1, 2].map((k) => cols.map((c2) => c2[k]).sort((a, b) => a - b)[cols.length >> 1]);
    const dist = (i) => Math.hypot(p[i * 4] - med[0], p[i * 4 + 1] - med[1], p[i * 4 + 2] - med[2]);
    const T1 = 28, T2 = 64;
    const seen = new Uint8Array(w * h);
    const stack = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const i = stack.pop();
      if (seen[i]) continue;
      seen[i] = 1;
      const d = dist(i);
      if (d >= T2) continue;
      const a = Math.max(0, (d - T1) / (T2 - T1));
      if (a <= 0) p[i * 4 + 3] = 0;
      else {
        for (let k = 0; k < 3; k++) p[i * 4 + k] = Math.max(0, Math.min(255, (p[i * 4 + k] - med[k] * (1 - a)) / a));
        p[i * 4 + 3] = Math.round(p[i * 4 + 3] * a);
      }
      if (d >= T1) continue; // only grow through clean background
      const x = i % w, y = (i / w) | 0;
      if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w);
    }
    // despill: on a chroma-key background the edge pixels carry its tint — pull the key channel down
    const key = med.indexOf(Math.max(...med));
    const sat = Math.max(...med) - Math.min(...med);
    if (sat > 80) {
      const R = 3;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!p[i * 4 + 3]) continue;
        let edge = p[i * 4 + 3] < 255;
        for (let dy = -R; dy <= R && !edge; dy++) for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && p[(yy * w + xx) * 4 + 3] === 0) { edge = true; break; }
        }
        if (!edge) continue;
        const o = [0, 1, 2].filter((k) => k !== key);
        p[i * 4 + key] = Math.min(p[i * 4 + key], Math.max(p[i * 4 + o[0]], p[i * 4 + o[1]]));
      }
    }
    g.putImageData(im, 0, 0);
    return med;
  }

  function bbox(c, thr) {
    const w = c.width, h = c.height, d = ctx(c).getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  }

  function crop(c, b, pad) {
    const x0 = Math.max(0, b.x0 - pad), y0 = Math.max(0, b.y0 - pad), x1 = Math.min(c.width, b.x1 + pad), y1 = Math.min(c.height, b.y1 + pad);
    const o = canvas(x1 - x0, y1 - y0);
    ctx(o).drawImage(c, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
    return o;
  }

  function resize(c, tw, th) {
    let cur = c;
    while (cur.width > tw * 2 && cur.height > th * 2) {
      const h2 = canvas(Math.round(cur.width / 2), Math.round(cur.height / 2));
      const g = ctx(h2); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, h2.width, h2.height);
      cur = h2;
    }
    if (cur.width === tw && cur.height === th) return cur;
    const o = canvas(tw, th);
    const g = ctx(o); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, tw, th);
    return o;
  }

  /** opaque footprint of the procedural art this asset replaces (scene units) */
  async function measureReference(name) {
    const ref = window.__art.referenceArt(name);
    if (!ref) return null;
    const img = await load(window.__art.svgUrl(ref.svg));
    const c = canvas(ref.w, ref.h);
    ctx(c).drawImage(img, 0, 0, ref.w, ref.h);
    const b = bbox(c, 140);
    if (!b) return null;
    return { w: b.x1 - b.x0, below: b.y1 - ref.ay * ref.h, off: (b.x0 + b.x1) / 2 - ref.ax * ref.w, refW: ref.w, refH: ref.h };
  }

  window.__process = async ({ dataUrl, name, ov }) => {
    const { kind, maxPx } = window.__art.artKind(name);
    const img = await load(dataUrl);
    let c = canvas(img.width, img.height);
    ctx(c).drawImage(img, 0, 0);
    const cut = kind === 'sprite' || kind === 'unit' || kind === 'icon';
    let bg = null;
    if (cut) {
      if (!hasAlpha(c)) bg = removeBackground(c);
      cleanAlpha(c);
      const b = bbox(c, 8);
      if (!b) throw new Error('image is empty after background removal');
      c = crop(c, b, 2);
    }
    let tw, th;
    if (kind === 'texture') { tw = th = maxPx; } else {
      const k = Math.min(1, maxPx / Math.max(c.width, c.height));
      tw = Math.round(c.width * k); th = Math.round(c.height * k);
    }
    c = resize(c, tw, th);
    const webp = c.toDataURL('image/webp', cut || kind === 'texture' ? 0.9 : 0.86);
    const entry = { file: name + '.webp', w: c.width, h: c.height, size: c.width, ax: 0.5, ay: 0.5 };
    // buildings grow a little with each tier so upgrades read at a glance
    const tier = /^bld_.+_t([1-4])$/.exec(name);
    const scale = (ov.scale ?? 1) * (tier ? [0.88, 0.95, 1, 1.05][Number(tier[1]) - 1] : 1);
    let note = '';
    if (cut) {
      const ref = await measureReference(name);
      if (ref) {
        entry.size = Math.round(ref.w * scale);
        const dispH = (entry.size * c.height) / c.width;
        entry.ay = (dispH - ref.below * scale) / dispH;
        entry.ax = 0.5 - (ref.off * scale) / entry.size;
        note = `matched to procedural footprint ${Math.round(ref.w)}px`;
      } else {
        // units stand on their feet; icons are centred
        entry.size = Math.round((kind === 'unit' ? 60 : 64) * scale);
        entry.ay = kind === 'unit' ? 0.97 : 0.5;
        note = 'no procedural reference';
      }
    } else if (kind === 'texture') entry.size = 512;
    entry.ax += ov.dx ?? 0;
    entry.ay += ov.dy ?? 0;
    entry.ax = Math.round(entry.ax * 1000) / 1000;
    entry.ay = Math.round(entry.ay * 1000) / 1000;
    if (ov.fx) entry.fx = ov.fx;
    return { webp, entry, note, bg };
  };

  /**
   * Cut a ChatGPT sheet into its cells. Objects are found as connected silhouettes (so loose parts
   * like flags stay attached) and given to the grid cell that holds their centre; pixels of objects
   * that belong to neighbouring cells are cleared from each crop.
   */
  window.__slice = async ({ dataUrl, cols, rows }) => {
    const img = await load(dataUrl);
    const c = canvas(img.width, img.height);
    ctx(c).drawImage(img, 0, 0);
    if (!hasAlpha(c)) removeBackground(c);
    cleanAlpha(c);
    const W = c.width, H = c.height, F = 4, w = Math.ceil(W / F), h = Math.ceil(H / F);
    const px = ctx(c).getImageData(0, 0, W, H).data;
    let m = new Uint8Array(w * h);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 40) m[((y / F) | 0) * w + ((x / F) | 0)] = 1;
    for (let pass = 0; pass < 2; pass++) { // dilate ~8px so detached parts join their object
      const d = m.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!m[y * w + x] && ((x > 0 && m[y * w + x - 1]) || (x < w - 1 && m[y * w + x + 1]) || (y > 0 && m[(y - 1) * w + x]) || (y < h - 1 && m[(y + 1) * w + x]))) d[y * w + x] = 1;
      m = d;
    }
    const lab = new Int32Array(w * h).fill(-1);
    const comps = [];
    for (let i = 0; i < w * h; i++) {
      if (!m[i] || lab[i] >= 0) continue;
      const id = comps.length, st = [i];
      let area = 0, sx = 0, sy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
      lab[i] = id;
      while (st.length) {
        const j = st.pop(), x = j % w, y = (j / w) | 0;
        area++; sx += x; sy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) if (k >= 0 && m[k] && lab[k] < 0) { lab[k] = id; st.push(k); }
      }
      comps.push({ area, cx: sx / area, cy: sy / area, x0, y0, x1, y1, cell: -1 });
    }
    const minArea = (w * h) / (cols * rows) * 0.002;
    for (const k of comps) {
      if (k.area < minArea) continue; // specks and noise
      const col = Math.min(cols - 1, Math.floor((k.cx / w) * cols)), row = Math.min(rows - 1, Math.floor((k.cy / h) * rows));
      k.cell = row * cols + col;
    }
    const out = [];
    for (let cell = 0; cell < cols * rows; cell++) {
      const mine = comps.filter((k) => k.cell === cell);
      if (!mine.length) { out.push(null); continue; }
      const bx0 = Math.max(0, Math.min(...mine.map((k) => k.x0)) * F - 4), by0 = Math.max(0, Math.min(...mine.map((k) => k.y0)) * F - 4);
      const bx1 = Math.min(W, (Math.max(...mine.map((k) => k.x1)) + 1) * F + 4), by1 = Math.min(H, (Math.max(...mine.map((k) => k.y1)) + 1) * F + 4);
      const o = canvas(bx1 - bx0, by1 - by0), g = ctx(o);
      g.drawImage(c, bx0, by0, o.width, o.height, 0, 0, o.width, o.height);
      const im = g.getImageData(0, 0, o.width, o.height), p = im.data;
      for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) {
        const l = lab[(((by0 + y) / F) | 0) * w + (((bx0 + x) / F) | 0)];
        if (l < 0 || comps[l].cell !== cell) p[(y * o.width + x) * 4 + 3] = 0;
      }
      g.putImageData(im, 0, 0);
      out.push(o.toDataURL('image/png'));
    }
    return out;
  };

  window.__placeholder = async (name) => {
    const ref = window.__art.referenceArt(name);
    if (!ref) return null;
    const img = await load(window.__art.svgUrl(ref.svg));
    const c = canvas(1024, 1024), g = ctx(c);
    g.fillStyle = '#00ff00'; g.fillRect(0, 0, 1024, 1024);
    const k = 900 / Math.max(ref.w, ref.h);
    g.drawImage(img, 512 - (ref.w * k) / 2, 512 - (ref.h * k) / 2, ref.w * k, ref.h * k);
    return c.toDataURL('image/png');
  };
});

try {
  if (PLACEHOLDERS) {
    const names = argv.slice(argv.indexOf('--placeholders') + 2);
    mkdirSync(PLACEHOLDERS, { recursive: true });
    for (const n of names) {
      const url = await page.evaluate((x) => window.__placeholder(x), n);
      if (!url) { console.log('no procedural art for', n); continue; }
      writeFileSync(join(PLACEHOLDERS, n + '.png'), Buffer.from(url.split(',')[1], 'base64'));
      console.log('placeholder', n);
    }
  } else {
    const overrides = existsSync('art/overrides.json') ? JSON.parse(readFileSync('art/overrides.json', 'utf8')) : {};
    // keys may use * as a wildcard (bld_farm_*); exact names win over patterns
    const overrideFor = (name) => {
      const out = {};
      for (const [k, v] of Object.entries(overrides)) if (k.includes('*') && new RegExp('^' + k.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(name)) Object.assign(out, v);
      return Object.assign(out, overrides[name] ?? {});
    };
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    mkdirSync(OUT, { recursive: true });
    const sheets = existsSync('docs/art/sheets.json') ? JSON.parse(readFileSync('docs/art/sheets.json', 'utf8')) : {};
    const files = readdirSync(IN).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
    // expand sheets (S01.png …) into named cells; plain files keep their own name
    const jobs = [];
    for (const f of files) {
      const base = basename(f, extname(f)).trim();
      const mime = /\.png$/i.test(f) ? 'image/png' : /\.webp$/i.test(f) ? 'image/webp' : 'image/jpeg';
      const dataUrl = `data:${mime};base64,` + readFileSync(join(IN, f)).toString('base64');
      const layout = sheets[base.toUpperCase()];
      if (layout) {
        if (ONLY && !layout.cells.includes(ONLY)) continue;
        const cells = layout.cols * layout.rows > 1 ? await page.evaluate((a) => window.__slice(a), { dataUrl, cols: layout.cols, rows: layout.rows }) : [dataUrl];
        layout.cells.forEach((name, i) => {
          if (!name || (ONLY && name !== ONLY)) return;
          if (cells[i]) jobs.push({ name, dataUrl: cells[i], from: base });
          else console.log(`✗ ${name}: cell ${i + 1} of sheet ${base} is empty`);
        });
        continue;
      }
      if (ONLY && base !== ONLY) continue;
      if (!/^[A-Za-z0-9_]+$/.test(base)) { console.log(`skip ${f}: name it by its asset (bld_citadel_order_t3.png) or sheet code (S01.png)`); continue; }
      jobs.push({ name: base, dataUrl, from: '' });
    }
    let ok = 0, bad = 0;
    for (const { name, dataUrl, from } of jobs) {
      try {
        const r = await page.evaluate((a) => window.__process(a), { dataUrl, name, ov: overrideFor(name) });
        writeFileSync(join(OUT, r.entry.file), Buffer.from(r.webp.split(',')[1], 'base64'));
        manifest[name] = r.entry;
        const kb = Math.round(Buffer.byteLength(r.webp.split(',')[1], 'base64') / 1024);
        console.log(`✓ ${name}${from ? ` (из ${from})` : ''}  ${r.entry.w}×${r.entry.h}  ${kb} KB  size=${r.entry.size} anchor=(${r.entry.ax}, ${r.entry.ay})${r.bg ? `  bg cut rgb(${r.bg.join(',')})` : ''}  ${r.note}`);
        ok++;
      } catch (e) { console.log(`✗ ${name}: ${e.message}`); bad++; }
    }
    const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
    writeFileSync(MANIFEST, JSON.stringify(sorted, null, 1) + '\n');
    console.log(`done: ${ok} imported, ${bad} failed, manifest has ${Object.keys(sorted).length} assets`);
  }
} finally {
  await browser.close();
  await server.close();
}
