import type { Reward } from '../core/types';

export type EventType = 'hunt' | 'harvest' | 'night';

export interface EventDef {
  type: EventType;
  name: string;
  icon: string;
  color: string;
  desc: string;
  how: string[];
  milestones: { points: number; reward: Reward }[];
  rankRewards: Reward[]; // index 0 = 1st place
}

export const EVENT_LENGTH = 2 * 24 * 3_600_000;

export const EVENTS: Record<EventType, EventDef> = {
  hunt: {
    type: 'hunt', name: 'Охота на Пустоту', icon: 'skull', color: '#c27bff',
    desc: 'Твари Пустоты расплодились у границ. Орден щедро платит за каждое разорённое логово.',
    how: ['Победа над логовом: 10 очков × уровень', 'Атака на разлом: 150 очков', 'Бой с титаном: 250 очков'],
    milestones: [
      { points: 150, reward: { items: { tome1: 3, mat_iron: 10 } } },
      { points: 500, reward: { items: { speed15: 3, mat_leather: 12 } } },
      { points: 1200, reward: { items: { key_silver: 3, mat_bone: 8 } } },
      { points: 2500, reward: { items: { tome2: 3, mat_crystal: 6 }, res: { aether: 60 } } },
      { points: 5000, reward: { items: { key_gold: 2, chest_big: 1 }, res: { aether: 120 } } },
    ],
    rankRewards: [
      { items: { key_gold: 3, mat_crystal: 12 }, res: { aether: 300 } },
      { items: { key_gold: 2, mat_crystal: 8 }, res: { aether: 180 } },
      { items: { key_gold: 1, mat_crystal: 5 }, res: { aether: 100 } },
    ],
  },
  harvest: {
    type: 'harvest', name: 'Великая жатва', icon: 'food', color: '#ffd24a',
    desc: 'Время собирать урожай. Самые запасливые лорды получат благословение гильдий.',
    how: ['Сбор на карте: 1 очко за 100 ресурсов (золото ×4)', 'Сбор урожая в городе: 1 очко за 400 ресурсов'],
    milestones: [
      { points: 100, reward: { res: { food: 5000, wood: 5000 } } },
      { points: 350, reward: { items: { speed15: 3, chest_small: 1 } } },
      { points: 900, reward: { items: { key_silver: 3 }, res: { stone: 8000, gold: 3000 } } },
      { points: 2000, reward: { items: { speed60: 2, mat_crystal: 4 }, res: { aether: 60 } } },
      { points: 4000, reward: { items: { key_gold: 2, chest_big: 1 }, res: { aether: 120 } } },
    ],
    rankRewards: [
      { items: { key_gold: 3, speed180: 2 }, res: { aether: 300 } },
      { items: { key_gold: 2, speed180: 1 }, res: { aether: 180 } },
      { items: { key_gold: 1, speed60: 2 }, res: { aether: 100 } },
    ],
  },
  night: {
    type: 'night', name: 'Ночь Пустоты', icon: 'rift', color: '#ff6a9a',
    desc: 'Разломы раскрылись, и волны тварей идут на город. Держите стены — и обучайте новых защитников.',
    how: ['Отражённая волна: 120 очков × номер волны', 'Обучение войск: 1 очко за 10 мощи', 'Волны идут, только пока вы в игре (Цитадель 4+)'],
    milestones: [
      { points: 150, reward: { items: { tome1: 3, speed5: 4 } } },
      { points: 500, reward: { items: { speed15: 4, mat_iron: 15 } } },
      { points: 1200, reward: { items: { key_silver: 3, shield8: 1 } } },
      { points: 2500, reward: { items: { tome3: 1, mat_bone: 10 }, res: { aether: 60 } } },
      { points: 5000, reward: { items: { key_gold: 2, chest_big: 1 }, res: { aether: 120 } } },
    ],
    rankRewards: [
      { items: { key_gold: 3, tome3: 2 }, res: { aether: 300 } },
      { items: { key_gold: 2, tome3: 1 }, res: { aether: 180 } },
      { items: { key_gold: 1, tome2: 3 }, res: { aether: 100 } },
    ],
  },
};

export const EVENT_ORDER: EventType[] = ['hunt', 'harvest', 'night'];

export interface EventSlot { type: EventType; key: string; start: number; end: number; index: number }

/** Deterministic rotation anchored to when the realm was founded. */
export function eventAt(now: number, created: number): EventSlot {
  const index = Math.max(0, Math.floor((now - created) / EVENT_LENGTH));
  const start = created + index * EVENT_LENGTH;
  const type = EVENT_ORDER[index % EVENT_ORDER.length];
  return { type, key: `${type}#${index}`, start, end: start + EVENT_LENGTH, index };
}

/** AI lord scores grow through the event: deterministic, scaled to the player's realm. */
export function rivalScore(seed: number, progress: number, scale: number): number {
  const h = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const ambition = 0.35 + h * 1.0;
  return Math.round(scale * ambition * Math.pow(Math.min(1, Math.max(0, progress)), 0.85));
}
