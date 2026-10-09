import type { TalentFx } from './talents';

export type Slot = 'weapon' | 'helm' | 'armor' | 'gloves' | 'boots' | 'trinket';
export type GearRarity = 0 | 1 | 2 | 3;
export type SetId = 'sun' | 'storm' | 'void';

export const SLOTS: { id: Slot; name: string; icon: string }[] = [
  { id: 'weapon', name: 'Оружие', icon: 'sword' },
  { id: 'helm', name: 'Шлем', icon: 'hero' },
  { id: 'armor', name: 'Доспех', icon: 'armor' },
  { id: 'gloves', name: 'Перчатки', icon: 'gauntlet' },
  { id: 'boots', name: 'Сапоги', icon: 'boot' },
  { id: 'trinket', name: 'Амулет', icon: 'amulet' },
];

export const GEAR_RARITY = [
  { name: 'Обычный', color: '#b8c0cc', mult: 1, css: 'common' },
  { name: 'Редкий', color: '#4aa3ff', mult: 1.6, css: 'rare' },
  { name: 'Эпический', color: '#b56cff', mult: 2.4, css: 'epic' },
  { name: 'Легендарный', color: '#ffb534', mult: 3.5, css: 'legendary' },
] as const;

export const MATERIALS = [
  { id: 'mat_iron', name: 'Железная руда', icon: 'ore', desc: 'Основа любого снаряжения. Добывается в логовах Пустоты и руинах.' },
  { id: 'mat_leather', name: 'Дублёная кожа', icon: 'leather', desc: 'Для перчаток, сапог и лёгких доспехов. Трофей из логов.' },
  { id: 'mat_bone', name: 'Кость Пустоты', icon: 'bone', desc: 'Твёрже стали. Остаётся от сильных тварей, разломов и титанов.' },
  { id: 'mat_crystal', name: 'Эфирный кристалл', icon: 'crystalMat', desc: 'Наполняет снаряжение силой. Находят в руинах, разломах и у титанов.' },
] as const;
export type MaterialId = (typeof MATERIALS)[number]['id'];

export const SETS: Record<SetId, { name: string; color: string; desc: string; bonus: { n: number; text: string; fx: Partial<TalentFx> }[] }> = {
  sun: {
    name: 'Солнечная гвардия', color: '#ffcf4a', desc: 'Латы паладинов Ордена: выдержат удар титана.',
    bonus: [
      { n: 2, text: 'Защита +3%', fx: { def: 0.03 } },
      { n: 4, text: 'Здоровье +5%', fx: { hp: 0.05 } },
      { n: 6, text: 'Защита +6%, лечение навыком +20%', fx: { def: 0.06, heal: 0.2 } },
    ],
  },
  storm: {
    name: 'Буревой охотник', color: '#7fe3ff', desc: 'Снаряжение странников бури: быстрота и точность.',
    bonus: [
      { n: 2, text: 'Скорость марша +5%', fx: { speed: 0.05 } },
      { n: 4, text: 'Атака +4%', fx: { atk: 0.04 } },
      { n: 6, text: 'Ярость +25 за раунд, урон навыка +10%', fx: { rage: 25, skill: 0.1 } },
    ],
  },
  void: {
    name: 'Клык Пустоты', color: '#c27bff', desc: 'Выковано из костей тварей, которых оно убивает.',
    bonus: [
      { n: 2, text: 'Урон по чудовищам +5%', fx: { monster: 0.05 } },
      { n: 4, text: 'Вместимость легиона +300', fx: { capacity: 300 } },
      { n: 6, text: 'Урон по чудовищам +10%, атака +4%', fx: { monster: 0.1, atk: 0.04 } },
    ],
  },
};

export interface Blueprint {
  id: string;
  slot: Slot;
  set: SetId;
  name: string;
  forge: number; // forge level required
  cost: Partial<Record<MaterialId, number>>;
  /** stats at common rarity */
  stats: Partial<TalentFx>;
}

const NAMES: Record<SetId, Record<Slot, string>> = {
  sun: { weapon: 'Меч зари', helm: 'Шлем рассвета', armor: 'Кираса солнца', gloves: 'Латные рукавицы', boots: 'Поножи стража', trinket: 'Медальон Ордена' },
  storm: { weapon: 'Лук грозы', helm: 'Капюшон ветров', armor: 'Плащ бури', gloves: 'Наручи лучника', boots: 'Сапоги-скороходы', trinket: 'Перо Громокрыла' },
  void: { weapon: 'Секира-клык', helm: 'Череп-шлем', armor: 'Костяной панцирь', gloves: 'Когти пустоты', boots: 'Сапоги из шкуры', trinket: 'Око разлома' },
};

