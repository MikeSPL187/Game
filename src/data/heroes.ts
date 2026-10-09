import type { FactionId, TroopType } from '../core/types';

export type Rarity = 'rare' | 'epic' | 'legendary';

export interface SkillDef {
  name: string;
  desc: string;
  /** active (rage) skill effects */
  dmg?: number;      // multiplier of one round of legion damage
  heal?: number;     // fraction of lost troops restored
  atkBuff?: number;  // attack bonus
  defBuff?: number;  // incoming damage reduction
  rounds?: number;
}

export interface PassiveDef {
  name: string;
  desc: string;
  atk?: number; def?: number; hp?: number;
  gather?: number; speed?: number; capacity?: number;
  vs?: 'monster' | 'city';
  type?: TroopType;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  rarity: Rarity;
  faction: FactionId;
  spec: TroopType;
  role: string;
  lore: string;
  atk: number; def: number; hp: number; // base % bonuses
  skill: SkillDef;
  passives: PassiveDef[];
  palette: { skin: string; hair: string; armor: string; accent: string; eye: string; bg: string };
  look: { hair: 'long' | 'short' | 'hood' | 'helm' | 'bald' | 'braids' | 'crown' | 'mohawk'; beard?: boolean; female?: boolean; scar?: boolean; horns?: boolean; ears?: boolean; mask?: boolean; glow?: boolean; tattoo?: boolean };
}

export const RARITY_INFO: Record<Rarity, { name: string; color: string; glow: string }> = {
  rare: { name: 'Редкий', color: '#4aa3ff', glow: 'rgba(74,163,255,.55)' },
  epic: { name: 'Эпический', color: '#b56cff', glow: 'rgba(181,108,255,.6)' },
  legendary: { name: 'Легендарный', color: '#ffb534', glow: 'rgba(255,181,52,.7)' },
};

