import { ACHIEVEMENTS } from '../src/data/achievements';
/**
 * Headless balance bot: plays the game greedily in simulated time and reports
 * how long each story chapter takes. Run: npx vite-node scripts/bot.ts
 */
import { Game, sumTroops } from '../src/game/game';
import { CHAPTERS } from '../src/data/quests';
import { BUILDINGS, PRODUCTION_RES, maxTier, trainBatch } from '../src/data/buildings';
import { PLOT_BY_ID } from '../src/data/cityLayout';
import { TECHS } from '../src/data/research';
import { TROOPS, TYPE_INFO } from '../src/data/troops';
import type { BuildingId, TroopKey, WorldObject } from '../src/core/types';
import { HEROES } from '../src/data/heroes';

const HOURS = Number(process.argv[2] ?? 120);
const CYCLE_H = Number(process.argv[3] ?? 2); // hours between sessions
let now = 1_700_000_000_000;
const realNow = Date.now;
Date.now = () => now;
const rnd = Math.random;
let seed = 7;
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const g = Game.create('order', 'Bot', 4242, now);
g.s.tutorial.done = true;
const STEP = 10_000; // 10 s
const log: string[] = [];
const chapterAt: Record<number, number> = {};
let sessionMinutes = 0;

function plotsOf(t: BuildingId) { return g.s.buildings.filter((b) => b.type === t); }
function tryUpgrade(plot: string): boolean {
  const r = g.upgrade(plot, now);
  if (r.ok && g.allianceOn()) for (const j of g.s.jobs) if (j.kind === 'build' && !j.helpReq) g.requestHelp(j.id, now);
  return r.ok;
}
function wantBuild(): string[] {
  const out: string[] = [];
  const q = g.nextQuest();
  if (q && q.go.kind === 'building') {
    const t = q.go.type;
    const cands = plotsOf(t).filter((b) => PLOT_BY_ID[b.plot].unlock <= g.citadel).sort((a, b) => a.level - b.level);
    if (cands[0]) out.push(cands[0].plot);
  }
  // citadel requirements
  const ci = g.upgradeInfo('citadel');
  for (const r of ci.reqs) if (!r.ok && r.go) out.push(r.go);
  out.push('citadel');
  // military/support essentials
  for (const t of ['barracks', 'range', 'stable', 'academy', 'infirmary', 'warehouse', 'wall', 'sanctum', 'tavern', 'watchtower', 'spire', 'forge'] as BuildingId[]) {
    const b = plotsOf(t)[0];
    if (b && PLOT_BY_ID[b.plot].unlock <= g.citadel && b.level < g.citadel) out.push(b.plot);
  }
  // economy: lowest-level production
  const eco = g.s.buildings.filter((b) => PRODUCTION_RES[b.type] && PLOT_BY_ID[b.plot].unlock <= g.citadel).sort((a, b) => a.level - b.level);
  for (const b of eco.slice(0, 4)) out.push(b.plot);
  return out;
}

function bestTier() { return maxTier(g.citadel); }

