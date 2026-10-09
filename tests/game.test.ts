import { describe, expect, it } from 'vitest';
import { Game, sumTroops, FREE_SPEEDUP_MS } from '../src/game/game';
import { CHAPTERS, DAILIES, DAILY_CHESTS } from '../src/data/quests';
import { productionCap, warehouseProtect } from '../src/data/buildings';
import { HEROES } from '../src/data/heroes';
import { dayKey } from '../src/core/format';
import { simulateBattle, groupsFromTroops, emptyMods, type Army } from '../src/game/combat';

const T0 = 1_700_000_000_000;
const H = 3_600_000;

function game(seed = 4242) {
  const g = Game.create('order', 'T', seed, T0);
  g.s.lastTick = T0;
  return g;
}
function setLevel(g: Game, type: string, level: number) {
  for (const b of g.s.buildings) if (b.type === type) { b.level = level; break; }
}
function nearest(g: Game, kind: string, pred: (o: any) => boolean = () => true) {
  const c = g.cityPos();
  return g.s.world.objects.filter((o) => o.kind === kind && pred(o)).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
}
function run(g: Game, from: number, seconds: number, step = 1000) {
  for (let t = step; t <= seconds * 1000; t += step) g.tick(from + t);
  return from + seconds * 1000;
}

describe('quests & chapters', () => {
  it('claims quests, completes a chapter and advances', () => {
    const g = game();
    const ch = CHAPTERS[0];
    // satisfy every chapter-1 quest directly
    setLevel(g, 'farm', 2); setLevel(g, 'sawmill', 2); setLevel(g, 'wall', 2); setLevel(g, 'warehouse', 1);
    setLevel(g, 'citadel', 2); setLevel(g, 'barracks', 2);
    g.s.stats.collects = 3; g.s.stats.troopsTrained = 30;
    const food = g.s.res.food;
    for (const q of ch.quests) expect(g.claimQuest(q.id).ok, q.id).toBe(true);
    expect(g.claimQuest(ch.quests[0].id).ok).toBe(false); // no double claim
    expect(g.s.res.food).toBeGreaterThan(food);
    expect(g.chapterDone()).toBe(true);
    expect(g.claimChapter().ok).toBe(true);
    expect(g.s.quests.chapter).toBe(2);
    expect(g.s.inventory.key_silver).toBeGreaterThanOrEqual(3);
  });
  it('cannot claim an unfinished quest', () => {
    const g = game();
    expect(g.claimQuest(CHAPTERS[0].quests[0].id).ok).toBe(false);
    expect(g.claimChapter().ok).toBe(false);
  });
  it('nextQuest prefers claimable quests', () => {
    const g = game();
    g.s.stats.collects = 3;
    expect(g.nextQuest()!.id).toBe('collect3');
  });
});

describe('dailies & calendar', () => {
  it('tracks progress since the daily reset, awards points and chests', () => {
    const g = game();
    g.s.stats.collects = 100; // before reset
    g.tick(T0 + 24 * H); // next day → baseline snapshot
    expect(g.dailyProgress('d_collect')).toBe(0);
    g.s.stats.collects += 5;
    expect(g.claimDaily('d_collect').ok).toBe(true);
    expect(g.claimDaily('d_collect').ok).toBe(false);
    const pts = DAILIES.find((d) => d.id === 'd_collect')!.points;
    expect(g.s.quests.dailyPoints).toBe(pts);
    g.s.quests.dailyPoints = DAILY_CHESTS[0].points;
    expect(g.claimDailyChest(0).ok).toBe(true);
    expect(g.claimDailyChest(0).ok).toBe(false);
    expect(g.claimDailyChest(4).ok).toBe(false);
  });
  it('calendar gives one reward per day', () => {
    const g = game();
    expect(g.calendarReady()).toBe(true);
    expect(g.claimCalendar().ok).toBe(true);
    expect(g.claimCalendar().ok).toBe(false);
    expect(g.s.calendar.last).toBe(dayKey());
  });
});

