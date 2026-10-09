import { bus } from '../core/bus';
import { dayKey } from '../core/format';
import { mulberry32 } from '../core/rng';
import type {
  BuildingId, BuildingState, Currency, GameState, IncomingRaid, Job, Legion, MarchAction, Point,
  Report, Res, ResBag, Reward, TroopKey, Troops, WorldObject,
} from '../core/types';
import {
  BUILDINGS, PRODUCTION_RES, infirmaryCap, infirmaryRate, legionSlots, maxTier, productionCap, productionPerHour,
  trainBatch, upgradeCost, upgradeTimeSec, wallBonus, warehouseProtect, watchRange,
} from '../data/buildings';
import { PLOT_BY_ID } from '../data/cityLayout';
import { HERO_BY_ID, HEROES, heroLevelCap, shardsForNextStar, xpForLevel, type Rarity } from '../data/heroes';
import { ITEM_BY_ID } from '../data/items';
import { CALENDAR, CHAPTERS, DAILIES, DAILY_CHESTS } from '../data/quests';
import { TECH_BY_ID, techCost, techTime } from '../data/research';
import { ROW_REQ, TALENT_BY_ID, emptyTalentFx, spentIn, talentFx, talentPointsTotal, type TalentFx } from '../data/talents';
import { BLUEPRINT_BY_ID, SETS, itemStats, rollRarity, type GearItem, type SetId } from '../data/gear';
import { PLOTS } from '../data/cityLayout';
import { EVENTS, eventAt, rivalScore, type EventType } from '../data/events';
import {
  ALLIANCE_SHOP, ALLIANCE_TECH_BY_ID, DONATION_CONTRIB, DONATION_PROGRESS, HELPS_PER_JOB, HELP_CONTRIB, HELP_DAILY_CAP, MEMBERS, REQUEST_KINDS,
  allianceLevelXp, donationCost, giftReward, techNeed,
} from '../data/alliance';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, achievementValue, type AchievementDef } from '../data/achievements';
import { TROOPS, TYPE_INFO } from '../data/troops';
import { TITAN_BY_ID, campName, campTroops, nodeRate, riftTroops } from '../data/world';
import { computeEffects, heroUtility, type Effects } from './bonuses';
import { applyHeroes, armyPower, emptyMods, estimate, groupsFromTroops, simulateBattle, titanGroup, type Army } from './combat';
import { SAVE_VERSION, emptyStats, newGame } from './state';
import { findPath, getTerrain, pathLength, type Terrain } from './terrain';
import {
  TARGET_COUNTS, decodeFog, encodeFog, lordTroops, makeCamp, makeNode, randomFreeTile, reveal, zoneLevel,
} from './worldgen';

export type Result = { ok: true } | { ok: false; error: string };
const OK: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

export const FREE_SPEEDUP_MS = 3 * 60_000;
export const BUILDER_COUNT = 2;
const BASE_MARCH_SPEED = 0.45; // tiles per second
const BATTLE_ANIM_MS = 2600;
const MAX_REPORTS = 40;

export class Game {
  s: GameState;
  ter: Terrain;
  fog: Uint8Array;
  fx: Effects;
  private fogDirty = false;
  online = true;

  constructor(state: GameState) {
    this.s = state;
    this.ter = getTerrain(state.world.seed);
    this.fog = decodeFog(state.world.fog, state.world.size);
    this.fx = computeEffects(state);
    this.revealAround();
  }

  static create(faction: GameState['player']['faction'], name: string, seed?: number, now = Date.now()): Game {
    return new Game(newGame(faction, name, seed, now));
  }

  serialize(): string {
    this.s.world.fog = encodeFog(this.fog);
    return JSON.stringify(this.s);
  }

  static deserialize(json: string): Game | null {
    try {
      const s = JSON.parse(json) as GameState;
      if (!s || typeof s !== 'object' || !s.version) return null;
      migrate(s);
      return new Game(s);
    } catch {
      return null;
    }
  }

  // ————————————————————————————————————————— helpers
  now() { return Date.now(); }
  uid() { return this.s.nextId++; }

  building(plot: string): BuildingState | undefined { return this.s.buildings.find((b) => b.plot === plot); }
  level(type: BuildingId): number {
    let m = 0;
    for (const b of this.s.buildings) if (b.type === type && b.level > m) m = b.level;
    return m;
  }
  get citadel() { return this.level('citadel'); }

  has(cost: ResBag): boolean {
    for (const [k, v] of Object.entries(cost)) if ((this.s.res[k as Currency] ?? 0) < (v ?? 0)) return false;
    return true;
  }
  missing(cost: ResBag): ResBag {
    const out: ResBag = {};
    for (const [k, v] of Object.entries(cost)) {
      const lack = (v ?? 0) - (this.s.res[k as Currency] ?? 0);
      if (lack > 0) out[k as Currency] = Math.ceil(lack);
    }
    return out;
  }
  pay(cost: ResBag) { for (const [k, v] of Object.entries(cost)) this.s.res[k as Currency] -= v ?? 0; }
  gain(bag: ResBag) { for (const [k, v] of Object.entries(bag)) this.s.res[k as Currency] = (this.s.res[k as Currency] ?? 0) + (v ?? 0); }
  addItems(items: Record<string, number>) { for (const [k, v] of Object.entries(items)) this.s.inventory[k] = (this.s.inventory[k] ?? 0) + v; }

  grant(r: Reward) {
    if (r.res) this.gain(r.res);
    if (r.items) this.addItems(r.items);
    if (r.shards) for (const [id, n] of Object.entries(r.shards)) this.addShards(id, n);
    if (r.troops) addTroops(this.s.troops, r.troops);
    bus.emit('reward', r);
  }

  jobsOf(kind: Job['kind']) { return this.s.jobs.filter((j) => j.kind === kind); }
  jobForPlot(plot: string) { return this.s.jobs.find((j) => j.plot === plot); }
  builderBusy() { return this.jobsOf('build').length; }

  power(): number {
    let p = 0;
    for (const b of this.s.buildings) p += Math.round(Math.pow(b.level, 1.6) * 12);
    for (const [k, n] of Object.entries(this.allTroops())) p += TROOPS[k as TroopKey].power * (n ?? 0);
    for (const lv of Object.values(this.s.research)) p += lv * 40;
    for (const h of Object.values(this.s.heroes)) if (h.owned) p += h.level * 30 + h.stars * 200;
    for (const t of Object.values(this.s.titans.tamed)) p += 2000 + t.level * 300;
    return p;
  }

  allTroops(): Troops {
    const out: Troops = { ...this.s.troops };
    for (const l of this.s.legions) addTroops(out, l.troops);
    return out;
  }

  // ————————————————————————————————————————— tick
  tick(now = this.now(), online = true) {
    this.online = online;
    const s = this.s;
    // device clock moved backwards: accept the new time instead of freezing the world
    if (now < s.lastTick - 60_000) { s.lastTick = now; s.world.lastRespawn = Math.min(s.world.lastRespawn, now); }
    const dt = Math.max(0, now - s.lastTick);
    if (dt <= 0) return;
    // production
    const hours = dt / 3_600_000;
    for (const b of s.buildings) {
      const r = PRODUCTION_RES[b.type];
      if (!r || b.level <= 0) continue;
      const job = this.jobForPlot(b.plot);
      if (job && job.kind === 'build' && b.level === 0) continue;
      const cap = productionCap(b.level);
      b.stored = Math.min(cap, b.stored + this.prodRate(b) * hours);
    }
    // healing
    this.healTick(dt);
    this.allianceTick(now);
    // jobs
    const done = s.jobs.filter((j) => j.end <= now).sort((a, b) => a.end - b.end);
    for (const j of done) this.completeJob(j);
    // marches
    let guard = 0;
    while (this.marchTick(now) && guard++ < 50) { /* resolve chained events */ }
    // raids
    for (const r of [...s.raids]) if (r.arrive <= now) this.resolveRaid(r);
    if (online) this.aiTick(now);
    this.respawnTick(now);
    this.dailyTick(now);
    this.eventTick(now);
    this.achievementTick(now);
    if (this.fogDirty) { this.fogDirty = false; bus.emit('fog'); }
    s.lastTick = now;
  }

  prodRate(b: BuildingState): number {
    const r = PRODUCTION_RES[b.type];
    if (!r) return 0;
    const bonus = this.fx.prod + (this.fx[('prod_' + r) as keyof Effects] ?? 0);
    return productionPerHour(b.level) * (1 + bonus);
  }

  totalProduction(): Record<Res, number> {
    const out: Record<Res, number> = { food: 0, wood: 0, stone: 0, gold: 0 };
    for (const b of this.s.buildings) {
      const r = PRODUCTION_RES[b.type];
      if (r && b.level > 0) out[r] += this.prodRate(b);
    }
    return out;
  }

  // ————————————————————————————————————————— collection
  collect(plot: string): number {
    const b = this.building(plot);
    if (!b) return 0;
    const r = PRODUCTION_RES[b.type];
    if (!r) return 0;
    const amt = Math.floor(b.stored);
    if (amt <= 0) return 0;
    b.stored -= amt;
    this.s.res[r] += amt;
    this.s.stats.collects++;
    this.addEventPoints('harvest', amt / 400);
    bus.emit('collect', { plot, res: r, amount: amt });
    return amt;
  }
  collectAll(): number {
    let n = 0;
    for (const b of this.s.buildings) if (PRODUCTION_RES[b.type] && b.stored >= 1) { n += this.collect(b.plot) > 0 ? 1 : 0; }
    return n;
  }

  // ————————————————————————————————————————— construction
  upgradeInfo(plot: string) {
    const b = this.building(plot)!;
    const def = BUILDINGS[b.type];
    const cost = upgradeCost(b.type, b.level);
    const time = Math.round(upgradeTimeSec(b.type, b.level) * 1000 / (1 + this.fx.build_speed));
    const reqs: { text: string; ok: boolean; go?: string }[] = [];
    const p = PLOT_BY_ID[plot];
    if (b.level === 0 && p.unlock > this.citadel) reqs.push({ text: `Цитадель ${p.unlock} ур.`, ok: false, go: 'citadel' });
    if (b.type !== 'citadel' && b.level > 0 && b.level + 1 > this.citadel + 1) reqs.push({ text: `Цитадель ${b.level} ур.`, ok: false, go: 'citadel' });
    if (b.type === 'citadel') {
      for (const n of def.needs ?? []) {
        const need = b.level + 1 - n.offset;
        if (need >= 1) {
          const have = this.level(n.type);
          reqs.push({ text: `${BUILDINGS[n.type].name} ${need} ур.`, ok: have >= need, go: this.s.buildings.find((x) => x.type === n.type)?.plot });
        }
      }
    }
    return { b, def, cost, time, reqs, maxed: b.level >= def.maxLevel };
  }

  canUpgrade(plot: string): Result {
    const b = this.building(plot);
    if (!b) return fail('Нет здания');
    const info = this.upgradeInfo(plot);
    if (info.maxed) return fail('Максимальный уровень');
    if (this.jobForPlot(plot)) return fail('Здание занято');
    if (info.reqs.some((r) => !r.ok)) return fail('Не выполнены требования');
    if (this.builderBusy() >= BUILDER_COUNT) return fail('Все строители заняты');
    if (!this.has(info.cost)) return fail('Недостаточно ресурсов');
    return OK;
  }

  upgrade(plot: string, now = this.now()): Result {
    const r = this.canUpgrade(plot);
    if (!r.ok) return r;
    const info = this.upgradeInfo(plot);
    this.pay(info.cost);
    // collect remaining production before work starts
    if (PRODUCTION_RES[info.b.type]) this.collect(plot);
    const job: Job = { id: this.uid(), kind: 'build', start: now, end: now + info.time, plot, toLevel: info.b.level + 1 };
    this.s.jobs.push(job);
    bus.emit('job-start', job);
    if (info.time <= 0) this.completeJob(job);
    return OK;
  }

