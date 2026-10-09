import type { ResBag } from '../core/types';

export type EffectKey =
  | 'prod' | 'prod_food' | 'prod_wood' | 'prod_stone' | 'prod_gold'
  | 'build_speed' | 'research_speed' | 'train_speed' | 'heal_speed'
  | 'gather_speed' | 'load' | 'march_speed'
  | 'atk' | 'def' | 'hp' | 'inf_def' | 'arc_atk' | 'cav_atk' | 'mag_atk' | 'inf_hp'
  | 'capacity' | 'infirmary_cap' | 'monster_dmg' | 'city_def';

export interface TechDef {
  id: string;
  tree: 'eco' | 'mil';
  name: string;
  desc: string;
  icon: string;
  col: number;
  row: number;
  max: number;
  effect: EffectKey;
  per: number; // per level (fraction or flat for capacity)
  req: string[];
  academy: number; // academy level needed
  cost: ResBag;    // level 1 cost; scales
  time: number;    // seconds level 1
}

export const TECHS: TechDef[] = [
  // ——— Economy
  { id: 'agri', tree: 'eco', name: 'Земледелие', desc: 'Добыча еды', icon: 'food', col: 0, row: 0, max: 5, effect: 'prod_food', per: 0.05, req: [], academy: 1, cost: { food: 300, wood: 300 }, time: 20 },
  { id: 'carp', tree: 'eco', name: 'Плотничество', desc: 'Добыча дерева', icon: 'wood', col: 0, row: 1, max: 5, effect: 'prod_wood', per: 0.05, req: [], academy: 1, cost: { food: 300, wood: 300 }, time: 20 },
  { id: 'mason', tree: 'eco', name: 'Каменное дело', desc: 'Добыча камня', icon: 'stone', col: 1, row: 0, max: 5, effect: 'prod_stone', per: 0.05, req: ['agri'], academy: 2, cost: { food: 600, wood: 600 }, time: 40 },
  { id: 'mint', tree: 'eco', name: 'Чеканка', desc: 'Добыча золота', icon: 'gold', col: 1, row: 1, max: 5, effect: 'prod_gold', per: 0.05, req: ['carp'], academy: 2, cost: { food: 600, wood: 600, stone: 200 }, time: 40 },
  { id: 'tools', tree: 'eco', name: 'Инструменты', desc: 'Скорость строительства', icon: 'hammer', col: 2, row: 0, max: 5, effect: 'build_speed', per: 0.04, req: ['mason'], academy: 3, cost: { wood: 1200, stone: 800 }, time: 90 },
  { id: 'scribe', tree: 'eco', name: 'Писцы', desc: 'Скорость исследований', icon: 'book', col: 2, row: 1, max: 5, effect: 'research_speed', per: 0.04, req: ['mint'], academy: 3, cost: { food: 1000, gold: 400 }, time: 90 },
  { id: 'carts', tree: 'eco', name: 'Телеги', desc: 'Грузоподъёмность', icon: 'cart', col: 3, row: 0, max: 5, effect: 'load', per: 0.08, req: ['tools'], academy: 4, cost: { wood: 2000, food: 2000 }, time: 150 },
  { id: 'survey', tree: 'eco', name: 'Разведка жил', desc: 'Скорость сбора', icon: 'pick', col: 3, row: 1, max: 5, effect: 'gather_speed', per: 0.06, req: ['scribe'], academy: 4, cost: { wood: 2000, stone: 1500 }, time: 150 },
  { id: 'roads', tree: 'eco', name: 'Тракты', desc: 'Скорость марша', icon: 'boot', col: 4, row: 0, max: 5, effect: 'march_speed', per: 0.05, req: ['carts'], academy: 6, cost: { food: 4000, wood: 4000, stone: 2000 }, time: 300 },
  { id: 'herbal', tree: 'eco', name: 'Травничество', desc: 'Скорость лечения', icon: 'herb', col: 4, row: 1, max: 5, effect: 'heal_speed', per: 0.1, req: ['survey'], academy: 6, cost: { food: 5000, gold: 1500 }, time: 300 },
  { id: 'guilds', tree: 'eco', name: 'Гильдии', desc: 'Вся добыча', icon: 'coin', col: 5, row: 0, max: 5, effect: 'prod', per: 0.05, req: ['roads', 'herbal'], academy: 9, cost: { food: 10000, wood: 10000, stone: 6000, gold: 3000 }, time: 600 },
  { id: 'aetherlore', tree: 'eco', name: 'Эфирные чертежи', desc: 'Скорость строительства', icon: 'crystal', col: 5, row: 1, max: 5, effect: 'build_speed', per: 0.05, req: ['roads', 'herbal'], academy: 10, cost: { wood: 14000, stone: 10000, gold: 4000 }, time: 800 },
  // ——— Military
  { id: 'drill', tree: 'mil', name: 'Муштра', desc: 'Скорость обучения', icon: 'flag', col: 0, row: 0, max: 5, effect: 'train_speed', per: 0.05, req: [], academy: 1, cost: { food: 400, wood: 300 }, time: 25 },
  { id: 'shields', tree: 'mil', name: 'Окованные щиты', desc: 'Защита пехоты', icon: 'shield', col: 0, row: 1, max: 5, effect: 'inf_def', per: 0.03, req: [], academy: 2, cost: { wood: 500, stone: 300 }, time: 30 },
  { id: 'bows', tree: 'mil', name: 'Тисовые луки', desc: 'Атака лучников', icon: 'bow', col: 1, row: 0, max: 5, effect: 'arc_atk', per: 0.03, req: ['drill'], academy: 3, cost: { wood: 900, food: 600 }, time: 60 },
  { id: 'lances', tree: 'mil', name: 'Длинные копья', desc: 'Атака кавалерии', icon: 'lance', col: 1, row: 1, max: 5, effect: 'cav_atk', per: 0.03, req: ['shields'], academy: 3, cost: { wood: 900, stone: 600 }, time: 60 },
  { id: 'logistics', tree: 'mil', name: 'Логистика', desc: 'Вместимость отряда', icon: 'banner', col: 2, row: 0, max: 5, effect: 'capacity', per: 400, req: ['bows'], academy: 4, cost: { food: 2000, wood: 1500, gold: 500 }, time: 120 },
  { id: 'runes', tree: 'mil', name: 'Руны силы', desc: 'Атака магов', icon: 'rune', col: 2, row: 1, max: 5, effect: 'mag_atk', per: 0.03, req: ['lances'], academy: 5, cost: { stone: 1500, gold: 800 }, time: 150 },
  { id: 'medics', tree: 'mil', name: 'Полевые лекари', desc: 'Вместимость лазарета', icon: 'herb', col: 3, row: 0, max: 5, effect: 'infirmary_cap', per: 0.1, req: ['logistics'], academy: 5, cost: { food: 3000, gold: 800 }, time: 180 },
  { id: 'hunters', tree: 'mil', name: 'Охота на Пустоту', desc: 'Урон по чудовищам', icon: 'skull', col: 3, row: 1, max: 5, effect: 'monster_dmg', per: 0.04, req: ['runes'], academy: 6, cost: { food: 3000, wood: 3000, gold: 1000 }, time: 220 },
  { id: 'steel', tree: 'mil', name: 'Небесная сталь', desc: 'Атака всех войск', icon: 'sword', col: 4, row: 0, max: 5, effect: 'atk', per: 0.03, req: ['medics'], academy: 8, cost: { stone: 6000, gold: 2500 }, time: 420 },
  { id: 'plate', tree: 'mil', name: 'Латы', desc: 'Защита всех войск', icon: 'armor', col: 4, row: 1, max: 5, effect: 'def', per: 0.03, req: ['hunters'], academy: 8, cost: { stone: 6000, wood: 6000, gold: 2000 }, time: 420 },
  { id: 'vigor', tree: 'mil', name: 'Эликсир стойкости', desc: 'Здоровье всех войск', icon: 'heart', col: 5, row: 0, max: 5, effect: 'hp', per: 0.03, req: ['steel', 'plate'], academy: 11, cost: { food: 15000, gold: 5000 }, time: 900 },
  { id: 'bastion', tree: 'mil', name: 'Бастион', desc: 'Защита города', icon: 'tower', col: 5, row: 1, max: 5, effect: 'city_def', per: 0.05, req: ['steel', 'plate'], academy: 10, cost: { stone: 15000, wood: 10000 }, time: 800 },
];

export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

export function techCost(t: TechDef, toLevel: number): ResBag {
  const m = Math.pow(toLevel, 1.9);
  const out: ResBag = {};
  for (const [k, v] of Object.entries(t.cost)) out[k as keyof ResBag] = Math.round(v! * m / 10) * 10;
  return out;
}
export function techTime(t: TechDef, toLevel: number): number {
  return Math.round(t.time * Math.pow(toLevel, 1.8));
}
