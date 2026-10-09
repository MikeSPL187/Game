import { Container, Graphics, Sprite, Text, Texture, type Application } from 'pixi.js';
import { bus } from '../core/bus';
import { fmtTime } from '../core/format';
import { hash2 } from '../core/rng';
import type { BuildingId, FactionId } from '../core/types';
import { buildingArt, constructionSite, PALETTES, tierOf, wallSegment, wallTower } from '../art/buildings';
import { iconSvg } from '../art/icons';
import { mountainArt, rockArt, soldierArt, treeArt } from '../art/worldArt';
import { BUILDINGS, PRODUCTION_RES, productionCap } from '../data/buildings';
import { CITY_CENTER, CITY_H, CITY_W, GATE, PLOTS, PLOT_BY_ID, WALL_RX, WALL_RY, type Plot } from '../data/cityLayout';
import { TYPE_INFO } from '../data/troops';
import type { Game } from '../game/game';
import { Camera } from './camera';
import { ROAD_PATHS, distToRoads, inWall, lakeDist, paintCityGround, LAKE } from './cityGround';
import { Particles, floatText, ringTexture, softCircle, starSprite } from './fx';
import { bake, canvasTexture, get, type Baked } from './textures';

interface PlotView {
  plot: Plot;
  root: Container;
  sprite: Sprite | null;
  glow: Sprite | null;
  key: string;
  level: number;
  marker: Container | null;
  bubble: Container | null;
  bubbleKind: string;
  timer: Container | null;
  timerText: Text | null;
  timerFill: Graphics | null;
  light: Sprite;
}

const bubbleIcons = new Map<string, Texture>();

async function iconTex(name: string): Promise<Texture> {
  const k = 'icon:' + name;
  const b = await bake(k, { svg: iconSvg(name), w: 64, h: 64, ax: 0.5, ay: 0.5 }, 1.5);
  bubbleIcons.set(name, b.tex);
  return b.tex;
}

function sprite(b: Baked, scale = 1): Sprite {
  const s = new Sprite(b.tex);
  s.anchor.set(b.ax, b.ay);
  s.scale.set(scale / (b.tex.width / b.w));
  return s;
}

export class CityScene {
  root = new Container();
  world = new Container();
  ground = new Container();
  objs = new Container();
  fxLayer = new Container();
  uiLayer = new Container();
  camera: Camera;
  particles = new Particles();
  views = new Map<string, PlotView>();
  private walls: Sprite[] = [];
  private wallTier = -1;
  private villagers: { s: Sprite; path: number; t: number; speed: number; dir: number }[] = [];
  private birds: { s: Container; vx: number; vy: number; ph: number }[] = [];
  private clouds: Sprite[] = [];
  private sparkles: { x: number; y: number }[] = [];
  selected: string | null = null;
  private selGlow: Sprite | null = null;
  private time = 0;
  perf: Record<string, number> = {};
  private emitAcc = 0;
  night = 0;
  private faction: FactionId;
  private lastTimerSec = -1;

  constructor(public app: Application, public game: Game) {
    this.faction = game.s.player.faction;
    this.root.addChild(this.world);
    this.world.addChild(this.ground, this.objs, this.particles.layer, this.fxLayer, this.uiLayer);
    this.objs.sortableChildren = true;
    const sh = window.innerHeight, sw = window.innerWidth;
    const fit = Math.max(sh / CITY_H, sw / CITY_W);
    this.camera = new Camera(this.world, app.canvas as HTMLCanvasElement, { worldW: CITY_W, worldH: CITY_H, minZoom: fit, maxZoom: Math.max(1.2, sh / 500), zoom: Math.max(fit, sh / 1080) });
    this.camera.x = CITY_CENTER.x; this.camera.y = CITY_CENTER.y + 60;
    this.camera.onTap = (x, y) => this.tap(x, y);
    this.camera.onMove = () => bus.emit('city-cam');
  }

