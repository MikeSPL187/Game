import type { BuildingId, Res, ResBag } from '../core/types';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  desc: string;
  category: 'economy' | 'military' | 'support';
  maxLevel: number;
  /** cost of upgrading 1 -> 2; scaled by level^costExp */
  cost: ResBag;
  costExp: number;
  /** seconds for level 1 -> 2, scaled by level^timeExp */
  time: number;
  timeExp: number;
  produces?: Res;
  /** extra requirements: other building must be at least (level - offset) */
  needs?: { type: BuildingId; offset: number }[];
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  citadel: {
    id: 'citadel', name: 'Цитадель', category: 'support', maxLevel: 25,
    desc: 'Сердце вашего владения. Определяет максимальный уровень остальных зданий, открывает новые участки и отряды.',
    cost: { wood: 220, stone: 160, food: 120 }, costExp: 2.35, time: 6, timeExp: 2.25,
    needs: [{ type: 'wall', offset: 1 }, { type: 'warehouse', offset: 2 }],
  },
  farm: {
    id: 'farm', name: 'Ферма', category: 'economy', maxLevel: 25, produces: 'food',
    desc: 'Выращивает зерно для войск и строительства. Собирайте урожай, пока амбары не переполнились.',
    cost: { wood: 60, stone: 20 }, costExp: 2.3, time: 3, timeExp: 2.1,
  },
  sawmill: {
    id: 'sawmill', name: 'Лесопилка', category: 'economy', maxLevel: 25, produces: 'wood',
    desc: 'Перерабатывает древесину Сумрачного леса. Основной материал любого строительства.',
    cost: { food: 60, stone: 20 }, costExp: 2.3, time: 3, timeExp: 2.1,
  },
  quarry: {
    id: 'quarry', name: 'Каменоломня', category: 'economy', maxLevel: 25, produces: 'stone',
    desc: 'Добывает гранит для стен и укреплений. Открывается на 3 уровне Цитадели.',
    cost: { food: 80, wood: 80 }, costExp: 2.3, time: 4, timeExp: 2.1,
  },
  goldmine: {
    id: 'goldmine', name: 'Золотой рудник', category: 'economy', maxLevel: 25, produces: 'gold',
    desc: 'Добывает золото — необходимо для исследований, элитных войск и героев.',
    cost: { food: 120, wood: 120, stone: 60 }, costExp: 2.3, time: 5, timeExp: 2.1,
  },
  barracks: {
    id: 'barracks', name: 'Казармы', category: 'military', maxLevel: 25,
    desc: 'Обучение пехоты — стойкого щита вашей армии. Пехота сильна против кавалерии.',
    cost: { wood: 120, food: 80 }, costExp: 2.3, time: 4, timeExp: 2.15,
  },
  range: {
    id: 'range', name: 'Стрельбище', category: 'military', maxLevel: 25,
    desc: 'Обучение лучников. Лучники разят пехоту издалека.',
    cost: { wood: 140, food: 60 }, costExp: 2.3, time: 4, timeExp: 2.15,
  },
  stable: {
    id: 'stable', name: 'Конюшни', category: 'military', maxLevel: 25,
    desc: 'Обучение кавалерии. Всадники быстры и сокрушают лучников.',
    cost: { wood: 140, food: 120, stone: 40 }, costExp: 2.3, time: 5, timeExp: 2.15,
  },
  spire: {
    id: 'spire', name: 'Шпиль чародеев', category: 'military', maxLevel: 25,
    desc: 'Обучение магов. Огромный урон, но хрупкая защита. Нуждаются в прикрытии.',
    cost: { wood: 160, stone: 120, gold: 60 }, costExp: 2.3, time: 6, timeExp: 2.15,
  },
  academy: {
    id: 'academy', name: 'Академия', category: 'support', maxLevel: 25,
    desc: 'Исследование технологий экономики и военного дела.',
    cost: { wood: 180, stone: 100, food: 100 }, costExp: 2.3, time: 5, timeExp: 2.15,
  },
  infirmary: {
    id: 'infirmary', name: 'Лазарет', category: 'support', maxLevel: 25,
    desc: 'Принимает раненых. Раненые бойцы постепенно и бесплатно возвращаются в строй.',
    cost: { wood: 120, food: 120 }, costExp: 2.25, time: 4, timeExp: 2.1,
  },
  tavern: {
    id: 'tavern', name: 'Таверна героев', category: 'support', maxLevel: 25,
    desc: 'Сюда стекаются легендарные странники. Призыв героев за ключи.',
    cost: { wood: 140, food: 100, gold: 20 }, costExp: 2.2, time: 4, timeExp: 2.1,
  },
  warehouse: {
    id: 'warehouse', name: 'Хранилище', category: 'support', maxLevel: 25,
    desc: 'Защищает часть ресурсов от разграбления во время набегов.',
    cost: { wood: 100, stone: 60 }, costExp: 2.2, time: 4, timeExp: 2.1,
  },
  wall: {
    id: 'wall', name: 'Крепостная стена', category: 'military', maxLevel: 25,
    desc: 'Укрепляет гарнизон при обороне города: бонус к защите и здоровью защитников.',
    cost: { stone: 160, wood: 80 }, costExp: 2.3, time: 5, timeExp: 2.15,
  },
  watchtower: {
    id: 'watchtower', name: 'Дозорная башня', category: 'support', maxLevel: 25,
    desc: 'Раньше предупреждает о набегах и расширяет обзор на карте мира.',
    cost: { wood: 140, stone: 80 }, costExp: 2.2, time: 4, timeExp: 2.1,
  },
  sanctum: {
    id: 'sanctum', name: 'Святилище титанов', category: 'support', maxLevel: 25,
    desc: 'Обитель прирученных титанов. Усиливает связь с титаном и его мощь в бою.',
    cost: { stone: 400, gold: 200, wood: 300 }, costExp: 2.3, time: 8, timeExp: 2.15,
  },
};

