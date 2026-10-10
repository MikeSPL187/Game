import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { artKind, bldArtName, referenceArt, worldArtName } from '../src/art/artMap';
import { artCount } from '../src/art/manifest';
import { BUILDINGS } from '../src/data/buildings';
import type { BuildingId } from '../src/core/types';

const promptNames = ['PROMPTS.md', 'PROMPTS_wild.md', 'PROMPTS_ash.md']
  .flatMap((f) => [...readFileSync(`docs/art/${f}`, 'utf8').matchAll(/`([A-Za-z0-9_]+)\.png`/g)].map((m) => m[1]));
const names = new Set(promptNames);

describe('art pipeline naming', () => {
  it('file names are unique (the pilot is listed again in stage A)', () => {
    expect(names.size).toBeGreaterThan(300);
    const dup = promptNames.filter((n, i) => promptNames.indexOf(n) !== i).sort();
    expect(dup).toEqual(['bld_citadel_order_t1', 'bld_citadel_order_t2', 'bld_citadel_order_t3', 'bld_citadel_order_t4', 'bld_farm_order_t1']);
  });

  it('every building tier the city can show has a prompt and a procedural reference', () => {
    for (const type of Object.keys(BUILDINGS) as BuildingId[]) {
      for (const f of ['order', 'wild', 'ash'] as const) for (let t = 1; t <= 4; t++) {
        const n = bldArtName(type, f, t);
        expect(names.has(n), n).toBe(true);
        expect(referenceArt(n), n).not.toBeNull();
      }
    }
  });

  it('world map keys map to prompted assets with references', () => {
    const keys = ['wcamp:0', 'wcamp:2', 'wnode:food', 'wnode:gold', 'wruin:1', 'wrift', 'wboat', 'wcity', 'wtitan:roc', 'wtitan:wyrm', 'wmtn:2', 'wsnow:0', 'whill:1', 'wtree:pine:1', 'wtree:ash:0'];
    for (const k of keys) {
      const n = worldArtName(k, 'order')!;
      expect(names.has(n), `${k} → ${n}`).toBe(true);
      expect(referenceArt(n), n).not.toBeNull();
    }
  });

  it('sprites are cut out, portraits and textures are not', () => {
    expect(artKind('bld_farm_order_t1').kind).toBe('sprite');
    expect(artKind('hero_aerena').kind).toBe('portrait');
    expect(artKind('tex_grass').kind).toBe('texture');
    expect(artKind('icon_food').kind).toBe('icon');
    expect(artKind('unit_void_cav').kind).toBe('unit');
  });

  it('ChatGPT sheets cover every asset exactly once, and the API list matches the prompts', () => {
    const sheets = JSON.parse(readFileSync('docs/art/sheets.json', 'utf8')) as Record<string, { cols: number; rows: number; cells: string[] }>;
    const cells = Object.values(sheets).flatMap((s) => s.cells.filter((c) => c && !c.startsWith('ui_')));
    expect(new Set(cells).size).toBe(cells.length);
    expect(new Set(cells)).toEqual(names);
    for (const [id, s] of Object.entries(sheets)) expect(s.cells.length, id).toBeLessThanOrEqual(s.cols * s.rows);
    const api = JSON.parse(readFileSync('docs/art/prompts.json', 'utf8')) as { name: string; size: string }[];
    expect(new Set(api.map((a) => a.name))).toEqual(names);
    for (const a of api) expect(['1024x1024', '1536x1024', '1024x1536']).toContain(a.size);
  });

  it('manifest loads', () => { expect(artCount()).toBeGreaterThanOrEqual(0); });
});