describe('economy details', () => {
  it('production is capped by storage', () => {
    const g = game();
    g.tick(T0 + 1000 * H, false);
    const b = g.building('farm1')!;
    expect(b.stored).toBeLessThanOrEqual(productionCap(b.level) + 1e-6);
  });
  it('cancelling a build refunds half the cost', () => {
    const g = game();
    const info = g.upgradeInfo('citadel');
    const wood = g.s.res.wood;
    g.s.buildings.find((b) => b.type === 'warehouse')!.level = 1;
    expect(g.upgrade('citadel', T0).ok).toBe(true);
    const job = g.jobForPlot('citadel')!;
    if (job) {
      expect(g.cancelJob(job.id).ok).toBe(true);
      expect(g.s.res.wood).toBe(wood - info.cost.wood! + Math.round(info.cost.wood! * 0.5));
    }
  });
  it('free finish works only under the threshold; speed items shorten jobs', () => {
    const g = game();
    setLevel(g, 'citadel', 10); setLevel(g, 'farm', 9);
    g.s.res = { food: 1e7, wood: 1e7, stone: 1e7, gold: 1e7, aether: 0 };
    expect(g.upgrade('farm1', T0).ok).toBe(true);
    const j = g.jobForPlot('farm1')!;
    expect(j.end - T0).toBeGreaterThan(FREE_SPEEDUP_MS);
    expect(g.freeFinish(j.id, T0).ok).toBe(false);
    g.s.inventory.speed60 = 50;
    const before = j.end;
    expect(g.useSpeedItem(j.id, 'speed60', 1, T0).ok).toBe(true);
    const still = g.s.jobs.find((x) => x.id === j.id);
    if (still) expect(still.end).toBe(before - 3_600_000);
    expect(g.useSpeedItem(j.id, 'tome1', 1, T0).ok).toBe(false);
  });
  it('buying missing resources spends aether', () => {
    const g = game();
    g.s.res.wood = 0;
    const cost = { wood: 1000 };
    const ae = g.s.res.aether;
    expect(g.buyMissing(cost).ok).toBe(true);
    expect(g.s.res.wood).toBe(1000);
    expect(g.s.res.aether).toBeLessThan(ae);
    g.s.res.aether = 0; g.s.res.wood = 0;
    expect(g.buyMissing(cost).ok).toBe(false);
  });
  it('training respects tier, batch size and busy building', () => {
    const g = game();
    expect(g.train('inf2', 10, T0).ok).toBe(false); // tier locked at citadel 1
    expect(g.train('inf1', 100000, T0).ok).toBe(false); // batch too big
    expect(g.train('inf1', 10, T0).ok).toBe(true);
    expect(g.train('inf1', 10, T0).ok).toBe(false); // barracks busy
    expect(g.train('cav1', 10, T0).ok).toBe(false); // no stable
  });
});

describe('research', () => {
  it('needs an academy, prerequisites, and applies its effect', () => {
    const g = game();
    expect(g.research('agri', T0).ok).toBe(false); // no academy
    setLevel(g, 'academy', 1);
    expect(g.research('mason', T0).ok).toBe(false); // prerequisite missing
    const rate = g.prodRate(g.building('farm1')!);
    expect(g.research('agri', T0).ok).toBe(true);
    expect(g.research('carp', T0).ok).toBe(false); // academy busy
    run(g, T0, 120);
    expect(g.s.research.agri).toBe(1);
    expect(g.prodRate(g.building('farm1')!)).toBeGreaterThan(rate);
  });
});

describe('infirmary', () => {
  it('heals wounded over time and instantly for resources', () => {
    const g = game();
    setLevel(g, 'infirmary', 1);
    g.s.wounded = { inf1: 100 };
    const before = g.s.troops.inf1 ?? 0;
    g.tick(T0 + 60_000, false);
    expect(g.woundedCount()).toBeLessThan(100);
    expect((g.s.troops.inf1 ?? 0)).toBeGreaterThan(before);
    expect(g.healAll().ok).toBe(true);
    expect(g.woundedCount()).toBe(0);
    expect(g.s.troops.inf1).toBe(before + 100);
  });
  it('offline catch-up completes jobs and heals', () => {
    const g = game();
    setLevel(g, 'infirmary', 3);
    g.s.wounded = { arc1: 50 };
    expect(g.train('inf1', 20, T0).ok).toBe(true);
    g.tick(T0 + 10 * H, false);
    expect(g.woundedCount()).toBe(0);
    expect(g.s.jobs.length).toBe(0);
    expect(g.s.troops.inf1).toBe(140);
  });
});

