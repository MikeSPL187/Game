import { Container, Sprite, Text, Texture } from 'pixi.js';
import { canvasTexture } from './textures';

let softTex: Texture | null = null;
let starTex: Texture | null = null;
let ringTex: Texture | null = null;

export function softCircle(): Texture {
  if (softTex) return softTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  softTex = canvasTexture(c);
  return softTex;
}

export function starSprite(): Texture {
  if (starTex) return starTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  g.translate(16, 16);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 3 : 16;
    const a = (i / 8) * Math.PI * 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.fill();
  starTex = canvasTexture(c);
  return starTex;
}

export function ringTexture(): Texture {
  if (ringTex) return ringTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.lineWidth = 6;
  g.shadowColor = 'white';
  g.shadowBlur = 12;
  g.beginPath(); g.ellipse(64, 64, 56, 28, 0, 0, Math.PI * 2); g.stroke();
  ringTex = canvasTexture(c);
  return ringTex;
}

interface Particle {
  s: Sprite;
  vx: number; vy: number;
  life: number; max: number;
  grow: number; fade: number;
  gravity: number;
  spin: number;
  a0: number;
}

/** Lightweight pooled particle system */
export class Particles {
  layer = new Container();
  private list: Particle[] = [];
  private pool: Sprite[] = [];

  emit(o: { x: number; y: number; tex?: Texture; tint?: number; vx?: number; vy?: number; spread?: number; life?: number; scale?: number; grow?: number; alpha?: number; gravity?: number; blend?: 'add' | 'normal'; spin?: number }) {
    const s = this.pool.pop() ?? new Sprite();
    s.texture = o.tex ?? softCircle();
    s.anchor.set(0.5);
    s.position.set(o.x, o.y);
    s.tint = o.tint ?? 0xffffff;
    s.alpha = o.alpha ?? 1;
    s.scale.set(o.scale ?? 0.3);
    s.blendMode = o.blend === 'add' ? 'add' : 'normal';
    s.rotation = Math.random() * 6;
    s.visible = true;
    this.layer.addChild(s);
    const sp = o.spread ?? 0;
    this.list.push({
      s, vx: (o.vx ?? 0) + (Math.random() - 0.5) * sp, vy: (o.vy ?? 0) + (Math.random() - 0.5) * sp,
      life: 0, max: o.life ?? 1, grow: o.grow ?? 0, fade: 1, gravity: o.gravity ?? 0, spin: o.spin ?? 0, a0: o.alpha ?? 1,
    });
  }

  burst(x: number, y: number, n: number, opts: Omit<Parameters<Particles['emit']>[0], 'x' | 'y'> & { speed?: number }) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 80) * (0.4 + Math.random() * 0.6);
      this.emit({ ...opts, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 + (opts.vy ?? 0) });
    }
  }

  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life += dt;
      const t = p.life / p.max;
      if (t >= 1) {
        p.s.visible = false;
        this.layer.removeChild(p.s);
        this.pool.push(p.s);
        this.list.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.rotation += p.spin * dt;
      if (p.grow) p.s.scale.set(p.s.scale.x + p.grow * dt);
      p.s.alpha = p.a0 * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
    }
  }
}

export function floatText(layer: Container, x: number, y: number, text: string, color = '#ffe27a', size = 30) {
  const t = new Text({
    text,
    style: { fontFamily: 'Philosopher, Georgia, serif', fontSize: size, fontWeight: '700', fill: color, stroke: { color: '#1a1008', width: 5 }, dropShadow: { color: '#000', alpha: 0.6, blur: 4, distance: 2 } },
  });
  t.anchor.set(0.5);
  t.position.set(x, y);
  layer.addChild(t);
  const start = performance.now();
  const tick = () => {
    const e = (performance.now() - start) / 1600;
    if (e >= 1) { t.destroy(); return; }
    t.y = y - e * 90;
    t.alpha = e < 0.7 ? 1 : 1 - (e - 0.7) / 0.3;
    t.scale.set(e < 0.12 ? 0.5 + e / 0.12 * 0.6 : 1.1 - Math.min(0.1, (e - 0.12)));
    requestAnimationFrame(tick);
  };
  tick();
}
