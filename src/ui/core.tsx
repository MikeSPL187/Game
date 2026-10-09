import type { ComponentChildren } from 'preact';
import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { bus } from '../core/bus';
import { fmt, fmtTime } from '../core/format';
import type { Currency, ResBag, Reward } from '../core/types';
import { iconUrl } from '../art/icons';
import { ITEM_BY_ID } from '../data/items';
import { HERO_BY_ID } from '../data/heroes';
import type { GameApp } from '../app';
import { sfx } from '../audio/audio';

// ———————————————————————————————————————— global context
export let ga: GameApp;
export function setGa(g: GameApp) { ga = g; }
export const game = () => ga.game;

export interface PanelSpec { id: string; props?: any }
type Listener = () => void;

class UIStore {
  stack: PanelSpec[] = [];
  private ls = new Set<Listener>();
  sub(l: Listener) { this.ls.add(l); return () => { this.ls.delete(l); }; }
  emit() { this.ls.forEach((l) => l()); }
  open(id: string, props?: any) {
    sfx('open');
    // replace if same panel already on top
    if (this.stack.length && this.stack[this.stack.length - 1].id === id) this.stack[this.stack.length - 1] = { id, props };
    else this.stack.push({ id, props });
    this.emit();
    bus.emit('ui-open', id);
  }
  close() { if (!this.stack.length) return; sfx('close'); this.stack.pop(); this.emit(); bus.emit('ui-close'); }
  closeAll() { if (!this.stack.length) return; this.stack = []; this.emit(); bus.emit('ui-close'); }
  top() { return this.stack[this.stack.length - 1]; }
}
export const ui = new UIStore();

export function useStore() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => ui.sub(() => force(0)), []);
  return ui;
}

/** Re-render on simulation tick / state change, throttled to animation frames. */
export function useGame(events = ['tick', 'state']) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    let raf = 0;
    const f = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; force(0); }); };
    const offs = events.map((e) => bus.on(e, f));
    return () => { offs.forEach((o) => o()); cancelAnimationFrame(raf); };
  }, []);
  return ga.game;
}