  cancelJob(id: number): Result {
    const j = this.s.jobs.find((x) => x.id === id);
    if (!j) return fail('Нет задачи');
    // refund 50%
    let cost: ResBag = {};
    if (j.kind === 'build') cost = upgradeCost(this.building(j.plot!)!.type, j.toLevel! - 1);
    if (j.kind === 'train') cost = mulBag(TROOPS[j.troop!].cost, j.count!);
    if (j.kind === 'research') cost = techCost(TECH_BY_ID[j.tech!], j.toLevel!);
    this.gain(mulBag(cost, 0.5));
    this.s.jobs = this.s.jobs.filter((x) => x !== j);
    bus.emit('state');
    return OK;
  }

  private completeJob(j: Job) {
    const s = this.s;
    s.jobs = s.jobs.filter((x) => x !== j);
    if (j.kind === 'build') {
      const b = this.building(j.plot!)!;
      b.level = j.toLevel!;
      s.stats.buildsDone++;
      if (b.type === 'watchtower' || b.type === 'citadel') this.revealAround();
      if (b.type === 'citadel') {
        const city = s.world.objects.find((o) => o.kind === 'city');
        if (city) city.level = b.level;
      }
      this.pushReport({ kind: 'system', title: `${BUILDINGS[b.type].name}: ${b.level} ур.`, text: 'Строительство завершено.' }, false);
      bus.emit('build-done', { plot: b.plot, level: b.level, type: b.type });
    } else if (j.kind === 'train') {
      addTroops(s.troops, { [j.troop!]: j.count! });
      s.stats.troopsTrained += j.count!;
      this.addEventPoints('night', (TROOPS[j.troop!].power * j.count!) / 10);
      bus.emit('train-done', { troop: j.troop, count: j.count });
    } else if (j.kind === 'research') {
      s.research[j.tech!] = j.toLevel!;
      s.stats.researchDone++;
      this.fx = computeEffects(s);
      bus.emit('research-done', { tech: j.tech, level: j.toLevel });
    }
    bus.emit('state');
  }

  /** remaining ms of a job */
  remaining(j: Job, now = this.now()) { return Math.max(0, j.end - now); }

  speedup(jobId: number, ms: number, now = this.now()) {
    const j = this.s.jobs.find((x) => x.id === jobId);
    if (!j) return;
    j.end -= ms;
    j.start -= ms;
    if (j.end <= now) this.completeJob(j);
    bus.emit('state');
  }

  freeFinish(jobId: number, now = this.now()): Result {
    const j = this.s.jobs.find((x) => x.id === jobId);
    if (!j) return fail('Нет задачи');
    if (j.kind !== 'build' && j.kind !== 'research') return fail('Недоступно');
    if (this.remaining(j, now) > FREE_SPEEDUP_MS) return fail('Слишком долго');
    this.completeJob(j);
    return OK;
  }

  useSpeedItem(jobId: number, itemId: string, count = 1, now = this.now()): Result {
    const it = ITEM_BY_ID[itemId];
    if (!it?.speedMs) return fail('Не ускорение');
    const have = this.s.inventory[itemId] ?? 0;
    if (have < count) return fail('Нет предметов');
    const j = this.s.jobs.find((x) => x.id === jobId);
    if (!j) return fail('Нет задачи');
    this.s.inventory[itemId] = have - count;
    this.speedup(jobId, it.speedMs * count, now);
    return OK;
  }

  /** Aether cost to finish instantly */
  aetherCost(ms: number) { return Math.max(1, Math.ceil(ms / 60_000 * 0.6)); }

  finishWithAether(jobId: number, now = this.now()): Result {
    const j = this.s.jobs.find((x) => x.id === jobId);
    if (!j) return fail('Нет задачи');
    const c = this.aetherCost(this.remaining(j, now));
    if (this.s.res.aether < c) return fail('Недостаточно эфира');
    this.s.res.aether -= c;
    this.completeJob(j);
    return OK;
  }

  /** Buy missing resources for aether (genre convenience) */
  resourceAetherCost(bag: ResBag): number {
    let c = 0;
    for (const [k, v] of Object.entries(bag)) c += (v ?? 0) * (k === 'gold' ? 0.02 : k === 'stone' ? 0.008 : 0.005);
    return Math.ceil(c);
  }
  buyMissing(cost: ResBag): Result {
    const miss = this.missing(cost);
    delete miss.aether;
    const c = this.resourceAetherCost(miss);
    if (this.s.res.aether < c) return fail('Недостаточно эфира');
    this.s.res.aether -= c;
    this.gain(miss);
    bus.emit('state');
    return OK;
  }

  // ————————————————————————————————————————— training
  trainTime(troop: TroopKey, count: number, building: BuildingId): number {
    const lvl = this.level(building);
    return Math.round(TROOPS[troop].time * count * 1000 / (1 + this.fx.train_speed + lvl * 0.02));
  }
  maxTrainable(troop: TroopKey): number {
    const building = TYPE_INFO[TROOPS[troop].type].building;
    let n = trainBatch(this.level(building));
    for (const [k, v] of Object.entries(TROOPS[troop].cost)) n = Math.min(n, Math.floor(this.s.res[k as Currency] / (v ?? 1)));
    return Math.max(0, n);
  }
  train(troop: TroopKey, count: number, now = this.now()): Result {
    const d = TROOPS[troop];
    const building = TYPE_INFO[d.type].building;
    const lvl = this.level(building);
    if (lvl <= 0) return fail(`Требуется: ${BUILDINGS[building].name}`);
    if (d.tier > maxTier(this.citadel)) return fail('Тир не открыт');
    if (count <= 0) return fail('Укажите количество');
    if (count > trainBatch(lvl)) return fail('Слишком большая партия');
    if (this.s.jobs.some((j) => j.kind === 'train' && j.plot === building)) return fail('Здание уже обучает войска');
    const cost = mulBag(d.cost, count);
    if (!this.has(cost)) return fail('Недостаточно ресурсов');
    this.pay(cost);
    const t = this.trainTime(troop, count, building);
    const job: Job = { id: this.uid(), kind: 'train', start: now, end: now + t, plot: building, troop, count };
    this.s.jobs.push(job);
    bus.emit('job-start', job);
    bus.emit('state');
    return OK;
  }

  // ————————————————————————————————————————— research
  researchState(id: string) {
    const t = TECH_BY_ID[id];
    const lvl = this.s.research[id] ?? 0;
    const reqOk = t.req.every((r) => (this.s.research[r] ?? 0) >= 1);
    const acOk = this.level('academy') >= t.academy;
    return { t, lvl, reqOk, acOk, maxed: lvl >= t.max, cost: techCost(t, lvl + 1), time: Math.round(techTime(t, lvl + 1) * 1000 / (1 + this.fx.research_speed + this.level('academy') * 0.02)) };
  }
  research(id: string, now = this.now()): Result {
    const st = this.researchState(id);
    if (this.level('academy') <= 0) return fail('Постройте Академию');
    if (st.maxed) return fail('Изучено полностью');
    if (!st.reqOk) return fail('Изучите предыдущие технологии');
    if (!st.acOk) return fail(`Требуется Академия ${st.t.academy} ур.`);
    if (this.jobsOf('research').length) return fail('Академия занята');
    if (!this.has(st.cost)) return fail('Недостаточно ресурсов');
    this.pay(st.cost);
    const job: Job = { id: this.uid(), kind: 'research', start: now, end: now + st.time, tech: id, toLevel: st.lvl + 1, plot: 'academy' };
    this.s.jobs.push(job);
    bus.emit('job-start', job);
    bus.emit('state');
    return OK;
  }

  // ————————————————————————————————————————— infirmary
  infirmaryCapacity() { return Math.round(infirmaryCap(this.level('infirmary')) * (1 + this.fx.infirmary_cap)); }
  woundedCount() { return sumTroops(this.s.wounded); }
  private healAcc = 0;
  private healTick(dt: number) {
    const total = this.woundedCount();
    if (total <= 0) { this.healAcc = 0; return; }
    const rate = infirmaryRate(this.level('infirmary')) * (1 + this.fx.heal_speed) / 60_000; // per ms
    this.healAcc += rate * dt;
    let n = Math.min(total, Math.floor(this.healAcc));
    if (n <= 0) return;
    this.healAcc -= n;
    const s = this.s;
    this.s.stats.healed += n;
    const keys = (Object.keys(s.wounded) as TroopKey[]).sort((a, b) => (s.wounded[b] ?? 0) - (s.wounded[a] ?? 0));
    for (const k of keys) {
      if (n <= 0) break;
      const v = s.wounded[k] ?? 0;
      const take = Math.min(v, Math.max(1, Math.round((v / total) * n)), n);
      s.wounded[k] = v - take;
      s.troops[k] = (s.troops[k] ?? 0) + take;
      if (!s.wounded[k]) delete s.wounded[k];
      n -= take;
    }
    if (this.woundedCount() <= 0) bus.emit('healed');
  }
  healCost(): ResBag {
    const out: ResBag = {};
    for (const [k, v] of Object.entries(this.s.wounded) as [TroopKey, number][]) {
      if (!v) continue;
      for (const [r, c] of Object.entries(TROOPS[k].cost)) out[r as Currency] = Math.ceil((out[r as Currency] ?? 0) + (c ?? 0) * v * 0.25);
    }
    return out;
  }
  healAll(): Result {
    const cost = this.healCost();
    if (!this.has(cost)) return fail('Недостаточно ресурсов');
    this.pay(cost);
    addTroops(this.s.troops, this.s.wounded);
    this.s.wounded = {};
    roundTroops(this.s.troops);
    bus.emit('state');
    return OK;
  }

  // ————————————————————————————————————————— heroes
  heroCap(id: string) { return heroLevelCap(this.s.heroes[id].stars); }
  addHeroXp(id: string, xp: number) {
    const h = this.s.heroes[id];
    if (!h || !h.owned) return;
    const cap = this.heroCap(id);
    h.xp += xp;
    let leveled = false;
    while (h.level < cap && h.xp >= xpForLevel(h.level)) {
      h.xp -= xpForLevel(h.level);
      h.level++;
      leveled = true;
      this.s.stats.heroLevelUps++;
    }
    if (h.level >= cap) h.xp = Math.min(h.xp, xpForLevel(h.level));
    if (leveled) bus.emit('hero-level', { id, level: h.level });
  }
  useTome(heroId: string, tomeId: string, count = 1): Result {
    const it = ITEM_BY_ID[tomeId];
    const have = this.s.inventory[tomeId] ?? 0;
    if (!it?.xp || have < count) return fail('Нет предметов');
    const h = this.s.heroes[heroId];
    if (!h?.owned) return fail('Герой не нанят');
    if (h.level >= this.heroCap(heroId)) return fail('Достигнут предел уровня — повысьте звёзды');
    this.s.inventory[tomeId] = have - count;
    this.addHeroXp(heroId, it.xp * count);
    bus.emit('state');
    return OK;
  }
  addShards(id: string, n: number) {
    const h = this.s.heroes[id];
    if (h) h.shards += n;
  }
  starUp(id: string): Result {
    const h = this.s.heroes[id];
    if (!h?.owned) return fail('Герой не нанят');
    if (h.stars >= 5) return fail('Максимум звёзд');
    const need = shardsForNextStar(h.stars);
    let have = h.shards;
    const univ = this.s.inventory.shard_any ?? 0;
    if (have + univ < need) return fail('Недостаточно осколков');
    const fromOwn = Math.min(have, need);
    h.shards -= fromOwn;
    this.s.inventory.shard_any = univ - (need - fromOwn);
    h.stars++;
    bus.emit('hero-star', { id, stars: h.stars });
    bus.emit('state');
    return OK;
  }
  /** Summon with key. Returns hero id and whether it was new. */
  summon(kind: 'silver' | 'gold', free = false, rnd = Math.random): { ok: boolean; error?: string; hero?: string; isNew?: boolean; shards?: number } {
    const key = kind === 'gold' ? 'key_gold' : 'key_silver';
    if (this.level('tavern') <= 0) return { ok: false, error: 'Постройте Таверну' };
    if (!free && (this.s.inventory[key] ?? 0) <= 0) return { ok: false, error: 'Нет ключей' };
    if (free && this.s.freeSummonAt > this.now()) return { ok: false, error: 'Бесплатный призыв ещё не готов' };
    if (free) this.s.freeSummonAt = this.now() + 8 * 3_600_000;
    else this.s.inventory[key]--;
    const tb = this.level('tavern') * 0.002;
    let rarity: Rarity;
    const r = rnd();
    if (kind === 'gold') {
      this.s.pity.gold++;
      if (this.s.pity.gold >= 10 || r < 0.1) rarity = 'legendary';
      else if (r < 0.6 + tb) rarity = 'epic';
      else rarity = 'rare';
      if (rarity === 'legendary') this.s.pity.gold = 0;
    } else {
      this.s.pity.silver++;
      if (r < 0.015) rarity = 'legendary';
      else if (r < 0.2 + tb || this.s.pity.silver >= 8) rarity = 'epic';
      else rarity = 'rare';
      if (rarity !== 'rare') this.s.pity.silver = 0;
    }
    // first gold summon guarantees a legendary new hero
    if (kind === 'gold' && !HEROES.some((h) => h.rarity === 'legendary' && this.s.heroes[h.id].owned)) rarity = 'legendary';
    const pool = HEROES.filter((h) => h.rarity === rarity);
    const unowned = pool.filter((h) => !this.s.heroes[h.id].owned);
    // favour new heroes a bit
    const pickFrom = unowned.length && rnd() < 0.6 ? unowned : pool;
    const hero = pickFrom[Math.floor(rnd() * pickFrom.length)];
    const st = this.s.heroes[hero.id];
    this.s.stats.summons++;
    let isNew = false, shards = 0;
    if (!st.owned) { st.owned = true; isNew = true; } else { shards = 10; st.shards += shards; }
    bus.emit('summon', { hero: hero.id, isNew, shards });
    bus.emit('state');
    return { ok: true, hero: hero.id, isNew, shards };
  }
  busyHeroes(): Set<string> {
    const set = new Set<string>();
    for (const l of this.s.legions) { if (l.lead) set.add(l.lead); if (l.deputy) set.add(l.deputy); }
    return set;
  }

