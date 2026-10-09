import type { BuildingId, GameState, Reward } from '../core/types';

export type GoTarget =
  | { kind: 'building'; type: BuildingId; action?: 'upgrade' | 'train' | 'research' | 'summon' | 'info' }
  | { kind: 'world'; find?: 'camp' | 'node' | 'ruin' | 'titan' | 'lord' | 'rift'; level?: number; titan?: string }
  | { kind: 'panel'; panel: 'heroes' | 'research' | 'inventory' | 'titans' };

export interface QuestDef {
  id: string;
  title: string;
  target: number;
  progress: (s: GameState) => number;
  go: GoTarget;
  reward: Reward;
}

export interface ChapterDef {
  n: number;
  title: string;
  intro: string;
  outro: string;
  quests: QuestDef[];
  reward: Reward;
}

export function maxLevel(s: GameState, type: BuildingId): number {
  let m = 0;
  for (const b of s.buildings) if (b.type === type && b.level > m) m = b.level;
  return m;
}
function countAtLeast(s: GameState, type: BuildingId, lvl: number): number {
  return s.buildings.filter((b) => b.type === type && b.level >= lvl).length;
}
function totalTroops(s: GameState): number {
  let n = 0;
  for (const v of Object.values(s.troops)) n += v ?? 0;
  for (const l of s.legions) for (const v of Object.values(l.troops)) n += v ?? 0;
  return n;
}
function ownedHeroes(s: GameState): number { return Object.values(s.heroes).filter((h) => h.owned).length; }
function bestHeroLevel(s: GameState): number { return Math.max(0, ...Object.values(s.heroes).filter((h) => h.owned).map((h) => h.level)); }
function gearedHero(s: GameState): number {
  const per: Record<string, number> = {};
  for (const it of s.gear ?? []) if (it.hero) per[it.hero] = (per[it.hero] ?? 0) + 1;
  return Math.max(0, ...Object.values(per));
}
function researchCount(s: GameState): number { return Object.values(s.research).reduce((a, b) => a + b, 0); }

const B = (type: BuildingId, lvl: number, reward: Reward, title?: string): QuestDef => ({
  id: `b_${type}_${lvl}`,
  title: title ?? '',
  target: lvl,
  progress: (s) => maxLevel(s, type),
  go: { kind: 'building', type, action: 'upgrade' },
  reward,
});

function named(q: QuestDef, title: string): QuestDef { q.title = title; return q; }