  async init(progress?: (f: number) => void) {
    const tg = performance.now();
    const gScale = this.game.s.settings.quality === 'low' ? 0.35 : 0.5;
    const groundTex = canvasTexture(paintCityGround(gScale));
    this.perf.ground = Math.round(performance.now() - tg);
    const g = new Sprite(groundTex);
    g.scale.set(1 / gScale);
    this.ground.addChild(g);
    // texture preload
    const jobs: Promise<unknown>[] = [];
    const s = this.game.s;
    for (const b of s.buildings) if (b.level > 0) jobs.push(this.bakeBuilding(b.type, b.level));
    jobs.push(bake('site', constructionSite(1)));
    for (const k of ['pine', 'oak', 'birch'] as const) for (let v = 0; v < 3; v++) jobs.push(bake(`tree:${k}:${v}`, () => treeArt(k, v)));
    for (let v = 0; v < 3; v++) { jobs.push(bake(`rock:${v}`, () => rockArt(v))); jobs.push(bake(`mtn:${v}`, () => mountainArt(v, v === 1))); }
    for (const t of ['inf', 'arc', 'cav', 'mag'] as const) jobs.push(bake(`villager:${t}`, () => soldierArt(['#8a6a4a', '#5a7a3a', '#7a4a3a', '#4a5a8a'][['inf', 'arc', 'cav', 'mag'].indexOf(t)], t)));
    for (const n of ['food', 'wood', 'stone', 'gold', 'hammer', 'sword', 'book', 'key_silver', 'heart', 'lock', 'arrowUp']) jobs.push(iconTex(n));
    let done = 0;
    jobs.forEach((j) => j.then(() => progress?.(++done / jobs.length)));
    await Promise.all(jobs);
    this.buildDecor();
    await this.buildWalls();
    for (const p of PLOTS) this.createView(p);
    this.refresh();
    this.spawnLife();
    bus.on('build-done', (e) => this.onBuildDone(e));
    bus.on('collect', (e) => this.onCollect(e));
  }

  private bakeBuilding(type: BuildingId, level: number) {
    const t = tierOf(level);
    const rep = [1, 1, 5, 10, 15][t];
    return bake(`b:${type}:${t}:${this.faction}`, () => buildingArt(type, rep, this.faction));
  }

  // ———————————————————————————————————————— static decor
  private buildDecor() {
    const occupied = (x: number, y: number, r: number) => PLOTS.some((p) => Math.hypot((p.x - x) * 0.7, p.y - 40 - y) < r);
    // mountains top-right corner
    const mtns: [number, number, number][] = [[2250, 300, 0], [2480, 360, 1], [2680, 420, 2], [2050, 250, 2], [2700, 220, 0], [2420, 180, 1], [1860, 210, 1], [2620, 600, 2]];
    for (const [x, y, v] of mtns) {
      const s = sprite(get(`mtn:${v}`)!, 1.8 + hash2(x, y, 1) * 0.6);
      s.position.set(x, y);
      s.zIndex = y;
      this.objs.addChild(s);
    }
    // forest
    let n = 0;
    for (let gy = 40; gy < CITY_H; gy += 42) {
      for (let gx = 20; gx < CITY_W; gx += 48) {
        const x = gx + (hash2(gx, gy, 3) - 0.5) * 40, y = gy + (hash2(gx, gy, 4) - 0.5) * 30;
        const ex = Math.min(x, CITY_W - x) / 520, ey = Math.min(y, CITY_H - y) / 380;
        const edge = 1 - Math.min(1, Math.min(ex, ey));
        const dens = 0.06 + edge * edge * 1.1;
        if (hash2(gx, gy, 9) > dens) continue;
        if (inWall(x, y, 70) || lakeDist(x, y) < 1.12 || distToRoads(x, y) < 46 || occupied(x, y, 165)) continue;
        if (x > 1750 && y < 520) continue; // mountains
        const r = hash2(gx, gy, 11);
        const kind = r < 0.55 ? 'pine' : r < 0.85 ? 'oak' : 'birch';
        const s = sprite(get(`tree:${kind}:${Math.floor(hash2(gx, gy, 12) * 3)}`)!, 1.4 + hash2(gx, gy, 13) * 0.8);
        s.position.set(x, y);
        s.zIndex = y;
        this.objs.addChild(s);
        n++;
      }
    }
    // rocks
    for (let i = 0; i < 40; i++) {
      const x = hash2(i, 5, 77) * CITY_W, y = hash2(i, 6, 77) * CITY_H;
      if (inWall(x, y, 40) || lakeDist(x, y) < 1.1 || distToRoads(x, y) < 40 || occupied(x, y, 150)) continue;
      const s = sprite(get(`rock:${i % 3}`)!, 1 + hash2(i, 7, 7));
      s.position.set(x, y); s.zIndex = y;
      this.objs.addChild(s);
    }
    // water sparkle points
    for (let i = 0; i < 40; i++) {
      const a = hash2(i, 1, 2) * Math.PI * 2, r = hash2(i, 2, 2) * 0.8;
      const x = LAKE.x + Math.cos(a) * LAKE.r * 1.4 * r, y = LAKE.y + Math.sin(a) * LAKE.r * 0.8 * r;
      if (lakeDist(x, y) < 0.9) this.sparkles.push({ x, y });
    }
    void n;
  }

