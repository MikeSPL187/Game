import { mulberry32 } from '../core/rng';
import type { BattleRound, TroopKey, Troops, TroopType } from '../core/types';
import { HERO_BY_ID } from '../data/heroes';
import { TITAN_BY_ID } from '../data/world';
import { TROOPS, counterMult } from '../data/troops';

export type GroupType = TroopType | 'beast';

export interface CombatGroup {
  key: string;
  name: string;
  type: GroupType;
  count: number;
  atk: number;
  def: number;
  hp: number;
  power: number;
}

export interface CombatHero { id: string; level: number; stars: number; lead: boolean }

export interface Mods {
  atk: number; def: number; hp: number;
  typeAtk: Partial<Record<TroopType, number>>;
  typeDef: Partial<Record<TroopType, number>>;
  typeHp: Partial<Record<TroopType, number>>;
  vsMonster: number;
}

export interface Army {
  name: string;
  kind: 'player' | 'monster' | 'lord' | 'titan';
  groups: CombatGroup[];
  heroes: CombatHero[];
  mods: Mods;
  titan?: { id: string; level: number; power: number } | null;
  retreatAt: number;
}

export interface BattleResult {
  win: boolean;
  rounds: BattleRound[];
  aLost: Record<string, number>;
  dLost: Record<string, number>;
  aStart: number;
  dStart: number;
  aEnd: number;
  dEnd: number;
}

export const DMG_C = 0.2;
const FRONT: Record<GroupType, number> = { inf: 1.7, cav: 1.1, arc: 0.75, mag: 0.6, beast: 1 };

export function emptyMods(): Mods { return { atk: 0, def: 0, hp: 0, typeAtk: {}, typeDef: {}, typeHp: {}, vsMonster: 0 }; }

export function groupsFromTroops(troops: Troops): CombatGroup[] {
  const out: CombatGroup[] = [];
  for (const [k, n] of Object.entries(troops)) {
    if (!n || n <= 0) continue;
    const d = TROOPS[k as TroopKey];
    out.push({ key: k, name: d.name, type: d.type, count: n, atk: d.atk, def: d.def, hp: d.hp, power: d.power });
  }
  return out;
}

/** Apply hero passives & base stats into army mods. */
export function applyHeroes(army: Army) {
  for (const h of army.heroes) {
    const def = HERO_BY_ID[h.id];
    if (!def) continue;
    const share = h.lead ? 1 : 0.5;
    const starMul = 1 + (h.stars - 1) * 0.06;
    const lvl = h.level * 0.0035;
    army.mods.atk += ((def.atk / 100) + lvl) * share * starMul;
    army.mods.def += ((def.def / 100) + lvl) * share * starMul;
    army.mods.hp += ((def.hp / 100) + lvl) * share * starMul;
    if (h.lead) {
      army.mods.typeAtk[def.spec] = (army.mods.typeAtk[def.spec] ?? 0) + 0.05;
      army.mods.typeDef[def.spec] = (army.mods.typeDef[def.spec] ?? 0) + 0.05;
    }
    for (const p of def.passives) {
      const m = share * starMul;
      if (p.vs === 'monster') { army.mods.vsMonster += (p.atk ?? 0) * m; continue; }
      if (p.type) {
        if (p.atk) army.mods.typeAtk[p.type] = (army.mods.typeAtk[p.type] ?? 0) + p.atk * m;
        if (p.def) army.mods.typeDef[p.type] = (army.mods.typeDef[p.type] ?? 0) + p.def * m;
        if (p.hp) army.mods.typeHp[p.type] = (army.mods.typeHp[p.type] ?? 0) + p.hp * m;
      } else {
        army.mods.atk += (p.atk ?? 0) * m;
        army.mods.def += (p.def ?? 0) * m;
        army.mods.hp += (p.hp ?? 0) * m;
      }
    }
  }
  if (army.titan) {
    const t = TITAN_BY_ID[army.titan.id];
    const m = 1 + army.titan.power;
    army.mods.atk += (t.buff.atk ?? 0) * m;
    army.mods.def += (t.buff.def ?? 0) * m;
    army.mods.hp += (t.buff.hp ?? 0) * m;
  }
}

