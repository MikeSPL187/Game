import { describe, expect, it } from 'vitest';
import { bus } from '../src/core/bus';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID } from '../src/data/achievements';
import { Game, migrate } from '../src/game/game';

const T0 = 1_700_000_000_000;

describe('achievements', () => {
  it('has 30+ unique achievements with growing targets per family', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    const fams = new Map<string, number[]>();
    for (const a of ACHIEVEMENTS) fams.set(a.family, [...(fams.get(a.family) ?? []), a.target]);
    for (const t of fams.values()) for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
  });

  it('progress comes from stats; the reward is granted exactly once', () => {
    const g = Game.create('order', 'T', 1, T0);
    const a = ACHIEVEMENT_BY_ID.camps1;
    expect(g.achievementState(a)).toBe('locked');
    expect(g.claimAchievement('camps1').ok).toBe(false);
    g.s.stats.campsDefeated = a.target;
    expect(g.achievementState(a)).toBe('ready');
    const aether = g.s.res.aether;
    expect(g.claimAchievement('camps1').ok).toBe(true);
    expect(g.s.res.aether).toBe(aether + (a.reward.res?.aether ?? 0));
    expect(g.achievementState(a)).toBe('claimed');
    expect(g.claimAchievement('camps1').ok).toBe(false);
    expect(g.s.res.aether).toBe(aether + (a.reward.res?.aether ?? 0));
    expect(g.achievementPoints()).toBe(a.points);
  });

  it('announces new unlocks once and counts them as ready', () => {
    const g = Game.create('order', 'T', 1, T0);
    g.tick(T0 + 1000, true);
    const got: string[] = [];
    const off = bus.on('achievement', (id: string) => got.push(id));
    g.s.stats.ruinsExplored = 5;
    g.tick(T0 + 5000, true);
    g.tick(T0 + 9000, true);
    off();
    expect(got).toEqual(['ruins1']);
    expect(g.achievementsReady()).toBeGreaterThanOrEqual(1);
    g.claimAchievement('ruins1');
    expect(g.s.achievements.seen).toContain('ruins1');
  });

  it('old saves are scanned silently on first load', () => {
    const g = Game.create('order', 'T', 1, T0);
    const raw = JSON.parse(JSON.stringify(g.s));
    delete raw.achievements;
    raw.stats.campsDefeated = 600;
    migrate(raw);
    const g2 = new Game(raw);
    const got: string[] = [];
    const off = bus.on('achievement', (id: string) => got.push(id));
    g2.tick(T0 + 5000, true);
    off();
    expect(got).toEqual([]);
    expect(g2.s.achievements.seen).toEqual(expect.arrayContaining(['camps1', 'camps2', 'camps3', 'camps4']));
    expect(g2.achievementsReady()).toBeGreaterThanOrEqual(4);
  });
});