  private async buildWalls() {
    const lvl = this.game.level('wall');
    const tier = tierOf(Math.max(1, lvl));
    if (tier === this.wallTier) return;
    this.wallTier = tier;
    for (const w of this.walls) w.destroy();
    this.walls = [];
    const pal = PALETTES[this.faction];
    const T = { x: CITY_CENTER.x, y: CITY_CENTER.y - WALL_RY };
    const R = { x: CITY_CENTER.x + WALL_RX, y: CITY_CENTER.y };
    const B = { x: CITY_CENTER.x, y: CITY_CENTER.y + WALL_RY };
    const L = { x: CITY_CENTER.x - WALL_RX, y: CITY_CENTER.y };
    const edges: { a: typeof T; b: typeof T; axis: 'x' | 'y'; parts: [number, number][] }[] = [
      { a: L, b: T, axis: 'y', parts: [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]] },
      { a: T, b: R, axis: 'x', parts: [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]] },
      { a: L, b: B, axis: 'x', parts: [[0, 0.25], [0.25, 0.345], [0.655, 0.75], [0.75, 1]] },
      { a: B, b: R, axis: 'y', parts: [[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]] },
    ];
    for (const e of edges) {
      const fullLen = Math.abs(e.b.x - e.a.x);
      for (const [f0, f1] of e.parts) {
        const len = fullLen * (f1 - f0);
        const key = `wall:${tier}:${this.faction}:${e.axis}:${Math.round(len)}`;
        const b = await bake(key, () => wallSegment(tier, pal, len, e.axis));
        const s = sprite(b);
        const fm = (f0 + f1) / 2;
        s.position.set(e.a.x + (e.b.x - e.a.x) * fm, e.a.y + (e.b.y - e.a.y) * fm);
        s.zIndex = s.y;
        this.objs.addChild(s);
        this.walls.push(s);
      }
    }
    const tb = await bake(`walltower:${tier}:${this.faction}`, () => wallTower(tier, pal));
    const towerPts = [T, R, B, L, { x: (T.x + R.x) / 2, y: (T.y + R.y) / 2 }, { x: (L.x + T.x) / 2, y: (L.y + T.y) / 2 }, { x: (B.x + R.x) / 2, y: (B.y + R.y) / 2 }];
    for (const p of towerPts) {
      const s = sprite(tb, 1.1);
      s.position.set(p.x, p.y + 4);
      s.zIndex = p.y + 4;
      this.objs.addChild(s);
      this.walls.push(s);
    }
  }

  // ———————————————————————————————————————— plots
  private createView(p: Plot) {
    const root = new Container();
    root.position.set(p.x, p.y);
    root.zIndex = p.y;
    this.objs.addChild(root);
    const light = new Sprite(softCircle());
    light.anchor.set(0.5);
    light.tint = 0xffb050;
    light.blendMode = 'add';
    light.scale.set(4.2, 2.6);
    light.position.set(p.x, p.y - 50);
    light.alpha = 0;
    this.fxLayer.addChild(light);
    this.views.set(p.id, { plot: p, root, sprite: null, glow: null, key: '', level: -1, marker: null, bubble: null, bubbleKind: '', timer: null, timerText: null, timerFill: null, light });
  }

  refresh() {
    const g = this.game;
    for (const v of this.views.values()) {
      const b = g.building(v.plot.id)!;
      const job = g.jobForPlot(v.plot.id);
      const building = job?.kind === 'build';
      let key: string;
      if (b.level === 0 && building) key = 'site';
      else if (b.level === 0) key = v.plot.unlock <= g.citadel ? 'empty' : v.plot.unlock <= g.citadel + 2 ? 'locked' : 'hidden';
      else key = `b:${b.type}:${tierOf(b.level)}:${this.faction}`;
      if (key !== v.key) this.setVisual(v, key, b.type, b.level);
      v.level = b.level;
      this.updateBubble(v);
      this.updateTimer(v);
    }
    if (tierOf(Math.max(1, g.level('wall'))) !== this.wallTier) this.buildWalls();
  }

  private setVisual(v: PlotView, key: string, type: BuildingId, level: number) {
    v.key = key;
    v.sprite?.destroy(); v.sprite = null;
    v.marker?.destroy(); v.marker = null;
    if (key === 'hidden') return;
    if (key === 'empty' || key === 'locked') {
      const m = new Container();
      const gr = new Graphics();
      const a = 92, b = 46;
      gr.poly([-a, 0, 0, -b, a, 0, 0, b]).fill({ color: key === 'empty' ? 0xd8c8a0 : 0x000000, alpha: key === 'empty' ? 0.35 : 0.14 });
      gr.poly([-a, 0, 0, -b, a, 0, 0, b]).stroke({ color: key === 'empty' ? 0xffe9a8 : 0xffffff, alpha: key === 'empty' ? 0.85 : 0.25, width: 3 });
      m.addChild(gr);
      if (key === 'locked') {
        const ic = new Sprite(bubbleIcons.get('lock')!);
        ic.anchor.set(0.5); ic.scale.set(0.42); ic.alpha = 0.7; ic.y = -6;
        m.addChild(ic);
        const t = new Text({ text: `Цитадель ${v.plot.unlock}`, style: { fontFamily: 'Philosopher, Georgia, serif', fontSize: 17, fill: '#fff', stroke: { color: '#000', width: 4 } } });
        t.anchor.set(0.5); t.y = 24; t.alpha = 0.8;
        m.addChild(t);
      }
      v.root.addChild(m);
      v.marker = m;
      return;
    }
    if (key === 'site') {
      v.sprite = sprite(get('site')!, 1);
      v.root.addChild(v.sprite);
      return;
    }
    const b = get(key);
    if (!b) {
      v.key = '';
      this.bakeBuilding(type, level).then(() => { if (v.key === '') this.refresh(); });
      return;
    }
    v.sprite = sprite(b, v.plot.scale ?? 1);
    v.root.addChildAt(v.sprite, 0);
  }

  private updateBubble(v: PlotView) {
    const g = this.game;
    const b = g.building(v.plot.id)!;
    let kind = '';
    const job = g.jobForPlot(v.plot.id);
    const res = PRODUCTION_RES[b.type];
    if (b.level > 0 && res && b.stored >= Math.max(40, productionCap(b.level) * 0.08)) kind = res;
    else if (b.level > 0 && !job) {
      const typeInfo = Object.values(TYPE_INFO).find((t) => t.building === b.type);
      if (typeInfo && !g.s.jobs.some((j) => j.kind === 'train' && j.plot === b.type)) kind = 'sword';
      else if (b.type === 'academy' && !g.jobsOf('research').length) kind = 'book';
      else if (b.type === 'tavern' && g.s.freeSummonAt <= Date.now()) kind = 'key_silver';
    }
    if (b.level === 0 && v.plot.unlock <= g.citadel && !job) kind = 'hammer';
    if (kind === v.bubbleKind) return;
    v.bubbleKind = kind;
    v.bubble?.destroy(); v.bubble = null;
    if (!kind) return;
    const c = new Container();
    const isRes = !!PRODUCTION_RES[b.type] && kind === res;
    const bg = new Graphics();
    bg.circle(0, 0, 30).fill({ color: isRes ? 0xfff6dc : 0x1f2740, alpha: 0.95 }).stroke({ color: 0xe8b84a, width: 4 });
    bg.poly([-9, 26, 9, 26, 0, 40]).fill({ color: isRes ? 0xfff6dc : 0x1f2740 });
    c.addChild(bg);
    const ic = new Sprite(bubbleIcons.get(kind)!);
    ic.anchor.set(0.5); ic.scale.set(0.5);
    c.addChild(ic);
    const top = v.sprite ? -v.sprite.height * v.sprite.anchor.y : -40;
    c.position.set(v.plot.x, v.plot.y + Math.max(top + 30, -240));
    (c as any).baseY = c.y;
    this.uiLayer.addChild(c);
    v.bubble = c;
  }

  private updateTimer(v: PlotView) {
    const job = this.game.jobForPlot(v.plot.id) ?? (['barracks', 'range', 'stable', 'spire'].includes(v.plot.type) ? this.game.s.jobs.find((j) => j.kind === 'train' && j.plot === v.plot.type) : undefined)
      ?? (v.plot.type === 'academy' ? this.game.jobsOf('research')[0] : undefined);
    if (!job) { v.timer?.destroy(); v.timer = null; return; }
    if (!v.timer) {
      const c = new Container();
      const bg = new Graphics();
      bg.roundRect(-80, -14, 160, 28, 14).fill({ color: 0x10141f, alpha: 0.88 }).stroke({ color: 0xe8b84a, width: 2 });
      const fill = new Graphics();
      const t = new Text({ text: '', style: { fontFamily: 'system-ui, sans-serif', fontSize: 17, fontWeight: '700', fill: '#fff' } });
      t.anchor.set(0.5);
      const icon = new Sprite(bubbleIcons.get(job.kind === 'build' ? 'hammer' : job.kind === 'research' ? 'book' : 'sword')!);
      icon.anchor.set(0.5); icon.scale.set(0.5); icon.x = -84;
      c.addChild(bg, fill, t, icon);
      c.position.set(v.plot.x, v.plot.y + 30);
      this.uiLayer.addChild(c);
      v.timer = c; v.timerText = t; v.timerFill = fill;
    }
    const now = Date.now();
    const f = Math.min(1, (now - job.start) / Math.max(1, job.end - job.start));
    v.timerFill!.clear().roundRect(-77, -11, 154 * f, 22, 11).fill({ color: job.kind === 'build' ? 0x4fbf5a : job.kind === 'research' ? 0x4a9aff : 0xe07a3a });
    v.timerText!.text = fmtTime(job.end - now);
  }

  // ———————————————————————————————————————— life
  private spawnLife() {
    const kinds = ['inf', 'arc', 'mag', 'inf', 'arc'] as const;
    for (let i = 0; i < 14; i++) {
      const s = sprite(get(`villager:${kinds[i % kinds.length]}`)!, 1.15);
      this.objs.addChild(s);
      this.villagers.push({ s, path: i % ROAD_PATHS.length, t: Math.random(), speed: 0.012 + Math.random() * 0.01, dir: Math.random() < 0.5 ? 1 : -1 });
    }
    for (let i = 0; i < 4; i++) {
      const c = new Sprite(softCircle());
      c.anchor.set(0.5);
      c.tint = 0x0a1a10;
      c.alpha = 0.12;
      c.scale.set(14 + Math.random() * 6, 7 + Math.random() * 3);
      c.position.set(Math.random() * CITY_W, Math.random() * CITY_H);
      this.ground.addChild(c);
      this.clouds.push(c);
    }
    for (let i = 0; i < 5; i++) this.spawnBird();
  }

  private spawnBird() {
    const c = new Container();
    const g = new Graphics();
    g.moveTo(-10, 0).quadraticCurveTo(-5, -6, 0, 0).quadraticCurveTo(5, -6, 10, 0).stroke({ color: 0x222222, width: 2.5 });
    c.addChild(g);
    c.position.set(-50 - Math.random() * 600, 200 + Math.random() * 1200);
    c.zIndex = 99999;
    this.fxLayer.addChild(c);
    this.birds.push({ s: c, vx: 60 + Math.random() * 40, vy: -10 + Math.random() * 20, ph: Math.random() * 6 });
  }

  // ———————————————————————————————————————— interaction
  private hitPlot(x: number, y: number): PlotView | null {
    let best: PlotView | null = null;
    for (const v of this.views.values()) {
      const p = v.plot;
      if (v.key === 'hidden') continue;
      let hit = false;
      if (v.sprite) {
        const w = v.sprite.width * 0.42, top = v.sprite.height * v.sprite.anchor.y * 0.9;
        hit = x > p.x - w && x < p.x + w && y > p.y - top && y < p.y + 50;
      } else {
        hit = Math.abs(x - p.x) / 95 + Math.abs(y - p.y) / 50 < 1;
      }
      if (hit && (!best || p.y > best.plot.y)) best = v;
    }
    return best;
  }

  private tap(x: number, y: number) {
    // bubbles have priority
    for (const v of this.views.values()) {
      if (v.bubble && Math.hypot(v.bubble.x - x, v.bubble.y - y) < 46) {
        const k = v.bubbleKind;
        if (['food', 'wood', 'stone', 'gold'].includes(k)) {
          this.game.collect(v.plot.id);
          this.refresh();
          return;
        }
        bus.emit('city-bubble', { plot: v.plot.id, kind: k });
        return;
      }
    }
    const v = this.hitPlot(x, y);
    if (!v) { this.select(null); bus.emit('city-deselect'); return; }
    // tapping a production building with stock collects first
    const b = this.game.building(v.plot.id)!;
    if (PRODUCTION_RES[b.type] && b.stored >= 1 && v.bubble) { this.game.collect(v.plot.id); this.refresh(); }
    this.select(v.plot.id);
    bus.emit('city-select', { plot: v.plot.id });
  }

  select(plot: string | null) {
    this.selected = plot;
    this.selGlow?.destroy(); this.selGlow = null;
    if (!plot) return;
    const v = this.views.get(plot)!;
    if (v.sprite) {
      const s = new Sprite(v.sprite.texture);
      s.anchor.copyFrom(v.sprite.anchor);
      s.scale.copyFrom(v.sprite.scale);
      s.blendMode = 'add';
      s.alpha = 0.3;
      v.root.addChild(s);
      this.selGlow = s;
    }
    const sp = this.particles;
    sp.emit({ x: v.plot.x, y: v.plot.y, tex: ringTexture(), scale: 1.6, grow: 1.6, life: 0.5, tint: 0xffe08a, alpha: 0.9, blend: 'add' });
  }

  plotScreen(plot: string): { x: number; y: number; top: number } {
    const v = this.views.get(plot)!;
    const p = this.camera.toScreen(v.plot.x, v.plot.y);
    const h = v.sprite ? v.sprite.height * v.sprite.anchor.y : 60;
    return { x: p.x, y: p.y, top: p.y - h * this.camera.zoom };
  }

  focusPlot(plot: string, zoom = Math.max(this.camera.zoom, window.innerHeight / 900)) {
    const p = PLOT_BY_ID[plot];
    this.camera.flyTo(p.x, p.y - 80, zoom, 700);
  }

  private onBuildDone(e: { plot: string; level: number; type: BuildingId }) {
    const p = PLOT_BY_ID[e.plot];
    if (!p) return;
    this.refresh();
    const v = this.views.get(e.plot)!;
    // pop animation
    if (v.sprite) {
      const s = v.sprite, sc = s.scale.x;
      const t0 = performance.now();
      const anim = () => {
        const t = (performance.now() - t0) / 500;
        if (t >= 1 || s.destroyed) { if (!s.destroyed) s.scale.set(sc); return; }
        const k = 1 + Math.sin(t * Math.PI) * 0.08 * (1 - t);
        s.scale.set(sc * (2 - k), sc * k);
        requestAnimationFrame(anim);
      };
      anim();
    }
    this.particles.burst(p.x, p.y - 40, 36, { tex: starSprite(), tint: 0xffd76a, scale: 0.6, life: 1.2, speed: 220, gravity: 160, blend: 'add', vy: -120, spin: 4 });
    this.particles.emit({ x: p.x, y: p.y, tex: ringTexture(), scale: 1.5, grow: 4, life: 0.8, tint: 0xffe08a, blend: 'add' });
    floatText(this.fxLayer, p.x, p.y - 140, `${BUILDINGS[e.type].name} · ${e.level} ур.`, '#ffe27a', 34);
  }

  private onCollect(e: { plot: string; res: string; amount: number }) {
    const p = PLOT_BY_ID[e.plot];
    if (!p) return;
    const colors: Record<string, number> = { food: 0xffd24a, wood: 0xc08a4a, stone: 0xd8d8d8, gold: 0xffe066 };
    this.particles.burst(p.x, p.y - 100, 14, { tex: starSprite(), tint: colors[e.res], scale: 0.45, life: 0.8, speed: 160, gravity: 200, blend: 'add', vy: -80 });
    floatText(this.fxLayer, p.x, p.y - 150, `+${Math.floor(e.amount).toLocaleString('ru-RU')}`, '#fff3c0', 30);
    const scr = this.camera.toScreen(p.x, p.y - 120);
    bus.emit('fly-res', { res: e.res, x: scr.x, y: scr.y, amount: e.amount });
  }

  // ———————————————————————————————————————— frame
  update(dt: number) {
    this.time += dt;
    this.camera.update();
    this.particles.update(dt);
    // day-night
    if (this.game.s.settings.dayNight) {
      const period = 600;
      const ph = (this.time / period + 0.15) % 1;
      const n = Math.max(0, -Math.sin(ph * Math.PI * 2));
      this.night = Math.min(1, n * 1.3) * 0.75;
    } else this.night = 0;
    const tint = lerpColor(0xffffff, 0x4a5a98, this.night * 0.85);
    this.ground.tint = tint;
    this.objs.tint = tint;
    for (const v of this.views.values()) v.light.alpha = v.level > 0 ? this.night * 0.38 : 0;
    // bubbles bob
    for (const v of this.views.values()) if (v.bubble) v.bubble.y = (v.bubble as any).baseY + Math.sin(this.time * 3 + v.plot.x) * 6;
    // timers once per 250ms
    const sec = Math.floor(this.time * 4);
    if (sec !== this.lastTimerSec) {
      this.lastTimerSec = sec;
      for (const v of this.views.values()) { this.updateTimer(v); this.updateBubble(v); }
    }
    if (this.selGlow) this.selGlow.alpha = 0.18 + Math.sin(this.time * 5) * 0.12;
    // villagers
    for (const vl of this.villagers) {
      const path = ROAD_PATHS[vl.path];
      vl.t += vl.speed * dt * vl.dir * (30 / path.length);
      if (vl.t > 1) { vl.t = 1; vl.dir = -1; }
      if (vl.t < 0) { vl.t = 0; vl.dir = 1; if (Math.random() < 0.5) vl.path = Math.floor(Math.random() * ROAD_PATHS.length); }
      const f = vl.t * (path.length - 1);
      const i = Math.floor(f), k = f - i;
      const a = path[i], b = path[Math.min(path.length - 1, i + 1)];
      const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
      const dx = (b.x - a.x) * vl.dir;
      vl.s.position.set(x, y + Math.abs(Math.sin(this.time * 9 + vl.path)) * -2);
      vl.s.scale.x = Math.abs(vl.s.scale.x) * (dx < 0 ? -1 : 1);
      vl.s.zIndex = y;
    }
    // clouds
    for (const c of this.clouds) { c.x += 14 * dt; c.y += 4 * dt; if (c.x > CITY_W + 600) { c.x = -600; c.y = Math.random() * CITY_H; } }
    // birds
    for (const b of this.birds) {
      b.s.x += b.vx * dt; b.s.y += b.vy * dt;
      b.s.scale.y = 0.6 + Math.abs(Math.sin(this.time * 8 + b.ph)) * 0.6;
      if (b.s.x > CITY_W + 100) { b.s.x = -100; b.s.y = 200 + Math.random() * 1200; }
    }
    // emitters
    this.emitAcc += dt;
    if (this.emitAcc > 0.12) {
      this.emitAcc = 0;
      this.ambientEmit();
    }
  }

  private ambientEmit() {
    const g = this.game;
    const q = g.s.settings.quality === 'high';
    for (const v of this.views.values()) {
      const job = g.jobForPlot(v.plot.id);
      if (job?.kind === 'build') {
        const { x, y } = v.plot;
        if (Math.random() < 0.5) this.particles.emit({ x: x + (Math.random() - 0.5) * 120, y: y - Math.random() * 40, vy: -20, vx: (Math.random() - 0.5) * 20, tint: 0xc8b48a, alpha: 0.45, scale: 0.3, grow: 0.5, life: 1.4 });
        if (Math.random() < 0.25) this.particles.emit({ x: x + (Math.random() - 0.5) * 80, y: y - 30 - Math.random() * 60, tex: starSprite(), tint: 0xffd76a, scale: 0.2, life: 0.4, blend: 'add', spread: 60 });
      }
      if (v.level <= 0) continue;
      const { x, y } = v.plot;
      const t = tierOf(v.level);
      switch (v.plot.type) {
        case 'tavern':
          if (Math.random() < 0.6) this.particles.emit({ x: x - 10 + Math.random() * 4, y: y - 98 - t * 4, vx: 10, vy: -26, tint: 0xcfcfcf, alpha: 0.5, scale: 0.25, grow: 0.5, life: 3 });
          break;
        case 'farm': case 'sawmill':
          if (Math.random() < 0.25) this.particles.emit({ x: x - 6, y: y - 70, vx: 8, vy: -22, tint: 0xdedede, alpha: 0.4, scale: 0.2, grow: 0.45, life: 2.5 });
          break;
        case 'spire':
          if (q && Math.random() < 0.5) this.particles.emit({ x: x + (Math.random() - 0.5) * 40, y: y - 200 - t * 20 - Math.random() * 40, vy: -20, tint: 0xc27bff, scale: 0.18, life: 1.6, blend: 'add', tex: starSprite() });
          break;
        case 'sanctum':
          if (q && Math.random() < 0.6) this.particles.emit({ x: x + (Math.random() - 0.5) * 120, y: y - 20 + (Math.random() - 0.5) * 40, vy: -40, tint: 0x7fe3ff, scale: 0.16, life: 2, blend: 'add', tex: starSprite() });
          break;
        case 'goldmine':
          if (q && Math.random() < 0.25) this.particles.emit({ x: x + (Math.random() - 0.5) * 40, y: y - 30, vy: -18, tint: 0xffd24a, scale: 0.14, life: 1.2, blend: 'add', tex: starSprite() });
          break;
        case 'watchtower':
          if (Math.random() < 0.7) this.particles.emit({ x: x + 26 + (Math.random() - 0.5) * 6, y: y - (t <= 1 ? 150 : 110 + t * 14 + 22), vy: -36, tint: 0xff8a2a, scale: 0.22, life: 0.7, blend: 'add' });
          break;
        case 'citadel':
          if (t >= 4 && q && Math.random() < 0.4) this.particles.emit({ x: x + (Math.random() - 0.5) * 30, y: y - 330, vy: -20, tint: 0x7fe3ff, scale: 0.15, life: 1.5, blend: 'add', tex: starSprite() });
          break;
      }
    }
    if (q && Math.random() < 0.6) {
      const s = this.sparkles[Math.floor(Math.random() * this.sparkles.length)];
      if (s) this.particles.emit({ x: s.x, y: s.y, tex: starSprite(), tint: 0xffffff, scale: 0.25, life: 0.8, blend: 'add', alpha: 0.8 });
    }
  }

  enter() { this.camera.attach(); this.root.visible = true; }
  leave() { this.camera.detach(); this.root.visible = false; }
  gate() { return GATE; }
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export { lerpColor };
