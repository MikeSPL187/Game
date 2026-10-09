import { describe, expect, it } from 'vitest';
import { Game, migrate } from '../src/game/game';
import { ALLIANCE_SHOP, HELP_DAILY_CAP, HELPS_PER_JOB, donationCost, techNeed } from '../src/data/alliance';

const T0 = 1_700_000_000_000;
const MIN = 60_000;

function allyGame() {
  const g = Game.create('order', 'T', 1, T0);
  g.s.buildings.find((b) => b.type === 'embassy')!.level = 1;
  for (const k of ['food', 'wood', 'stone', 'gold'] as const) g.s.res[k] = 10_000_000;
  return g;
}

describe('alliance', () => {
  it('requires an embassy', () => {
    const g = Game.create('order', 'T', 1, T0);
    expect(g.allianceOn()).toBe(false);
    expect(g.donate('at_build').ok).toBe(false);
    expect(g.allianceSupport()).toBe(0);
  });

  it('help requests shorten a build timer up to the per-job cap', () => {
    const g = allyGame();
    g.s.buildings.find((b) => b.type === 'citadel')!.level = 20;
    const farm = g.s.buildings.find((b) => b.type === 'farm')!;
    farm.level = 10;
    const r = g.upgrade(farm.plot, T0);
    expect(r).toEqual({ ok: true });
    const job = g.s.jobs.find((j) => j.kind === 'build')!;
    const end0 = job.end;
    expect(g.requestHelp(job.id, T0).ok).toBe(true);
    expect(g.requestHelp(job.id, T0).ok).toBe(false); // only once
    g.tick(T0 + 30 * MIN, true);
    const max = HELPS_PER_JOB(1);
    expect(job.helps).toBe(max);
    expect(job.end).toBeLessThan(end0);
    expect(end0 - job.end).toBeGreaterThanOrEqual(max * MIN);
    // duration stays the same so progress bars do not jump backwards
    expect(job.end - job.start).toBe(end0 - (job.start + (end0 - job.end)));
  });

  it('allies post requests over time; helping is capped per day', () => {
    const g = allyGame();
    g.tick(T0 + 3 * 3600_000, true);
    const a = g.s.alliance;
    expect(a.requests.length).toBeGreaterThan(0);
    const n = g.helpAllies();
    expect(n).toBeGreaterThan(0);
    expect(a.contribution).toBe(n * 8);
    expect(g.s.stats.allianceHelps).toBe(n);
    a.helpsToday = HELP_DAILY_CAP;
    a.requests.push({ id: 999, member: 'a1', kind: 'Строительство' });
    expect(g.helpAllies()).toBe(0);
  });

  it('gifts accumulate offline and grant rewards', () => {
    const g = allyGame();
    g.tick(T0 + 12 * 3600_000, false);
    expect(g.s.alliance.gifts.length).toBeGreaterThan(0);
    expect(g.s.alliance.gifts.length).toBeLessThanOrEqual(5);
    const r = g.claimGifts(() => 0.1);
    expect(r).not.toBeNull();
    expect(g.s.alliance.gifts.length).toBe(0);
    expect(g.s.inventory.speed5).toBeGreaterThan(0);
    expect(g.claimGifts()).toBeNull();
  });

  it('donations level technologies which feed into bonuses', () => {
    const g = allyGame();
    const before = g.fx.build_speed;
    const food0 = g.s.res.food;
    const donations = Math.ceil(techNeed(0) / 60);
    for (let i = 0; i < donations; i++) expect(g.donate('at_build').ok).toBe(true);
    expect(g.s.res.food).toBe(food0 - donations * donationCost(g.citadel).food!);
    expect(g.s.alliance.techs.at_build.level).toBe(1);
    expect(g.fx.build_speed).toBeCloseTo(before + 0.02, 6);
    g.s.alliance.donationsToday = 20;
    expect(g.donate('at_build').ok).toBe(false);
  });

  it('shop spends contribution and respects daily limits', () => {
    const g = allyGame();
    const it = ALLIANCE_SHOP.find((x) => x.id === 's_gold')!;
    expect(g.buyAlliance(it.id).ok).toBe(false); // no contribution
    g.s.alliance.contribution = 5000;
    const keys = g.s.inventory.key_gold ?? 0;
    expect(g.buyAlliance(it.id).ok).toBe(true);
    expect(g.s.inventory.key_gold).toBe(keys + 1);
    expect(g.s.alliance.contribution).toBe(5000 - it.price);
    expect(g.buyAlliance(it.id).ok).toBe(false); // daily limit 1
  });

  it('daily counters reset on a new day', () => {
    const g = allyGame();
    g.tick(T0 + MIN, true);
    g.s.alliance.helpsToday = 12; g.s.alliance.donationsToday = 5; g.s.alliance.shopToday = { s_gold: 1 };
    g.tick(T0 + 26 * 3600_000, true);
    expect(g.s.alliance.helpsToday).toBe(0);
    expect(g.s.alliance.donationsToday).toBe(0);
    expect(g.s.alliance.shopToday).toEqual({});
  });

  it('support grows with embassy and alliance level', () => {
    const g = allyGame();
    const s1 = g.allianceSupport();
    g.s.buildings.find((b) => b.type === 'embassy')!.level = 10;
    g.s.alliance.level = 5;
    expect(g.allianceSupport()).toBeGreaterThan(s1);
  });

  it('migrates old saves without alliance data', () => {
    const g = Game.create('order', 'T', 1, T0);
    const raw = JSON.parse(JSON.stringify(g.s));
    delete raw.alliance;
    delete raw.stats.allianceHelps;
    raw.buildings = raw.buildings.filter((b: { type: string }) => b.type !== 'embassy');
    migrate(raw);
    const s = raw as typeof g.s;
    expect(s.alliance.level).toBe(1);
    expect(s.stats.allianceHelps).toBe(0);
    expect(s.buildings.some((b) => b.type === 'embassy')).toBe(true);
  });
});