  // ————————————————————————————————————————— items
  useItem(id: string, count = 1): Result {
    const it = ITEM_BY_ID[id];
    const have = this.s.inventory[id] ?? 0;
    if (!it || have < count) return fail('Нет предметов');
    if (!it.usable) return fail('Нельзя использовать напрямую');
    this.s.inventory[id] = have - count;
    if (it.res && it.amount) this.gain({ [it.res]: it.amount * count });
    if (id === 'shield8') this.s.shieldUntil = Math.max(this.now(), this.s.shieldUntil) + 8 * 3_600_000 * count;
    if (id === 'chest_small' || id === 'chest_big') {
      const rnd = Math.random;
      for (let i = 0; i < count; i++) this.grant(chestReward(id === 'chest_big', this.citadel, rnd));
    }
    bus.emit('state');
    return OK;
  }

  // ————————————————————————————————————————— legions & marches
  legionCapacity(lead: string | null): number {
    const lvl = lead ? this.s.heroes[lead].level : 0;
    return Math.round(800 + lvl * 120 + this.citadel * 150 + this.fx.capacity + this.tal(lead).capacity);
  }

  // ————————————————————————————————————————— talents
  /** Combined commander bonuses: talents + equipped gear + set bonuses. */
  tal(heroId: string | null): TalentFx {
    if (!heroId || !this.s.heroes[heroId]) return emptyTalentFx();
    const fx = talentFx(this.s.heroes[heroId].talents);
    const add = (p: Partial<TalentFx>) => { for (const [k, v] of Object.entries(p)) (fx as any)[k] += v ?? 0; };
    const sets: Partial<Record<SetId, number>> = {};
    for (const it of this.s.gear) {
      if (it.hero !== heroId) continue;
      add(itemStats(it));
      const set = BLUEPRINT_BY_ID[it.bp].set;
      sets[set] = (sets[set] ?? 0) + 1;
    }
    for (const [set, n] of Object.entries(sets) as [SetId, number][]) for (const b of SETS[set].bonus) if (n >= b.n) add(b.fx);
    return fx;
  }

  // ————————————————————————————————————————— forge & gear
  craft(bpId: string, rnd = Math.random): { ok: boolean; error?: string; item?: GearItem } {
    const bp = BLUEPRINT_BY_ID[bpId];
    const lvl = this.level('forge');
    if (!bp) return { ok: false, error: 'Нет чертежа' };
    if (lvl <= 0) return { ok: false, error: 'Постройте Кузницу' };
    if (lvl < bp.forge) return { ok: false, error: `Требуется Кузница ${bp.forge} ур.` };
    if (this.s.gear.length >= 60) return { ok: false, error: 'Арсенал полон — разберите ненужное' };
    for (const [m, n] of Object.entries(bp.cost)) if ((this.s.inventory[m] ?? 0) < (n ?? 0)) return { ok: false, error: 'Недостаточно материалов' };
    for (const [m, n] of Object.entries(bp.cost)) this.s.inventory[m] -= n ?? 0;
    const item: GearItem = { uid: this.uid(), bp: bpId, rarity: rollRarity(lvl, rnd()), hero: null };
    this.s.gear.push(item);
    this.s.stats.crafted = (this.s.stats.crafted ?? 0) + 1;
    bus.emit('craft', item);
    bus.emit('state');
    return { ok: true, item };
  }
  salvage(uid: number): Result {
    const it = this.s.gear.find((g) => g.uid === uid);
    if (!it) return fail('Нет предмета');
    if (it.hero && this.busyHeroes().has(it.hero)) return fail('Герой в походе');
    const bp = BLUEPRINT_BY_ID[it.bp];
    const back: Record<string, number> = {};
    for (const [m, n] of Object.entries(bp.cost)) back[m] = Math.floor((n ?? 0) * (0.5 + it.rarity * 0.1));
    this.addItems(back);
    this.s.gear = this.s.gear.filter((g) => g !== it);
    bus.emit('state');
    return OK;
  }
  equip(uid: number, heroId: string): Result {
    const it = this.s.gear.find((g) => g.uid === uid);
    const h = this.s.heroes[heroId];
    if (!it || !h?.owned) return fail('Недоступно');
    const busy = this.busyHeroes();
    if (busy.has(heroId) || (it.hero && busy.has(it.hero))) return fail('Герой в походе');
    const slot = BLUEPRINT_BY_ID[it.bp].slot;
    for (const g of this.s.gear) if (g.hero === heroId && BLUEPRINT_BY_ID[g.bp].slot === slot) g.hero = null;
    it.hero = heroId;
    bus.emit('state');
    return OK;
  }
  unequip(uid: number): Result {
    const it = this.s.gear.find((g) => g.uid === uid);
    if (!it?.hero) return fail('Не надет');
    if (this.busyHeroes().has(it.hero)) return fail('Герой в походе');
    it.hero = null;
    bus.emit('state');
    return OK;
  }
  heroGear(heroId: string) { return this.s.gear.filter((g) => g.hero === heroId); }
  talentPoints(heroId: string): number {
    const h = this.s.heroes[heroId];
    return talentPointsTotal(h.level) - spentIn(h.talents);
  }
  canLearn(heroId: string, nodeId: string): Result {
    const h = this.s.heroes[heroId];
    const n = TALENT_BY_ID[nodeId];
    if (!h?.owned || !n) return fail('Недоступно');
    if (this.busyHeroes().has(heroId)) return fail('Герой в походе');
    const rank = h.talents?.[nodeId] ?? 0;
    if (rank >= n.max) return fail('Талант изучен полностью');
    if (this.talentPoints(heroId) <= 0) return fail('Нет очков талантов — повышайте уровень героя');
    if (spentIn(h.talents, n.branch) < ROW_REQ[n.row]) return fail(`Вложите ${ROW_REQ[n.row]} очков в эту ветку`);
    return OK;
  }
  learnTalent(heroId: string, nodeId: string): Result {
    const r = this.canLearn(heroId, nodeId);
    if (!r.ok) return r;
    const h = this.s.heroes[heroId];
    h.talents = { ...(h.talents ?? {}), [nodeId]: (h.talents?.[nodeId] ?? 0) + 1 };
    bus.emit('state');
    return OK;
  }
  resetTalents(heroId: string): Result {
    const h = this.s.heroes[heroId];
    if (!h?.owned) return fail('Недоступно');
    if (this.busyHeroes().has(heroId)) return fail('Герой в походе');
    if (!spentIn(h.talents)) return fail('Нечего сбрасывать');
    h.talents = {};
    bus.emit('state');
    return OK;
  }
  legionSpeed(troops: Troops, lead: string | null, deputy: string | null): number {
    let min = Infinity;
    for (const [k, n] of Object.entries(troops)) if (n && n > 0) min = Math.min(min, TROOPS[k as TroopKey].speed);
    if (min === Infinity) min = 1;
    const hu = heroUtility(lead, deputy);
    return BASE_MARCH_SPEED * min * (1 + this.fx.march_speed + hu.speed + this.tal(lead).speed);
  }
  legionLoad(troops: Troops, lead: string | null, deputy: string | null): number {
    let l = 0;
    for (const [k, n] of Object.entries(troops)) l += TROOPS[k as TroopKey].load * (n ?? 0);
    return Math.round(l * (1 + this.fx.load + heroUtility(lead, deputy).capacity));
  }
  freeLegionSlots() { return legionSlots(this.citadel) - this.s.legions.length; }
  cityPos(): Point { const c = this.s.world.objects.find((o) => o.kind === 'city')!; return { x: c.x, y: c.y }; }
  obj(id: number | null | undefined) { return id == null ? undefined : this.s.world.objects.find((o) => o.id === id); }

  /** Compute march path & duration from a point to a tile */
  planMarch(from: Point, to: Point, troops: Troops, lead: string | null, deputy: string | null) {
    const path = findPath(this.ter, Math.round(from.x), Math.round(from.y), to.x, to.y);
    if (!path) return null;
    if (path.length) path[0] = { x: from.x, y: from.y };
    const len = pathLength(this.ter, path);
    const speed = this.legionSpeed(troops, lead, deputy);
    return { path, ms: Math.round((len / speed) * 1000), speed, len };
  }

  /** Validate dispatch & create a legion (from city) */
  dispatch(opts: { lead: string; deputy: string | null; troops: Troops; target: Point; action: MarchAction; targetId: number | null }, now = this.now()): Result {
    const s = this.s;
    if (this.freeLegionSlots() <= 0) return fail('Нет свободных отрядов');
    if (!opts.lead || !s.heroes[opts.lead]?.owned) return fail('Выберите командира');
    const busy = this.busyHeroes();
    if (busy.has(opts.lead) || (opts.deputy && busy.has(opts.deputy))) return fail('Герой уже в походе');
    if (opts.deputy === opts.lead) opts.deputy = null;
    const total = sumTroops(opts.troops);
    if (total <= 0) return fail('Добавьте войска');
    if (total > this.legionCapacity(opts.lead)) return fail('Превышена вместимость отряда');
    for (const [k, n] of Object.entries(opts.troops) as [TroopKey, number][]) if ((s.troops[k] ?? 0) < n - 1e-6) return fail('Недостаточно войск');
    const err = this.validateTarget(opts.action, opts.targetId);
    if (err) return fail(err);
    const plan = this.planMarch(this.cityPos(), opts.target, opts.troops, opts.lead, opts.deputy);
    if (!plan) return fail('Путь недоступен');
    for (const [k, n] of Object.entries(opts.troops) as [TroopKey, number][]) {
      s.troops[k] = (s.troops[k] ?? 0) - n;
      if ((s.troops[k] ?? 0) < 0.5) delete s.troops[k];
    }
    const l: Legion = {
      id: this.uid(), lead: opts.lead, deputy: opts.deputy, troops: { ...opts.troops }, state: 'march',
      pos: { ...this.cityPos() }, path: plan.path, pathT0: now, speed: plan.speed, action: opts.action,
      targetId: opts.targetId, carry: {}, gatherStart: 0, gatherEnd: 0, battleEnd: 0,
    };
    if (opts.targetId != null && opts.action === 'gather') { const o = this.obj(opts.targetId); if (o) o.occupant = l.id; }
    s.legions.push(l);
    bus.emit('march', l);
    bus.emit('state');
    return OK;
  }

