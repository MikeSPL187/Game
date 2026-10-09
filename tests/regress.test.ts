import { describe, expect, it } from 'vitest';
import { Game, sumTroops } from '../src/game/game';

const T0 = 1_700_000_000_000;

describe('regressions', () => {
  it('device clock moving backwards does not freeze the simulation', () => {
    const g = Game.create('order', 'T', 1, T0);
    g.s.lastTick = T0;
    g.tick(T0 + 10 * 3_600_000); // clock jumped forward
    g.tick(T0); // then moved back
    expect(g.s.lastTick).toBe(T0);
    const before = g.building('farm1')!.stored;
    g.tick(T0 + 3_600_000);
    expect(g.building('farm1')!.stored).toBeGreaterThanOrEqual(before);
    expect(g.s.lastTick).toBe(T0 + 3_600_000);
  });

  it('a defeated lord does not instantly get a full garrison back', () => {
    const g = Game.create('order', 'T', 1, T0);
    const lord = g.s.lords[0];
    g.ensureLordTroops(lord);
    const full = sumTroops(lord.troops);
    expect(full).toBeGreaterThan(0);
    // simulate defeat: token guard remains
    lord.troops = { inf1: 5 };
    g.ensureLordTroops(lord);
    expect(sumTroops(lord.troops)).toBe(5);
    const o = g.obj(lord.objId)!;
    const army = g.targetArmy(o)!;
    expect(army.groups.reduce((a, x) => a + x.count, 0)).toBe(5);
  });

  it('titan health regenerates in proportion to elapsed time', () => {
    const g = Game.create('order', 'T', 1, T0);
    const t = g.s.world.objects.find((o) => o.kind === 'titan')!;
    t.hp = 0.5;
    g.s.world.lastRespawn = T0;
    g.s.lastTick = T0;
    g.tick(T0 + 20 * 60_000, false);
    expect(t.hp!).toBeGreaterThan(0.65);
    expect(t.hp!).toBeLessThanOrEqual(1);
  });
});

describe('raids', () => {
  it('lords never chain raids back-to-back', () => {
    const g = Game.create('order', 'T', 1, T0);
    g.s.buildings.find((b) => b.type === 'citadel')!.level = 8;
    g.s.troops = { inf2: 2000, arc2: 1000 };
    for (const l of g.s.lords) l.nextRaidAt = T0; // every lord wants to attack right now
    g.s.lastTick = T0;
    let raids = 0;
    for (let t = 1; t <= 6 * 60; t++) { // six hours online, ticking each minute
      const before = g.s.raids.length;
      g.tick(T0 + t * 60_000, true);
      if (g.s.raids.length > before) raids++;
    }
    expect(raids).toBeGreaterThan(0);
    expect(raids).toBeLessThanOrEqual(8);
  });

  it('recallAll brings every field legion home', () => {
    const g = Game.create('order', 'T', 4242, T0);
    const c = g.cityPos();
    const node = g.s.world.objects.filter((o) => o.kind === 'node').sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
    expect(g.dispatch({ lead: 'brenn', deputy: null, troops: { inf1: 50 }, target: { x: node.x, y: node.y }, action: 'gather', targetId: node.id }, T0).ok).toBe(true);
    expect(g.recallAll(T0 + 1000)).toBe(1);
    expect(g.s.legions[0].state).toBe('return');
  });
});
