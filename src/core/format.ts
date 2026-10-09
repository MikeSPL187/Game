import type { Currency, ResBag } from './types';

export function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return Math.floor(n).toLocaleString('ru-RU');
}

export function fmtFull(n: number): string {
  return Math.floor(n).toLocaleString('ru-RU');
}

export function fmtTime(ms: number): string {
  let s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  if (d > 0) return `${d}д ${h}ч`;
  if (h > 0) return `${h}ч ${String(m).padStart(2, '0')}м`;
  if (m > 0) return `${m}м ${String(s).padStart(2, '0')}с`;
  return `${s}с`;
}

export function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(v * 100 % 1 === 0 ? 0 : 1)}%`;
}

export const RES_ORDER: Currency[] = ['food', 'wood', 'stone', 'gold', 'aether'];

export function bagEntries(b: ResBag): [Currency, number][] {
  return RES_ORDER.filter((k) => (b[k] ?? 0) > 0).map((k) => [k, b[k]!]);
}

export function dayKey(t = Date.now()): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