  validateTarget(action: MarchAction, targetId: number | null): string | null {
    if (action === 'move' || action === 'return') return null;
    const o = this.obj(targetId);
    if (!o) return 'Цель исчезла';
    if (action === 'gather') {
      if (o.kind !== 'node') return 'Здесь нечего добывать';
      if (o.occupant != null && this.s.legions.some((l) => l.id === o.occupant)) return 'Месторождение занято';
    }
    if (action === 'attack' && !['camp', 'lord', 'titan', 'rift'].includes(o.kind)) return 'Нельзя атаковать';
    if (action === 'attack' && o.kind === 'titan' && this.s.titans.tamed[o.titanId!]) return 'Титан уже приручён';
    if (action === 'explore' && o.kind !== 'ruin') return 'Нечего исследовать';
    return null;
  }

  /** Redirect an existing legion (idle on map / marching / gathering) */
  command(legionId: number, action: MarchAction, target: Point, targetId: number | null, now = this.now()): Result {
    const l = this.s.legions.find((x) => x.id === legionId);
    if (!l) return fail('Нет отряда');
    if (l.state === 'battle') return fail('Отряд в бою');
    const err = this.validateTarget(action, targetId);
    if (err) return fail(err);
    const pos = this.legionPos(l, now);
    if (l.state === 'gather') this.stopGather(l, now);
    this.releaseNode(l);
    const plan = this.planMarch(pos, target, l.troops, l.lead, l.deputy);
    if (!plan) return fail('Путь недоступен');
    l.pos = pos;
    l.path = plan.path;
    l.pathT0 = now;
    l.speed = plan.speed;
    l.action = action;
    l.targetId = targetId;
    l.state = action === 'return' ? 'return' : 'march';
    if (action === 'gather' && targetId != null) { const o = this.obj(targetId); if (o) o.occupant = l.id; }
    bus.emit('march', l);
    bus.emit('state');
    return OK;
  }

  recall(legionId: number, now = this.now()): Result {
    return this.command(legionId, 'return', this.cityPos(), null, now);
  }

  /** Order every legion that is not already heading home to return. Returns how many were recalled. */
  recallAll(now = this.now()): number {
    let n = 0;
    for (const l of [...this.s.legions]) if (l.state !== 'return' && l.state !== 'battle' && this.recall(l.id, now).ok) n++;
    return n;
  }

  private releaseNode(l: Legion) {
    for (const o of this.s.world.objects) if (o.occupant === l.id) o.occupant = null;
  }

  /** time-based position along path */
  legionPos(l: Legion, now = this.now()): Point {
    if (l.state !== 'march' && l.state !== 'return') return l.pos;
    return posOnPath(this.ter, l.path, l.speed, now - l.pathT0).pos;
  }
  arrivalTime(l: Legion): number {
    return l.pathT0 + Math.round(pathLength(this.ter, l.path) / l.speed * 1000);
  }

  private marchTick(now: number): boolean {
    let changed = false;
    for (const l of [...this.s.legions]) {
      if (l.state === 'march' || l.state === 'return') {
        const p = this.legionPos(l, now);
        if (reveal(this.fog, this.s.world.size, p.x, p.y, 4.5)) this.fogDirty = true;
        const at = this.arrivalTime(l);
        if (at <= now) {
          l.pos = { ...l.path[l.path.length - 1] };
          l.path = [];
          this.arrive(l, at);
          changed = true;
        }
      } else if (l.state === 'gather' && l.gatherEnd <= now) {
        this.stopGather(l, l.gatherEnd);
        this.startReturn(l, l.gatherEnd);
        changed = true;
      } else if (l.state === 'battle' && l.battleEnd <= now) {
        if (sumTroops(l.troops) < 1) { this.disband(l); changed = true; continue; }
        this.startReturn(l, l.battleEnd);
        changed = true;
      }
    }
    return changed;
  }

  private startReturn(l: Legion, t: number) {
    const plan = this.planMarch(l.pos, this.cityPos(), l.troops, l.lead, l.deputy);
    if (!plan) { this.disband(l, true); return; }
    l.path = plan.path; l.pathT0 = t; l.speed = plan.speed;
    l.state = 'return'; l.action = 'return'; l.targetId = null;
    bus.emit('march', l);
  }

  private disband(l: Legion, home = true) {
    if (home) {
      addTroops(this.s.troops, l.troops);
      roundTroops(this.s.troops);
      this.gain(l.carry);
    }
    this.releaseNode(l);
    this.s.legions = this.s.legions.filter((x) => x !== l);
    bus.emit('legion-home', l);
    bus.emit('state');
  }

  private arrive(l: Legion, t: number) {
    const o = this.obj(l.targetId);
    switch (l.action) {
      case 'return': {
        const carried = sumBag(l.carry);
        if (carried > 0) this.s.stats.gathered += 0; // counted at gather time
        this.disband(l, true);
        return;
      }
      case 'move':
        l.state = 'station';
        l.action = null;
        bus.emit('state');
        return;
      case 'gather': {
        if (!o || o.kind !== 'node' || !o.amount) { this.startReturn(l, t); return; }
        const rate = this.gatherRate(l, o);
        const load = this.legionLoad(l.troops, l.lead, l.deputy) - sumBag(l.carry);
        const amt = Math.min(o.amount, Math.max(0, load));
        if (amt <= 0) { this.startReturn(l, t); return; }
        l.state = 'gather';
        l.gatherStart = t;
        l.gatherEnd = t + Math.round(amt / rate * 1000);
        o.occupant = l.id;
        bus.emit('gather-start', l);
        bus.emit('state');
        return;
      }
      case 'explore': {
        if (!o || o.kind !== 'ruin') { this.startReturn(l, t); return; }
        const rnd = mulberry32(o.id * 7919 + t);
        const reward = ruinReward(o.level, rnd);
        this.grant(reward);
        if (l.lead) this.addHeroXp(l.lead, reward.heroXp ?? 0);
        this.s.stats.ruinsExplored++;
        this.removeObj(o);
        this.pushReport({ kind: 'explore', title: 'Руины исследованы', text: ruinText(rnd), rewards: reward, pos: { x: o.x, y: o.y } });
        this.startReturn(l, t);
        return;
      }
      case 'attack': {
        if (!o) { this.startReturn(l, t); return; }
        this.battleAt(l, o, t);
        return;
      }
    }
    this.startReturn(l, t);
  }

  gatherRate(l: Legion, o: WorldObject): number {
    const hu = heroUtility(l.lead, l.deputy);
    const troopsFactor = Math.min(1.6, 0.5 + sumTroops(l.troops) / 1200);
    return nodeRate(o.level, o.res!) * troopsFactor * (1 + this.fx.gather_speed + hu.gather + this.tal(l.lead).gather);
  }

  private stopGather(l: Legion, t: number) {
    const o = this.obj(l.targetId);
    if (!o || o.kind !== 'node') { l.state = 'station'; return; }
    const rate = this.gatherRate(l, o);
    const got = Math.min(o.amount ?? 0, Math.round(rate * Math.max(0, Math.min(t, l.gatherEnd) - l.gatherStart) / 1000));
    o.amount = (o.amount ?? 0) - got;
    l.carry[o.res!] = (l.carry[o.res!] ?? 0) + got;
    this.s.stats.gathered += got;
    this.addEventPoints('harvest', (got / 100) * (o.res === 'gold' ? 4 : 1));
    if (l.lead) this.addHeroXp(l.lead, Math.round(got / 20));
    o.occupant = null;
    if ((o.amount ?? 0) <= 10) this.removeObj(o);
    l.state = 'station';
    bus.emit('gather-done', { legion: l.id, res: o.res, amount: got });
  }

  /** Build the player's army from a legion */
  legionArmy(l: { lead: string | null; deputy: string | null; troops: Troops }, kind: 'player' = 'player'): Army {
    const heroes = [l.lead, l.deputy].filter(Boolean).map((id, i) => ({ id: id!, level: this.s.heroes[id!].level, stars: this.s.heroes[id!].stars, lead: i === 0, tal: i === 0 ? this.tal(id!) : undefined }));
    const a: Army = { name: this.s.player.name, kind, groups: groupsFromTroops(l.troops), heroes, mods: emptyMods(), retreatAt: 0.25, titan: null };
    a.mods.atk += this.fx.atk; a.mods.def += this.fx.def; a.mods.hp += this.fx.hp;
    a.mods.typeDef.inf = this.fx.inf_def; a.mods.typeHp.inf = this.fx.inf_hp;
    a.mods.typeAtk.arc = this.fx.arc_atk; a.mods.typeAtk.cav = this.fx.cav_atk; a.mods.typeAtk.mag = this.fx.mag_atk;
    a.mods.vsMonster += this.fx.monster_dmg;
    const at = this.s.titans.active;
    if (at && this.s.titans.tamed[at]) {
      a.titan = { id: at, level: this.s.titans.tamed[at].level, power: this.titanPower(at) };
    }
    applyHeroes(a);
    return a;
  }

  titanPower(id: string) {
    const t = this.s.titans.tamed[id];
    if (!t) return 0;
    return t.level * 0.05 + this.level('sanctum') * 0.04;
  }

  targetArmy(o: WorldObject): Army | null {
    if (o.kind === 'camp') {
      const a: Army = { name: campName(o.level), kind: 'monster', groups: groupsFromTroops(campTroops(o.level)), heroes: [], mods: emptyMods(), retreatAt: 0, titan: null };
      a.mods.atk = o.level * 0.01; a.mods.def = o.level * 0.01;
      for (const g of a.groups) g.name = hollowName(g.type);
      return a;
    }
    if (o.kind === 'rift') {
      const a: Army = { name: 'Эфирный разлом', kind: 'monster', groups: groupsFromTroops(riftTroops(o.level)), heroes: [], mods: emptyMods(), retreatAt: 0, titan: null };
      for (const g of a.groups) { g.count *= o.hp ?? 1; g.name = hollowName(g.type); }
      a.mods.atk = 0.1 + o.level * 0.015; a.mods.def = 0.1 + o.level * 0.015;
      return a;
    }
    if (o.kind === 'titan') {
      const t = TITAN_BY_ID[o.titanId!];
      const g = titanGroup(t.id, o.hp ?? 1);
      const minions = campTroops(t.level);
      const a: Army = { name: t.name, kind: 'titan', groups: [g, ...groupsFromTroops(minions)], heroes: [], mods: emptyMods(), retreatAt: 0, titan: null };
      for (const gg of a.groups.slice(1)) gg.name = hollowName(gg.type);
      a.mods.def = t.level * 0.01;
      return a;
    }
    if (o.kind === 'lord') {
      const lord = this.s.lords.find((x) => x.id === o.lordId)!;
      this.ensureLordTroops(lord);
      const a: Army = { name: lord.name, kind: 'lord', groups: groupsFromTroops(lord.troops), heroes: [{ id: lordHero(lord.faction), level: lord.heroLevel, stars: 1 + Math.floor(lord.citadel / 6), lead: true }], mods: emptyMods(), retreatAt: 0.15, titan: null };
      a.mods.def += wallBonus(lord.citadel);
      a.mods.hp += wallBonus(lord.citadel);
      applyHeroes(a);
      return a;
    }
    return null;
  }

  /** Lords get their full garrison once; afterwards it only regrows over time (aiTick). */
  ensureLordTroops(lord: GameState['lords'][number]) {
    if (lord.power > 0) return;
    lord.troops = lordTroops(lord.citadel, mulberry32(lord.objId * 31 + lord.citadel)) as Troops;
    lord.power = 1;
  }

