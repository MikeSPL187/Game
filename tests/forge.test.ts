import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { rarityOdds } from '../src/data/gear';

const T0 = 1_700_000_000_000;
function forgeGame() {
  const g = Game.create('order', 'T', 1, T0);
  g.s.buildings.find((b) => b.type === 'forge')!.level = 10;
  g.s.inventory = { mat_iron: 500, mat_leather: 500, mat_bone: 200, mat_crystal: 200 };
  return g;
}

describe('forge & gear', () => {
  it('needs a forge, enough level and materials', () => {
    const g = Game.create('order', 'T', 1, T0);
    expect(g.craft('sun_weapon').ok).toBe(false); // no forge
    g.s.buildings.find((b) => b.type === 'forge')!.level = 1;
    expect(g.craft('void_weapon').ok).toBe(false); // forge too low
    expect(g.craft('sun_weapon').ok).toBe(false); // no materials
    g.s.inventory.mat_iron = 12; g.s.inventory.mat_leather = 6;
    const r = g.craft('sun_weapon', () => 0);
    expect(r.ok).toBe(true);
    expect(g.s.inventory.mat_iron).toBe(0);
    expect(r.item!.rarity).toBe(0);
  });

  it('higher forge levels improve rarity odds', () => {
    const lo = rarityOdds(1), hi = rarityOdds(20);
    expect(hi[3] + hi[2]).toBeGreaterThan(lo[3] + lo[2]);
    for (const o of [lo, hi]) expect(o.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });

  it('equipping applies stats and set bonuses to the commander only', () => {
    const g = forgeGame();
    const base = g.tal('torvald');
    const items = ['sun_weapon', 'sun_helm', 'sun_armor', 'sun_gloves'].map((bp) => g.craft(bp, () => 0.999).item!);
    for (const it of items) expect(g.equip(it.uid, 'torvald').ok).toBe(true);
    const fx = g.tal('torvald');
    expect(fx.atk).toBeGreaterThan(base.atk);
    expect(fx.def).toBeGreaterThan(base.def + 0.03); // includes the 2-piece set bonus
    expect(fx.hp).toBeGreaterThanOrEqual(base.hp + 0.05); // 4-piece set bonus
    expect(g.legionArmy({ lead: 'brenn', deputy: 'torvald', troops: { inf1: 1 } }).heroes[1].tal).toBeUndefined();
  });

  it('one item per slot; equipping elsewhere moves it; salvage returns materials', () => {
    const g = forgeGame();
    const a = g.craft('sun_weapon').item!;
    const b = g.craft('storm_weapon').item!;
    g.equip(a.uid, 'torvald');
    g.equip(b.uid, 'torvald');
    expect(g.heroGear('torvald').map((x) => x.uid)).toEqual([b.uid]);
    g.equip(b.uid, 'brenn');
    expect(g.heroGear('torvald')).toHaveLength(0);
    expect(g.heroGear('brenn')).toHaveLength(1);
    const iron = g.s.inventory.mat_iron;
    expect(g.salvage(a.uid).ok).toBe(true);
    expect(g.s.inventory.mat_iron).toBeGreaterThan(iron);
    expect(g.s.gear.find((x) => x.uid === a.uid)).toBeUndefined();
  });

  it('camps drop forge materials', () => {
    const g = Game.create('order', 'T', 4242, T0);
    const c = g.cityPos();
    const camp = g.s.world.objects.filter((o) => o.kind === 'camp' && o.level === 1).sort((x, y) => Math.hypot(x.x - c.x, x.y - c.y) - Math.hypot(y.x - c.x, y.y - c.y))[0];
    g.s.lastTick = T0;
    g.dispatch({ lead: 'torvald', deputy: 'brenn', troops: { inf1: 100, arc1: 50 }, target: { x: camp.x, y: camp.y }, action: 'attack', targetId: camp.id }, T0);
    for (let t = 1; t <= 300; t++) g.tick(T0 + t * 1000);
    expect(g.s.inventory.mat_iron ?? 0).toBeGreaterThan(0);
  });

  it('old saves gain the forge plot on load', () => {
    const g = Game.create('order', 'T', 1, T0);
    const s = JSON.parse(g.serialize());
    s.buildings = s.buildings.filter((b: any) => b.type !== 'forge');
    delete s.gear;
    const g2 = Game.deserialize(JSON.stringify(s))!;
    expect(g2.building('forge')).toBeTruthy();
    expect(g2.s.gear).toEqual([]);
  });
});