export const CHAPTERS: ChapterDef[] = [
  {
    n: 1, title: 'Пепел и камень',
    intro: 'Милорд, Раскол оставил от наших земель лишь пепел. Но камень помнит, а люди — верят. Начнём с малого: накормим народ и отстроим стены.',
    outro: 'Первый урожай собран, и люди вновь поют у костров. Но с востока ползут тени Пустоты...',
    reward: { res: { food: 3000, wood: 3000, stone: 1000 }, items: { key_silver: 2, speed5: 3 } },
    quests: [
      named(B('farm', 2, { res: { wood: 300 } }), 'Улучшите Ферму до 2 ур.'),
      named(B('sawmill', 2, { res: { food: 300 } }), 'Улучшите Лесопилку до 2 ур.'),
      { id: 'collect3', title: 'Соберите урожай 3 раза', target: 3, progress: (s) => s.stats.collects, go: { kind: 'building', type: 'farm', action: 'info' }, reward: { res: { food: 500, wood: 500 } } },
      named(B('wall', 2, { res: { stone: 300 } }), 'Улучшите Стену до 2 ур.'),
      named(B('warehouse', 1, { res: { wood: 400 } }), 'Постройте Хранилище'),
      named(B('citadel', 2, { items: { speed5: 2 }, res: { food: 600, wood: 600 } }), 'Улучшите Цитадель до 2 ур.'),
      named(B('barracks', 2, { res: { food: 800 } }), 'Улучшите Казармы до 2 ур.'),
      { id: 'train30', title: 'Обучите 30 воинов', target: 30, progress: (s) => s.stats.troopsTrained, go: { kind: 'building', type: 'barracks', action: 'train' }, reward: { res: { food: 800, wood: 500 } } },
    ],
  },
  {
    n: 2, title: 'Тени на границе',
    intro: 'Разведчики докладывают: у самых наших стен засели твари Пустоты. Пора показать, что новый лорд умеет держать меч.',
    outro: 'Логово тварей разорено! Слава о вашей победе разлетелась по округе — в таверну потянулись странники.',
    reward: { res: { food: 5000, wood: 5000, stone: 2000, gold: 500 }, items: { key_gold: 1, tome1: 3 } },
    quests: [
      { id: 'camp1', title: 'Победите Логово Пустоты 1 ур.', target: 1, progress: (s) => s.stats.campsDefeated, go: { kind: 'world', find: 'camp', level: 1 }, reward: { res: { food: 1000 }, items: { tome1: 1 } } },
      named(B('infirmary', 2, { res: { wood: 1000 } }), 'Улучшите Лазарет до 2 ур.'),
      named(B('citadel', 3, { res: { food: 1500, wood: 1500 }, items: { speed15: 1 } }), 'Улучшите Цитадель до 3 ур.'),
      named(B('academy', 1, { res: { food: 1000 } }), 'Постройте Академию'),
      { id: 'res1', title: 'Завершите 1 исследование', target: 1, progress: researchCount, go: { kind: 'building', type: 'academy', action: 'research' }, reward: { res: { wood: 1200 } } },
      { id: 'gather1', title: 'Добудьте 2 000 ресурсов на карте', target: 2000, progress: (s) => s.stats.gathered, go: { kind: 'world', find: 'node', level: 1 }, reward: { res: { stone: 800 } } },
      { id: 'camp3', title: 'Победите 3 логова Пустоты', target: 3, progress: (s) => s.stats.campsDefeated, go: { kind: 'world', find: 'camp' }, reward: { items: { key_silver: 1 } } },
    ],
  },
  {
    n: 3, title: 'Зов героев',
    intro: 'В таверне шумно: искатели приключений ждут лорда, достойного их клинков. Золотой ключ откроет дверь к самым славным из них.',
    outro: 'Под вашим знаменем собрались настоящие герои. Теперь пора исследовать древние руины, хранящие секреты Раскола.',
    reward: { res: { food: 8000, wood: 8000, stone: 4000, gold: 1500 }, items: { key_gold: 1, speed60: 1 } },
    quests: [
      { id: 'summon2', title: 'Призовите героев 2 раза', target: 2, progress: (s) => s.stats.summons, go: { kind: 'building', type: 'tavern', action: 'summon' }, reward: { items: { tome1: 2 } } },
      { id: 'heroes3', title: 'Соберите 3 героев', target: 3, progress: ownedHeroes, go: { kind: 'building', type: 'tavern', action: 'summon' }, reward: { res: { gold: 400 } } },
      { id: 'herolv8', title: 'Поднимите героя до 8 ур.', target: 8, progress: bestHeroLevel, go: { kind: 'panel', panel: 'heroes' }, reward: { items: { tome2: 1 } } },
      named(B('citadel', 4, { res: { food: 2500, wood: 2500 } }), 'Улучшите Цитадель до 4 ур.'),
      named(B('range', 1, { res: { wood: 1500 } }), 'Постройте Стрельбище'),
      { id: 'ruin2', title: 'Исследуйте 2 руины', target: 2, progress: (s) => s.stats.ruinsExplored, go: { kind: 'world', find: 'ruin' }, reward: { items: { chest_small: 1 } } },
      { id: 'troops200', title: 'Соберите армию из 200 воинов', target: 200, progress: totalTroops, go: { kind: 'building', type: 'barracks', action: 'train' }, reward: { res: { food: 2500 } } },
    ],
  },
  {
    n: 4, title: 'Крепость растёт',
    intro: 'Соседние лорды заметили наш подъём. Одни шлют послов, другие — шпионов. Укрепим город, пока не поздно.',
    outro: 'Город окреп. Но в небе над Грозовыми пиками всё чаще сверкает молния — древний титан пробуждается.',
    reward: { res: { food: 15000, wood: 15000, stone: 8000, gold: 3000 }, items: { key_gold: 1, speed60: 2 } },
    quests: [
      named(B('citadel', 6, { items: { speed60: 1 } }), 'Улучшите Цитадель до 6 ур.'),
      named(B('wall', 6, { res: { stone: 3000 } }), 'Улучшите Стену до 6 ур.'),
      named(B('watchtower', 3, { res: { wood: 3000 } }), 'Улучшите Дозорную башню до 3 ур.'),
      { id: 'camp5lv', title: 'Победите логово 5 ур.', target: 5, progress: (s) => s.stats.maxCampLevel, go: { kind: 'world', find: 'camp', level: 5 }, reward: { items: { tome2: 1 } } },
      { id: 'res5', title: 'Завершите 5 исследований', target: 5, progress: researchCount, go: { kind: 'building', type: 'academy', action: 'research' }, reward: { res: { gold: 1500 } } },
      named(B('forge', 1, { items: { mat_iron: 20, mat_leather: 10 } }), 'Постройте Кузницу'),
      { id: 'farms2', title: 'Имейте 2 Фермы 5 ур.', target: 2, progress: (s) => countAtLeast(s, 'farm', 5), go: { kind: 'building', type: 'farm', action: 'upgrade' }, reward: { res: { wood: 4000 } } },
    ],
  },
  {
    n: 5, title: 'Пробуждение Громокрыла',
    intro: 'Громокрыл, титан бурь, кружит над пиками. Тот, кто одолеет его, обретёт союзника, способного решить исход любой битвы.',
    outro: 'Небо покорилось! Громокрыл склонил голову перед вами. Отныне его гроза — ваше оружие.',
    reward: { res: { food: 25000, wood: 25000, stone: 15000, gold: 6000 }, items: { key_gold: 2, titan_food: 3 } },
    quests: [
      named(B('citadel', 8, { items: { speed60: 1 } }), 'Улучшите Цитадель до 8 ур.'),
      named(B('sanctum', 1, { res: { gold: 3000 } }), 'Постройте Святилище титанов'),
      { id: 'herolv20', title: 'Поднимите героя до 20 ур.', target: 20, progress: bestHeroLevel, go: { kind: 'panel', panel: 'heroes' }, reward: { items: { tome3: 1 } } },
      { id: 'gear2', title: 'Наденьте на героя 2 предмета', target: 2, progress: gearedHero, go: { kind: 'building', type: 'forge', action: 'info' }, reward: { items: { mat_bone: 6, mat_crystal: 3 } } },
      { id: 'troops1500', title: 'Соберите армию из 1 500 воинов', target: 1500, progress: totalTroops, go: { kind: 'building', type: 'barracks', action: 'train' }, reward: { res: { food: 8000 } } },
      { id: 'tame_roc', title: 'Приручите Громокрыла', target: 1, progress: (s) => (s.titans.tamed.roc ? 1 : 0), go: { kind: 'world', find: 'titan', titan: 'roc' }, reward: { items: { key_gold: 1 } } },
    ],
  },
  {
    n: 6, title: 'Война лордов',
    intro: 'Барон Мортимер прислал ультиматум: покориться или сгореть. Мы ответим сталью.',
    outro: 'Знамя врага пало. Лорды Расколотых земель теперь произносят ваше имя с опаской.',
    reward: { res: { food: 40000, wood: 40000, stone: 25000, gold: 10000 }, items: { key_gold: 2, speed180: 1 } },
    quests: [
      named(B('citadel', 10, { items: { speed180: 1 } }), 'Улучшите Цитадель до 10 ур.'),
      { id: 'defend1', title: 'Отразите набег на город', target: 1, progress: (s) => s.stats.raidsDefended, go: { kind: 'building', type: 'wall', action: 'info' }, reward: { res: { stone: 6000 } } },
      { id: 'lord1', title: 'Победите армию вражеского лорда', target: 1, progress: (s) => s.stats.lordsDefeated, go: { kind: 'world', find: 'lord' }, reward: { items: { chest_big: 1 } } },
      { id: 'rift1', title: 'Закройте Эфирный разлом', target: 1, progress: (s) => s.stats.riftsCleared, go: { kind: 'world', find: 'rift' }, reward: { items: { key_gold: 1 } } },
      { id: 'camp12lv', title: 'Победите логово 12 ур.', target: 12, progress: (s) => s.stats.maxCampLevel, go: { kind: 'world', find: 'camp', level: 12 }, reward: { items: { tome3: 1 } } },
    ],
  },
  {
    n: 7, title: 'Каменный страж',
    intro: 'Земля дрожит под Каменной грядой: Камнепанцирь, древнейший из титанов, проснулся от грохота наших войн.',
    outro: 'Гора склонилась перед вами. Остался лишь один — Пепельный Змей, пламя самого Раскола.',
    reward: { res: { food: 80000, wood: 80000, stone: 50000, gold: 20000 }, items: { key_gold: 3, speed180: 2 } },
    quests: [
      named(B('citadel', 14, { items: { speed180: 1 } }), 'Улучшите Цитадель до 14 ур.'),
      { id: 'res20', title: 'Завершите 20 исследований', target: 20, progress: researchCount, go: { kind: 'building', type: 'academy', action: 'research' }, reward: { res: { gold: 8000 } } },
      { id: 'tame_golem', title: 'Приручите Камнепанциря', target: 1, progress: (s) => (s.titans.tamed.golem ? 1 : 0), go: { kind: 'world', find: 'titan', titan: 'golem' }, reward: { items: { key_gold: 2 } } },
      { id: 'lord3', title: 'Победите армии лордов 3 раза', target: 3, progress: (s) => s.stats.lordsDefeated, go: { kind: 'world', find: 'lord' }, reward: { items: { chest_big: 2 } } },
    ],
  },
  {
    n: 8, title: 'Пламя Раскола',
    intro: 'Пепельный Змей пробудился. Его тень накрыла полмира. Это последняя битва старой эпохи — и первая битва новой.',
    outro: 'Змей покорён. Расколотые земли признали своего владыку. Но эфир шепчет: за краем мира есть другие острова...',
    reward: { res: { food: 200000, wood: 200000, stone: 120000, gold: 50000, aether: 500 }, items: { key_gold: 5 } },
    quests: [
      named(B('citadel', 20, { items: { speed180: 2 } }), 'Улучшите Цитадель до 20 ур.'),
      { id: 'tame_wyrm', title: 'Приручите Пепельного Змея', target: 1, progress: (s) => (s.titans.tamed.wyrm ? 1 : 0), go: { kind: 'world', find: 'titan', titan: 'wyrm' }, reward: { items: { key_gold: 3 } } },
      { id: 'camp20lv', title: 'Победите логово 20 ур.', target: 20, progress: (s) => s.stats.maxCampLevel, go: { kind: 'world', find: 'camp', level: 20 }, reward: { items: { tome3: 3 } } },
    ],
  },
];

