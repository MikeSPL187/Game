import type { BuildingId, ResBag, Tier, TroopKey, TroopType } from '../core/types';

export interface TroopDef {
  key: TroopKey;
  type: TroopType;
  tier: Tier;
  name: string;
  atk: number;
  def: number;
  hp: number;
  speed: number; // relative
  load: number;
  power: number;
  cost: ResBag;
  time: number; // seconds per unit
}

export const TROOP_TYPES: TroopType[] = ['inf', 'arc', 'cav', 'mag'];
export const TIERS: Tier[] = [1, 2, 3, 4];

export const TYPE_INFO: Record<TroopType, { name: string; plural: string; building: BuildingId; color: string; strong: TroopType; weak: TroopType; desc: string }> = {
  inf: { name: 'Пехота', plural: 'Пехота', building: 'barracks', color: '#5aa0ff', strong: 'cav', weak: 'arc', desc: 'Крепкий передний край. Сильна против кавалерии, уязвима для лучников.' },
  arc: { name: 'Лучники', plural: 'Лучники', building: 'range', color: '#7bd36a', strong: 'inf', weak: 'cav', desc: 'Дальний бой. Сильны против пехоты, уязвимы для кавалерии.' },
  cav: { name: 'Кавалерия', plural: 'Кавалерия', building: 'stable', color: '#ff9b4a', strong: 'arc', weak: 'inf', desc: 'Самые быстрые войска. Сильна против лучников, уязвима для пехоты.' },
  mag: { name: 'Маги', plural: 'Маги', building: 'spire', color: '#c27bff', strong: 'inf', weak: 'cav', desc: 'Колоссальный урон по площади, но хрупкие. Наносят доп. урон пехоте.' },
};

const NAMES: Record<TroopType, string[]> = {
  inf: ['Ополченец', 'Щитоносец', 'Рыцарь клятвы', 'Бессмертный страж'],
  arc: ['Охотник', 'Лучник', 'Следопыт', 'Буревой стрелок'],
  cav: ['Наездник', 'Улан', 'Рыцарь-копейщик', 'Грифоний всадник'],
  mag: ['Послушник', 'Чародей', 'Архимаг', 'Эфирный жрец'],
};

const STATS: Record<TroopType, { atk: number[]; def: number[]; hp: number[]; speed: number; load: number }> = {
  inf: { atk: [10, 16, 26, 40], def: [14, 22, 34, 52], hp: [16, 24, 36, 55], speed: 1.0, load: 10 },
  arc: { atk: [14, 22, 34, 52], def: [9, 14, 22, 34], hp: [12, 18, 28, 42], speed: 1.0, load: 8 },
  cav: { atk: [13, 21, 33, 50], def: [11, 17, 27, 41], hp: [14, 21, 32, 48], speed: 1.45, load: 7 },
  mag: { atk: [17, 27, 42, 64], def: [7, 11, 18, 28], hp: [10, 15, 23, 35], speed: 0.9, load: 5 },
};

const BASE_COST: Record<TroopType, ResBag> = {
  inf: { food: 50, wood: 40 },
  arc: { food: 40, wood: 55 },
  cav: { food: 60, wood: 30, stone: 25 },
  mag: { food: 40, wood: 20, stone: 20, gold: 15 },
};

const TIER_MUL = [1, 2.4, 5.5, 11];
const TIER_POWER = [1, 3, 7, 14];
const TIER_TIME = [2, 4.5, 9, 18];

export const TROOPS = {} as Record<TroopKey, TroopDef>;
for (const type of TROOP_TYPES) {
  for (const tier of TIERS) {
    const s = STATS[type];
    const cost: ResBag = {};
    for (const [k, v] of Object.entries(BASE_COST[type])) cost[k as keyof ResBag] = Math.round(v! * TIER_MUL[tier - 1]);
    if (tier >= 3) cost.gold = (cost.gold ?? 0) + Math.round(20 * TIER_MUL[tier - 1]);
    const key = `${type}${tier}` as TroopKey;
    TROOPS[key] = {
      key, type, tier, name: NAMES[type][tier - 1],
      atk: s.atk[tier - 1], def: s.def[tier - 1], hp: s.hp[tier - 1],
      speed: s.speed, load: Math.round(s.load * (1 + (tier - 1) * 0.35)),
      power: TIER_POWER[tier - 1], cost, time: TIER_TIME[tier - 1],
    };
  }
}

export const ALL_TROOP_KEYS = Object.keys(TROOPS) as TroopKey[];

export function counterMult(attacker: TroopType, target: TroopType): number {
  const a = TYPE_INFO[attacker];
  if (a.strong === target) return 1.3;
  if (a.weak === target) return 0.8;
  return 1;
}