export function useNow(ms = 250) {
  const [now, set] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => set(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

// ———————————————————————————————————————— feedback
export function haptic(strong = false) {
  if (!game().s.settings.haptics) return;
  if (Capacitor.isNativePlatform()) Haptics.impact({ style: strong ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
  else if (navigator.vibrate) navigator.vibrate(strong ? 18 : 8);
}

export function toast(text: string, err = false) {
  bus.emit('toast', { text, err });
  if (err) sfx('error');
}

/** Run a game action returning Result and give feedback. */
export function act(r: { ok: boolean; error?: string }, okSound = 'click'): boolean {
  if (!r.ok) { toast(r.error ?? 'Ошибка', true); haptic(true); return false; }
  sfx(okSound);
  haptic();
  return true;
}

// ———————————————————————————————————————— primitives
export function Icon({ name, size = 24, style }: { name: string; size?: number; style?: any }) {
  return <img class="ico" src={iconUrl(name)} width={size} height={size} style={style} draggable={false} />;
}

export function Btn(p: { children: ComponentChildren; onClick?: () => void; kind?: 'gold' | 'green' | 'blue' | 'red' | 'dark' | 'purple'; size?: 'small' | 'big'; wide?: boolean; disabled?: boolean; off?: boolean; style?: any; class?: string }) {
  const cls = ['btn', p.kind && p.kind !== 'gold' ? p.kind : '', p.size ?? '', p.wide ? 'wide' : '', p.off ? 'off' : '', p.class ?? ''].join(' ');
  return (
    <button class={cls} disabled={p.disabled} style={p.style} onClick={(e) => { e.stopPropagation(); if (p.disabled) return; p.onClick?.(); }}>
      {p.children}
    </button>
  );
}

export function IconBtn(p: { icon: string; label?: string; badge?: number | boolean; onClick: () => void; size?: number; pulse?: boolean; style?: any }) {
  return (
    <button class={'iconbtn' + (p.pulse ? ' pulse' : '')} style={{ width: p.size, height: p.size, ...p.style }} onClick={(e) => { e.stopPropagation(); sfx('click'); haptic(); p.onClick(); }}>
      <Icon name={p.icon} size={Math.round((p.size ?? 58) * 0.62)} />
      {p.label && <span class="lbl">{p.label}</span>}
      {p.badge ? <span class={'badge' + (p.badge === true ? ' dot' : '')}>{p.badge === true ? '' : p.badge}</span> : null}
    </button>
  );
}

export function Panel(p: { title: ComponentChildren; children: ComponentChildren; width?: number; height?: number; tabs?: { id: string; label: string; badge?: boolean }[]; tab?: string; onTab?: (id: string) => void; onClose?: () => void; icon?: string; noPad?: boolean }) {
  return (
    <div class="overlay" onClick={() => (p.onClose ?? (() => ui.close()))()}>
      <div class="panel" style={{ width: p.width ?? 900, height: p.height }} onClick={(e) => e.stopPropagation()}>
        <div class="panel-head">
          {p.icon && <Icon name={p.icon} size={34} />}
          <div class="panel-title">{p.title}</div>
          <button class="panel-close" onClick={() => (p.onClose ?? (() => ui.close()))()}>✕</button>
        </div>
        {p.tabs && (
          <div class="tabs">
            {p.tabs.map((t) => (
              <button class={'tab' + (t.id === p.tab ? ' on' : '')} onClick={() => { sfx('page'); p.onTab?.(t.id); }}>
                {t.label}{t.badge && <span class="badge dot" style={{ top: -3, right: -3 }} />}
              </button>
            ))}
          </div>
        )}
        <div class="panel-body scroll" style={p.noPad ? { padding: 0 } : undefined}>{p.children}</div>
      </div>
    </div>
  );
}

export function Cost({ cost, have = true, size = 22 }: { cost: ResBag; have?: boolean; size?: number }) {
  const g = game();
  return (
    <div class="cost">
      {(Object.entries(cost) as [Currency, number][]).filter(([, v]) => v > 0).map(([k, v]) => (
        <span class={'chip' + (have && g.s.res[k] < v ? ' lack' : '')}>
          <Icon name={k} size={size} /> {fmt(v)}
        </span>
      ))}
    </div>
  );
}

export function Bar({ value, max, kind, label, h }: { value: number; max: number; kind?: 'blue' | 'gold' | 'red' | 'purple'; label?: string; h?: number }) {
  const p = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <div class={'bar ' + (kind ?? '')} style={h ? { height: h } : undefined}>
      <i style={{ width: `${p * 100}%` }} />
      {label != null && <span>{label}</span>}
    </div>
  );
}

export function Timer({ end }: { end: number }) {
  const now = useNow(250);
  return <>{fmtTime(end - now)}</>;
}

export function Stars({ n, max = 5, size = 14 }: { n: number; max?: number; size?: number }) {
  return (
    <span class="stars">
      {Array.from({ length: max }, (_, i) => <Icon name="star" size={size} style={{ opacity: i < n ? 1 : 0.22, filter: i < n ? undefined : 'grayscale(1)' }} />)}
    </span>
  );
}

export function RewardList({ r, compact }: { r: Reward; compact?: boolean }) {
  const items: { icon: string; label: string; rar?: string }[] = [];
  for (const [k, v] of Object.entries(r.res ?? {})) if (v) items.push({ icon: k, label: fmt(v) });
  for (const [k, v] of Object.entries(r.items ?? {})) if (v) items.push({ icon: ITEM_BY_ID[k]?.icon ?? 'chest', label: `×${v}`, rar: ITEM_BY_ID[k]?.rarity });
  for (const [k, v] of Object.entries(r.shards ?? {})) if (v) items.push({ icon: 'shard', label: `${HERO_BY_ID[k]?.name ?? k} ×${v}`, rar: 'epic' });
  if (r.heroXp) items.push({ icon: 'tome', label: `${fmt(r.heroXp)} XP` });
  if (compact) {
    return <div class="cost">{items.map((i) => <span class="chip"><Icon name={i.icon} size={20} />{i.label}</span>)}</div>;
  }
  return (
    <div class="reward-pop">
      {items.map((i, n) => (
        <div class={'it r-' + (i.rar ?? 'common')} style={{ animationDelay: `${n * 0.06}s` }}>
          <div class="ic"><Icon name={i.icon} size={50} /></div>
          <b>{i.label}</b>
        </div>
      ))}
    </div>
  );
}

export function Slider({ value, max, onInput, min = 0 }: { value: number; max: number; min?: number; onInput: (v: number) => void }) {
  const p = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return <input class="slider" type="range" min={min} max={max} value={value} style={{ '--p': `${p}%` } as any} onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))} />;
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button class={'toggle' + (on ? ' on' : '')} onClick={() => { sfx('click'); onChange(!on); }} />;
}

/** Keep a value from a ref that updates every animation frame (for positions) */
export function useRaf(fn: () => void) {
  const r = useRef(fn);
  r.current = fn;
  useEffect(() => {
    let id = 0;
    const loop = () => { r.current(); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
}

export const K = () => Number(getComputedStyle(document.documentElement).getPropertyValue('--k')) || 1;
