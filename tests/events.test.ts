import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { EVENTS, EVENT_LENGTH, eventAt } from '../src/data/events';

const T0 = 1_700_000_000_000;

describe('rotating events', () => {
  it('rotates hunt → harvest → night every two days from the founding date', () => {
    expect(eventAt(T0, T0).type).toBe('hunt');
    expect(eventAt(T0 + EVENT_LENGTH, T0).type).toBe('harvest');
    expect(eventAt(T0 + 2 * EVENT_LENGTH + 5, T0).type).toBe('night');
    expect(eventAt(T0 + 3 * EVENT_LENGTH, T0).type).toBe('hunt');
  });

  it('awards points only for the active event and milestones once', () => {
    const g = Game.create('order', 'T', 1, T0);
    g.s.lastTick = T0;
    g.tick(T0 + 1000);
    g.addEventPoints('harvest', 500); // not active
    expect(g.s.event.points).toBe(0);
    g.addEventPoints('hunt', 200);
    expect(g.claimEventMilestone(0).ok).toBe(true);
    expect(g.claimEventMilestone(0).ok).toBe(false);
    expect(g.claimEventMilestone(1).ok).toBe(false);
  });

  it('finishing an event grants unclaimed milestones and posts the results', () => {
    const g = Game.create('order', 'T', 1, T0);
    g.s.lastTick = T0;
    g.tick(T0 + 1000);
    g.addEventPoints('hunt', EVENTS.hunt.milestones[2].points);
    const keys = g.s.inventory.key_silver ?? 0;
    g.tick(T0 + EVENT_LENGTH + 1000, false);
    expect(g.currentEvent().type).toBe('harvest');
    expect(g.s.event.points).toBe(0);
    expect(g.s.inventory.key_silver ?? 0).toBeGreaterThan(keys); // milestone 3 contains silver keys
    expect(g.s.reports.some((r) => r.title.startsWith('Итоги события'))).toBe(true);
  });

  it('Night of the Void sends waves while online and rewards holding the walls', () => {
    const g = Game.create('order', 'T', 1, T0);
    g.s.buildings.find((b) => b.type === 'citadel')!.level = 5;
    g.s.troops = { inf2: 1500, arc2: 800 };
    const nightStart = T0 + 2 * EVENT_LENGTH;
    g.s.lastTick = nightStart;
    g.s.shieldUntil = nightStart + 10 * 3_600_000; // lords stay away; waves ignore the shield
    let t = nightStart;
    for (let i = 0; i < 60; i++) { t += 60_000; g.tick(t, true); }
    expect(g.s.stats.raidsDefended).toBeGreaterThan(0);
    expect(g.s.event.points).toBeGreaterThan(0);
    const ranking = g.eventRanking(t);
    expect(ranking.filter((r) => r.me)).toHaveLength(1);
    expect(ranking).toHaveLength(g.s.lords.length + 1);
  });
});