function act() {
  // a sensible player brings the army home when the watchtower sounds the alarm
  const raid = g.incomingRaid();
  if (raid) { g.recallAll(now); return; }
  // collect
  g.collectAll();
  // claim
  const ch = g.chapter();
  if (ch) for (const q of ch.quests) if (!g.s.quests.claimed.includes(q.id) && g.questProgress(q) >= q.target) g.claimQuest(q.id);
  if (g.chapterDone()) {
    const n = g.s.quests.chapter;
    g.claimChapter();
    chapterAt[n] = now;
  }
  if (g.calendarReady()) g.claimCalendar();
  for (let i = 0; i < 5; i++) g.claimEventMilestone(i);
  for (const id of [...g.s.achievements.seen]) if (!g.s.achievements.claimed.includes(id)) g.claimAchievement(id);
  // alliance: help, take gifts, ask for help, donate surplus, shop
  if (g.allianceOn()) {
    g.helpAllies();
    g.claimGifts();
    for (const j of g.s.jobs) if ((j.kind === 'build' || j.kind === 'research') && !j.helpReq) g.requestHelp(j.id, now);
    for (const id of ['s_speed60', 's_speed15', 's_tome2']) while (g.buyAlliance(id).ok) { /* spend */ }
  }
  // chests & items
  for (const id of ['chest_small', 'chest_big']) while ((g.s.inventory[id] ?? 0) > 0) g.useItem(id);
  // build
  for (const p of wantBuild()) { if (g.idleBuilders() <= 0) break; if (!g.jobForPlot(p)) tryUpgrade(p); }
  // free finishes & speedups
  for (const j of [...g.s.jobs]) {
    if ((j.kind === 'build' || j.kind === 'research') && j.end - now <= 180_000) g.freeFinish(j.id, now);
    else if (j.kind === 'build') for (const it of ['speed5', 'speed15', 'speed60']) if ((g.s.inventory[it] ?? 0) > 0 && j.end - now > 30 * 60_000) g.useSpeedItem(j.id, it, 1, now);
  }
  // research cheapest available
  if (!g.jobsOf('research').length && g.level('academy') > 0) {
    const opts = TECHS.map((t) => g.researchState(t.id)).filter((s) => !s.maxed && s.reqOk && s.acOk && g.has(s.cost)).sort((a, b) => a.time - b.time);
    if (opts[0]) g.research(opts[0].t.id, now);
  }
  // train — keep resources reserve for building
  for (const tt of ['inf', 'arc', 'cav', 'mag'] as const) {
    const bld = TYPE_INFO[tt].building;
    if (g.level(bld) <= 0 || g.s.jobs.some((j) => j.kind === 'train' && j.plot === bld)) continue;
    const key = `${tt}${bestTier()}` as TroopKey;
    const n = Math.min(trainBatch(g.level(bld)), Math.floor(g.maxTrainable(key) * 0.5));
    if (n >= 10) g.train(key, n, now);
  }
  // heroes
  while ((g.s.inventory.key_gold ?? 0) > 0) g.summon('gold');
  while ((g.s.inventory.key_silver ?? 0) > 0) g.summon('silver');
  if (g.s.freeSummonAt <= now) g.summon('silver', true);
  for (const h of HEROES) if (g.s.heroes[h.id].owned) {
    for (const t of ['tome3', 'tome2', 'tome1']) while ((g.s.inventory[t] ?? 0) > 0 && g.useTome(h.id, t).ok) { /* */ }
    g.starUp(h.id);
    for (const n of ['m_atk', 'm_rage', 'm_skill', 'm_hunt', 'm_cap', 's_atk', 's_def', 's_hp', 's_road', 's_cap', 'g_def', 'g_hp', 'g_heal', 'g_cap', 'g_end']) while (g.learnTalent(h.id, n).ok) { /* spend */ }
  }
  // forge: craft the best set available and dress the strongest heroes
  if (g.level('forge') > 0) {
    for (const set of ['void', 'storm', 'sun']) for (const slot of ['weapon', 'armor', 'helm', 'gloves', 'boots', 'trinket']) {
      const owned = g.s.gear.filter((x) => x.bp === `${set}_${slot}`).length;
      if (owned < 2) g.craft(`${set}_${slot}`);
    }
    const top = HEROES.filter((h) => g.s.heroes[h.id].owned && !g.busyHeroes().has(h.id)).sort((a, b) => g.s.heroes[b.id].level - g.s.heroes[a.id].level).slice(0, 2);
    for (const h of top) for (const it of [...g.s.gear].sort((a, b) => b.rarity - a.rarity)) if (!it.hero) g.equip(it.uid, h.id);
  }
  for (const t of Object.keys(g.s.titans.tamed)) while ((g.s.inventory.titan_food ?? 0) > 0) g.feedTitan(t);
  // heal when cheap
  if (g.woundedCount() > 50 && g.has(g.healCost())) g.healAll();
  // dispatch legions
  const busy = g.busyHeroes();
  const heroes = HEROES.filter((h) => g.s.heroes[h.id].owned && !busy.has(h.id)).sort((a, b) => g.s.heroes[b.id].level - g.s.heroes[a.id].level);
  while (g.freeLegionSlots() > 0 && heroes.length && sumTroops(g.s.troops) > 50) {
    const lead = heroes.shift()!.id;
    const dep = heroes.length ? heroes.shift()!.id : null;
    const cap = g.legionCapacity(lead);
    const troops: Record<string, number> = {};
    let left = cap;
    for (const k of (Object.keys(g.s.troops) as TroopKey[]).sort((a, b) => TROOPS[b].tier - TROOPS[a].tier)) {
      const n = Math.min(left, Math.floor(g.s.troops[k] ?? 0));
      if (n > 0) { troops[k] = n; left -= n; }
    }
    const army = { lead, deputy: dep, troops };
    const city = g.cityPos();
    const objs = g.s.world.objects.filter((o) => ['camp', 'titan', 'rift', 'lord', 'ruin'].includes(o.kind) && !(o.kind === 'titan' && g.s.titans.tamed[o.titanId!]));
    let best: { o: WorldObject; score: number } | null = null;
    for (const o of objs) {
      if (g.s.legions.some((l) => l.targetId === o.id)) continue;
      const d = Math.hypot(o.x - city.x, o.y - city.y);
      if (o.kind === 'ruin') { const sc = 3 - d * 0.05; if (!best || sc > best.score) best = { o, score: sc }; continue; }
      const p = g.predict(army, o);
      if (p.score < 1.25 && !(o.kind === 'titan' && p.score > 0.6) && !(o.kind === 'rift' && p.score > 0.7)) continue;
      const val = o.kind === 'titan' ? 40 : o.kind === 'rift' ? 15 : o.kind === 'lord' ? 10 : o.level;
      const sc = val - d * 0.06;
      if (!best || sc > best.score) best = { o, score: sc };
    }
    const needGather = g.nextQuest()?.id.startsWith('gather') || g.s.legions.filter((l) => l.action === 'gather').length === 0;
    if (needGather || !best) {
      const nodes = g.s.world.objects.filter((o) => o.kind === 'node' && o.occupant == null).sort((a, b) => Math.hypot(a.x - city.x, a.y - city.y) - Math.hypot(b.x - city.x, b.y - city.y));
      if (nodes[0] && g.dispatch({ lead, deputy: dep, troops: troops as any, target: { x: nodes[0].x, y: nodes[0].y }, action: 'gather', targetId: nodes[0].id }, now).ok) continue;
    }
    if (!best) break;
    const act = best.o.kind === 'ruin' ? 'explore' : 'attack';
    const r = g.dispatch({ lead, deputy: dep, troops: troops as any, target: { x: best.o.x, y: best.o.y }, action: act, targetId: best.o.id }, now);
    if (!r.ok) break;
  }
}

