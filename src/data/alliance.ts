import type { Reward, ResBag } from '../core/types';

export const ALLIANCE_NAME = 'Пепельный Рассвет';

export const MEMBERS = [
  { id: 'a1', name: 'Леди Иветта', hero: 'aerena', title: 'Старейшина' },
  { id: 'a2', name: 'Брам Каменщик', hero: 'ulf', title: 'Зодчий' },
  { id: 'a3', name: 'Тиль Лисица', hero: 'sella', title: 'Разведчица' },
  { id: 'a4', name: 'Хорст Седой', hero: 'torvald', title: 'Воевода' },
  { id: 'a5', name: 'Мелисса Звёздная', hero: 'syra', title: 'Чародейка' },
  { id: 'a6', name: 'Оскар Бородач', hero: 'orian', title: 'Казначей' },
  { id: 'a7', name: 'Рагна Буря', hero: 'lyra', title: 'Охотница' },
  { id: 'a8', name: 'Ивар Клинок', hero: 'varg', title: 'Ветеран' },
] as const;

export interface AllianceTech { id: string; name: string; icon: string; desc: string; max: number; per: number; effect: 'build_speed' | 'research_speed' | 'atk' | 'gather_speed' | 'heal_speed' }

export const ALLIANCE_TECHS: AllianceTech[] = [
  { id: 'at_build', name: 'Общие мастерские', icon: 'hammer', desc: 'Скорость строительства', max: 10, per: 0.02, effect: 'build_speed' },
  { id: 'at_lore', name: 'Библиотека союза', icon: 'book', desc: 'Скорость исследований', max: 10, per: 0.02, effect: 'research_speed' },
  { id: 'at_war', name: 'Боевое братство', icon: 'sword', desc: 'Атака войск', max: 10, per: 0.01, effect: 'atk' },
  { id: 'at_trade', name: 'Торговые пути', icon: 'cart', desc: 'Скорость сбора', max: 10, per: 0.03, effect: 'gather_speed' },
  { id: 'at_heal', name: 'Госпитальеры', icon: 'herb', desc: 'Скорость лечения', max: 10, per: 0.05, effect: 'heal_speed' },
];
export const ALLIANCE_TECH_BY_ID = Object.fromEntries(ALLIANCE_TECHS.map((t) => [t.id, t]));

/** donation points needed to reach the next tech level */
export function techNeed(level: number): number { return Math.round(400 * Math.pow(level + 1, 1.6)); }

/** One donation: costs resources, gives tech progress and personal contribution. */
export function donationCost(citadel: number): ResBag {
  const m = 1 + citadel * 0.5;
  return { food: Math.round(1500 * m), wood: Math.round(1500 * m), stone: Math.round(500 * m) };
}
export const DONATION_PROGRESS = 60;
export const DONATION_CONTRIB = 25;

export const HELPS_PER_JOB = (embassy: number) => 5 + Math.floor(embassy / 2);
export const HELP_DAILY_CAP = 40;
export const HELP_CONTRIB = 8;

/** experience the AI members bring every hour */
export const ALLIANCE_XP_PER_HOUR = 30;

export function allianceLevelXp(level: number): number { return Math.round(1000 * Math.pow(level, 1.5)); }

export interface ShopItem { id: string; item: string; count: number; price: number; daily: number }
export const ALLIANCE_SHOP: ShopItem[] = [
  { id: 's_speed15', item: 'speed15', count: 1, price: 60, daily: 10 },
  { id: 's_speed60', item: 'speed60', count: 1, price: 220, daily: 5 },
  { id: 's_tome2', item: 'tome2', count: 1, price: 150, daily: 5 },
  { id: 's_iron', item: 'mat_iron', count: 10, price: 80, daily: 5 },
  { id: 's_leather', item: 'mat_leather', count: 10, price: 80, daily: 5 },
  { id: 's_bone', item: 'mat_bone', count: 4, price: 160, daily: 3 },
  { id: 's_crystal', item: 'mat_crystal', count: 2, price: 200, daily: 3 },
  { id: 's_silver', item: 'key_silver', count: 1, price: 250, daily: 2 },
  { id: 's_shield', item: 'shield8', count: 1, price: 300, daily: 1 },
  { id: 's_gold', item: 'key_gold', count: 1, price: 900, daily: 1 },
];

export function giftReward(level: number, rnd: () => number): Reward {
  const r = rnd();
  const items: Record<string, number> = {};
  if (r < 0.35) items.speed5 = 2;
  else if (r < 0.6) items.tome1 = 2;
  else if (r < 0.8) items.mat_iron = 6;
  else if (r < 0.93) items.key_silver = 1;
  else items.mat_crystal = 2;
  return { items, res: { food: 600 * level, wood: 600 * level } };
}

/** Requests from allies the player can help with. */
export const REQUEST_KINDS = ['Строительство', 'Исследование', 'Лечение войск'] as const;
