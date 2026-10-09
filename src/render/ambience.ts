import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { hash2 } from '../core/rng';
import { T } from '../game/terrain';
import { softCircle, starSprite } from './fx';
import { canvasTexture, get } from './textures';
import type { WorldScene } from './worldScene';

/**
 * "Living world" layer for the world map (high quality only):
 * boats sailing on deep water, glints on the water, drifting cloud shadows,
 * screen-space weather picked from the biome under the camera, and idle effects on camps and titans.
 */

type Weather = 'clear' | 'rain' | 'snow' | 'ash' | 'fog';
interface Boat { s: Sprite; x: number; y: number; tx: number; ty: number; speed: number; seed: number }
interface Drop { s: Sprite; vx: number; vy: number; life: number; max: number; kind: Weather }

let rainTex: Texture | null = null;
function rainStreak(): Texture {
  if (rainTex) return rainTex;
  const c = document.createElement('canvas');
  c.width = 4; c.height = 32;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 32);
  grd.addColorStop(0, 'rgba(220,235,255,0)'); grd.addColorStop(1, 'rgba(220,235,255,.9)');
  g.fillStyle = grd; g.fillRect(1, 0, 2, 32);
  rainTex = canvasTexture(c);
  return rainTex;
}

const TILE = 64;
const isWater = (t: number) => t === T.Deep || t === T.Shallow;

export class WorldAmbience {
  /** world-space: boats and cloud shadows (added under the fog) */
  layer = new Container();
  /** screen-space weather (added above the world) */
  screen = new Container();
  private boats: Boat[] = [];
  private shadows: Sprite[] = [];
  private shadowsPlaced = false;
  private drops: Drop[] = [];
  private pool: Sprite[] = [];
  private tint = new Graphics();
  private fogPuffs: Sprite[] = [];
  weather: Weather = 'clear';
  private intensity = 0;
  private target: Weather = 'clear';
  private sampleT = 0;
  private time = 0;
  enabled = true;

  constructor(private sc: WorldScene) {
    this.screen.addChild(this.tint);
    this.buildBoats();
    for (let i = 0; i < 7; i++) {
      const s = new Sprite(softCircle());
      s.anchor.set(0.5); s.tint = 0x0a1020; s.alpha = 0.1;
      s.scale.set(14 + (i % 3) * 4, 8 + (i % 2) * 3);
      this.shadows.push(s);
      this.layer.addChild(s);
    }
    for (let i = 0; i < 6; i++) {
      const s = new Sprite(softCircle());
      s.anchor.set(0.5); s.tint = 0xc8d4c8; s.alpha = 0; s.visible = false;
      this.fogPuffs.push(s);
      this.screen.addChild(s);
    }
  }

  private buildBoats() {
    const ter = this.sc.ter, n = ter.size;
    const deep: number[] = [];
    for (let y = 2; y < n - 2; y++) for (let x = 2; x < n - 2; x++) {
      if (ter.t[y * n + x] !== T.Deep) continue;
      let ok = true;
      for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (!isWater(ter.t[(y + dy) * n + x + dx])) { ok = false; break; }
      if (ok) deep.push(y * n + x);
    }
    const picked: number[] = [];
    for (const i of deep) {
      if (picked.length >= 12) break;
      if (hash2(i % n, Math.floor(i / n), ter.seed + 91) > 0.04) continue;
      if (picked.some((p) => Math.hypot((p % n) - (i % n), Math.floor(p / n) - Math.floor(i / n)) < 10)) continue;
      picked.push(i);
    }
    const b = get('wboat');
    if (!b) return;
    for (const i of picked) {
      const s = new Sprite(b.tex);
      s.anchor.set(b.ax, b.ay);
      s.scale.set(0.75 / (b.tex.width / b.w));
      const x = i % n + 0.5, y = Math.floor(i / n) + 0.5;
      const boat: Boat = { s, x, y, tx: x, ty: y, speed: 0.25 + hash2(x, y, 7) * 0.2, seed: hash2(x, y, 3) * 10 };
      this.pickTarget(boat);
      this.boats.push(boat);
      this.layer.addChild(s);
    }
  }