export function upgradeCost(id: BuildingId, fromLevel: number): ResBag {
  const d = BUILDINGS[id];
  const L = Math.max(1, fromLevel);
  const mul = fromLevel === 0 ? 0.6 : Math.pow(L, d.costExp);
  const out: ResBag = {};
  for (const [k, v] of Object.entries(d.cost)) out[k as Res] = Math.round((v! * mul) / 5) * 5;
  // gold enters every economy above level 8 to keep gold mines relevant
  if (fromLevel >= 8 && !d.cost.gold) out.gold = Math.round((Object.values(d.cost)[0]! * mul * 0.25) / 5) * 5;
  return out;
}

export function upgradeTimeSec(id: BuildingId, fromLevel: number): number {
  const d = BUILDINGS[id];
  const L = Math.max(1, fromLevel);
  const base = fromLevel === 0 ? d.time * 0.6 : d.time * Math.pow(L, d.timeExp);
  // after level 10 slow growth a bit more to pace late game
  const late = fromLevel > 10 ? Math.pow(1.08, fromLevel - 10) : 1;
  return Math.round(base * late);
}

/** resource per hour of a production building */
export function productionPerHour(level: number): number {
  if (level <= 0) return 0;
  return Math.round(360 * Math.pow(level, 1.55));
}

/** internal storage before collection, in hours of production */
export function productionCap(level: number): number {
  return productionPerHour(level) * (4 + level * 0.25);
}

export const PRODUCTION_RES: Partial<Record<BuildingId, Res>> = {
  farm: 'food', sawmill: 'wood', quarry: 'stone', goldmine: 'gold',
};

export function warehouseProtect(level: number): number {
  return Math.round(4000 * Math.pow(Math.max(1, level), 1.6));
}
export function infirmaryCap(level: number): number {
  return Math.round(400 * Math.pow(Math.max(1, level), 1.35));
}
/** wounded healed per minute */
export function infirmaryRate(level: number): number {
  return Math.round(12 * Math.pow(Math.max(1, level), 1.2));
}
export function trainBatch(level: number): number {
  return Math.round(40 + level * 25 + Math.pow(level, 2) * 2);
}
export function wallBonus(level: number): number { return level * 0.03; }
export function watchRange(level: number): number { return 8 + level; }

/** what a given building level grants — used in upgrade panel */
export function buildingPerks(id: BuildingId, level: number): { label: string; value: string }[] {
  if (level <= 0) return [];
  switch (id) {
    case 'citadel':
      return [
        { label: 'Макс. уровень зданий', value: String(level) },
        { label: 'Отрядов в походе', value: String(legionSlots(level)) },
        { label: 'Тир войск', value: 'T' + maxTier(level) },
      ];
    case 'farm': case 'sawmill': case 'quarry': case 'goldmine':
      return [
        { label: 'Добыча в час', value: productionPerHour(level).toLocaleString('ru-RU') },
        { label: 'Вместимость', value: Math.round(productionCap(level)).toLocaleString('ru-RU') },
      ];
    case 'barracks': case 'range': case 'stable': case 'spire':
      return [
        { label: 'Размер партии', value: String(trainBatch(level)) },
        { label: 'Скорость обучения', value: '+' + (level * 2) + '%' },
      ];
    case 'academy': return [{ label: 'Скорость исследований', value: '+' + level * 2 + '%' }];
    case 'infirmary':
      return [
        { label: 'Вместимость', value: infirmaryCap(level).toLocaleString('ru-RU') },
        { label: 'Лечение в минуту', value: String(infirmaryRate(level)) },
      ];
    case 'tavern': return [{ label: 'Шанс эпического героя', value: '+' + (level * 0.2).toFixed(1) + '%' }];
    case 'warehouse': return [{ label: 'Защита каждого ресурса', value: warehouseProtect(level).toLocaleString('ru-RU') }];
    case 'wall': return [{ label: 'Бонус защитникам', value: '+' + Math.round(wallBonus(level) * 100) + '%' }];
    case 'watchtower': return [{ label: 'Радиус обзора', value: watchRange(level) + ' кл.' }];
    case 'sanctum': return [{ label: 'Сила титана', value: '+' + level * 4 + '%' }];
  }
  return [];
}

export function legionSlots(citadel: number): number {
  return 2 + (citadel >= 8 ? 1 : 0) + (citadel >= 15 ? 1 : 0) + (citadel >= 22 ? 1 : 0);
}
export function maxTier(citadel: number): 1 | 2 | 3 | 4 {
  if (citadel >= 18) return 4;
  if (citadel >= 11) return 3;
  if (citadel >= 5) return 2;
  return 1;
}