  lordFullTroops(lord: GameState['lords'][number]): Troops {
    return lordTroops(lord.citadel, mulberry32(lord.objId * 31 + lord.citadel)) as Troops;
  }

  /** Estimate outcome for UI: 'easy' | 'even' | 'hard' | 'deadly' */
  predict(l: { lead: string | null; deputy: string | null; troops: Troops }, o: WorldObject): { label: string; tone: 'good' | 'warn' | 'bad'; score: number } {
    const t = this.targetArmy(o);
    if (!t || sumTroops(l.troops) <= 0) return { label: '—', tone: 'warn', score: 0 };
    const army = this.legionArmy(l);
    if (o.kind === 'titan' || o.kind === 'rift') army.mods.atk += this.allianceSupport();
    const sc = estimate(army, t);
    if (sc >= 1.6) return { label: 'Лёгкая победа', tone: 'good', score: sc };
    if (sc >= 1.2) return { label: 'Победа', tone: 'good', score: sc };
    if (sc >= 1) return { label: 'Тяжёлый бой', tone: 'warn', score: sc };
    if (sc >= 0.5) return { label: 'Опасно', tone: 'bad', score: sc };
    return { label: 'Смертельно', tone: 'bad', score: sc };
  }

  private battleAt(l: Legion, o: WorldObject, t: number) {
    const def = this.targetArmy(o);
    if (!def) { this.startReturn(l, t); return; }
    const att = this.legionArmy(l);
    if (o.kind === 'titan' || o.kind === 'rift') att.mods.atk += this.allianceSupport();
    const aPow = armyPower(att), dPow = armyPower(def);
    const startTroops = { ...l.troops };
    const res = simulateBattle(att, def, (o.id * 131 + t) | 0);
    // apply losses to legion: PvE -> wounded (free healing), PvP -> 35% dead
    const pve = o.kind !== 'lord';
    const capLeft = Math.max(0, this.infirmaryCapacity() - this.woundedCount());
    let wounded = 0, dead = 0;
    let capRemain = capLeft;
    for (const [k, lost] of Object.entries(res.aLost) as [TroopKey, number][]) {
      if (!lost) continue;
      l.troops[k] = Math.max(0, (l.troops[k] ?? 0) - lost);
      if (!l.troops[k]) delete l.troops[k];
      const toWound = pve ? lost : Math.round(lost * 0.65);
      const w = Math.min(capRemain, toWound);
      capRemain -= w;
      this.s.wounded[k] = (this.s.wounded[k] ?? 0) + w;
      wounded += w;
      dead += lost - w;
    }
    let rewards: Reward | undefined;
    let title = '';
    const heroIds = [l.lead, l.deputy].filter(Boolean) as string[];
    if (o.kind === 'camp') {
      title = res.win ? `Победа: ${campName(o.level)} ${o.level} ур.` : `Поражение: ${campName(o.level)} ${o.level} ур.`;
      if (res.win) {
        rewards = campReward(o.level, mulberry32(o.id + t), o.level > this.s.stats.maxCampLevel);
        this.grant(rewards);
        this.s.stats.campsDefeated++;
        this.s.stats.maxCampLevel = Math.max(this.s.stats.maxCampLevel, o.level);
        this.addEventPoints('hunt', o.level * 10);
        this.removeObj(o);
      }
      const xp = Math.round(140 * Math.pow(o.level, 1.45) * (res.win ? 1 : 0.3));
      heroIds.forEach((id, i) => this.addHeroXp(id, i === 0 ? xp : Math.round(xp * 0.6)));
      if (rewards) rewards.heroXp = xp;
    } else if (o.kind === 'rift') {
      this.addEventPoints('hunt', 150);
      const dealt = res.dStart > 0 ? (res.dStart - res.dEnd) / res.dStart : 1;
      o.hp = Math.max(0, (o.hp ?? 1) * (1 - dealt));
      title = res.win || o.hp <= 0.02 ? 'Разлом закрыт!' : `Разлом ослаблен (${Math.round((o.hp ?? 0) * 100)}%)`;
      if (res.win || o.hp <= 0.02) {
        rewards = { res: scaleRes({ food: 4000, wood: 4000, stone: 2000, gold: 1000, aether: 40 }, o.level), items: { key_gold: 1, chest_big: 1, tome2: 2, mat_bone: 6 + Math.floor(o.level / 3), mat_crystal: 3 + Math.floor(o.level / 5) } };
        this.grant(rewards);
        this.s.stats.riftsCleared++;
        this.removeObj(o);
      }
      const xp = Math.round(300 * Math.pow(o.level, 1.4));
      heroIds.forEach((id, i) => this.addHeroXp(id, i === 0 ? xp : Math.round(xp * 0.6)));
    } else if (o.kind === 'titan') {
      this.addEventPoints('hunt', 250);
      const td = TITAN_BY_ID[o.titanId!];
      const dealt = res.dStart > 0 ? (res.dStart - res.dEnd) / res.dStart : 1;
      o.hp = Math.max(0, (o.hp ?? 1) * (1 - dealt * 0.9));
      if (res.win || o.hp <= 0.02) {
        title = `${td.name} приручён!`;
        this.s.titans.tamed[td.id] = { level: 1, xp: 0 };
        if (!this.s.titans.active) this.s.titans.active = td.id;
        rewards = { res: scaleRes({ food: 20000, wood: 20000, stone: 10000, gold: 5000, aether: 150 }, td.level), items: { key_gold: 2, titan_food: 3, mat_bone: 15, mat_crystal: 10 } };
        this.grant(rewards);
        this.removeObj(o);
        bus.emit('titan-tamed', td.id);
      } else {
        title = `${td.name}: здоровье ${Math.round(o.hp * 100)}%`;
      }
      const xp = Math.round(400 * Math.pow(td.level, 1.4));
      heroIds.forEach((id, i) => this.addHeroXp(id, i === 0 ? xp : Math.round(xp * 0.6)));
    } else if (o.kind === 'lord') {
      const lord = this.s.lords.find((x) => x.id === o.lordId)!;
      // trophies scale with how rebuilt the garrison was — farming a beaten lord yields little
      const garrison = Math.min(1, res.dStart / Math.max(1, sumTroops(this.lordFullTroops(lord))));
      for (const g of def.groups) lord.troops[g.key as TroopKey] = g.count;
      if (res.win) {
        title = `Победа над ${lord.name}`;
        const loot = mulBag(scaleRes({ food: 3000, wood: 3000, stone: 1500, gold: 800 }, lord.citadel), garrison);
        const load = this.legionLoad(l.troops, l.lead, l.deputy);
        const tot = sumBag(loot);
        const f = Math.min(1, load / Math.max(1, tot));
        for (const k of Object.keys(loot) as Res[]) l.carry[k] = (l.carry[k] ?? 0) + Math.round(loot[k]! * f);
        const chest = garrison >= 0.6;
        rewards = { res: mulBag(loot, f), items: chest ? { chest_big: 1 } : {} };
        if (chest) this.addItems({ chest_big: 1 });
        lord.defeats++;
        // a defeated lord keeps only a token guard and rebuilds slowly
        lord.troops = mulBag(this.lordFullTroops(lord) as ResBag, 0.1) as Troops;
        lord.nextRaidAt = Math.max(lord.nextRaidAt, t + 45 * 60_000);
        this.s.stats.lordsDefeated++;
      } else {
        title = `Поражение: ${lord.name}`;
      }
      const xp = Math.round(200 * Math.pow(lord.citadel, 1.4));
      heroIds.forEach((id, i) => this.addHeroXp(id, i === 0 ? xp : Math.round(xp * 0.6)));
    }
    const lostTotal = sumNums(res.aLost);
    const report: Partial<Report> = {
      kind: 'battle', title, win: res.win, rounds: res.rounds, comp: res.comp, rewards,
      pos: { x: o.x, y: o.y },
      attacker: { name: this.s.player.name, heroes: heroIds.map((id) => ({ id, level: this.s.heroes[id].level })), start: sumTroops(startTroops), lost: dead, wounded, survived: sumTroops(l.troops), power: aPow, kind: 'player' },
      defender: { name: def.name, heroes: def.heroes.map((h) => ({ id: h.id, level: h.level })), start: res.dStart, lost: sumNums(res.dLost), wounded: 0, survived: res.dEnd, power: dPow, kind: def.kind, portrait: o.kind === 'titan' ? o.titanId : o.kind },
    };
    void lostTotal;
    this.pushReport(report);
    l.state = 'battle';
    l.battleEnd = t + BATTLE_ANIM_MS;
    bus.emit('battle', { legion: l.id, x: o.x, y: o.y, win: res.win, report });
    bus.emit('state');
  }

  pushReport(r: Partial<Report>, notify = true) {
    const rep: Report = { id: this.uid(), time: this.now(), kind: r.kind ?? 'system', title: r.title ?? '', read: false, ...r } as Report;
    this.s.reports.unshift(rep);
    if (this.s.reports.length > MAX_REPORTS) this.s.reports.length = MAX_REPORTS;
    if (notify) bus.emit('report', rep);
  }

  removeObj(o: WorldObject) {
    this.s.world.objects = this.s.world.objects.filter((x) => x !== o);
    bus.emit('world-obj', { removed: o.id });
  }

  // ————————————————————————————————————————— raids & AI
  private aiTick(now: number) {
    const s = this.s;
    for (const lord of s.lords) {
      // growth every 40 minutes
      if (!lord.lastGrow) lord.lastGrow = now;
      if (now - lord.lastGrow > 40 * 60_000) {
        lord.lastGrow = now;
        if (lord.citadel < 25 && Math.random() < 0.35) {
          lord.citadel++;
          const o = this.obj(lord.objId);
          if (o) o.level = lord.citadel;
        }
        // regenerate troops
        this.ensureLordTroops(lord);
        const full = this.lordFullTroops(lord);
        for (const [k, v] of Object.entries(full)) lord.troops[k as TroopKey] = Math.min(v!, Math.round((lord.troops[k as TroopKey] ?? 0) + v! * 0.3));
      }
    }
    // Hollow waves during "Night of the Void"
    const ev = this.currentEvent(now);
    if (ev.type === 'night' && this.citadel >= 4 && !s.raids.length && now >= s.event.nextWave) {
      if (!s.event.nextWave) s.event.nextWave = now + 3 * 60_000;
      else { this.spawnWave(now); s.event.nextWave = now + (25 + Math.random() * 15) * 60_000; return; }
    }
    // raids begin after citadel 6 and outside shield
    if (this.citadel < 6 || now < s.shieldUntil) return;
    if (s.raids.length || now < s.raidCooldown) return;
    const city = this.cityPos();
    for (const lord of s.lords) {
      const o = this.obj(lord.objId);
      if (!o) continue;
      if (!lord.nextRaidAt) { lord.nextRaidAt = now + (20 + Math.random() * 30) * 60_000; continue; }
      if (now < lord.nextRaidAt) continue;
      const dist = Math.hypot(o.x - city.x, o.y - city.y);
      if (dist > 60 || lord.citadel > this.citadel + 6) { lord.nextRaidAt = now + 30 * 60_000; continue; }
      lord.nextRaidAt = now + (90 + Math.random() * 90) * 60_000;
      s.raidCooldown = now + (50 + Math.random() * 50) * 60_000;
      this.spawnRaid(lord.id, now);
      break;
    }
  }