const BASE_STATS: Record<SetId, Record<Slot, Partial<TalentFx>>> = {
  sun: { weapon: { atk: 0.02 }, helm: { hp: 0.02 }, armor: { def: 0.03 }, gloves: { def: 0.015, atk: 0.01 }, boots: { hp: 0.015, speed: 0.02 }, trinket: { def: 0.015, hp: 0.015 } },
  storm: { weapon: { atk: 0.03 }, helm: { atk: 0.01, hp: 0.01 }, armor: { def: 0.02 }, gloves: { atk: 0.02 }, boots: { speed: 0.04 }, trinket: { atk: 0.015, gather: 0.05 } },
  void: { weapon: { atk: 0.025, monster: 0.02 }, helm: { hp: 0.02 }, armor: { def: 0.02, hp: 0.01 }, gloves: { monster: 0.03 }, boots: { speed: 0.02, capacity: 60 }, trinket: { monster: 0.02, capacity: 80 } },
};

const SET_FORGE: Record<SetId, number> = { sun: 1, storm: 4, void: 8 };
const SET_COST: Record<SetId, Partial<Record<MaterialId, number>>> = {
  sun: { mat_iron: 12, mat_leather: 6 },
  storm: { mat_iron: 10, mat_leather: 10, mat_crystal: 3 },
  void: { mat_iron: 14, mat_bone: 8, mat_crystal: 4 },
};

export const BLUEPRINTS: Blueprint[] = (Object.keys(NAMES) as SetId[]).flatMap((set) =>
  SLOTS.map(({ id: slot }) => ({
    id: `${set}_${slot}`, slot, set, name: NAMES[set][slot], forge: SET_FORGE[set], cost: SET_COST[set], stats: BASE_STATS[set][slot],
  })));

export const BLUEPRINT_BY_ID: Record<string, Blueprint> = Object.fromEntries(BLUEPRINTS.map((b) => [b.id, b]));

export interface GearItem { uid: number; bp: string; rarity: GearRarity; hero: string | null }

export function itemStats(it: GearItem): Partial<TalentFx> {
  const bp = BLUEPRINT_BY_ID[it.bp];
  const m = GEAR_RARITY[it.rarity].mult;
  const out: Partial<TalentFx> = {};
  for (const [k, v] of Object.entries(bp.stats)) (out as any)[k] = k === 'capacity' ? Math.round(v! * m) : v! * m;
  return out;
}

/** Rarity roll weights: higher forge levels shift the odds towards better gear. */
export function rarityOdds(forgeLevel: number): number[] {
  const f = Math.max(0, forgeLevel - 1);
  const leg = Math.min(0.12, 0.01 + f * 0.005);
  const epic = Math.min(0.35, 0.08 + f * 0.012);
  const rare = Math.min(0.45, 0.3 + f * 0.008);
  return [Math.max(0, 1 - leg - epic - rare), rare, epic, leg];
}

export function rollRarity(forgeLevel: number, r: number): GearRarity {
  const odds = rarityOdds(forgeLevel);
  let acc = 0;
  for (let i = 0; i < 4; i++) { acc += odds[i]; if (r < acc) return i as GearRarity; }
  return 0;
}

export function statLabel(k: string, v: number): string {
  const pct = (x: number) => `+${(x * 100).toFixed(x * 100 < 10 ? 1 : 0)}%`;
  switch (k) {
    case 'atk': return `Атака ${pct(v)}`;
    case 'def': return `Защита ${pct(v)}`;
    case 'hp': return `Здоровье ${pct(v)}`;
    case 'monster': return `Урон по чудовищам ${pct(v)}`;
    case 'speed': return `Скорость марша ${pct(v)}`;
    case 'gather': return `Сбор ${pct(v)}`;
    case 'capacity': return `Вместимость +${Math.round(v)}`;
    case 'rage': return `Ярость +${Math.round(v)}`;
    case 'skill': return `Урон навыка ${pct(v)}`;
    case 'heal': return `Лечение ${pct(v)}`;
    default: return k;
  }
}