function eff(g: CombatGroup, m: Mods, stat: 'atk' | 'def' | 'hp'): number {
  const t = g.type === 'beast' ? undefined : g.type;
  if (stat === 'atk') return g.atk * (1 + m.atk + (t ? m.typeAtk[t] ?? 0 : 0));
  if (stat === 'def') return g.def * (1 + m.def + (t ? m.typeDef[t] ?? 0 : 0));
  return g.hp * (1 + m.hp + (t ? m.typeHp[t] ?? 0 : 0));
}

function total(a: Army) { return a.groups.reduce((s, g) => s + g.count, 0); }

export function armyPower(a: Army): number {
  return Math.round(a.groups.reduce((s, g) => s + g.count * g.power, 0) * (1 + (a.mods.atk + a.mods.def + a.mods.hp) / 3));
}

interface SideState {
  army: Army;
  start: Record<string, number>;
  dead: Record<string, number>;
  atkBuff: { v: number; r: number }[];
  defBuff: { v: number; r: number }[];
  rage: number[];
}

function rawDamage(s: SideState, vsMonster: boolean): { g: CombatGroup; dmg: number }[] {
  const buff = s.atkBuff.reduce((a, b) => a + b.v, 0);
  return s.army.groups.filter((g) => g.count > 0).map((g) => ({
    g,
    dmg: g.count * eff(g, s.army.mods, 'atk') * DMG_C * (1 + buff + (vsMonster ? s.army.mods.vsMonster : 0)),
  }));
}

function distribute(from: { g: CombatGroup; dmg: number }[], to: SideState, mult: number, rnd: () => number): Record<string, number> {
  const targets = to.army.groups.filter((g) => g.count > 0.01);
  const kills: Record<string, number> = {};
  if (!targets.length) return kills;
  const wsum = targets.reduce((s, g) => s + g.count * FRONT[g.type], 0);
  const red = Math.min(0.6, to.defBuff.reduce((a, b) => a + b.v, 0));
  for (const src of from) {
    for (const h of targets) {
      const share = (h.count * FRONT[h.type]) / wsum;
      const cm = src.g.type !== 'beast' && h.type !== 'beast' ? counterMult(src.g.type, h.type) : 1;
      const dmg = src.dmg * share * cm * mult * (1 - red) * (0.94 + rnd() * 0.12);
      const tough = eff(h, to.army.mods, 'hp') * (1 + eff(h, to.army.mods, 'def') / 40);
      kills[h.key] = (kills[h.key] ?? 0) + dmg / tough;
    }
  }
  return kills;
}

function applyKills(s: SideState, kills: Record<string, number>) {
  for (const g of s.army.groups) {
    const k = Math.min(g.count, kills[g.key] ?? 0);
    g.count -= k;
    s.dead[g.key] = (s.dead[g.key] ?? 0) + k;
  }
}

function heal(s: SideState, frac: number) {
  for (const g of s.army.groups) {
    const lost = s.dead[g.key] ?? 0;
    const back = lost * frac;
    g.count += back;
    s.dead[g.key] = lost - back;
  }
}

function tickBuffs(s: SideState) {
  s.atkBuff = s.atkBuff.filter((b) => --b.r > 0);
  s.defBuff = s.defBuff.filter((b) => --b.r > 0);
}