const end = now + HOURS * 3_600_000;
const start = now;
// Player session model: plays 20 minutes every 2 hours (online), offline otherwise
while (now < end) {
  const tInCycle = (now - start) % (CYCLE_H * 3_600_000);
  const online = tInCycle < 20 * 60_000;
  now += online ? STEP : 60_000 * 5;
  g.tick(now, online);
  if (online) { act(); sessionMinutes += STEP / 60_000; }
  if (g.s.quests.chapter > CHAPTERS.length) break;
}
Date.now = realNow; Math.random = rnd;
const h = (t: number) => ((t - start) / 3_600_000).toFixed(1) + 'h';
console.log('Chapter completion (simulated wall time):');
for (const [n, t] of Object.entries(chapterAt)) console.log(`  Ch ${n} ${CHAPTERS[Number(n) - 1].title}: ${h(t)}`);
for (const q of (g.chapter()?.quests ?? [])) console.log('   ', q.id, g.questProgress(q) + '/' + q.target, g.s.quests.claimed.includes(q.id) ? 'claimed' : '');
console.log('Alliance', JSON.stringify({ lvl: g.s.alliance.level, xp: g.s.alliance.xp, helps: g.s.stats.allianceHelps, embassy: g.level('embassy') }));
console.log('Current chapter', g.s.quests.chapter, 'next quest:', g.nextQuest()?.title, g.nextQuest() ? g.questProgress(g.nextQuest()!) + '/' + g.nextQuest()!.target : '');
console.log('Citadel', g.citadel, 'power', g.power(), 'troops', Math.round(sumTroops(g.allTroops())), 'heroes', Object.values(g.s.heroes).filter((x) => x.owned).map((x) => x.id + x.level + '★' + x.stars).join(' '));
console.log('Stats', JSON.stringify(g.s.stats));
console.log('Titans', JSON.stringify(g.s.titans), 'research', Object.values(g.s.research).reduce((a, b) => a + b, 0));
console.log('Res', JSON.stringify(Object.fromEntries(Object.entries(g.s.res).map(([k, v]) => [k, Math.round(v)]))));
console.log('Buildings', g.s.buildings.filter((b) => b.level > 0).map((b) => `${b.plot}:${b.level}`).join(' '));
console.log('Played minutes', Math.round(sessionMinutes));
console.log('Achievements', g.s.achievements.claimed.length, '/', ACHIEVEMENTS.length, 'points', g.achievementPoints());
void BUILDINGS; void log;