describe('heroes', () => {
  it('tomes level heroes up to the star cap, star-up raises it', () => {
    const g = game();
    g.s.inventory.tome3 = 100;
    expect(g.useTome('torvald', 'tome3', 1).ok).toBe(true);
    while (g.useTome('torvald', 'tome3', 1).ok) { /* drain to cap */ }
    expect(g.s.heroes.torvald.level).toBe(g.heroCap('torvald'));
    expect(g.starUp('torvald').ok).toBe(false);
    g.s.heroes.torvald.shards = 10;
    expect(g.starUp('torvald').ok).toBe(true);
    expect(g.s.heroes.torvald.stars).toBe(2);
    expect(g.useTome('torvald', 'tome3', 1).ok).toBe(true);
    expect(g.useTome('aerena', 'tome3', 1).ok).toBe(false); // not owned
  });
  it('first gold summon is a legendary and pity is tracked', () => {
    const g = game();
    g.s.inventory.key_gold = 1;
    const r = g.summon('gold', false, () => 0.99);
    expect(r.ok).toBe(true);
    expect(HEROES.find((h) => h.id === r.hero)!.rarity).toBe('legendary');
    expect(g.summon('gold').ok).toBe(false); // no keys left
  });
  it('gold pity guarantees a legendary on the 10th summon', () => {
    const g = game();
    g.s.heroes.aerena.owned = true; // skip first-summon guarantee
    g.s.inventory.key_gold = 10;
    const rar: string[] = [];
    for (let i = 0; i < 10; i++) { const r = g.summon('gold', false, () => 0.99); expect(r.ok, r.error).toBe(true); rar.push(HEROES.find((h) => h.id === r.hero)!.rarity); }
    expect(rar[9]).toBe('legendary');
  });
  it('free summon has a cooldown; duplicates give shards', () => {
    const g = game();
    expect(g.summon('silver', true).ok).toBe(true);
    expect(g.summon('silver', true).ok).toBe(false);
    g.s.inventory.key_silver = 30;
    let shards = 0;
    for (let i = 0; i < 30; i++) shards += g.summon('silver').shards ?? 0;
    expect(shards).toBeGreaterThan(0);
  });
});

describe('items', () => {
  it('resource packs, chests and shields', () => {
    const g = game();
    g.s.inventory = { food10: 2, chest_big: 1, shield8: 1, tome1: 1 };
    const f = g.s.res.food;
    expect(g.useItem('food10', 2).ok).toBe(true);
    expect(g.s.res.food).toBe(f + 20000);
    expect(g.useItem('chest_big').ok).toBe(true);
    expect((g.s.inventory.key_silver ?? 0)).toBeGreaterThan(0);
    expect(g.useItem('shield8').ok).toBe(true);
    expect(g.s.shieldUntil).toBeGreaterThan(Date.now());
    expect(g.useItem('tome1').ok).toBe(false); // used from the hero screen
    expect(g.useItem('food10').ok).toBe(false); // none left
  });
});

describe('legions', () => {
  it('validates dispatch input', () => {
    const g = game();
    const camp = nearest(g, 'camp');
    const base = { lead: 'torvald', deputy: null, target: { x: camp.x, y: camp.y }, action: 'attack' as const, targetId: camp.id };
    expect(g.dispatch({ ...base, troops: {} }, T0).ok).toBe(false);
    expect(g.dispatch({ ...base, troops: { inf1: 99999 } }, T0).ok).toBe(false);
    expect(g.dispatch({ ...base, lead: 'aerena', troops: { inf1: 10 } }, T0).ok).toBe(false); // not owned
    expect(g.dispatch({ ...base, action: 'gather', troops: { inf1: 10 } }, T0).ok).toBe(false); // camp is not a node
    expect(g.dispatch({ ...base, troops: { inf1: 10 } }, T0).ok).toBe(true);
    expect(g.dispatch({ ...base, troops: { inf1: 10 } }, T0).ok).toBe(false); // hero busy
    expect(g.s.troops.inf1).toBe(110);
  });
  it('move → station → command to explore a ruin', () => {
    const g = game();
    const ruin = nearest(g, 'ruin');
    const c = g.cityPos();
    const tile = { x: c.x + 2, y: c.y };
    expect(g.dispatch({ lead: 'brenn', deputy: null, troops: { arc1: 20 }, target: tile, action: 'move', targetId: null }, T0).ok).toBe(true);
    let t = run(g, T0, 60);
    expect(g.s.legions[0].state).toBe('station');
    expect(g.command(g.s.legions[0].id, 'explore', { x: ruin.x, y: ruin.y }, ruin.id, t).ok).toBe(true);
    t = run(g, t, 300);
    expect(g.s.stats.ruinsExplored).toBe(1);
    expect(g.s.legions.length).toBe(0);
    expect(g.s.troops.arc1).toBe(60);
  });
  it('recalling a gathering legion keeps what it collected', () => {
    const g = game();
    const node = nearest(g, 'node');
    expect(g.dispatch({ lead: 'brenn', deputy: null, troops: { inf1: 100 }, target: { x: node.x, y: node.y }, action: 'gather', targetId: node.id }, T0).ok).toBe(true);
    let t = T0;
    while (g.s.legions[0].state !== 'gather') { t += 1000; g.tick(t); }
    t = run(g, t, 30);
    const res = node.res!;
    const before = g.s.res[res];
    expect(g.recall(g.s.legions[0].id, t).ok).toBe(true);
    expect(node.occupant).toBeNull();
    run(g, t, 200);
    expect(g.s.legions.length).toBe(0);
    expect(g.s.res[res]).toBeGreaterThan(before);
  });
  it('refuses unreachable destinations', () => {
    const g = game();
    const n = g.ter.size;
    let water = -1;
    for (let i = 0; i < n * n; i++) if (g.ter.t[i] === 0) { water = i; break; }
    expect(water).toBeGreaterThan(-1);
    const r = g.dispatch({ lead: 'brenn', deputy: null, troops: { inf1: 10 }, target: { x: water % n, y: Math.floor(water / n) }, action: 'move', targetId: null }, T0);
    expect(r.ok).toBe(false);
  });
});