export function simulateBattle(attacker: Army, defender: Army, seed = 1, maxRounds = 24): BattleResult {
  const rnd = mulberry32(seed);
  const mk = (army: Army): SideState => ({
    army,
    start: Object.fromEntries(army.groups.map((g) => [g.key, g.count])),
    dead: {}, atkBuff: [], defBuff: [], rage: army.heroes.map(() => 0),
  });
  const A = mk(attacker), D = mk(defender);
  const aStart = total(attacker), dStart = total(defender);
  const rounds: BattleRound[] = [];
  const vsMonsterA = defender.kind === 'monster' || defender.kind === 'titan';
  const vsMonsterD = false;

  for (let r = 1; r <= maxRounds; r++) {
    const events: string[] = [];
    // skills
    for (const [side, other, isA] of [[A, D, true], [D, A, false]] as const) {
      side.army.heroes.forEach((h, i) => {
        side.rage[i] += h.lead ? 340 : 260;
        if (side.rage[i] >= 1000) {
          side.rage[i] = 0;
          const def = HERO_BY_ID[h.id];
          if (!def) return;
          const sk = def.skill;
          const lvlMul = 1 + (h.stars - 1) * 0.12 + h.level * 0.004;
          if (sk.dmg) {
            const raw = rawDamage(side, isA ? vsMonsterA : vsMonsterD);
            const k = distribute(raw, other, sk.dmg * 0.75 * lvlMul, rnd);
            applyKills(other, k);
          }
          if (sk.heal) heal(side, sk.heal * lvlMul);
          if (sk.atkBuff) side.atkBuff.push({ v: sk.atkBuff * lvlMul, r: (sk.rounds ?? 2) + 1 });
          if (sk.defBuff) side.defBuff.push({ v: sk.defBuff * lvlMul, r: (sk.rounds ?? 2) + 1 });
          events.push(`${isA ? 'A' : 'D'}|skill|${h.id}|${sk.name}`);
        }
      });
      const tt = side.army.titan;
      if (tt && (r === 3 || r === 9)) {
        const td = TITAN_BY_ID[tt.id];
        const raw = rawDamage(side, isA ? vsMonsterA : vsMonsterD);
        const k = distribute(raw, other, td.strike * (1 + tt.power), rnd);
        applyKills(other, k);
        events.push(`${isA ? 'A' : 'D'}|titan|${tt.id}|${td.name}`);
      }
    }
    // simultaneous exchange
    const aRaw = rawDamage(A, vsMonsterA);
    const dRaw = rawDamage(D, vsMonsterD);
    const kd = distribute(aRaw, D, 1, rnd);
    const ka = distribute(dRaw, A, 1, rnd);
    applyKills(D, kd);
    applyKills(A, ka);
    tickBuffs(A); tickBuffs(D);
    const at = total(attacker), dt = total(defender);
    rounds.push({ a: Math.round(at), d: Math.round(dt), events });
    if (dt < 1 || dt <= dStart * defender.retreatAt) break;
    if (at < 1 || at <= aStart * attacker.retreatAt) break;
  }

  const aEnd = total(attacker), dEnd = total(defender);
  // winner: side whose remaining fraction is higher, defender needs to be broken for attacker win
  const aFrac = aEnd / Math.max(1, aStart), dFrac = dEnd / Math.max(1, dStart);
  const dBroken = dEnd < 1 || dEnd <= dStart * defender.retreatAt + 0.5;
  const aBroken = aEnd < 1 || aEnd <= aStart * attacker.retreatAt + 0.5;
  let win: boolean;
  if (dBroken && !aBroken) win = true;
  else if (aBroken && !dBroken) win = false;
  else win = aFrac > dFrac && dBroken;

  // finalize integer counts
  for (const g of attacker.groups) g.count = Math.max(0, Math.round(g.count));
  for (const g of defender.groups) g.count = Math.max(0, Math.round(g.count));
  const aLost: Record<string, number> = {}, dLost: Record<string, number> = {};
  for (const g of attacker.groups) aLost[g.key] = Math.max(0, (A.start[g.key] ?? 0) - g.count);
  for (const g of defender.groups) dLost[g.key] = Math.max(0, (D.start[g.key] ?? 0) - g.count);
  return { win, rounds, aLost, dLost, aStart: Math.round(aStart), dStart: Math.round(dStart), aEnd: Math.round(aEnd), dEnd: Math.round(dEnd) };
}

/** quick estimate of win probability-like score: >1 means attacker favoured */
export function estimate(attacker: Army, defender: Army): number {
  const clone = (a: Army): Army => ({ ...a, groups: a.groups.map((g) => ({ ...g })), heroes: [...a.heroes], mods: { ...a.mods, typeAtk: { ...a.mods.typeAtk }, typeDef: { ...a.mods.typeDef }, typeHp: { ...a.mods.typeHp } } });
  const r = simulateBattle(clone(attacker), clone(defender), 7);
  const aFrac = r.aEnd / Math.max(1, r.aStart);
  const dFrac = r.dEnd / Math.max(1, r.dStart);
  if (r.win) return 1 + aFrac;
  return Math.max(0.05, 1 - dFrac);
}

export function titanGroup(id: string, hpFrac = 1): CombatGroup {
  const t = TITAN_BY_ID[id];
  return { key: 'titan_' + id, name: t.name, type: 'beast', count: Math.max(1, Math.round(t.hp * hpFrac / 50)), atk: t.atk * 50 / 10, def: 30, hp: 50, power: 40 };
}
