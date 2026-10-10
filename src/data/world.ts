import type { FactionId, Res, TroopKey, Troops } from '../core/types';

export const FACTIONS: Record<FactionId, { name: string; motto: string; desc: string; color: string; color2: string; bonus: string; bonuses: Partial<Record<string, number>> }> = {
  order: {
    name: 'Солнечный Орден', motto: 'Свет не отступает.',
    desc: 'Рыцари и паладины, хранящие осколки небесного престола. Несокрушимая оборона.',
    color: '#ffcf4a', color2: '#3a5aa8', bonus: 'Защита войск +8% · Скорость строительства +5%',
    bonuses: { def: 0.08, build_speed: 0.05 },
  },
  wild: {
    name: 'Дикий Завет', motto: 'Лес помнит всё.',
    desc: 'Друиды, следопыты и звери Сумрачного леса. Мастера манёвра и добычи.',
    color: '#7bd36a', color2: '#2a5a3a', bonus: 'Скорость марша +10% · Скорость сбора +10%',
    bonuses: { march_speed: 0.1, gather_speed: 0.1 },
  },
  ash: {
    name: 'Пепельные Кланы', motto: 'Из пепла — сила.',
    desc: 'Огнекровные воители вулканических равнин. Яростный натиск и мощь кавалерии.',
    color: '#ff6a3a', color2: '#5a1a1a', bonus: 'Атака войск +8% · Скорость обучения +5%',
    bonuses: { atk: 0.08, train_speed: 0.05 },
  },
};

export interface TitanDef {
  id: string;
  name: string;
  title: string;
  level: number;
  desc: string;
  buff: { atk?: number; def?: number; hp?: number };
  strike: number; // damage multiplier of titan strike
  color: string;
  color2: string;
  hp: number; // combat toughness in "troops"
  atk: number;
}

export const TITANS: TitanDef[] = [
  { id: 'roc', name: 'Громокрыл', title: 'Повелитель гроз', level: 8, desc: 'Исполинская птица, рождённая в сердце грозы. Её крик раскалывает небо.', buff: { atk: 0.06 }, strike: 1.2, color: '#5ac8ff', color2: '#24407a', hp: 11000, atk: 36 },
  { id: 'golem', name: 'Камнепанцирь', title: 'Древний страж', level: 15, desc: 'Ходячая гора, спавшая под Каменной грядой тысячу лет.', buff: { def: 0.08, hp: 0.06 }, strike: 1.6, color: '#c8a46a', color2: '#4a3a2a', hp: 38000, atk: 72 },
  { id: 'wyrm', name: 'Пепельный Змей', title: 'Пламя Раскола', level: 22, desc: 'Последний дракон старой эпохи. Его дыхание обращает крепости в стекло.', buff: { atk: 0.1, def: 0.05, hp: 0.05 }, strike: 2.4, color: '#ff6a2a', color2: '#5a1a0a', hp: 90000, atk: 110 },
  { id: 'frost', name: 'Ледяной Колосс', title: 'Сердце Вечной Зимы', level: 25, desc: 'Великан изо льда и звёздного света, спящий на вершинах Северного хребта. Там, где он ступает, замерзает даже эфир.', buff: { atk: 0.08, def: 0.1, hp: 0.1 }, strike: 3.0, color: '#9ae8ff', color2: '#1a3a5a', hp: 180000, atk: 150 },
];

export const TITAN_BY_ID: Record<string, TitanDef> = Object.fromEntries(TITANS.map((t) => [t.id, t]));

export const LORD_NAMES: { name: string; faction: FactionId; color: string }[] = [
  { name: 'Барон Мортимер', faction: 'order', color: '#e0c050' },
  { name: 'Ярла Кровавая', faction: 'ash', color: '#e04a3a' },
  { name: 'Сильван Тёмный', faction: 'wild', color: '#3ad08a' },
  { name: 'Граф Валдемар', faction: 'order', color: '#6a8aff' },
  { name: 'Хан Курган', faction: 'ash', color: '#ff8a2a' },
  { name: 'Морвена Тень', faction: 'wild', color: '#c070ff' },
];

export const NODE_INFO: Record<Res, { name: string; plural: string }> = {
  food: { name: 'Поля', plural: 'Поля' },
  wood: { name: 'Лес', plural: 'Лесоповал' },
  stone: { name: 'Каменоломня', plural: 'Каменоломни' },
  gold: { name: 'Золотая жила', plural: 'Жилы' },
};

export function nodeAmount(level: number, res: Res): number {
  const base = res === 'gold' ? 1500 : res === 'stone' ? 3500 : 5000;
  return Math.round(base * Math.pow(level, 1.5));
}

/** gather rate per second per legion, scaled by load and node level */
export function nodeRate(level: number, res: Res): number {
  const base = res === 'gold' ? 1.8 : res === 'stone' ? 3.5 : 5;
  return base * (1 + (level - 1) * 0.35);
}

const HOLLOW_NAMES = ['Логово гнилоклыков', 'Стая теней', 'Гнездо мороков', 'Лагерь отступников', 'Пристанище костяных', 'Улей пустоты'];
export function campName(level: number): string {
  return HOLLOW_NAMES[Math.min(HOLLOW_NAMES.length - 1, Math.floor((level - 1) / 4))];
}

/** Troops of a hollow camp at a given level. */
export function campTroops(level: number): Troops {
  const power = Math.round((120 * Math.pow(1.38, level - 1) + level * 60) * Math.min(1, 0.45 + level * 0.09));
  const tier = level >= 20 ? 4 : level >= 13 ? 3 : level >= 6 ? 2 : 1;
  const tierPower = [1, 3, 7, 14][tier - 1];
  const units = Math.max(10, Math.round(power / tierPower));
  const mix: [string, number][] = level % 3 === 0 ? [['mag', 0.3], ['inf', 0.4], ['arc', 0.3]]
    : level % 3 === 1 ? [['inf', 0.5], ['cav', 0.3], ['arc', 0.2]]
    : [['arc', 0.45], ['cav', 0.35], ['inf', 0.2]];
  const out: Troops = {};
  for (const [t, f] of mix) out[(t + tier) as TroopKey] = Math.round(units * f);
  return out;
}

export function riftTroops(level: number): Troops {
  const t = campTroops(level + 1);
  for (const k of Object.keys(t) as TroopKey[]) t[k] = Math.round(t[k]! * 1.5);
  return t;
}

export const CAMP_KINDS = 3;
