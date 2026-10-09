import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const KEY = 'aetherfall.save.v1';
const native = Capacitor.isNativePlatform();

export async function loadSave(): Promise<string | null> {
  try {
    if (native) {
      const r = await Preferences.get({ key: KEY });
      if (r.value) return r.value;
    }
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function writeSave(json: string): Promise<void> {
  try {
    if (native) await Preferences.set({ key: KEY, value: json });
    else localStorage.setItem(KEY, json);
  } catch (e) {
    console.warn('save failed', e);
  }
}

export async function clearSave(): Promise<void> {
  try {
    if (native) await Preferences.remove({ key: KEY });
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}
