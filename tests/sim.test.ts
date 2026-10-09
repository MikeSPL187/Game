import { describe, expect, it } from 'vitest';
import { Game, sumTroops } from '../src/game/game';
import { simulateBattle, groupsFromTroops, emptyMods, type Army } from '../src/game/combat';
import { campTroops } from '../src/data/world';
import { findPath } from '../src/game/terrain';

const T0 = 1_700_000_000_000;

function army(troops: any, kind: Army['kind'] = 'player'): Army {
  return { name: 'x', kind, groups: groupsFromTroops(troops), heroes: [], mods: emptyMods(), retreatAt: 0.25, titan: null };
}

describe('world', () => {
  it('generates a reachable start with content around', () => {
    const g = Game.create('order', 'Тест', 12345, T0);
    const city = g.cityPos();
    expect(g.ter.reach[city.y * g.ter.size + city.x]).toBe(1);
    const objs = g.s.world.objects;
    expect(objs.filter((o) => o.kind === 'camp').length).toBeGreaterThan(40);
    expect(objs.filter((o) => o.kind === 'titan').length).toBe(3);
    expect(objs.filter((o) => o.kind === 'lord').length).toBeGreaterThanOrEqual(5);
    const near = objs.filter((o) => o.kind === 'camp' && Math.hypot(o.x - city.x, o.y - city.y) < 10);
    expect(near.length).toBeGreaterThan(2);
    for (const o of objs) {
      expect(findPath(g.ter, city.x, city.y, o.x, o.y), `${o.kind} ${o.x},${o.y}`).not.toBeNull();
    }
  });
  it('many seeds are valid', () => {
    for (let seed = 1; seed < 8; seed++) {
      const g = Game.create('wild', 'T', seed * 977, T0);
      expect(g.s.world.objects.filter((o) => o.kind === 'titan').length).toBe(3);
      expect(g.s.lords.length).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('economy', () => {
  it('produces and collects', () => {
    const g = Game.create('order', 'Тест', 1, T0);
    g.s.lastTick = T0;
    g.tick(T0 + 3_600_000);
    const farm = g.building('farm1')!;
    expect(farm.stored).toBeGreaterThan(300);
    const before = g.s.res.food;
    g.collect('farm1');
    expect(g.s.res.food).toBeGreaterThan(before);
  });
  it('upgrades buildings with builders and timers', () => {
    const g = Game.create('order', 'Тест', 1, T0);
    expect(g.upgrade('farm1', T0).ok).toBe(true);
    expect(g.upgrade('saw1', T0).ok).toBe(true);
    const r = g.upgrade('wall', T0);
    expect(r.ok).toBe(false);
    g.s.lastTick = T0;
    g.tick(T0 + 60_000);
    expect(g.building('farm1')!.level).toBe(2);
    expect(g.building('saw1')!.level).toBe(2);
  });
  it('trains troops', () => {
    const g = Game.create('order', 'Тест', 1, T0);
    const before = g.s.troops.inf1 ?? 0;
    expect(g.train('inf1', 10, T0).ok).toBe(true);
    g.s.lastTick = T0;
    g.tick(T0 + 120_000);
    expect(g.s.troops.inf1).toBe(before + 10);
  });
});

describe('combat', () => {
  it('equal armies are close, bigger wins', () => {
    const r1 = simulateBattle(army({ inf1: 200 }), army({ inf1: 100 }, 'monster'), 3);
    expect(r1.win).toBe(true);
    const r2 = simulateBattle(army({ inf1: 50 }), army({ inf1: 200 }, 'monster'), 3);
    expect(r2.win).toBe(false);
  });
  it('counters matter', () => {
    const a = simulateBattle(army({ cav1: 100 }), army({ arc1: 100 }, 'monster'), 3);
    const b = simulateBattle(army({ arc1: 100 }), army({ cav1: 100 }, 'monster'), 3);
    expect(a.aEnd).toBeGreaterThan(b.aEnd);
  });
  it('starting army beats level 1-2 camps', () => {
    const g = Game.create('order', 'Тест', 1, T0);
    for (const lvl of [1, 2]) {
      const def = army(campTroops(lvl), 'monster');
      def.retreatAt = 0;
      const att = g.legionArmy({ lead: 'torvald', deputy: 'brenn', troops: { inf1: 120, arc1: 60 } });
      const r = simulateBattle(att, def, lvl);
      expect(r.win, 'camp ' + lvl).toBe(true);
    }
  });
});

describe('marches', () => {
  it('attacks a nearby camp and returns home', () => {
    const g = Game.create('order', 'Тест', 4242, T0);
    const city = g.cityPos();
    const camp = g.s.world.objects.filter((o) => o.kind === 'camp' && o.level === 1)
      .sort((a, b) => Math.hypot(a.x - city.x, a.y - city.y) - Math.hypot(b.x - city.x, b.y - city.y))[0];
    expect(camp).toBeTruthy();
    const r = g.dispatch({ lead: 'torvald', deputy: 'brenn', troops: { inf1: 100, arc1: 50 }, target: { x: camp.x, y: camp.y }, action: 'attack', targetId: camp.id }, T0);
    expect(r.ok).toBe(true);
    g.s.lastTick = T0;
    for (let t = 1; t <= 300; t++) g.tick(T0 + t * 1000);
    expect(g.s.legions.length).toBe(0);
    expect(g.s.stats.campsDefeated).toBe(1);
    expect(sumTroops(g.s.troops) + sumTroops(g.s.wounded)).toBeGreaterThan(170);
  });
  it('gathers and brings resources back', () => {
    const g = Game.create('order', 'Тест', 4242, T0);
    const city = g.cityPos();
    const node = g.s.world.objects.filter((o) => o.kind === 'node')
      .sort((a, b) => Math.hypot(a.x - city.x, a.y - city.y) - Math.hypot(b.x - city.x, b.y - city.y))[0];
    const before = g.s.res[node.res!];
    expect(g.dispatch({ lead: 'brenn', deputy: null, troops: { inf1: 100 }, target: { x: node.x, y: node.y }, action: 'gather', targetId: node.id }, T0).ok).toBe(true);
    g.s.lastTick = T0;
    for (let t = 1; t <= 2000; t++) g.tick(T0 + t * 1000);
    expect(g.s.legions.length).toBe(0);
    expect(g.s.res[node.res!]).toBeGreaterThan(before + 100);
    expect(g.s.stats.gathered).toBeGreaterThan(100);
  });
  it('serializes and restores', () => {
    const g = Game.create('ash', 'Тест', 77, T0);
    const json = g.serialize();
    const g2 = Game.deserialize(json)!;
    expect(g2.s.player.faction).toBe('ash');
    expect(g2.s.world.objects.length).toBe(g.s.world.objects.length);
  });
});
