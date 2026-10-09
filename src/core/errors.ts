import { bus } from './bus';

export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export interface ErrorEntry { time: number; where: string; message: string; stack?: string }

const log: ErrorEntry[] = [];
const MAX = 12;
let burst: number[] = [];

/** Record an error. Returns true when errors are piling up and the game should stop and show the crash screen. */
export function reportError(where: string, err: unknown): boolean {
  const e = err instanceof Error ? err : new Error(String(err));
  const entry: ErrorEntry = { time: Date.now(), where, message: e.message || String(err), stack: e.stack };
  log.push(entry);
  if (log.length > MAX) log.shift();
  console.error(`[${where}]`, err);
  const now = Date.now();
  burst = burst.filter((t) => now - t < 5000);
  burst.push(now);
  const fatal = burst.length >= 4;
  bus.emit('error', { entry, fatal });
  return fatal;
}

export function errorLog(): readonly ErrorEntry[] { return log; }

export function errorReport(extra: Record<string, unknown> = {}): string {
  const lines = [
    `Aetherfall ${APP_VERSION}`,
    `UA: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a'}`,
    `Time: ${new Date().toISOString()}`,
    ...Object.entries(extra).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`),
    '',
    ...log.slice().reverse().map((e) => `[${new Date(e.time).toISOString()}] ${e.where}: ${e.message}\n${(e.stack ?? '').split('\n').slice(0, 6).join('\n')}`),
  ];
  return lines.join('\n');
}

export function installGlobalHandlers() {
  bus.onError = (ev, err) => { reportError(`event:${ev}`, err); };
  window.addEventListener('error', (ev) => { reportError('window', ev.error ?? ev.message); });
  window.addEventListener('unhandledrejection', (ev) => { reportError('promise', ev.reason); });
}
