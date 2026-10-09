import { Container, Graphics, Sprite, Text, type Application } from 'pixi.js';
import { bus } from '../core/bus';
import { fbm, hash2 } from '../core/rng';
import type { Legion, WorldObject } from '../core/types';
import { campArt, castleArt, mountainArt, nodeArt, riftArt, riftVortex, ruinArt, soldierArt, titanArt, treeArt, hillArt } from '../art/worldArt';
import { PALETTES } from '../art/buildings';
import { iconSvg } from '../art/icons';
import { FACTIONS, NODE_INFO } from '../data/world';
import { TROOPS } from '../data/troops';
import type { Game } from '../game/game';
import { T, type Terrain } from '../game/terrain';
import { Camera } from './camera';
import { Particles, floatText, ringTexture, softCircle, starSprite } from './fx';
import { bake, canvasTexture, get, type Baked } from './textures';

export const TILE = 64;
const CHUNK = 16;
const TEX_PER_TILE = 12;

const BASE: Record<number, [number, number, number]> = {
  // water tiles blend as wet sand; water itself is painted from the continuous height field
  [T.Deep]: [190, 176, 128], [T.Shallow]: [196, 182, 132], [T.Sand]: [214, 196, 140], [T.Grass]: [104, 150, 66],
  [T.Forest]: [62, 110, 52], [T.Hills]: [128, 140, 82], [T.Mountain]: [128, 118, 104], [T.Snow]: [226, 232, 240],
  [T.Ash]: [84, 66, 62], [T.Swamp]: [70, 84, 64], [T.Meadow]: [132, 168, 78],
};

function spr(b: Baked, scale = 1): Sprite {
  const s = new Sprite(b.tex);
  s.anchor.set(b.ax, b.ay);
  s.scale.set(scale / (b.tex.width / b.w));
  return s;
}

interface ObjView { c: Container; obj: WorldObject; label?: Text; hp?: Graphics; extra?: Sprite }
interface LegView { c: Container; line: Graphics; legion: Legion; flag: Sprite; men: Sprite[] }

export class WorldScene {
  root = new Container();
  world = new Container();
  groundL = new Container();
  decoL = new Container();
  objL = new Container();
  lineL = new Container();
  marchL = new Container();
  fogL = new Container();
  fxL = new Container();
  uiL = new Container();
  camera: Camera;
  particles = new Particles();
  ter: Terrain;
  chunks: Container[] = [];
  objViews = new Map<number, ObjView>();
  legViews = new Map<number, LegView>();
  raidViews = new Map<number, LegView>();
  private fogCanvas!: HTMLCanvasElement;
  private fogSprite!: Sprite;
  private fogDirty = true;
  private selRing: Sprite | null = null;
  private selMarker: Container | null = null;
  private time = 0;
  private lastSync = 0;

  constructor(public app: Application, public game: Game) {
    this.ter = game.ter;
    this.root.addChild(this.world);
    this.world.addChild(this.groundL, this.decoL, this.lineL, this.objL, this.marchL, this.particles.layer, this.fogL, this.fxL, this.uiL);
    this.objL.sortableChildren = true;
    this.marchL.sortableChildren = true;
    const size = this.ter.size * TILE;
    this.camera = new Camera(this.world, app.canvas as HTMLCanvasElement, { worldW: size, worldH: size, minZoom: Math.max(0.08, window.innerHeight / 5200), maxZoom: Math.max(1, window.innerHeight / 600), zoom: window.innerHeight / 1050 });
    const c = game.cityPos();
    this.camera.x = (c.x + 0.5) * TILE; this.camera.y = (c.y + 0.5) * TILE;
    this.camera.onTap = (x, y) => this.tap(x, y);
    this.camera.onMove = () => bus.emit('world-cam');
  }

