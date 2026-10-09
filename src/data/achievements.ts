import type { GameState, Reward, Stats } from '../core/types';

export interface AchievementDef {
  id: string;
  family: string;
  tier: number; // 0-based
  name: string;
  desc: string;
  icon: string;
  target: number;
  points: number;
  reward: Reward;
}

/** Progress source: a stat key or a derived value computed from the state (power is passed in). */
type Source = keyof Stats | ((s: GameState, power: number) => number);

interface Family { id: string; name: string; icon: string; desc: (n: string) => string; src: Source; targets: number[] }

const owned = (s: GameState) => Object.values(s.heroes).filter((h) => h.owned);

const FAMILIES: Family[] = [
  { id: 'citadel', name: 'Зодчий', icon: 'castle', desc: (n) => `Улучшите Цитадель до ${n} ур.`, src: (s) => s.buildings.find((b) => b.type === 'citadel')?.level ?? 0, targets: [5, 10, 15, 20, 25] },
  { id: 'builds', name: 'Каменщик', icon: 'hammer', desc: (n) => `Завершите ${n} строительств`, src: 'buildsDone', targets: [25, 100, 300] },
  { id: 'power', name: 'Восходящая сила', icon: 'power', desc: (n) => `Наберите ${n} мощи`, src: (_s, p) => p, targets: [10_000, 50_000, 150_000, 400_000] },
  { id: 'camps', name: 'Охотник на Пустоту', icon: 'skull', desc: (n) => `Разорите ${n} логов Пустоты`, src: 'campsDefeated', targets: [10, 50, 200, 500] },
  { id: 'campLv', name: 'Покоритель глубин', icon: 'camp', desc: (n) => `Победите логово ${n} ур.`, src: 'maxCampLevel', targets: [5, 10, 15, 20] },
  { id: 'gather', name: 'Добытчик', icon: 'cart', desc: (n) => `Добудьте на карте ${n} ресурсов`, src: 'gathered', targets: [10_000, 100_000, 1_000_000] },
  { id: 'train', name: 'Полководец', icon: 'troops', desc: (n) => `Обучите ${n} воинов`, src: 'troopsTrained', targets: [500, 5_000, 25_000] },
  { id: 'heal', name: 'Милосердие', icon: 'heart', desc: (n) => `Вылечите ${n} раненых`, src: 'healed', targets: [500, 5_000, 25_000] },
  { id: 'summon', name: 'Зов таверны', icon: 'key_gold', desc: (n) => `Призовите героев ${n} раз`, src: 'summons', targets: [10, 50, 150] },
  { id: 'heroes', name: 'Собиратель легенд', icon: 'hero', desc: (n) => `Соберите ${n} героев`, src: (s) => owned(s).length, targets: [4, 8, 12] },
  { id: 'heroLv', name: 'Наставник', icon: 'star', desc: (n) => `Поднимите героя до ${n} ур.`, src: (s) => Math.max(0, ...owned(s).map((h) => h.level)), targets: [10, 25, 40, 60] },
  { id: 'stars', name: 'Звёздный час', icon: 'star', desc: (n) => `Возвысьте героя до ${n}★`, src: (s) => Math.max(0, ...owned(s).map((h) => h.stars)), targets: [3, 5] },
  { id: 'ruins', name: 'Археолог', icon: 'ruin', desc: (n) => `Исследуйте ${n} руин`, src: 'ruinsExplored', targets: [5, 25, 60] },
  { id: 'research', name: 'Мудрец', icon: 'book', desc: (n) => `Завершите ${n} исследований`, src: 'researchDone', targets: [10, 40, 100] },
  { id: 'defend', name: 'Несокрушимые стены', icon: 'tower', desc: (n) => `Отразите ${n} набегов`, src: 'raidsDefended', targets: [1, 10, 30] },
  { id: 'lords', name: 'Гроза лордов', icon: 'lord', desc: (n) => `Победите армии лордов ${n} раз`, src: 'lordsDefeated', targets: [1, 10, 40] },
  { id: 'rifts', name: 'Печать разлома', icon: 'rift', desc: (n) => `Закройте ${n} Эфирных разломов`, src: 'riftsCleared', targets: [1, 5, 15] },
  { id: 'titans', name: 'Укротитель титанов', icon: 'titan', desc: (n) => `Приручите титанов: ${n}`, src: (s) => Object.keys(s.titans.tamed).length, targets: [1, 2, 3] },
  { id: 'craft', name: 'Мастер-кузнец', icon: 'gauntlet', desc: (n) => `Выкуйте ${n} предметов`, src: 'crafted', targets: [1, 10, 30] },
  { id: 'legend', name: 'Сокровищница', icon: 'armor', desc: (n) => `Получите легендарных предметов: ${n}`, src: (s) => s.gear.filter((g) => g.rarity === 3).length, targets: [1, 3] },
  { id: 'ally', name: 'Верный союзник', icon: 'banner', desc: (n) => `Помогите союзникам ${n} раз`, src: 'allianceHelps', targets: [10, 100, 300] },
];

const TIER_POINTS = [10, 20, 40, 80, 160];
const TIER_REWARD: Reward[] = [
  { res: { aether: 20 }, items: { speed15: 1 } },
  { res: { aether: 40 }, items: { key_silver: 1, speed15: 2 } },
  { res: { aether: 80 }, items: { key_gold: 1 } },
  { res: { aether: 150 }, items: { key_gold: 1, chest_big: 1 } },
  { res: { aether: 250 }, items: { key_gold: 2, chest_big: 1 } },
];
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

const fmtN = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ');

export const ACHIEVEMENTS: AchievementDef[] = FAMILIES.flatMap((f) =>
  f.targets.map((target, tier) => ({
    id: `${f.id}${tier + 1}`, family: f.id, tier,
    name: f.targets.length > 1 ? `${f.name} ${ROMAN[tier]}` : f.name,
    desc: f.desc(fmtN(target)), icon: f.icon, target,
    points: TIER_POINTS[tier], reward: TIER_REWARD[tier],
  })));

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
const FAMILY_BY_ID = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));

export function achievementValue(a: AchievementDef, s: GameState, power: number): number {
  const src = FAMILY_BY_ID[a.family].src;
  return typeof src === 'function' ? src(s, power) : (s.stats[src] ?? 0);
}

export const ACHIEVEMENT_FAMILIES = FAMILIES.map((f) => ({ id: f.id, name: f.name, icon: f.icon }));
export const MAX_ACHIEVEMENT_POINTS = ACHIEVEMENTS.reduce((a, x) => a + x.points, 0);
