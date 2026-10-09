import { beforeEach, describe, expect, it } from 'vitest';
import { KEY, KEY_BACKUP, exportCode, importCode, loadSaveCandidates, looksValid, setBackend, writeSave, type Backend } from '../src/core/storage';
import { Game } from '../src/game/game';

const T0 = 1_700_000_000_000;
let mem: Map<string, string>;
const backend: Backend = {
  async get(k) { return mem.get(k) ?? null; },
  async set(k, v) { mem.set(k, v); },
  async remove(k) { mem.delete(k); },
};

beforeEach(() => { mem = new Map(); setBackend(backend); });

describe('storage', () => {
  it('writes primary and backup, and loads primary first', async () => {
    const g = Game.create('order', 'A', 1, T0);
    expect(await writeSave(g.serialize(), T0)).toBe(true);
    expect(mem.has(KEY)).toBe(true);
    expect(mem.has(KEY_BACKUP)).toBe(true);
    const c = await loadSaveCandidates();
    expect(c.map((x) => x.slot)).toEqual(['primary', 'backup']);
  });

  it('falls back to the backup when the primary slot is corrupted', async () => {
    const g = Game.create('wild', 'B', 2, T0);
    await writeSave(g.serialize(), T0);
    mem.set(KEY, mem.get(KEY)!.slice(0, 500)); // truncated write
    const c = await loadSaveCandidates();
    expect(c).toHaveLength(1);
    expect(c[0].slot).toBe('backup');
    expect(Game.deserialize(c[0].json)!.s.player.name).toBe('B');
  });

  it('refuses to overwrite a good save with garbage', async () => {
    const g = Game.create('ash', 'C', 3, T0);
    await writeSave(g.serialize(), T0);
    expect(await writeSave('{"broken":', T0 + 1)).toBe(false);
    expect(looksValid(mem.get(KEY)!)).toBe(true);
  });

  it('backup is refreshed only periodically', async () => {
    const g = Game.create('order', 'D', 4, T0);
    await writeSave(g.serialize(), T0);
    g.s.player.name = 'E';
    await writeSave(g.serialize(), T0 + 10_000);
    expect(JSON.parse(mem.get(KEY)!).player.name).toBe('E');
    expect(JSON.parse(mem.get(KEY_BACKUP)!).player.name).toBe('D');
  });

  it('export / import round-trips a save', async () => {
    const g = Game.create('wild', 'Экспорт', 5, T0);
    g.s.res.food = 4242;
    const code = await exportCode(g.serialize());
    expect(code.startsWith('AF1')).toBe(true);
    const json = await importCode(code);
    expect(json).not.toBeNull();
    const g2 = Game.deserialize(json!)!;
    expect(g2.s.player.name).toBe('Экспорт');
    expect(g2.s.res.food).toBe(4242);
    expect(await importCode('AF1Z:not-base64!!')).toBeNull();
    expect(await importCode('hello')).toBeNull();
  });

  it('migrates an old save missing newer fields', () => {
    const g = Game.create('order', 'Old', 6, T0);
    const s = JSON.parse(g.serialize());
    delete s.raidCooldown; delete s.titans; delete s.calendar; delete s.stats.healed; delete s.heroes.sella;
    s.version = 1;
    const g2 = Game.deserialize(JSON.stringify(s))!;
    expect(g2).not.toBeNull();
    expect(g2.s.raidCooldown).toBe(0);
    expect(g2.s.titans.tamed).toEqual({});
    expect(g2.s.heroes.sella.owned).toBe(false);
    expect(g2.s.stats.healed).toBe(0);
    g2.tick(T0 + 60_000);
  });
});