  async init(progress?: (f: number) => void) {
    const jobs: Promise<unknown>[] = [];
    const f = this.game.s.player.faction;
    for (let v = 0; v < 3; v++) jobs.push(bake(`wcamp:${v}`, () => campArt(v)));
    for (const r of ['food', 'wood', 'stone', 'gold'] as const) jobs.push(bake(`wnode:${r}`, () => nodeArt(r, 0)));
    for (let v = 0; v < 3; v++) jobs.push(bake(`wruin:${v}`, () => ruinArt(v)));
    jobs.push(bake('wrift', riftArt), bake('wvortex', riftVortex));
    jobs.push(bake('wcity', () => castleArt(FACTIONS[f].color, f, 5, true)));
    for (const l of this.game.s.lords) jobs.push(bake(`wlord:${l.id}`, () => castleArt(l.color, l.faction, l.citadel)));
    for (const t of ['roc', 'golem', 'wyrm']) jobs.push(bake(`wtitan:${t}`, () => titanArt(t)));
    for (let v = 0; v < 3; v++) { jobs.push(bake(`wmtn:${v}`, () => mountainArt(v, false))); jobs.push(bake(`wsnow:${v}`, () => mountainArt(v, true))); }
    jobs.push(bake('whill:0', () => hillArt(0)), bake('whill:1', () => hillArt(1)));
    for (const k of ['pine', 'oak', 'dead', 'ash', 'birch'] as const) for (let v = 0; v < 2; v++) jobs.push(bake(`wtree:${k}:${v}`, () => treeArt(k, v), 1));
    const pc = PALETTES[f].banner;
    for (const t of ['inf', 'arc', 'cav', 'mag'] as const) {
      jobs.push(bake(`wsold:${t}:me`, () => soldierArt(pc, t)));
      jobs.push(bake(`wsold:${t}:foe`, () => soldierArt('#a02a2a', t)));
    }
    for (const n of ['attack', 'pick', 'ruin', 'home', 'move', 'skull', 'sword']) jobs.push(bake('wicon:' + n, { svg: iconSvg(n), w: 64, h: 64, ax: 0.5, ay: 0.5 }, 1.5));
    let done = 0;
    jobs.forEach((j) => j.then(() => progress?.(++done / (jobs.length + 2))));
    await Promise.all(jobs);
    this.paintTerrain();
    progress?.((done + 1) / (jobs.length + 2));
    this.buildDecor();
    this.buildFog();
    this.syncObjects();
    this.syncLegions();
    bus.on('fog', () => { this.fogDirty = true; });
    bus.on('world-obj', () => this.syncObjects());
    bus.on('march', () => this.syncLegions());
    bus.on('battle', (e) => this.onBattle(e));
    bus.on('raid', () => this.syncLegions());
  }

