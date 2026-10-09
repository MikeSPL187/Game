import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { planNotifications } from '../src/game/notifyPlan';

const T0 = 1_700_000_000_000;

describe('notification planning', () => {
  it('schedules finished jobs, merges close events and skips imminent ones', () => {
    const g = Game.create('order', 'T', 1, T0);
    g.s.lastTick = T0;
    g.s.jobs.push({ id: 1, kind: 'build', start: T0, end: T0 + 30_000, plot: 'farm1', toLevel: 2 });      // too soon
    g.s.jobs.push({ id: 2, kind: 'build', start: T0, end: T0 + 3_600_000, plot: 'saw1', toLevel: 2 });
    g.s.jobs.push({ id: 3, kind: 'train', start: T0, end: T0 + 3_630_000, plot: 'barracks', troop: 'inf1', count: 50 }); // merges with #2
    g.s.jobs.push({ id: 4, kind: 'research', start: T0, end: T0 + 7_200_000, tech: 'agri', toLevel: 1, plot: 'academy' });
    g.s.freeSummonAt = T0 + 5 * 3_600_000;
    const plan = planNotifications(g, T0);
    const times = plan.map((p) => p.at - T0);
    expect(times[0]).toBe(3_600_000);
    expect(plan[0].title).toBe('Владение ждёт вас');
    expect(plan[0].body).toContain('Войска обучены');
    expect(plan.some((p) => p.title === 'Исследование завершено')).toBe(true);
    expect(plan.some((p) => p.title === 'Бесплатный призыв')).toBe(true);
    expect(times.every((t) => t >= 60_000)).toBe(true);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });
  it('warns before production storage fills up', () => {
    const g = Game.create('order', 'T', 1, T0);
    for (const b of g.s.buildings) b.stored = 0;
    g.s.freeSummonAt = 0;
    const plan = planNotifications(g, T0);
    expect(plan.some((p) => p.title === 'Хранилища переполнены')).toBe(true);
  });
});
