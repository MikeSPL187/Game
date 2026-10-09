import type { TroopType } from '../core/types';
import { TYPE_INFO } from './troops';

export type Branch = 'might' | 'guard' | 'spec';

export interface TalentFx {
  atk: number; def: number; hp: number;
  typeAtk: number; typeDef: number; typeHp: number; // for the hero's specialty troop type
  rage: number;       // extra rage per round
  skill: number;      // active skill damage multiplier bonus
  heal: number;       // active skill healing bonus
  monster: number;    // damage vs monsters/titans
  capacity: number;   // extra troops in the legion
  speed: number;      // march speed
  gather: number;     // gathering speed
}

export interface TalentNode {
  id: string;
  branch: Branch;
  row: number;
  max: number;
  icon: string;
  name: string;
  /** description for one rank; {v} is replaced with the per-rank value */
  desc: (spec: TroopType) => string;
  apply: (fx: TalentFx, rank: number) => void;
}

export const BRANCHES: { id: Branch; name: string; color: string; icon: string }[] = [
  { id: 'might', name: 'Натиск', color: '#ff7a5a', icon: 'sword' },
  { id: 'guard', name: 'Стойкость', color: '#5aa8ff', icon: 'shield' },
  { id: 'spec', name: 'Мастерство', color: '#ffd24a', icon: 'star' },
];

/** points that must be spent in a branch to open a row */
export const ROW_REQ = [0, 4, 8, 12, 16];

const t = (s: TroopType) => TYPE_INFO[s].name.toLowerCase();

export const TALENTS: TalentNode[] = [
  // ——— Натиск
  { id: 'm_atk', branch: 'might', row: 0, max: 5, icon: 'sword', name: 'Острая сталь', desc: () => 'Атака отряда +1%', apply: (f, r) => { f.atk += 0.01 * r; } },
  { id: 'm_rage', branch: 'might', row: 1, max: 3, icon: 'flag', name: 'Боевой клич', desc: () => 'Ярость +12 за раунд', apply: (f, r) => { f.rage += 12 * r; } },
  { id: 'm_skill', branch: 'might', row: 2, max: 5, icon: 'rune', name: 'Сокрушение', desc: () => 'Урон навыка +5%', apply: (f, r) => { f.skill += 0.05 * r; } },
  { id: 'm_hunt', branch: 'might', row: 3, max: 3, icon: 'skull', name: 'Охотник на Пустоту', desc: () => 'Урон по чудовищам и титанам +4%', apply: (f, r) => { f.monster += 0.04 * r; } },
  { id: 'm_cap', branch: 'might', row: 4, max: 1, icon: 'attack', name: 'Ярость титанов', desc: () => 'Атака +5%, урон навыка +10%', apply: (f, r) => { f.atk += 0.05 * r; f.skill += 0.1 * r; } },
  // ——— Стойкость
  { id: 'g_def', branch: 'guard', row: 0, max: 5, icon: 'shield', name: 'Сомкнутый строй', desc: () => 'Защита отряда +1%', apply: (f, r) => { f.def += 0.01 * r; } },
  { id: 'g_hp', branch: 'guard', row: 1, max: 5, icon: 'heart', name: 'Закалка', desc: () => 'Здоровье отряда +1%', apply: (f, r) => { f.hp += 0.01 * r; } },
  { id: 'g_heal', branch: 'guard', row: 2, max: 3, icon: 'herb', name: 'Полевая медицина', desc: () => 'Лечение навыком +15%', apply: (f, r) => { f.heal += 0.15 * r; } },
  { id: 'g_cap', branch: 'guard', row: 3, max: 5, icon: 'banner', name: 'Знаменосцы', desc: () => 'Вместимость легиона +120', apply: (f, r) => { f.capacity += 120 * r; } },
  { id: 'g_end', branch: 'guard', row: 4, max: 1, icon: 'armor', name: 'Несгибаемый', desc: () => 'Защита +5%, здоровье +5%', apply: (f, r) => { f.def += 0.05 * r; f.hp += 0.05 * r; } },
  // ——— Мастерство (специализация героя)
  { id: 's_atk', branch: 'spec', row: 0, max: 5, icon: 'arrowUp', name: 'Выучка', desc: (s) => `Атака: ${t(s)} +2%`, apply: (f, r) => { f.typeAtk += 0.02 * r; } },
  { id: 's_def', branch: 'spec', row: 1, max: 5, icon: 'shield', name: 'Броня', desc: (s) => `Защита: ${t(s)} +2%`, apply: (f, r) => { f.typeDef += 0.02 * r; } },
  { id: 's_hp', branch: 'spec', row: 2, max: 5, icon: 'heart', name: 'Выносливость', desc: (s) => `Здоровье: ${t(s)} +2%`, apply: (f, r) => { f.typeHp += 0.02 * r; } },
  { id: 's_road', branch: 'spec', row: 3, max: 3, icon: 'boot', name: 'Следопыт', desc: () => 'Скорость марша +3%, сбор +5%', apply: (f, r) => { f.speed += 0.03 * r; f.gather += 0.05 * r; } },
  { id: 's_cap', branch: 'spec', row: 4, max: 1, icon: 'star', name: 'Легенда рода', desc: (s) => `Атака: ${t(s)} +6%, ярость +20`, apply: (f, r) => { f.typeAtk += 0.06 * r; f.rage += 20 * r; } },
];

export const TALENT_BY_ID: Record<string, TalentNode> = Object.fromEntries(TALENTS.map((n) => [n.id, n]));

export function emptyTalentFx(): TalentFx {
  return { atk: 0, def: 0, hp: 0, typeAtk: 0, typeDef: 0, typeHp: 0, rage: 0, skill: 0, heal: 0, monster: 0, capacity: 0, speed: 0, gather: 0 };
}

export function talentFx(talents: Record<string, number> | undefined): TalentFx {
  const fx = emptyTalentFx();
  for (const [id, r] of Object.entries(talents ?? {})) if (r > 0 && TALENT_BY_ID[id]) TALENT_BY_ID[id].apply(fx, r);
  return fx;
}

export function spentIn(talents: Record<string, number> | undefined, branch?: Branch): number {
  let n = 0;
  for (const [id, r] of Object.entries(talents ?? {})) if (!branch || TALENT_BY_ID[id]?.branch === branch) n += r;
  return n;
}

export function talentPointsTotal(level: number): number { return Math.max(0, level - 1); }
