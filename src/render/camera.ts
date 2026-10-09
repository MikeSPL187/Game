import { Container, type FederatedPointerEvent } from 'pixi.js';

export interface CameraOpts {
  worldW: number;
  worldH: number;
  minZoom: number;
  maxZoom: number;
  zoom: number;
}

/**
 * Pan / pinch / wheel camera with inertia. Works directly with DOM pointer events
 * on the canvas so that multi-touch pinch is reliable on Android WebView.
 */
export class Camera {
  x = 0; y = 0; // world point at screen center
  zoom: number;
  vx = 0; vy = 0;
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
  private pinch: { d: number; zoom: number; cx: number; cy: number } | null = null;
  private moved = 0;
  private lastMove = 0;
  enabled = true;
  onTap: ((wx: number, wy: number, sx: number, sy: number) => void) | null = null;
  onMove: (() => void) | null = null;
  private target: { x: number; y: number; zoom: number; t: number; from: { x: number; y: number; zoom: number }; dur: number } | null = null;

  constructor(public view: Container, public el: HTMLElement, public o: CameraOpts) {
    this.zoom = o.zoom;
    this.x = o.worldW / 2; this.y = o.worldH / 2;
  }

  get sw() { return this.el.clientWidth; }
  get sh() { return this.el.clientHeight; }

  attach() {
    const el = this.el;
    el.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    el.addEventListener('wheel', this.wheel, { passive: false });
  }
  detach() {
    const el = this.el;
    el.removeEventListener('pointerdown', this.down);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.up);
    el.removeEventListener('wheel', this.wheel);
    this.pointers.clear();
  }

  private down = (e: PointerEvent) => {
    if (!this.enabled) return;
    this.target = null;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    this.vx = this.vy = 0;
    if (this.pointers.size === 1) this.moved = 0;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      this.moved = 999;
    }
  };

  private move = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      this.zoomAt(this.pinch.zoom * (d / this.pinch.d), cx, cy);
      // pan with midpoint
      this.x -= (cx - this.pinch.cx) / this.zoom;
      this.y -= (cy - this.pinch.cy) / this.zoom;
      this.pinch.cx = cx; this.pinch.cy = cy;
      this.clamp();
      this.onMove?.();
      return;
    }
    this.moved += Math.abs(dx) + Math.abs(dy);
    if (this.moved > 8) {
      this.x -= dx / this.zoom;
      this.y -= dy / this.zoom;
      const now = performance.now();
      const dt = Math.max(1, now - this.lastMove);
      this.lastMove = now;
      this.vx = (-dx / this.zoom) / dt * 16;
      this.vy = (-dy / this.zoom) / dt * 16;
      this.clamp();
      this.onMove?.();
    }
  };

  private up = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0) {
      if (this.moved <= 8 && performance.now() - p.t < 600) {
        const r = this.el.getBoundingClientRect();
        const sx = e.clientX - r.left, sy = e.clientY - r.top;
        const w = this.toWorld(sx, sy);
        this.onTap?.(w.x, w.y, sx, sy);
      }
      if (performance.now() - this.lastMove > 60) { this.vx = this.vy = 0; }
    }
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    const r = this.el.getBoundingClientRect();
    this.target = null;
    this.zoomAt(this.zoom * Math.pow(1.0015, -e.deltaY), e.clientX - r.left, e.clientY - r.top);
    this.clamp();
    this.onMove?.();
  };

  zoomAt(z: number, sx: number, sy: number) {
    z = Math.max(this.o.minZoom, Math.min(this.o.maxZoom, z));
    const before = this.toWorld(sx, sy);
    this.zoom = z;
    const after = this.toWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }

  toWorld(sx: number, sy: number) {
    return { x: this.x + (sx - this.sw / 2) / this.zoom, y: this.y + (sy - this.sh / 2) / this.zoom };
  }
  toScreen(wx: number, wy: number) {
    return { x: (wx - this.x) * this.zoom + this.sw / 2, y: (wy - this.y) * this.zoom + this.sh / 2 };
  }

  clamp() {
    const hw = this.sw / 2 / this.zoom, hh = this.sh / 2 / this.zoom;
    const { worldW, worldH } = this.o;
    this.x = hw * 2 >= worldW ? worldW / 2 : Math.max(hw, Math.min(worldW - hw, this.x));
    this.y = hh * 2 >= worldH ? worldH / 2 : Math.max(hh, Math.min(worldH - hh, this.y));
  }

  flyTo(x: number, y: number, zoom = this.zoom, dur = 600) {
    this.target = { x, y, zoom, t: performance.now(), from: { x: this.x, y: this.y, zoom: this.zoom }, dur };
    this.vx = this.vy = 0;
  }

  update() {
    if (this.target) {
      const t = Math.min(1, (performance.now() - this.target.t) / this.target.dur);
      const e = 1 - Math.pow(1 - t, 3);
      this.x = this.target.from.x + (this.target.x - this.target.from.x) * e;
      this.y = this.target.from.y + (this.target.y - this.target.from.y) * e;
      this.zoom = this.target.from.zoom + (this.target.zoom - this.target.from.zoom) * e;
      if (t >= 1) this.target = null;
      this.clamp();
      this.onMove?.();
    } else if (this.pointers.size === 0 && (Math.abs(this.vx) > 0.01 || Math.abs(this.vy) > 0.01)) {
      this.x += this.vx; this.y += this.vy;
      this.vx *= 0.92; this.vy *= 0.92;
      this.clamp();
      this.onMove?.();
    }
    this.view.scale.set(this.zoom);
    this.view.position.set(Math.round(this.sw / 2 - this.x * this.zoom), Math.round(this.sh / 2 - this.y * this.zoom));
  }

  isInteracting() { return this.pointers.size > 0; }
}

export type { FederatedPointerEvent };