export interface DailyDef { id: string; title: string; target: number; points: number; stat: keyof GameState['stats'] }

export const DAILIES: DailyDef[] = [
  { id: 'd_collect', title: 'Соберите ресурсы 5 раз', target: 5, points: 15, stat: 'collects' },
  { id: 'd_train', title: 'Обучите 100 воинов', target: 100, points: 20, stat: 'troopsTrained' },
  { id: 'd_camps', title: 'Победите 3 логова Пустоты', target: 3, points: 25, stat: 'campsDefeated' },
  { id: 'd_gather', title: 'Добудьте 10 000 ресурсов на карте', target: 10000, points: 20, stat: 'gathered' },
  { id: 'd_build', title: 'Завершите 3 строительства', target: 3, points: 15, stat: 'buildsDone' },
  { id: 'd_research', title: 'Завершите 1 исследование', target: 1, points: 15, stat: 'researchDone' },
  { id: 'd_summon', title: 'Призовите героя', target: 1, points: 10, stat: 'summons' },
  { id: 'd_ruin', title: 'Исследуйте руину', target: 1, points: 10, stat: 'ruinsExplored' },
];

export const DAILY_CHESTS: { points: number; reward: Reward }[] = [
  { points: 20, reward: { res: { food: 2000, wood: 2000 }, items: { speed5: 2 } } },
  { points: 40, reward: { res: { stone: 1500, gold: 500 }, items: { tome1: 2 } } },
  { points: 60, reward: { items: { key_silver: 2, speed15: 2 } } },
  { points: 80, reward: { items: { chest_small: 2, tome2: 1 } } },
  { points: 100, reward: { items: { key_gold: 1, speed60: 1 }, res: { aether: 50 } } },
];

export const CALENDAR: Reward[] = [
  { res: { food: 5000, wood: 5000 }, items: { speed15: 2 } },
  { items: { key_silver: 3, tome1: 3 } },
  { res: { stone: 4000, gold: 1500 }, items: { speed60: 1 } },
  { items: { key_gold: 1, chest_small: 2 } },
  { items: { tome2: 3, speed60: 2 } },
  { shards: { lyra: 10 }, items: { key_silver: 3 } },
  { items: { key_gold: 2, chest_big: 1 }, res: { aether: 200 } },
];