  // ———————————————————————————————————————— terrain
  private paintTerrain() {
    const n = this.ter.size, P = TEX_PER_TILE, W = n * P;
    const c = document.createElement('canvas');
    c.width = c.height = W;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(W, W);
    const d = img.data;
    const t = this.ter.t, h = this.ter.h;
    const seed = this.ter.seed;
    const H = (x: number, y: number) => {
      x = Math.max(0, Math.min(n - 1.001, x)); y = Math.max(0, Math.min(n - 1.001, y));
      const xi = Math.floor(x), yi = Math.floor(y), ax = x - xi, ay = y - yi;
      return (h[yi * n + xi] * (1 - ax) + h[yi * n + xi + 1] * ax) * (1 - ay) + (h[(yi + 1) * n + xi] * (1 - ax) + h[(yi + 1) * n + xi + 1] * ax) * ay;
    };
    for (let py = 0; py < W; py++) {
      const fy = py / P - 0.5;
      const y0 = Math.max(0, Math.min(n - 1, Math.floor(fy))), y1 = Math.min(n - 1, y0 + 1), ky = Math.max(0, Math.min(1, fy - y0));
      for (let px = 0; px < W; px++) {
        const fx = px / P - 0.5;
        const x0 = Math.max(0, Math.min(n - 1, Math.floor(fx))), x1 = Math.min(n - 1, x0 + 1), kx = Math.max(0, Math.min(1, fx - x0));
        // jitter blend weights with noise for organic borders
        const jn = fbm(px / 9, py / 9, seed + 5, 2) - 0.5;
        const kxj = Math.max(0, Math.min(1, kx + jn * 0.7)), kyj = Math.max(0, Math.min(1, ky + jn * 0.7));
        const c00 = BASE[t[y0 * n + x0]], c10 = BASE[t[y0 * n + x1]], c01 = BASE[t[y1 * n + x0]], c11 = BASE[t[y1 * n + x1]];
        let r = 0, g = 0, b = 0;
        for (let k = 0; k < 3; k++) {
          const top = c00[k] * (1 - kxj) + c10[k] * kxj;
          const bot = c01[k] * (1 - kxj) + c11[k] * kxj;
          const v = top * (1 - kyj) + bot * kyj;
          if (k === 0) r = v; else if (k === 1) g = v; else b = v;
        }
        // continuous height for shading & water
        const hh = H(fx, fy);
        const hx = H(fx + 0.6, fy) - H(fx - 0.6, fy), hy = H(fx, fy + 0.6) - H(fx, fy - 0.6);
        const detail = fbm(px / 3.5, py / 3.5, seed + 9, 2) - 0.5;
        const wn = (fbm(px / 14, py / 14, seed + 11, 2) - 0.5) * 0.02;
        if (hh + wn < 0.39) {
          const depth = Math.max(0, Math.min(1, (0.39 - hh) / 0.2));
          r = 70 - depth * 46 + detail * 8; g = 140 - depth * 70 + detail * 10; b = 168 - depth * 40 + detail * 10;
          if (hh + wn > 0.372) { r += 50; g += 40; b += 22; } // foam near coast
        } else {
          const shadeV = (-hx - hy) * 140;
          r += shadeV + detail * 22; g += shadeV + detail * 22; b += shadeV * 0.8 + detail * 14;
          const macro = fbm(px / 60, py / 60, seed + 17, 3) - 0.5;
          r += macro * 26; g += macro * 22; b += macro * 10;
        }
        const i = (py * W + px) * 4;
        d[i] = Math.max(0, Math.min(255, r)); d[i + 1] = Math.max(0, Math.min(255, g)); d[i + 2] = Math.max(0, Math.min(255, b)); d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // meadow flowers & sand ripples
    for (let i = 0; i < 9000; i++) {
      const x = hash2(i, 1, seed) * W, y = hash2(i, 2, seed) * W;
      const tt = t[Math.floor(y / P) * n + Math.floor(x / P)];
      if (tt === T.Meadow || (tt === T.Grass && i % 4 === 0)) {
        ctx.fillStyle = ['#f4e46a', '#f0a0c8', '#ffffff', '#c890ff'][i % 4];
        ctx.fillRect(x, y, 1.4, 1.4);
      }
    }
    const tex = canvasTexture(c);
    const s = new Sprite(tex);
    s.scale.set(TILE / P);
    this.groundL.addChild(s);
    // map border vignette
    const v = new Graphics();
    const size = n * TILE;
    v.rect(-4000, -4000, size + 8000, 4000).fill({ color: 0x0b1424 });
    v.rect(-4000, size, size + 8000, 4000).fill({ color: 0x0b1424 });
    v.rect(-4000, 0, 4000, size).fill({ color: 0x0b1424 });
    v.rect(size, 0, 4000, size).fill({ color: 0x0b1424 });
    this.groundL.addChild(v);
  }

  private buildDecor() {
    const n = this.ter.size;
    const cn = Math.ceil(n / CHUNK);
    for (let i = 0; i < cn * cn; i++) {
      const c = new Container();
      c.sortableChildren = true;
      this.chunks.push(c);
      this.decoL.addChild(c);
    }
    const objTiles = new Set(this.game.s.world.objects.map((o) => o.y * n + o.x));
    const near = (x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (objTiles.has((y + dy) * n + x + dx)) return true; return false; };
    const seed = this.ter.seed;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const tt = this.ter.t[y * n + x];
      const h = hash2(x, y, seed + 3);
      const chunk = this.chunks[Math.floor(y / CHUNK) * cn + Math.floor(x / CHUNK)];
      const add = (key: string, scale: number, ox = 0, oy = 0) => {
        const b = get(key); if (!b) return;
        const s = spr(b, scale);
        s.position.set((x + 0.5 + ox) * TILE, (y + 0.5 + oy) * TILE);
        s.zIndex = s.y;
        chunk.addChild(s);
      };
      if (near(x, y) && tt !== T.Mountain && tt !== T.Snow) continue;
      if (tt === T.Mountain && h < 0.55 && (x + y) % 2 === 0) add(`wmtn:${Math.floor(h * 6) % 3}`, 0.75 + h * 0.4, 0, 0.3);
      else if (tt === T.Snow && (x + y) % 2 === 0) add(`wsnow:${Math.floor(h * 6) % 3}`, 0.8 + h * 0.4, 0, 0.3);
      else if (tt === T.Forest) {
        const k = h < 0.7 ? 'pine' : 'oak';
        add(`wtree:${k}:${Math.floor(h * 10) % 2}`, 0.9, -0.2, 0.1);
        if (h > 0.3) add(`wtree:${k}:${Math.floor(h * 7) % 2}`, 0.8, 0.25, 0.35);
      } else if (tt === T.Hills && h < 0.35) add(`whill:${Math.floor(h * 10) % 2}`, 0.55);
      else if (tt === T.Ash && h < 0.18) add(`wtree:ash:${Math.floor(h * 10) % 2}`, 0.7);
      else if (tt === T.Swamp && h < 0.35) add(`wtree:dead:${Math.floor(h * 10) % 2}`, 0.7);
      else if ((tt === T.Grass || tt === T.Meadow) && h < 0.06) add(`wtree:${h < 0.03 ? 'oak' : 'birch'}:0`, 0.8);
    }
  }

  // ———————————————————————————————————————— fog
  private buildFog() {
    const n = this.ter.size, P = 6;
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = this.fogCanvas.height = n * P;
    this.fogSprite = new Sprite();
    this.fogSprite.scale.set(TILE / P);
    this.fogL.addChild(this.fogSprite);
    this.paintFog();
  }

  private cloudCanvas: HTMLCanvasElement | null = null;
  private paintFog() {
    const n = this.ter.size, P = 6, W = n * P;
    if (!this.cloudCanvas) {
      const cc = document.createElement('canvas');
      cc.width = cc.height = W;
      const cx = cc.getContext('2d')!;
      const img = cx.createImageData(W, W);
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        const v = fbm(x / 40, y / 40, 777, 4);
        const i = (y * W + x) * 4;
        img.data[i] = 150 + v * 90; img.data[i + 1] = 162 + v * 84; img.data[i + 2] = 186 + v * 64; img.data[i + 3] = 255;
      }
      cx.putImageData(img, 0, 0);
      this.cloudCanvas = cc;
    }
    const ctx = this.fogCanvas.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, W);
    ctx.drawImage(this.cloudCanvas, 0, 0);
    // cut revealed area (blurred)
    const mask = document.createElement('canvas');
    mask.width = mask.height = W;
    const m = mask.getContext('2d')!;
    m.fillStyle = '#000';
    const fog = this.game.fog;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (fog[y * n + x]) m.fillRect(x * P - 1, y * P - 1, P + 2, P + 2);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.filter = 'blur(7px)';
    ctx.drawImage(mask, 0, 0);
    ctx.drawImage(mask, 0, 0);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    const old = this.fogSprite.texture;
    this.fogSprite.texture = canvasTexture(this.fogCanvas);
    if (old && old !== this.fogSprite.texture && old.label !== 'EMPTY') old.destroy(true);
    this.fogSprite.alpha = 0.96;
    this.fogDirty = false;
  }

  revealed(x: number, y: number): boolean {
    const n = this.ter.size;
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= n || yi >= n) return false;
    return !!this.game.fog[yi * n + xi];
  }

  // ———————————————————————————————————————— objects
  syncObjects() {
    const seen = new Set<number>();
    for (const o of this.game.s.world.objects) {
      seen.add(o.id);
      let v = this.objViews.get(o.id);
      if (!v) { const nv = this.makeObj(o); if (!nv) continue; v = nv; this.objViews.set(o.id, v); }
      v.obj = o;
      const vis = o.kind === 'titan' || o.kind === 'city' || this.revealed(o.x, o.y);
      v.c.visible = vis;
      if (v.hp) {
        v.hp.clear();
        const hp = o.hp ?? 1;
        if (hp < 0.999) {
          v.hp.roundRect(-50, 0, 100, 10, 5).fill({ color: 0x10141f, alpha: 0.85 });
          v.hp.roundRect(-48, 2, 96 * hp, 6, 3).fill({ color: 0xe04a3a });
        }
      }
    }
    for (const [id, v] of this.objViews) if (!seen.has(id)) { v.c.destroy({ children: true }); this.objViews.delete(id); }
  }

  private makeObj(o: WorldObject): ObjView | null {
    const c = new Container();
    c.position.set((o.x + 0.5) * TILE, (o.y + 0.5) * TILE);
    c.zIndex = c.y;
    let key = '', scale = 0.62;
    switch (o.kind) {
      case 'camp': key = `wcamp:${o.variant ?? 0}`; scale = 0.62; break;
      case 'node': key = `wnode:${o.res}`; scale = 0.78; break;
      case 'ruin': key = `wruin:${o.variant ?? 0}`; scale = 0.55; break;
      case 'rift': key = 'wrift'; scale = 0.6; break;
      case 'city': key = 'wcity'; scale = 0.95; break;
      case 'lord': key = `wlord:${o.lordId}`; scale = 0.85; break;
      case 'titan': key = `wtitan:${o.titanId}`; scale = 0.62; break;
    }
    const b = get(key);
    if (!b) return null;
    const v: ObjView = { c, obj: o };
    if (o.kind === 'rift') {
      const vb = get('wvortex')!;
      const vs = spr(vb, 0.55);
      vs.position.set(0, -14);
      vs.scale.y *= 0.55;
      vs.blendMode = 'add';
      c.addChild(vs);
      v.extra = vs;
    }
    const s = spr(b, scale);
    c.addChild(s);
    if (o.kind === 'titan') {
      const glow = new Sprite(softCircle());
      glow.anchor.set(0.5); glow.scale.set(5, 2.4); glow.alpha = 0.35; glow.blendMode = 'add';
      glow.tint = o.titanId === 'wyrm' ? 0xff6a2a : o.titanId === 'golem' ? 0x7fe3ff : 0x5ac8ff;
      glow.y = -60;
      c.addChildAt(glow, 0);
      v.extra = s;
    }
    // badge
    const label = this.labelFor(o);
    if (label) {
      const t = new Text({ text: label, style: { fontFamily: 'Philosopher, Georgia, serif', fontSize: o.kind === 'city' || o.kind === 'lord' || o.kind === 'titan' ? 22 : 18, fontWeight: '700', fill: o.kind === 'camp' || o.kind === 'rift' ? '#ffb0f0' : o.kind === 'lord' ? '#ffb0a0' : '#fff6d8', stroke: { color: '#10141f', width: 5 } } });
      t.anchor.set(0.5, 0);
      t.y = o.kind === 'titan' ? 18 : 12;
      c.addChild(t);
      v.label = t;
    }
    if (o.kind === 'titan' || o.kind === 'rift') {
      const g = new Graphics();
      g.y = o.kind === 'titan' ? 46 : 36;
      c.addChild(g);
      v.hp = g;
    }
    this.objL.addChild(c);
    return v;
  }

  private labelFor(o: WorldObject): string {
    switch (o.kind) {
      case 'camp': return `Пустота · ${o.level}`;
      case 'node': return `${NODE_INFO[o.res!].name} · ${o.level}`;
      case 'ruin': return 'Руины';
      case 'rift': return `Разлом · ${o.level}`;
      case 'city': return this.game.s.player.name;
      case 'lord': { const l = this.game.s.lords.find((x) => x.id === o.lordId); return l ? `${l.name} · ${l.citadel}` : ''; }
      case 'titan': return `Титан · ${o.level}`;
    }
  }

  // ———————————————————————————————————————— legions
  syncLegions() {
    const g = this.game;
    const seen = new Set<number>();
    for (const l of g.s.legions) {
      seen.add(l.id);
      let v = this.legViews.get(l.id);
      if (!v) { v = this.makeLegion(l, false); this.legViews.set(l.id, v); }
      v.legion = l;
      this.drawLine(v);
    }
    for (const [id, v] of this.legViews) if (!seen.has(id)) { v.c.destroy({ children: true }); v.line.destroy(); this.legViews.delete(id); }
    const rs = new Set<number>();
    for (const r of g.s.raids) {
      rs.add(r.id);
      if (!this.raidViews.has(r.id)) {
        const fake: Legion = { id: r.id, lead: null, deputy: null, troops: r.troops, state: 'march', pos: r.from, path: [r.from, g.cityPos()], pathT0: r.start, speed: 0, action: 'attack', targetId: null, carry: {}, gatherStart: 0, gatherEnd: 0, battleEnd: 0 };
        const v = this.makeLegion(fake, true);
        this.raidViews.set(r.id, v);
      }
    }
    for (const [id, v] of this.raidViews) if (!rs.has(id)) { v.c.destroy({ children: true }); v.line.destroy(); this.raidViews.delete(id); }
  }

  private makeLegion(l: Legion, foe: boolean): LegView {
    const c = new Container();
    const kinds = Object.entries(l.troops).filter(([, n]) => (n ?? 0) > 0).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([k]) => TROOPS[k as keyof typeof TROOPS].type);
    const pick = [kinds[0] ?? 'inf', kinds[1] ?? kinds[0] ?? 'inf', kinds[0] ?? 'inf'];
    const men: Sprite[] = [];
    const offs = [[-14, -6], [12, -8], [0, 6]];
    pick.forEach((k, i) => {
      const s = spr(get(`wsold:${k}:${foe ? 'foe' : 'me'}`)!, 1.25);
      s.position.set(offs[i][0], offs[i][1]);
      c.addChild(s);
      men.push(s);
    });
    const ring = new Graphics();
    ring.ellipse(0, 4, 30, 12).stroke({ color: foe ? 0xff4a3a : 0x7fe3ff, width: 3, alpha: 0.9 });
    c.addChildAt(ring, 0);
    const flagS = new Sprite(get(foe ? 'wicon:skull' : 'wicon:sword')!.tex);
    flagS.anchor.set(0.5); flagS.scale.set(0.28); flagS.y = -54;
    const bg = new Graphics();
    bg.circle(0, -54, 15).fill({ color: foe ? 0x5a1010 : 0x10203a, alpha: 0.95 }).stroke({ color: foe ? 0xff6a4a : 0xe8b84a, width: 2.5 });
    c.addChild(bg, flagS);
    this.marchL.addChild(c);
    const line = new Graphics();
    this.lineL.addChild(line);
    return { c, line, legion: l, flag: flagS, men };
  }

  private drawLine(v: LegView, foe = false) {
    const l = v.legion;
    v.line.clear();
    if (!(l.state === 'march' || l.state === 'return') || l.path.length < 2) return;
    const color = foe ? 0xff4a3a : l.action === 'attack' ? 0xff7a5a : l.action === 'gather' ? 0x7ad85a : l.action === 'explore' ? 0xffd24a : 0x7fe3ff;
    const pts = l.path.map((p) => [(p.x + 0.5) * TILE, (p.y + 0.5) * TILE]);
    // dashed
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.floor(len / 22);
      for (let k = 0; k < steps; k++) {
        const a = k / steps, b = Math.min(1, (k + 0.55) / steps);
        v.line.moveTo(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a).lineTo(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
      }
    }
    v.line.stroke({ color, width: 6, alpha: 0.85, cap: 'round' });
    const [ex, ey] = pts[pts.length - 1];
    v.line.circle(ex, ey, 14).stroke({ color, width: 4, alpha: 0.9 });
  }

  private onBattle(e: { x: number; y: number; win: boolean }) {
    const x = (e.x + 0.5) * TILE, y = (e.y + 0.5) * TILE;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this.particles.burst(x + (Math.random() - 0.5) * 50, y - 20 + (Math.random() - 0.5) * 30, 10, { tex: starSprite(), tint: i % 2 ? 0xffd24a : 0xff6a3a, scale: 0.4, life: 0.6, speed: 160, blend: 'add' });
      }, i * 300);
    }
    this.particles.emit({ x, y, tex: ringTexture(), scale: 1.2, grow: 4, life: 0.9, tint: e.win ? 0xffe08a : 0xff4a3a, blend: 'add' });
    setTimeout(() => floatText(this.fxL, x, y - 80, e.win ? 'Победа!' : 'Поражение', e.win ? '#ffe27a' : '#ff8a7a', 36), 1600);
  }

  // ———————————————————————————————————————— interaction
  objectAt(wx: number, wy: number): WorldObject | null {
    let best: WorldObject | null = null, bd = Infinity;
    for (const o of this.game.s.world.objects) {
      const v = this.objViews.get(o.id);
      if (!v?.c.visible) continue;
      const cx = (o.x + 0.5) * TILE, cy = (o.y + 0.5) * TILE - 24;
      const r = o.kind === 'titan' ? 110 : o.kind === 'city' || o.kind === 'lord' ? 90 : 56;
      const d = Math.hypot(wx - cx, (wy - cy) * 1.2);
      if (d < r && d < bd) { bd = d; best = o; }
    }
    return best;
  }

  legionAt(wx: number, wy: number): Legion | null {
    for (const v of this.legViews.values()) {
      if (Math.hypot(v.c.x - wx, v.c.y - 10 - wy) < 44) return v.legion;
    }
    return null;
  }

  private tap(wx: number, wy: number) {
    const leg = this.legionAt(wx, wy);
    if (leg) { this.markTile(leg.pos.x, leg.pos.y, 0x7fe3ff); bus.emit('world-select', { legion: leg.id }); return; }
    const o = this.objectAt(wx, wy);
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (o) { this.markTile(o.x, o.y, 0xffe08a); bus.emit('world-select', { obj: o.id }); return; }
    if (tx < 0 || ty < 0 || tx >= this.ter.size || ty >= this.ter.size) return;
    this.markTile(tx, ty, 0xffffff);
    bus.emit('world-select', { tile: { x: tx, y: ty } });
  }

  markTile(x: number, y: number, color: number) {
    this.selRing?.destroy();
    const s = new Sprite(ringTexture());
    s.anchor.set(0.5); s.tint = color; s.blendMode = 'add';
    s.position.set((x + 0.5) * TILE, (y + 0.5) * TILE + 6);
    this.uiL.addChild(s);
    this.selRing = s;
  }
  clearMark() { this.selRing?.destroy(); this.selRing = null; this.selMarker?.destroy(); this.selMarker = null; }

  screenOf(tx: number, ty: number) { return this.camera.toScreen((tx + 0.5) * TILE, (ty + 0.5) * TILE); }

  focusTile(x: number, y: number, zoom?: number) {
    const base = window.innerHeight / 1200;
    this.camera.flyTo((x + 0.5) * TILE, (y + 0.5) * TILE, zoom != null ? zoom * base / 0.6 : Math.max(this.camera.zoom, base), 800);
  }

  refresh() {
    if (performance.now() - this.lastSync > 200) {
      this.lastSync = performance.now();
      this.syncObjects();
      this.syncLegions();
    }
  }

  // ———————————————————————————————————————— frame
  update(dt: number) {
    this.time += dt;
    this.camera.update();
    this.particles.update(dt);
    if (this.fogDirty) { this.paintFog(); this.syncObjects(); }
    // cull chunks
    const z = this.camera.zoom;
    const hw = this.camera.sw / 2 / z, hh = this.camera.sh / 2 / z;
    const x0 = this.camera.x - hw - 200, x1 = this.camera.x + hw + 200, y0 = this.camera.y - hh - 300, y1 = this.camera.y + hh + 200;
    const cn = Math.ceil(this.ter.size / CHUNK), cs = CHUNK * TILE;
    this.chunks.forEach((c, i) => {
      const cx = (i % cn) * cs, cy = Math.floor(i / cn) * cs;
      c.visible = cx + cs > x0 && cx < x1 && cy + cs > y0 && cy < y1 && z > 0.1;
    });
    for (const v of this.objViews.values()) {
      const inView = v.c.x > x0 && v.c.x < x1 && v.c.y > y0 && v.c.y < y1 + 200;
      v.c.renderable = inView;
      const lz = z / (window.innerHeight / 1200);
      if (!inView) continue;
      if (v.obj.kind === 'rift' && v.extra) v.extra.rotation += dt * 1.6;
      if (v.obj.kind === 'titan' && v.extra) v.extra.y = Math.sin(this.time * 1.4 + v.obj.id) * 6 - 4;
      if (v.label) v.label.visible = lz > 0.45 || v.obj.kind === 'city' || v.obj.kind === 'titan' || v.obj.kind === 'lord';
    }
    // marches
    const now = Date.now();
    for (const v of this.legViews.values()) {
      const l = v.legion;
      const p = this.game.legionPos(l, now);
      v.c.position.set((p.x + 0.5) * TILE, (p.y + 0.5) * TILE);
      v.c.zIndex = v.c.y;
      const moving = l.state === 'march' || l.state === 'return';
      v.men.forEach((m, i) => { m.y = [-6, -8, 6][i] + (moving ? -Math.abs(Math.sin(this.time * 10 + i)) * 4 : 0); });
      if (l.state === 'battle' && Math.random() < 0.3) this.particles.emit({ x: v.c.x + (Math.random() - 0.5) * 40, y: v.c.y - 20, tex: starSprite(), tint: 0xffaa4a, scale: 0.35, life: 0.4, blend: 'add', spread: 80 });
      if (l.state === 'gather' && Math.random() < 0.08) this.particles.emit({ x: v.c.x, y: v.c.y - 40, vy: -30, tex: starSprite(), tint: 0x9aff7a, scale: 0.25, life: 1, blend: 'add' });
      v.flag.parent!.visible = true;
    }
    for (const [id, v] of this.raidViews) {
      const r = this.game.s.raids.find((x) => x.id === id);
      if (!r) continue;
      const f = Math.min(1, (now - r.start) / (r.arrive - r.start));
      const c = this.game.cityPos();
      const x = r.from.x + (c.x - r.from.x) * f, y = r.from.y + (c.y - r.from.y) * f;
      v.c.position.set((x + 0.5) * TILE, (y + 0.5) * TILE);
      v.c.zIndex = v.c.y;
      v.line.clear();
      v.line.moveTo(v.c.x, v.c.y).lineTo((c.x + 0.5) * TILE, (c.y + 0.5) * TILE).stroke({ color: 0xff3a2a, width: 5, alpha: 0.6 + Math.sin(this.time * 6) * 0.3 });
    }
    if (this.selRing) { this.selRing.scale.set(0.9 + Math.sin(this.time * 4) * 0.08); }
  }

  enter() { this.camera.attach(); this.root.visible = true; this.fogDirty = true; }
  leave() { this.camera.detach(); this.root.visible = false; }
}