  spawnRaid(lordId: string, now = this.now()) {
    const lord = this.s.lords.find((l) => l.id === lordId)!;
    const o = this.obj(lord.objId)!;
    const myPower = this.troopPower(this.s.troops) + this.s.legions.reduce((a, l) => a + this.troopPower(l.troops), 0);
    const strength = Math.max(150, this.troopPower(this.s.troops) * (0.35 + Math.random() * 0.3) + myPower * 0.1);
    const tier = maxTier(Math.min(25, lord.citadel));
    const per = [1, 3, 7, 14][tier - 1];
    const units = Math.round(strength / per);
    const types = ['inf', 'arc', 'cav', 'mag'] as const;
    const troops: Troops = {};
    const w = [0.35, 0.3, 0.25, 0.1];
    types.forEach((t, i) => { const n = Math.round(units * w[i]); if (n > 0) troops[(t + tier) as TroopKey] = n; });
    const warn = (90 + this.level('watchtower') * 12) * 1000;
    const raid: IncomingRaid = { id: this.uid(), lordId, troops, heroLevel: lord.heroLevel, from: { x: o.x, y: o.y }, start: now, arrive: now + warn };
    this.s.raids.push(raid);
    bus.emit('raid', raid);
    bus.emit('state');
  }

  troopPower(t: Troops) { return Object.entries(t).reduce((a, [k, n]) => a + TROOPS[k as TroopKey].power * (n ?? 0), 0); }

  cityDefenseArmy(): Army {
    const lead = this.s.defender && this.s.heroes[this.s.defender]?.owned && !this.busyHeroes().has(this.s.defender) ? this.s.defender : null;
    const a = this.legionArmy({ lead, deputy: null, troops: this.s.troops });
    a.name = 'Гарнизон';
    const wb = 0.15 + wallBonus(this.level('wall')) + this.fx.city_def;
    a.mods.def += wb; a.mods.hp += wb;
    a.retreatAt = 0;
    return a;
  }

  private resolveRaid(r: IncomingRaid) {
    const s = this.s;
    s.raids = s.raids.filter((x) => x !== r);
    if (r.kind === 'hollow') { this.resolveWave(r); return; }
    const lord = s.lords.find((l) => l.id === r.lordId)!;
    const att: Army = { name: lord.name, kind: 'lord', groups: groupsFromTroops(r.troops), heroes: [{ id: lordHero(lord.faction), level: r.heroLevel, stars: 1 + Math.floor(lord.citadel / 6), lead: true }], mods: emptyMods(), retreatAt: 0.3, titan: null };
    applyHeroes(att);
    const def = this.cityDefenseArmy();
    const start = sumTroops(s.troops);
    const aPow = armyPower(att), dPow = armyPower(def);
    let res;
    if (start < 1) {
      res = { win: true, rounds: [], aLost: {}, dLost: {}, aStart: sumTroops(r.troops), dStart: 0, aEnd: sumTroops(r.troops), dEnd: 0, comp: { a: [], d: [] } };
    } else {
      res = simulateBattle(att, def, r.id * 17);
    }
    // defender losses: 50% wounded, rest dead
    let wounded = 0, dead = 0;
    let cap = Math.max(0, this.infirmaryCapacity() - this.woundedCount());
    for (const [k, lost] of Object.entries(res.dLost) as [TroopKey, number][]) {
      if (!lost) continue;
      s.troops[k] = Math.max(0, (s.troops[k] ?? 0) - lost);
      if (!s.troops[k]) delete s.troops[k];
      const w = Math.min(cap, Math.round(lost * 0.6));
      cap -= w;
      s.wounded[k] = (s.wounded[k] ?? 0) + w;
      wounded += w; dead += lost - w;
    }
    let rewards: Reward | undefined;
    let text = '';
    if (!res.win) {
      s.stats.raidsDefended++;
      rewards = { res: scaleRes({ food: 1500, wood: 1500, stone: 800, gold: 400 }, Math.max(1, lord.citadel)), items: { chest_small: 1 } };
      this.grant(rewards);
      text = 'Гарнизон отбил набег! Враг бежит, бросив обоз.';
      if (s.defender) this.addHeroXp(s.defender, 400 * lord.citadel);
    } else {
      s.stats.raidsLost++;
      const prot = warehouseProtect(this.level('warehouse'));
      const lost: ResBag = {};
      for (const k of ['food', 'wood', 'stone', 'gold'] as Res[]) {
        const take = Math.max(0, Math.floor((s.res[k] - prot) * 0.25));
        if (take > 0) { lost[k] = take; s.res[k] -= take; }
      }
      text = sumBag(lost) > 0 ? `Враг прорвался и разграбил склады: ${Object.entries(lost).map(([k, v]) => `${resName(k as Res)} ${Math.round(v!)}`).join(', ')}. Улучшите Хранилище и Стену.` : 'Враг прорвался, но Хранилище уберегло припасы.';
      s.shieldUntil = Math.max(s.shieldUntil, this.now() + 2 * 3_600_000);
    }
    this.pushReport({
      kind: 'defense', title: !res.win ? `Набег отражён: ${lord.name}` : `Город разграблен: ${lord.name}`, win: !res.win, text, rounds: res.rounds, comp: res.comp, rewards,
      attacker: { name: lord.name, heroes: att.heroes.map((h) => ({ id: h.id, level: h.level })), start: res.aStart, lost: sumNums(res.aLost), wounded: 0, survived: res.aEnd, power: aPow, kind: 'lord' },
      defender: { name: 'Гарнизон', heroes: def.heroes.map((h) => ({ id: h.id, level: h.level })), start, lost: dead, wounded, survived: sumTroops(s.troops), power: dPow, kind: 'player' },
    });
    bus.emit('raid-resolved', { win: !res.win });
    bus.emit('state');
  }

  // ————————————————————————————————————————— alliance
  allianceOn() { return this.level('embassy') > 0; }

  requestHelp(jobId: number, now = this.now()): Result {
    if (!this.allianceOn()) return fail('Постройте Посольство');
    const j = this.s.jobs.find((x) => x.id === jobId);
    if (!j || (j.kind !== 'build' && j.kind !== 'research')) return fail('Недоступно');
    if (j.helpReq) return fail('Помощь уже запрошена');
    j.helpReq = true; j.helps = 0; j.nextHelp = now + 15_000;
    bus.emit('state');
    return OK;
  }

  private allianceTick(now: number) {
    if (!this.allianceOn()) return;
    const a = this.s.alliance;
    const day = dayKey(now);
    if (a.day !== day) { a.day = day; a.helpsToday = 0; a.donationsToday = 0; a.shopToday = {}; }
    const max = HELPS_PER_JOB(this.level('embassy'));
    for (const j of this.s.jobs) {
      if (!j.helpReq) continue;
      let guard = 0;
      while ((j.helps ?? 0) < max && (j.nextHelp ?? 0) <= now && j.end > (j.nextHelp ?? 0) && guard++ < 50) {
        const cut = Math.max(60_000, (j.end - j.start) * 0.01);
        j.end -= cut; j.start -= cut;
        j.helps = (j.helps ?? 0) + 1;
        j.nextHelp = (j.nextHelp ?? now) + 20_000 + ((j.id * 7919 + j.helps * 104729) % 40_000);
      }
    }
    // allies ask for help and share gifts (gifts accumulate offline too)
    if (!a.nextRequest) a.nextRequest = Math.min(now, this.s.lastTick) + 60_000;
    let g2 = 0;
    while (a.nextRequest <= now && g2++ < 10) {
      if (a.requests.length < 6) {
        const id = this.uid();
        a.requests.push({ id, member: MEMBERS[id % MEMBERS.length].id, kind: REQUEST_KINDS[id % REQUEST_KINDS.length] });
      }
      a.nextRequest += (6 + (a.nextRequest % 7)) * 60_000;
    }
    if (!a.nextGift) a.nextGift = Math.min(now, this.s.lastTick) + 20 * 60_000;
    let g3 = 0;
    while (a.nextGift <= now && g3++ < 10) {
      if (a.gifts.length < 5) { const id = this.uid(); a.gifts.push({ id, at: a.nextGift, from: MEMBERS[(id * 5) % MEMBERS.length].id }); }
      a.nextGift += (150 + (a.nextGift / 1000 % 120)) * 60_000;
    }
  }

  private allianceXp(n: number) {
    const a = this.s.alliance;
    a.xp += n;
    while (a.xp >= allianceLevelXp(a.level) && a.level < 20) { a.xp -= allianceLevelXp(a.level); a.level++; bus.emit('alliance-level', a.level); }
  }

  helpAllies(): number {
    const a = this.s.alliance;
    let n = 0;
    while (a.requests.length && a.helpsToday < HELP_DAILY_CAP) {
      a.requests.shift();
      a.helpsToday++;
      a.contribution += HELP_CONTRIB;
      this.s.stats.allianceHelps++;
      this.allianceXp(5);
      n++;
    }
    if (n) bus.emit('state');
    return n;
  }

  claimGifts(rnd = Math.random): Reward | null {
    const a = this.s.alliance;
    if (!a.gifts.length) return null;
    const items: Record<string, number> = {};
    const res: ResBag = {};
    for (const _ of a.gifts) {
      const r = giftReward(a.level, rnd);
      for (const [k, v] of Object.entries(r.items ?? {})) items[k] = (items[k] ?? 0) + v;
      for (const [k, v] of Object.entries(r.res ?? {})) res[k as Currency] = (res[k as Currency] ?? 0) + (v ?? 0);
      this.allianceXp(10);
    }
    a.gifts = [];
    const reward = { items, res };
    this.grant(reward);
    bus.emit('state');
    return reward;
  }

  donate(techId: string): Result {
    const t = ALLIANCE_TECH_BY_ID[techId];
    const a = this.s.alliance;
    if (!t || !this.allianceOn()) return fail('Недоступно');
    const st = a.techs[techId] ?? { level: 0, progress: 0 };
    if (st.level >= t.max) return fail('Технология изучена полностью');
    if (a.donationsToday >= 20) return fail('Лимит пожертвований на сегодня');
    const cost = donationCost(this.citadel);
    if (!this.has(cost)) return fail('Недостаточно ресурсов');
    this.pay(cost);
    st.progress += DONATION_PROGRESS;
    while (st.level < t.max && st.progress >= techNeed(st.level)) { st.progress -= techNeed(st.level); st.level++; }
    a.techs[techId] = st;
    a.donationsToday++;
    a.contribution += DONATION_CONTRIB;
    this.allianceXp(20);
    this.fx = computeEffects(this.s);
    bus.emit('state');
    return OK;
  }

  buyAlliance(shopId: string): Result {
    const it = ALLIANCE_SHOP.find((x) => x.id === shopId);
    const a = this.s.alliance;
    if (!it) return fail('Нет товара');
    if ((a.shopToday[shopId] ?? 0) >= it.daily) return fail('Лимит покупок на сегодня');
    if (a.contribution < it.price) return fail('Недостаточно очков вклада');
    a.contribution -= it.price;
    a.shopToday[shopId] = (a.shopToday[shopId] ?? 0) + 1;
    this.addItems({ [it.item]: it.count });
    bus.emit('state');
    return OK;
  }

  /** Allied banners join battles against titans and rifts. */
  allianceSupport(): number { return this.allianceOn() ? 0.05 + this.level('embassy') * 0.01 + this.s.alliance.level * 0.005 : 0; }

  // ————————————————————————————————————————— achievements
  private achCheckAt = 0;

  achievementValue(a: AchievementDef): number { return achievementValue(a, this.s, this.power()); }

  achievementState(a: AchievementDef): 'claimed' | 'ready' | 'locked' {
    if (this.s.achievements.claimed.includes(a.id)) return 'claimed';
    return this.achievementValue(a) >= a.target ? 'ready' : 'locked';
  }

  achievementsReady(): number {
    const st = this.s.achievements;
    return st.seen.filter((id) => !st.claimed.includes(id)).length;
  }

  achievementPoints(): number {
    return this.s.achievements.claimed.reduce((n, id) => n + (ACHIEVEMENT_BY_ID[id]?.points ?? 0), 0);
  }

  claimAchievement(id: string): Result & { reward?: Reward } {
    const a = ACHIEVEMENT_BY_ID[id];
    const st = this.s.achievements;
    if (!a) return fail('Нет такого достижения');
    if (st.claimed.includes(id)) return fail('Награда уже получена');
    if (this.achievementValue(a) < a.target) return fail('Достижение ещё не открыто');
    st.claimed.push(id);
    if (!st.seen.includes(id)) st.seen.push(id);
    this.grant(a.reward);
    bus.emit('state');
    return { ok: true, reward: a.reward };
  }

