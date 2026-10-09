import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export const KEY = 'aetherfall.save.v1';
export const KEY_BACKUP = 'aetherfall.save.v1.backup';
const BACKUP_EVERY_MS = 3 * 60_000;

export interface Backend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const localBackend: Backend = {
  async get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  async set(k, v) { localStorage.setItem(k, v); },
  async remove(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

const nativeBackend: Backend = {
  async get(k) { const r = await Preferences.get({ key: k }); return r.value ?? (await localBackend.get(k)); },
  async set(k, v) { await Preferences.set({ key: k, value: v }); },
  async remove(k) { await Preferences.remove({ key: k }); await localBackend.remove(k); },
};

let backend: Backend = typeof window !== 'undefined' && Capacitor.isNativePlatform() ? nativeBackend : localBackend;
let lastBackup = 0;

/** For tests: swap the storage backend. */
export function setBackend(b: Backend) { backend = b; lastBackup = 0; }

/** Cheap structural check that a string is a complete save. */
export function looksValid(json: string | null): boolean {
  if (!json || json.length < 50) return false;
  try {
    const s = JSON.parse(json);
    return !!s && typeof s === 'object' && typeof s.version === 'number' && Array.isArray(s.buildings) && !!s.world && Array.isArray(s.world.objects) && !!s.player;
  } catch {
    return false;
  }
}

/**
 * Returns save candidates, best first: primary, then backup.
 * The caller tries to deserialize each and keeps the first that works.
 */
export async function loadSaveCandidates(): Promise<{ json: string; slot: 'primary' | 'backup' }[]> {
  const out: { json: string; slot: 'primary' | 'backup' }[] = [];
  try {
    const p = await backend.get(KEY);
    if (looksValid(p)) out.push({ json: p!, slot: 'primary' });
  } catch { /* corrupted storage entry */ }
  try {
    const b = await backend.get(KEY_BACKUP);
    if (looksValid(b)) out.push({ json: b!, slot: 'backup' });
  } catch { /* ignore */ }
  return out;
}

export async function loadSave(): Promise<string | null> {
  return (await loadSaveCandidates())[0]?.json ?? null;
}

export async function writeSave(json: string, now = Date.now()): Promise<boolean> {
  if (!looksValid(json)) return false;
  try {
    await backend.set(KEY, json);
    if (now - lastBackup >= BACKUP_EVERY_MS) {
      lastBackup = now;
      await backend.set(KEY_BACKUP, json);
    }
    return true;
  } catch (e) {
    console.warn('save failed', e);
    return false;
  }
}

export async function clearSave(): Promise<void> {
  await backend.remove(KEY);
  await backend.remove(KEY_BACKUP);
}

// ———————————————————————————————————————— export / import
const PREFIX_GZ = 'AF1Z:';
const PREFIX_RAW = 'AF1:';

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/** Portable save code the player can copy to another device. */
export async function exportCode(json: string): Promise<string> {
  const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream !== 'undefined') {
    try { return PREFIX_GZ + toB64(await pipe(bytes, new CompressionStream('gzip'))); } catch { /* fall through */ }
  }
  return PREFIX_RAW + toB64(bytes);
}

export async function importCode(code: string): Promise<string | null> {
  const c = code.trim().replace(/\s+/g, '');
  try {
    if (c.startsWith(PREFIX_GZ)) {
      if (typeof DecompressionStream === 'undefined') return null;
      const json = new TextDecoder().decode(await pipe(fromB64(c.slice(PREFIX_GZ.length)), new DecompressionStream('gzip')));
      return looksValid(json) ? json : null;
    }
    if (c.startsWith(PREFIX_RAW)) {
      const json = new TextDecoder().decode(fromB64(c.slice(PREFIX_RAW.length)));
      return looksValid(json) ? json : null;
    }
  } catch { /* invalid code */ }
  return null;
}