  private pickTarget(b: Boat) {
    const ter = this.sc.ter, n = ter.size;
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2, d = 2 + Math.random() * 6;
      const tx = b.x + Math.cos(a) * d, ty = b.y + Math.sin(a) * d * 0.7;
      let ok = true;
      for (let k = 0; k <= 10 && ok; k++) {
        const px = Math.floor(b.x + (tx - b.x) * (k / 10)), py = Math.floor(b.y + (ty - b.y) * (k / 10));
        if (px < 1 || py < 1 || px >= n - 1 || py >= n - 1 || ter.t[py * n + px] !== T.Deep) ok = false;
      }
      if (ok) { b.tx = tx; b.ty = ty; return; }
    }
    b.tx = b.x; b.ty = b.y;
  }

  private spawn(kind: Weather, sw: number, sh: number) {
    const s = this.pool.pop() ?? new Sprite();
    s.anchor.set(0.5); s.visible = true; s.rotation = 0;
    let vx = 0, vy = 0, max = 2;
    if (kind === 'rain') {
      s.texture = rainStreak(); s.tint = 0xffffff; s.alpha = 0.55; s.scale.set(0.8, 0.9 + Math.random() * 0.6);
      vx = -140; vy = 760; max = (sh + 60) / vy; s.rotation = Math.atan2(-vx, vy);
      s.position.set(Math.random() * (sw + 200), -30);
    } else if (kind === 'snow') {
      s.texture = softCircle(); s.tint = 0xffffff; s.alpha = 0.9; s.scale.set(0.08 + Math.random() * 0.1);
      vx = -20 + Math.random() * 30; vy = 40 + Math.random() * 40; max = (sh + 40) / vy;
      s.position.set(Math.random() * (sw + 100), -20);
    } else {
      // ash: embers rise, flakes fall
      const ember = Math.random() < 0.45;
      s.texture = ember ? starSprite() : softCircle();
      s.tint = ember ? 0xff8a3a : 0x6a6260; s.alpha = ember ? 1 : 0.7; s.scale.set(ember ? 0.3 + Math.random() * 0.2 : 0.07 + Math.random() * 0.06);
      s.blendMode = ember ? 'add' : 'normal';
      vx = 15 - Math.random() * 30; vy = ember ? -30 - Math.random() * 30 : 25 + Math.random() * 20;
      max = 4 + Math.random() * 3;
      s.position.set(Math.random() * sw, ember ? sh * (0.4 + Math.random() * 0.7) : -10);
    }
    if (kind !== 'ash') s.blendMode = 'normal';
    this.screen.addChild(s);
    this.drops.push({ s, vx, vy, life: 0, max, kind });
  }

  /** dominant biome around the camera decides the weather */
  private sampleWeather() {
    const cam = this.sc.camera, ter = this.sc.ter, n = ter.size;
    const cx = cam.x / TILE, cy = cam.y / TILE;
    const r = Math.max(4, Math.min(16, cam.sw / cam.zoom / TILE / 3));
    const cnt: Record<number, number> = {};
    for (let i = 0; i < 49; i++) {
      const x = Math.floor(cx + ((i % 7) - 3) / 3 * r), y = Math.floor(cy + (Math.floor(i / 7) - 3) / 3 * r);
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const t = ter.t[y * n + x];
      cnt[t] = (cnt[t] ?? 0) + 1;
    }
    const c = (t: number) => cnt[t] ?? 0;
    const storm = Math.sin(this.time / 70) > 0.35; // rain comes and goes in waves
    if (c(T.Snow) + c(T.Mountain) * 0.6 > 12) this.target = 'snow';
    else if (c(T.Ash) > 10) this.target = 'ash';
    else if (c(T.Swamp) > 8) this.target = 'fog';
    else if (storm && c(T.Forest) + c(T.Grass) + c(T.Meadow) + c(T.Hills) > 20) this.target = 'rain';
    else this.target = 'clear';
  }

  update(dt: number) {
    this.time += dt;
    const on = this.enabled && this.sc.game.s.settings.quality === 'high';
    this.layer.visible = on;
    this.screen.visible = on;
    if (!on) return;
    const cam = this.sc.camera, z = cam.zoom, sw = cam.sw, sh = cam.sh;
    const hw = sw / 2 / z, hh = sh / 2 / z;
    // boats
    for (const b of this.boats) {
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
      if (d < 0.05) this.pickTarget(b);
      else { const k = Math.min(1, (b.speed * dt) / d); b.x += dx * k; b.y += dy * k; }
      b.s.position.set(b.x * TILE, b.y * TILE + Math.sin(this.time * 1.6 + b.seed) * 2);
      b.s.rotation = Math.sin(this.time * 1.2 + b.seed) * 0.05;
      const sx = Math.abs(b.s.scale.x);
      if (Math.abs(dx) > 0.02) b.s.scale.x = dx < 0 ? -sx : sx;
      b.s.visible = this.sc.revealed(b.x, b.y);
      if (b.s.visible && d > 0.05 && Math.random() < dt * 3) this.sc.particles.emit({ x: b.s.x - Math.sign(dx) * 18, y: b.s.y, tex: softCircle(), tint: 0xffffff, alpha: 0.5, scale: 0.12, grow: 0.4, life: 1.2 });
    }
    // cloud shadows drift with the wind and wrap around the view
    const wx = 22, wy = 8;
    if (!this.shadowsPlaced) {
      this.shadowsPlaced = true;
      this.shadows.forEach((s, i) => s.position.set(cam.x + (hash2(i, 1, 5) - 0.5) * hw * 3, cam.y + (hash2(i, 2, 5) - 0.5) * hh * 3));
    }
    this.shadows.forEach((s) => {
      s.x += wx * dt; s.y += wy * dt;
      const L = cam.x - hw * 1.6, R = cam.x + hw * 1.6, U = cam.y - hh * 1.6, D = cam.y + hh * 1.6;
      if (s.x > R) s.x = L; else if (s.x < L) s.x = R;
      if (s.y > D) s.y = U; else if (s.y < U) s.y = D;
      s.visible = z < 1.6;
    });
    // glints on the water
    if (z > 0.22) {
      for (let k = 0; k < 3; k++) {
        const x = cam.x + (Math.random() - 0.5) * hw * 2, y = cam.y + (Math.random() - 0.5) * hh * 2;
        const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE), n = this.sc.ter.size;
        if (tx < 0 || ty < 0 || tx >= n || ty >= n || !isWater(this.sc.ter.t[ty * n + tx]) || !this.sc.revealed(tx, ty)) continue;
        this.sc.particles.emit({ x, y, tex: starSprite(), tint: 0xffffff, scale: 0.12 + Math.random() * 0.12, life: 0.7, blend: 'add', alpha: 0.9 });
      }
    }
    // weather
    this.sampleT -= dt;
    if (this.sampleT <= 0) { this.sampleT = 1.5; this.sampleWeather(); }
    if (this.weather !== this.target) {
      this.intensity = Math.max(0, this.intensity - dt * 0.6);
      if (this.intensity <= 0) this.weather = this.target;
    } else this.intensity = Math.min(1, this.intensity + dt * 0.4);
    const w = this.weather, I = this.intensity;
    const rate = w === 'rain' ? 140 : w === 'snow' ? 70 : w === 'ash' ? 40 : 0;
    let budget = rate * I * dt * (sw / 1280);
    while (budget > 0 && this.drops.length < 260) { if (Math.random() < budget) this.spawn(w, sw, sh); budget -= 1; }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life += dt;
      d.s.x += d.vx * dt; d.s.y += d.vy * dt;
      if (d.kind === 'snow') d.s.x += Math.sin(this.time * 2 + d.s.y * 0.02) * 12 * dt;
      if (d.kind === 'ash') d.s.alpha = Math.max(0, 0.9 * (1 - d.life / d.max));
      // leftovers of the previous weather fade out quickly
      if (d.kind !== w) d.s.alpha -= dt * 1.5;
      if (d.life >= d.max || d.s.alpha <= 0 || d.s.y > sh + 40 || d.s.y < -60) {
        d.s.visible = false; d.s.parent?.removeChild(d.s); this.pool.push(d.s);
        this.drops.splice(i, 1);
      }
    }
    // screen tint for rain/ash, fog puffs for swamps
    this.tint.clear();
    const tintCol = w === 'rain' ? 0x1a2a40 : w === 'ash' ? 0x3a1a10 : w === 'fog' ? 0x8a9a8a : 0;
    if (tintCol && I > 0) this.tint.rect(0, 0, sw, sh).fill({ color: tintCol, alpha: (w === 'fog' ? 0.1 : 0.14) * I });
    this.fogPuffs.forEach((s, i) => {
      const show = w === 'fog' && I > 0;
      s.visible = show;
      if (!show) return;
      s.scale.set(sw / 64 * 0.45, sh / 64 * 0.35);
      s.x = ((i / this.fogPuffs.length) * (sw + 400) + this.time * 18) % (sw + 400) - 200;
      s.y = sh * (0.25 + (i % 3) * 0.25) + Math.sin(this.time * 0.3 + i) * 20;
      s.alpha = 0.22 * I;
    });
  }

  /** idle life on map objects (called per visible object) */
  objectFx(kind: string, x: number, y: number, titanId: string | undefined, dt: number) {
    if (!this.screen.visible) return;
    const p = this.sc.particles;
    if (kind === 'camp' && Math.random() < dt * 0.8) p.emit({ x: x + (Math.random() - 0.5) * 50, y: y - 20, vy: -24, tex: softCircle(), tint: 0xb04af0, alpha: 0.55, scale: 0.18, grow: 0.5, life: 1.8, blend: 'add' });
    if (kind === 'titan' && Math.random() < dt * 2.2) {
      const tint = titanId === 'wyrm' ? 0xff7a2a : titanId === 'golem' ? 0x7fe3ff : 0xbfe8ff;
      p.emit({ x: x + (Math.random() - 0.5) * 90, y: y - 40 - Math.random() * 60, vy: titanId === 'wyrm' ? -40 : -12, tex: starSprite(), tint, scale: 0.25, life: 1.2, blend: 'add', spread: 20 });
    }
    if (kind === 'rift' && Math.random() < dt * 1.5) p.emit({ x: x + (Math.random() - 0.5) * 40, y: y - 14, vy: -30, tex: starSprite(), tint: 0xd08aff, scale: 0.2, life: 1, blend: 'add', spread: 30 });
  }
}