  /** Announces newly unlocked achievements (throttled; old saves are scanned silently once). */
  private achievementTick(now: number) {
    if (now < this.achCheckAt && this.achCheckAt - now <= 2000) return;
    this.achCheckAt = now + 2000;
    const st = this.s.achievements;
    const power = this.power();
    for (const a of ACHIEVEMENTS) {
      if (st.seen.includes(a.id) || achievementValue(a, this.s, power) < a.target) continue;
      st.seen.push(a.id);
      if (st.init) bus.emit('achievement', a.id);
    }
    st.init = true;
  }

  // ————————————————————————————————————————— events
  currentEvent(now = this.s.lastTick) { return eventAt(now, this.s.created); }

  addEventPoints(type: EventType, pts: number) {
    if (pts <= 0 || this.currentEvent().type !== type) return;
    this.s.event.points += pts;
  }

  eventRanking(now = this.s.lastTick) {
    const ev = this.currentEvent(now);
    const progress = (now - ev.start) / (ev.end - ev.start);
    const scale = 3800 * (0.6 + this.citadel / 25);
    const rows = this.s.lords.map((l, i) => ({ name: l.name, color: l.color, score: rivalScore(ev.index * 7 + i + 1, progress, scale), me: false }));
    rows.push({ name: this.s.player.name, color: '#ffe29a', score: Math.floor(this.s.event.points), me: true });
    return rows.sort((a, b) => b.score - a.score);
  }

  claimEventMilestone(i: number): Result {
    const ev = EVENTS[this.currentEvent().type];
    const m = ev.milestones[i];
    if (!m) return fail('Нет награды');
    if (this.s.event.claimed.includes(i)) return fail('Уже получено');
    if (this.s.event.points < m.points) return fail('Недостаточно очков события');
    this.s.event.claimed.push(i);
    this.grant(m.reward);
    bus.emit('state');
    return OK;
  }

  private eventTick(now: number) {
    const cur = this.currentEvent(now);
    const e = this.s.event;
    if (e.key === cur.key) return;
    if (e.key) this.finishEvent(e.key, now);
    this.s.event = { key: cur.key, points: 0, claimed: [], wave: 0, nextWave: 0 };
    bus.emit('event-start', cur.type);
  }

  /** Close a finished event: hand out everything earned so nothing is lost. */
  private finishEvent(key: string, now: number) {
    const [type, idx] = key.split('#') as [EventType, string];
    const def = EVENTS[type];
    if (!def) return;
    const e = this.s.event;
    const items: Record<string, number> = {};
    const res: ResBag = {};
    const merge = (r: Reward) => {
      for (const [k, v] of Object.entries(r.items ?? {})) items[k] = (items[k] ?? 0) + v;
      for (const [k, v] of Object.entries(r.res ?? {})) res[k as Currency] = (res[k as Currency] ?? 0) + (v ?? 0);
    };
    def.milestones.forEach((m, i) => { if (!e.claimed.includes(i) && e.points >= m.points) merge(m.reward); });
    const scale = 3800 * (0.6 + this.citadel / 25);
    const scores = this.s.lords.map((_, i) => rivalScore(Number(idx) * 7 + i + 1, 1, scale));
    const rank = 1 + scores.filter((sc) => sc > e.points).length;
    if (rank <= 3) merge(def.rankRewards[rank - 1]);
    const reward: Reward = { items, res };
    this.grant(reward);
    this.pushReport({ kind: 'system', title: `Итоги события «${def.name}»: ${rank} место`, text: `Вы набрали ${Math.floor(e.points)} очков и заняли ${rank} место среди лордов Расколотых земель.${rank <= 3 ? ' Награда за место уже в сумке.' : ''}`, rewards: reward }, true);
    void now;
  }

  spawnWave(now = this.now()) {
    const s = this.s;
    const c = this.cityPos();
    const wave = s.event.wave + 1;
    const power = Math.max(120, this.troopPower(s.troops) * (0.25 + Math.min(0.35, wave * 0.04)));
    const tier = maxTier(this.citadel);
    const units = Math.round(power / [1, 3, 7, 14][tier - 1]);
    const troops: Troops = {};
    (['inf', 'arc', 'cav', 'mag'] as const).forEach((t, i) => { const n = Math.round(units * [0.4, 0.25, 0.25, 0.1][i]); if (n > 0) troops[(t + tier) as TroopKey] = n; });
    const a = Math.random() * Math.PI * 2;
    const from = { x: Math.round(c.x + Math.cos(a) * 12), y: Math.round(c.y + Math.sin(a) * 12) };
    const raid: IncomingRaid = { id: this.uid(), lordId: '', kind: 'hollow', wave, troops, heroLevel: 0, from, start: now, arrive: now + 75_000 };
    s.raids.push(raid);
    bus.emit('raid', raid);
    bus.emit('state');
  }

  private resolveWave(r: IncomingRaid) {
    const s = this.s;
    const att: Army = { name: 'Орда Пустоты', kind: 'monster', groups: groupsFromTroops(r.troops), heroes: [], mods: emptyMods(), retreatAt: 0.35, titan: null };
    for (const g of att.groups) g.name = hollowName(g.type);
    const def = this.cityDefenseArmy();
    const start = sumTroops(s.troops);
    const res = start < 1 ? { win: true, rounds: [], aLost: {}, dLost: {}, aStart: sumTroops(r.troops), dStart: 0, aEnd: sumTroops(r.troops), dEnd: 0, comp: { a: [], d: [] } } : simulateBattle(att, def, r.id * 13);
    let wounded = 0;
    // monsters wound rather than kill: all garrison losses go to the infirmary when there is room
    let cap = Math.max(0, this.infirmaryCapacity() - this.woundedCount());
    let dead = 0;
    for (const [k, lost] of Object.entries(res.dLost) as [TroopKey, number][]) {
      if (!lost) continue;
      s.troops[k] = Math.max(0, (s.troops[k] ?? 0) - lost);
      if (!s.troops[k]) delete s.troops[k];
      const w = Math.min(cap, lost);
      cap -= w; wounded += w; dead += lost - w;
      s.wounded[k] = (s.wounded[k] ?? 0) + w;
    }
    const wave = r.wave ?? 1;
    let rewards: Reward | undefined;
    if (!res.win) {
      s.event.wave = wave;
      this.addEventPoints('night', 120 * wave);
      rewards = { res: scaleRes({ food: 800, wood: 800 }, Math.max(1, this.citadel)), items: { mat_bone: 1 + Math.floor(wave / 2) } };
      this.grant(rewards);
      s.stats.raidsDefended++;
    } else {
      s.event.wave = Math.max(0, wave - 2);
    }
    this.pushReport({
      kind: 'defense', title: !res.win ? `Волна ${wave} отражена!` : `Волна ${wave} прорвалась`, win: !res.win, rounds: res.rounds, comp: res.comp, rewards,
      text: !res.win ? 'Стены выстояли. Следующая волна будет сильнее.' : 'Твари прорвались, но отступили с рассветом. Укрепите гарнизон — ресурсы не тронуты.',
      attacker: { name: 'Орда Пустоты', heroes: [], start: res.aStart, lost: sumNums(res.aLost), wounded: 0, survived: res.aEnd, power: armyPower(att), kind: 'monster' },
      defender: { name: 'Гарнизон', heroes: def.heroes.map((h) => ({ id: h.id, level: h.level })), start, lost: dead, wounded, survived: sumTroops(s.troops), power: armyPower(def), kind: 'player' },
    });
    bus.emit('raid-resolved', { win: !res.win });
    bus.emit('state');
  }

  // ————————————————————————————————————————— respawn
  private respawnTick(now: number) {
    const w = this.s.world;
    if (now - w.lastRespawn < 60_000) return;
    const minutes = Math.min(24 * 60, (now - w.lastRespawn) / 60_000);
    w.lastRespawn = now;
    const rnd = mulberry32((now / 1000) | 0);
    const count = (k: string) => w.objects.filter((o) => o.kind === k).length;
    const city = this.cityPos();
    // keep a few low-level camps near the city forever so the player always has content
    const nearCamps = w.objects.filter((o) => o.kind === 'camp' && Math.hypot(o.x - city.x, o.y - city.y) < 14).length;
    if (nearCamps < 4) {
      const p = randomFreeTile(this.ter, w.objects, rnd, { x: city.x, y: city.y, r: 13, min: 4 });
      if (p) { const c = makeCamp(this.ter, w.nextObjId++, p.x, p.y, rnd); c.level = Math.max(1, Math.min(c.level, this.s.stats.maxCampLevel + 1)); w.objects.push(c); }
    }
    for (let i = 0; i < 3 && count('camp') < TARGET_COUNTS.camp; i++) {
      const p = randomFreeTile(this.ter, w.objects, rnd);
      if (p) w.objects.push(makeCamp(this.ter, w.nextObjId++, p.x, p.y, rnd));
    }
    for (let i = 0; i < 3 && count('node') < TARGET_COUNTS.node; i++) {
      const p = randomFreeTile(this.ter, w.objects, rnd);
      if (p) w.objects.push(makeNode(this.ter, w.nextObjId++, p.x, p.y, rnd));
    }
    if (count('ruin') < TARGET_COUNTS.ruin && rnd() < 0.3) {
      const p = randomFreeTile(this.ter, w.objects, rnd);
      if (p) w.objects.push({ id: w.nextObjId++, kind: 'ruin', x: p.x, y: p.y, level: zoneLevel(this.ter, p.x, p.y), variant: Math.floor(rnd() * 3) });
    }
    if (count('rift') < TARGET_COUNTS.rift && rnd() < 0.08) {
      const p = randomFreeTile(this.ter, w.objects, rnd, { x: city.x, y: city.y, r: 90, min: 24 });
      if (p) w.objects.push({ id: w.nextObjId++, kind: 'rift', x: p.x, y: p.y, level: Math.min(25, zoneLevel(this.ter, p.x, p.y) + 2), hp: 1 });
    }
    // titans & rifts regenerate slowly
    for (const o of w.objects) if ((o.kind === 'titan' || o.kind === 'rift') && (o.hp ?? 1) < 1) o.hp = Math.min(1, (o.hp ?? 1) + 0.01 * minutes);
    bus.emit('world-obj', {});
  }

  revealAround() {
    const c = this.cityPos();
    if (reveal(this.fog, this.s.world.size, c.x, c.y, watchRange(this.level('watchtower')) + this.citadel * 0.5)) this.fogDirty = true;
  }