export const HEROES: HeroDef[] = [
  {
    id: 'aerena', name: 'Айрена', title: 'Светоносная', rarity: 'legendary', faction: 'order', spec: 'inf', role: 'Пехота · Оборона',
    lore: 'Последняя паладина Солнечного Ордена. Её щит выдержал падение небесного престола.',
    atk: 8, def: 14, hp: 12,
    skill: { name: 'Солнечный бастион', desc: 'Наносит урон (160%) и снижает входящий урон отряда на 25% на 2 раунда.', dmg: 1.6, defBuff: 0.25, rounds: 2 },
    passives: [
      { name: 'Клятва света', desc: 'Пехота: +12% защиты', def: 0.12, type: 'inf' },
      { name: 'Неугасимая', desc: 'Здоровье отряда +8%', hp: 0.08 },
    ],
    palette: { skin: '#f2c9a5', hair: '#f6e3a1', armor: '#e9e4d6', accent: '#ffcf4a', eye: '#4fb6ff', bg: '#4a3a12' },
    look: { hair: 'long', female: true, glow: true },
  },
  {
    id: 'kael', name: 'Каэль', title: 'Буревестник', rarity: 'legendary', faction: 'wild', spec: 'mag', role: 'Маги · Урон',
    lore: 'Изгнанный архимаг, укротивший бурю над Расколотыми пиками. Говорят, гром отвечает на его зов.',
    atk: 16, def: 6, hp: 8,
    skill: { name: 'Цепная молния', desc: 'Наносит огромный урон (240%) по вражескому отряду.', dmg: 2.4 },
    passives: [
      { name: 'Око бури', desc: 'Маги: +12% атаки', atk: 0.12, type: 'mag' },
      { name: 'Грозовой фронт', desc: 'Атака отряда +6%', atk: 0.06 },
    ],
    palette: { skin: '#d8b49a', hair: '#cfd8ff', armor: '#2c3c8c', accent: '#7fe3ff', eye: '#a8f0ff', bg: '#16224d' },
    look: { hair: 'hood', beard: true, glow: true },
  },
  {
    id: 'grom', name: 'Гром', title: 'Пепельный Кулак', rarity: 'legendary', faction: 'ash', spec: 'cav', role: 'Кавалерия · Натиск',
    lore: 'Вождь Пепельных кланов, прошедший сквозь пламя Огненного змея и вернувшийся с его рогом.',
    atk: 15, def: 9, hp: 10,
    skill: { name: 'Огненный натиск', desc: 'Наносит урон (190%) и повышает атаку отряда на 20% на 2 раунда.', dmg: 1.9, atkBuff: 0.2, rounds: 2 },
    passives: [
      { name: 'Ярость клана', desc: 'Кавалерия: +12% атаки', atk: 0.12, type: 'cav' },
      { name: 'Пожиратель пустоты', desc: 'Урон по чудовищам +15%', atk: 0.15, vs: 'monster' },
    ],
    palette: { skin: '#8a9a6a', hair: '#2a1c14', armor: '#5a2a1a', accent: '#ff6a2a', eye: '#ffb02a', bg: '#4a1a10' },
    look: { hair: 'mohawk', beard: true, scar: true, tattoo: true },
  },
  {
    id: 'lyra', name: 'Лира', title: 'Тихая Стрела', rarity: 'epic', faction: 'wild', spec: 'arc', role: 'Лучники · Урон',
    lore: 'Следопыт из Сумрачного леса. Её стрелы находят цель раньше, чем враг услышит тетиву.',
    atk: 11, def: 5, hp: 6,
    skill: { name: 'Град стрел', desc: 'Наносит урон (170%) по вражескому отряду.', dmg: 1.7 },
    passives: [{ name: 'Меткий глаз', desc: 'Лучники: +10% атаки', atk: 0.10, type: 'arc' }],
    palette: { skin: '#f0cfae', hair: '#7a3a1c', armor: '#2f5a32', accent: '#a6e36a', eye: '#5fd38a', bg: '#173a20' },
    look: { hair: 'braids', female: true, ears: true },
  },
  {
    id: 'torvald', name: 'Торвальд', title: 'Железный Щит', rarity: 'epic', faction: 'order', spec: 'inf', role: 'Пехота · Защита',
    lore: 'Ветеран северных застав. Ни одна стена, которую он защищал, не пала.',
    atk: 5, def: 11, hp: 10,
    skill: { name: 'Стена щитов', desc: 'Снижает входящий урон на 30% на 2 раунда и возвращает в строй 4% павших.', defBuff: 0.3, heal: 0.04, rounds: 2 },
    passives: [{ name: 'Закалённый', desc: 'Пехота: +10% здоровья', hp: 0.10, type: 'inf' }],
    palette: { skin: '#e4b48f', hair: '#b86a2a', armor: '#8a929e', accent: '#d9a441', eye: '#3a6aa8', bg: '#2a2f38' },
    look: { hair: 'helm', beard: true },
  },
  {
    id: 'syra', name: 'Сайра', title: 'Лунная Ведьма', rarity: 'epic', faction: 'wild', spec: 'mag', role: 'Маги · Поддержка',
    lore: 'Хранительница лунных родников. Её песнь исцеляет раны и сводит с ума чудовищ.',
    atk: 8, def: 6, hp: 9,
    skill: { name: 'Лунный свет', desc: 'Наносит урон (110%) и возвращает в строй 8% павших.', dmg: 1.1, heal: 0.08 },
    passives: [{ name: 'Серебряная роса', desc: 'Здоровье отряда +6%', hp: 0.06 }],
    palette: { skin: '#cfd2ff', hair: '#e8ecff', armor: '#3a2a6a', accent: '#b8a2ff', eye: '#e6d4ff', bg: '#21184a' },
    look: { hair: 'long', female: true, glow: true, ears: true },
  },
  {
    id: 'varg', name: 'Варг', title: 'Клык', rarity: 'epic', faction: 'ash', spec: 'cav', role: 'Кавалерия · Охота',
    lore: 'Полуволк, полу-человек. Ведёт свою стаю по следам Пустоты.',
    atk: 10, def: 7, hp: 7,
    skill: { name: 'Разрыв', desc: 'Наносит урон (150%) и повышает атаку на 15% на 2 раунда.', dmg: 1.5, atkBuff: 0.15, rounds: 2 },
    passives: [{ name: 'Охотник на тварей', desc: 'Урон по чудовищам +12%', atk: 0.12, vs: 'monster' }],
    palette: { skin: '#b89a80', hair: '#4a4a52', armor: '#3a2a22', accent: '#d64a2a', eye: '#ffd24a', bg: '#2a1a14' },
    look: { hair: 'short', beard: true, scar: true, horns: false, mask: false, ears: true },
  },
  {
    id: 'orian', name: 'Ориан', title: 'Мудрый', rarity: 'epic', faction: 'order', spec: 'mag', role: 'Сбор · Экономика',
    lore: 'Магистр Академии и картограф Расколотых земель. Знает, где лежат богатейшие жилы.',
    atk: 6, def: 6, hp: 6,
    skill: { name: 'Глиф защиты', desc: 'Снижает входящий урон на 20% на 2 раунда.', defBuff: 0.2, rounds: 2 },
    passives: [
      { name: 'Картограф', desc: 'Скорость сбора ресурсов +25%', gather: 0.25 },
      { name: 'Знание троп', desc: 'Скорость марша +10%', speed: 0.10 },
    ],
    palette: { skin: '#e8c8a8', hair: '#d8d8d8', armor: '#6a4a2a', accent: '#5ab8ff', eye: '#6aa8d8', bg: '#2a2418' },
    look: { hair: 'bald', beard: true },
  },
  {
    id: 'brenn', name: 'Бренн', title: 'Ловчий', rarity: 'rare', faction: 'wild', spec: 'arc', role: 'Лучники · Сбор',
    lore: 'Охотник с окраин, первым откликнувшийся на зов нового лорда.',
    atk: 6, def: 3, hp: 4,
    skill: { name: 'Прицельный залп', desc: 'Наносит урон (130%).', dmg: 1.3 },
    passives: [{ name: 'Лесная тропа', desc: 'Скорость сбора +15%', gather: 0.15 }],
    palette: { skin: '#e2b896', hair: '#5a3a1a', armor: '#5a4a2a', accent: '#8ab84a', eye: '#4a7a3a', bg: '#22301a' },
    look: { hair: 'hood' },
  },
  {
    id: 'mira', name: 'Мира', title: 'Полевая Стража', rarity: 'rare', faction: 'order', spec: 'inf', role: 'Пехота · Сбор',
    lore: 'Капитан ополчения. Её отряды возвращаются с полей с полными телегами.',
    atk: 4, def: 6, hp: 5,
    skill: { name: 'Сомкнуть ряды', desc: 'Снижает входящий урон на 18% на 2 раунда.', defBuff: 0.18, rounds: 2 },
    passives: [{ name: 'Хозяйственная', desc: 'Грузоподъёмность +20%', capacity: 0.2 }],
    palette: { skin: '#f0c8a0', hair: '#c88a3a', armor: '#7a6a5a', accent: '#e0c050', eye: '#5a8a5a', bg: '#30281a' },
    look: { hair: 'short', female: true },
  },
  {
    id: 'ulf', name: 'Ульф', title: 'Железная Рука', rarity: 'rare', faction: 'ash', spec: 'inf', role: 'Пехота · Натиск',
    lore: 'Кузнец, сменивший молот на секиру, когда Пустота пришла в его деревню.',
    atk: 6, def: 5, hp: 4,
    skill: { name: 'Сокрушение', desc: 'Наносит урон (140%).', dmg: 1.4 },
    passives: [{ name: 'Кузнечная закалка', desc: 'Пехота: +6% атаки', atk: 0.06, type: 'inf' }],
    palette: { skin: '#d8a888', hair: '#3a2a1a', armor: '#4a4a4a', accent: '#ff8a3a', eye: '#3a3a3a', bg: '#2a2020' },
    look: { hair: 'bald', beard: true, scar: true },
  },
  {
    id: 'sella', name: 'Селла', title: 'Ветрогонка', rarity: 'rare', faction: 'wild', spec: 'cav', role: 'Кавалерия · Разведка',
    lore: 'Гонец, проскакавшая все Расколотые земли за семь дней.',
    atk: 5, def: 4, hp: 4,
    skill: { name: 'Обходной манёвр', desc: 'Наносит урон (120%) и повышает атаку на 10% на 2 раунда.', dmg: 1.2, atkBuff: 0.1, rounds: 2 },
    passives: [{ name: 'Попутный ветер', desc: 'Скорость марша +15%', speed: 0.15 }],
    palette: { skin: '#f0d0b0', hair: '#f0a050', armor: '#3a5a7a', accent: '#8ad0ff', eye: '#4a8ac0', bg: '#1a2a3a' },
    look: { hair: 'braids', female: true },
  },
];

export const HERO_BY_ID: Record<string, HeroDef> = Object.fromEntries(HEROES.map((h) => [h.id, h]));

export const MAX_HERO_LEVEL = 60;
export function heroLevelCap(stars: number): number { return [20, 30, 40, 50, 60][Math.max(0, Math.min(4, stars - 1))]; }
export function xpForLevel(level: number): number { return Math.round(120 * Math.pow(level, 1.85)); }
export const STAR_SHARDS = [0, 10, 20, 40, 80];
export function shardsForNextStar(stars: number): number { return STAR_SHARDS[stars] ?? Infinity; }
export function dupShards(r: Rarity): number { return r === 'legendary' ? 10 : r === 'epic' ? 10 : 10; }