describe('raids', () => {
  it('a strong garrison repels a raid and earns a reward', () => {
    const g = game();
    setLevel(g, 'citadel', 8); setLevel(g, 'wall', 8);
    g.s.troops = { inf2: 3000, arc2: 2000 };
    g.spawnRaid(g.s.lords[0].id, T0);
    const raid = g.s.raids[0];
    g.s.raids[0].troops = { inf1: 100 };
    g.tick(raid.arrive + 1000);
    expect(g.s.raids.length).toBe(0);
    expect(g.s.stats.raidsDefended).toBe(1);
  });
  it('an empty city is looted but the warehouse protects its share', () => {
    const g = game();
    setLevel(g, 'citadel', 8);
    g.s.troops = {};
    g.s.res.food = 100_000;
    g.spawnRaid(g.s.lords[0].id, T0);
    g.tick(g.s.raids[0].arrive + 1000);
    expect(g.s.stats.raidsLost).toBe(1);
    const prot = warehouseProtect(g.level('warehouse'));
    expect(g.s.res.food).toBeLessThan(100_000);
    expect(g.s.res.food).toBeGreaterThanOrEqual(prot);
    expect(g.s.shieldUntil).toBeGreaterThan(T0); // post-raid peace shield
  });
});

describe('titans', () => {
  it('damage persists between attacks and a win tames the titan', () => {
    const g = game();
    const titan = nearest(g, 'titan', (o) => o.titanId === 'roc');
    for (const k of ['aerena', 'kael']) { g.s.heroes[k].owned = true; g.s.heroes[k].level = 30; }
    setLevel(g, 'citadel', 12);
    g.s.troops = { inf3: 6000, arc3: 4000, cav3: 3000 };
    const go = (t: number) => {
      expect(g.dispatch({ lead: 'aerena', deputy: 'kael', troops: { inf3: 2500, arc3: 1500, cav3: 1000 }, target: { x: titan.x, y: titan.y }, action: 'attack', targetId: titan.id }, t).ok).toBe(true);
      return run(g, t, 600, 2000);
    };
    go(T0);
    expect(g.s.titans.tamed.roc).toBeTruthy();
    expect(g.s.titans.active).toBe('roc');
    expect(g.s.world.objects.some((o) => o.titanId === 'roc')).toBe(false);
    // titan now fights for us
    expect(g.legionArmy({ lead: null, deputy: null, troops: { inf1: 1 } }).titan?.id).toBe('roc');
    g.s.inventory.titan_food = 5;
    expect(g.feedTitan('roc', 5).ok).toBe(true);
    expect(g.s.titans.tamed.roc.level).toBeGreaterThan(1);
  });
});

describe('combat', () => {
  const army = (t: any, kind: Army['kind'] = 'player'): Army => ({ name: 'x', kind, groups: groupsFromTroops(t), heroes: [], mods: emptyMods(), retreatAt: 0.25, titan: null });
  it('is deterministic for the same seed', () => {
    const a = simulateBattle(army({ inf1: 300, arc1: 200 }), army({ cav1: 400 }, 'monster'), 99);
    const b = simulateBattle(army({ inf1: 300, arc1: 200 }), army({ cav1: 400 }, 'monster'), 99);
    expect(a).toEqual(b);
  });
  it('heroes make a legion stronger', () => {
    const g = game();
    g.s.heroes.aerena.owned = true; g.s.heroes.aerena.level = 30;
    const plain = simulateBattle(army({ inf1: 200 }), army({ inf1: 200 }, 'monster'), 5);
    const withHero = simulateBattle(g.legionArmy({ lead: 'aerena', deputy: null, troops: { inf1: 200 } }), army({ inf1: 200 }, 'monster'), 5);
    expect(withHero.aEnd).toBeGreaterThan(plain.aEnd);
    expect(sumTroops({ inf1: 1 })).toBe(1);
  });
});