  // ————————————————————————————————————————— quests
  chapter() { return CHAPTERS.find((c) => c.n === this.s.quests.chapter) ?? null; }
  questProgress(q: { progress: (s: GameState) => number; target: number }) {
    return Math.min(q.target, q.progress(this.s));
  }
  claimQuest(id: string): Result {
    const ch = this.chapter();
    const q = ch?.quests.find((x) => x.id === id);
    if (!q) return fail('Нет задания');
    if (this.s.quests.claimed.includes(id)) return fail('Уже получено');
    if (this.questProgress(q) < q.target) return fail('Задание не выполнено');
    this.s.quests.claimed.push(id);
    this.grant(q.reward);
    bus.emit('state');
    return OK;
  }
  chapterDone() {
    const ch = this.chapter();
    return !!ch && ch.quests.every((q) => this.s.quests.claimed.includes(q.id));
  }
  claimChapter(): Result {
    const ch = this.chapter();
    if (!ch || !this.chapterDone()) return fail('Глава не завершена');
    this.grant(ch.reward);
    this.s.quests.chapterClaimed.push(ch.n);
    this.s.quests.chapter++;
    bus.emit('chapter', ch.n);
    bus.emit('state');
    return OK;
  }
  /** first unfinished/unclaimed quest in chapter */
  nextQuest() {
    const ch = this.chapter();
    if (!ch) return null;
    const claimable = ch.quests.find((q) => !this.s.quests.claimed.includes(q.id) && this.questProgress(q) >= q.target);
    if (claimable) return claimable;
    return ch.quests.find((q) => !this.s.quests.claimed.includes(q.id)) ?? null;
  }
  dailyProgress(id: string) {
    const d = DAILIES.find((x) => x.id === id)!;
    const base = (this.s.quests.daily as any)[d.stat] ?? 0;
    return Math.min(d.target, Math.floor(this.s.stats[d.stat] - base));
  }
  claimDaily(id: string): Result {
    const d = DAILIES.find((x) => x.id === id);
    if (!d) return fail('Нет задания');
    if (this.s.quests.dailyClaimed.includes(id)) return fail('Уже получено');
    if (this.dailyProgress(id) < d.target) return fail('Не выполнено');
    this.s.quests.dailyClaimed.push(id);
    this.s.quests.dailyPoints += d.points;
    bus.emit('state');
    return OK;
  }
  claimDailyChest(i: number): Result {
    const c = DAILY_CHESTS[i];
    if (!c) return fail('Нет сундука');
    if (this.s.quests.dailyChests.includes(i)) return fail('Уже открыт');
    if (this.s.quests.dailyPoints < c.points) return fail('Мало очков активности');
    this.s.quests.dailyChests.push(i);
    this.grant(c.reward);
    bus.emit('state');
    return OK;
  }
  private dailyTick(now: number) {
    const k = dayKey(now);
    if (this.s.quests.dailyDate !== k) {
      this.s.quests.dailyDate = k;
      this.s.quests.daily = { ...this.s.stats } as any;
      this.s.quests.dailyClaimed = [];
      this.s.quests.dailyChests = [];
      this.s.quests.dailyPoints = 0;
      bus.emit('daily-reset');
    }
  }
  calendarReady() { return this.s.calendar.last !== dayKey() && this.s.calendar.day < CALENDAR.length; }
  claimCalendar(): Result {
    if (!this.calendarReady()) return fail('Уже получено сегодня');
    const r = CALENDAR[this.s.calendar.day];
    this.grant(r);
    this.s.calendar.day++;
    this.s.calendar.last = dayKey();
    bus.emit('state');
    return OK;
  }

  // ————————————————————————————————————————— titans
  feedTitan(id: string, count = 1): Result {
    const t = this.s.titans.tamed[id];
    if (!t) return fail('Титан не приручён');
    const have = this.s.inventory.titan_food ?? 0;
    if (have < count) return fail('Нет эссенции');
    this.s.inventory.titan_food = have - count;
    t.xp += 300 * count;
    while (t.xp >= 400 * t.level && t.level < 30) { t.xp -= 400 * t.level; t.level++; }
    bus.emit('state');
    return OK;
  }
  setActiveTitan(id: string): Result {
    if (!this.s.titans.tamed[id]) return fail('Титан не приручён');
    this.s.titans.active = id;
    bus.emit('state');
    return OK;
  }

  // ————————————————————————————————————————— summaries for UI
  incomingRaid(): IncomingRaid | null { return this.s.raids[0] ?? null; }
  unreadReports() { return this.s.reports.filter((r) => !r.read).length; }
  hasClaimable(): boolean {
    const ch = this.chapter();
    if (ch && ch.quests.some((q) => !this.s.quests.claimed.includes(q.id) && this.questProgress(q) >= q.target)) return true;
    if (this.chapterDone()) return true;
    if (DAILIES.some((d) => !this.s.quests.dailyClaimed.includes(d.id) && this.dailyProgress(d.id) >= d.target)) return true;
    return DAILY_CHESTS.some((c, i) => !this.s.quests.dailyChests.includes(i) && this.s.quests.dailyPoints >= c.points);
  }
  idleBuilders() { return BUILDER_COUNT - this.builderBusy(); }
}

// ————————————————————————————————————————— pure helpers
export function addTroops(into: Troops, add: Troops) {
  for (const [k, v] of Object.entries(add)) if (v) into[k as TroopKey] = (into[k as TroopKey] ?? 0) + v;
}
export function roundTroops(t: Troops) {
  for (const k of Object.keys(t) as TroopKey[]) { t[k] = Math.round(t[k]!); if (!t[k]) delete t[k]; }
}
export function sumTroops(t: Troops): number { let n = 0; for (const v of Object.values(t)) n += v ?? 0; return n; }
export function sumNums(t: Record<string, number>): number { let n = 0; for (const v of Object.values(t)) n += v ?? 0; return n; }
export function sumBag(b: ResBag): number { let n = 0; for (const v of Object.values(b)) n += v ?? 0; return n; }
export function mulBag(b: ResBag, m: number): ResBag { const o: ResBag = {}; for (const [k, v] of Object.entries(b)) o[k as Currency] = Math.round((v ?? 0) * m); return o; }
function scaleRes(b: ResBag, level: number): ResBag { return mulBag(b, Math.pow(level, 1.25) / 2 + 0.5); }
export function resName(k: Currency): string {
  return { food: 'Еда', wood: 'Дерево', stone: 'Камень', gold: 'Золото', aether: 'Эфир' }[k];
}

export function posOnPath(ter: Terrain, path: Point[], speed: number, elapsedMs: number): { pos: Point; seg: number; done: boolean } {
  if (path.length === 0) return { pos: { x: 0, y: 0 }, seg: 0, done: true };
  if (path.length === 1) return { pos: { ...path[0] }, seg: 0, done: true };
  let dist = (elapsedMs / 1000) * speed;
  for (let i = 1; i < path.length; i++) {
    const segLen = pathLength(ter, [path[i - 1], path[i]]);
    if (dist <= segLen) {
      const f = segLen > 0 ? dist / segLen : 1;
      return { pos: { x: path[i - 1].x + (path[i].x - path[i - 1].x) * f, y: path[i - 1].y + (path[i].y - path[i - 1].y) * f }, seg: i - 1, done: false };
    }
    dist -= segLen;
  }
  return { pos: { ...path[path.length - 1] }, seg: path.length - 2, done: true };
}

function hollowName(type: string): string {
  return ({ inf: 'Гнилоклыки', arc: 'Шипометатели', cav: 'Теневые волки', mag: 'Мороки', beast: 'Тварь' } as Record<string, string>)[type] ?? 'Твари';
}

function lordHero(f: string): string { return f === 'order' ? 'torvald' : f === 'wild' ? 'lyra' : 'varg'; }

function campReward(level: number, rnd: () => number, first: boolean): Reward {
  const m = Math.pow(level, 1.55);
  const res: ResBag = { food: Math.round(350 * m), wood: Math.round(350 * m) };
  if (level >= 3) res.stone = Math.round(140 * m);
  if (level >= 5) res.gold = Math.round(60 * m);
  const items: Record<string, number> = {};
  if (rnd() < 0.45) items.tome1 = 1;
  if (rnd() < 0.35) items.speed5 = 1;
  if (rnd() < 0.08 + level * 0.005) items.key_silver = 1;
  if (rnd() < 0.1) items.chest_small = 1;
  if (level >= 8 && rnd() < 0.15) items.tome2 = 1;
  if (level >= 10 && rnd() < 0.04) items.shard_any = 1;
  if (first) { items.key_silver = (items.key_silver ?? 0) + 1; res.aether = 10 + level * 2; }
  // forge materials
  items.mat_iron = 1 + Math.floor(rnd() * (1 + level / 4));
  if (rnd() < 0.6) items.mat_leather = 1 + Math.floor(rnd() * (1 + level / 5));
  if (level >= 6 && rnd() < 0.35) items.mat_bone = 1 + Math.floor(level / 8);
  if (level >= 10 && rnd() < 0.15) items.mat_crystal = 1;
  return { res, items };
}

function ruinReward(level: number, rnd: () => number): Reward {
  const m = Math.pow(level, 1.3) + 1;
  const res: ResBag = {};
  const pickRes = (['food', 'wood', 'stone', 'gold'] as Res[])[Math.floor(rnd() * 4)];
  res[pickRes] = Math.round((pickRes === 'gold' ? 200 : 700) * m);
  if (rnd() < 0.3) res.aether = 5 + Math.round(level * 1.5);
  const items: Record<string, number> = {};
  const roll = rnd();
  if (roll < 0.25) items.key_silver = 1;
  else if (roll < 0.5) items.tome1 = 2;
  else if (roll < 0.7) items.speed15 = 1;
  else if (roll < 0.85) items.chest_small = 1;
  else if (roll < 0.95) items.shard_any = 1;
  else items.key_gold = 1;
  items.mat_iron = 2 + Math.floor(rnd() * 3);
  if (rnd() < 0.5) items.mat_crystal = 1 + Math.floor(level / 10);
  return { res, items, heroXp: Math.round(100 * m) };
}

const RUIN_TEXTS = [
  'Среди обломков древнего святилища разведчики нашли тайник, запечатанный эфирной печатью.',
  'Под корнями мёртвого дуба скрывался склеп забытого короля. Его сокровища теперь ваши.',
  'Обрушенная башня звездочётов хранила карты и запасы, переживший Раскол.',
  'Каменный круг гудел от силы. В его центре лежали дары, оставленные для достойного.',
  'Заброшенный караван-сарай. Торговцы бежали, но товар остался.',
];
function ruinText(rnd: () => number) { return RUIN_TEXTS[Math.floor(rnd() * RUIN_TEXTS.length)]; }

export function chestReward(big: boolean, citadel: number, rnd: () => number): Reward {
  const m = (big ? 4 : 1) * (1 + citadel * 0.35);
  const items: Record<string, number> = {};
  const r = rnd();
  if (big) {
    items.key_silver = 1 + Math.floor(rnd() * 2);
    if (r < 0.35) items.key_gold = 1;
    items.tome2 = 1;
    items.speed60 = 1;
  } else {
    if (r < 0.4) items.speed5 = 2; else if (r < 0.7) items.tome1 = 2; else items.speed15 = 1;
  }
  return { res: { food: Math.round(800 * m), wood: Math.round(800 * m), stone: Math.round(300 * m), gold: Math.round(120 * m) }, items };
}

export function migrate(s: GameState) {
  if (!s.stats) s.stats = emptyStats();
  for (const [k, v] of Object.entries(emptyStats())) if ((s.stats as any)[k] == null) (s.stats as any)[k] = v;
  if (!s.titans) s.titans = { tamed: {}, active: null };
  if (!s.settings) s.settings = { sound: true, music: true, haptics: true, quality: 'high', dayNight: true, showFps: false, notifications: true };
  if (s.settings.showFps == null) s.settings.showFps = false;
  if (s.settings.notifications == null) s.settings.notifications = true;
  if (s.settings.dayNight == null) s.settings.dayNight = true;
  if (!s.raids) s.raids = [];
  if (s.raidCooldown == null) s.raidCooldown = 0;
  if (!s.flags) s.flags = {};
  if (!s.gear) s.gear = [];
  if (!s.achievements) s.achievements = { seen: [], claimed: [], init: false };
  if (!s.alliance) s.alliance = { level: 1, xp: 0, contribution: 0, day: '', helpsToday: 0, donationsToday: 0, techs: {}, gifts: [], requests: [], nextGift: 0, nextRequest: 0, shopToday: {} };
  if (s.stats.allianceHelps == null) s.stats.allianceHelps = 0;
  if (!s.event) s.event = { key: '', points: 0, claimed: [], wave: 0, nextWave: 0 };
  if (s.stats.crafted == null) s.stats.crafted = 0;
  // plots added in later versions
  for (const p of PLOTS) if (!s.buildings.some((b) => b.plot === p.id)) s.buildings.push({ plot: p.id, type: p.type, level: 0, stored: 0 });
  if (!s.calendar) s.calendar = { day: 0, last: '' };
  for (const h of HEROES) if (!s.heroes[h.id]) s.heroes[h.id] = { id: h.id, level: 1, xp: 0, stars: 1, shards: 0, owned: false };
  s.version = SAVE_VERSION;
}

export { HERO_BY_ID };
