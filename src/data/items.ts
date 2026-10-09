import type { Res } from '../core/types';

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cat: 'speed' | 'res' | 'hero' | 'special';
  speedMs?: number;
  res?: Res;
  amount?: number;
  xp?: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  usable: boolean;
}

const MIN = 60_000;

export const ITEMS: ItemDef[] = [
  { id: 'speed1', name: 'Ускорение 1 мин', desc: 'Сокращает любое ожидание на 1 минуту.', icon: 'hourglass', cat: 'speed', speedMs: 1 * MIN, rarity: 'common', usable: false },
  { id: 'speed5', name: 'Ускорение 5 мин', desc: 'Сокращает любое ожидание на 5 минут.', icon: 'hourglass', cat: 'speed', speedMs: 5 * MIN, rarity: 'common', usable: false },
  { id: 'speed15', name: 'Ускорение 15 мин', desc: 'Сокращает любое ожидание на 15 минут.', icon: 'hourglass', cat: 'speed', speedMs: 15 * MIN, rarity: 'rare', usable: false },
  { id: 'speed60', name: 'Ускорение 1 час', desc: 'Сокращает любое ожидание на 1 час.', icon: 'hourglass', cat: 'speed', speedMs: 60 * MIN, rarity: 'epic', usable: false },
  { id: 'speed180', name: 'Ускорение 3 часа', desc: 'Сокращает любое ожидание на 3 часа.', icon: 'hourglass', cat: 'speed', speedMs: 180 * MIN, rarity: 'legendary', usable: false },
  { id: 'food1', name: 'Мешок зерна', desc: '+1 000 еды', icon: 'food', cat: 'res', res: 'food', amount: 1000, rarity: 'common', usable: true },
  { id: 'food10', name: 'Амбар зерна', desc: '+10 000 еды', icon: 'food', cat: 'res', res: 'food', amount: 10000, rarity: 'rare', usable: true },
  { id: 'wood1', name: 'Связка брёвен', desc: '+1 000 дерева', icon: 'wood', cat: 'res', res: 'wood', amount: 1000, rarity: 'common', usable: true },
  { id: 'wood10', name: 'Склад брёвен', desc: '+10 000 дерева', icon: 'wood', cat: 'res', res: 'wood', amount: 10000, rarity: 'rare', usable: true },
  { id: 'stone1', name: 'Глыба камня', desc: '+750 камня', icon: 'stone', cat: 'res', res: 'stone', amount: 750, rarity: 'common', usable: true },
  { id: 'stone10', name: 'Груда камня', desc: '+7 500 камня', icon: 'stone', cat: 'res', res: 'stone', amount: 7500, rarity: 'rare', usable: true },
  { id: 'gold1', name: 'Кошель золота', desc: '+300 золота', icon: 'gold', cat: 'res', res: 'gold', amount: 300, rarity: 'common', usable: true },
  { id: 'gold10', name: 'Сундук золота', desc: '+3 000 золота', icon: 'gold', cat: 'res', res: 'gold', amount: 3000, rarity: 'rare', usable: true },
  { id: 'tome1', name: 'Свиток опыта', desc: '+500 опыта герою', icon: 'tome', cat: 'hero', xp: 500, rarity: 'common', usable: false },
  { id: 'tome2', name: 'Книга опыта', desc: '+2 500 опыта герою', icon: 'tome', cat: 'hero', xp: 2500, rarity: 'rare', usable: false },
  { id: 'tome3', name: 'Фолиант опыта', desc: '+10 000 опыта герою', icon: 'tome', cat: 'hero', xp: 10000, rarity: 'epic', usable: false },
  { id: 'key_silver', name: 'Серебряный ключ', desc: 'Призыв героя в Таверне.', icon: 'key_silver', cat: 'hero', rarity: 'rare', usable: false },
  { id: 'key_gold', name: 'Золотой ключ', desc: 'Призыв героя в Таверне. Высокий шанс эпического и легендарного.', icon: 'key_gold', cat: 'hero', rarity: 'legendary', usable: false },
  { id: 'shard_any', name: 'Универсальный осколок', desc: 'Можно использовать как осколок любого героя.', icon: 'shard', cat: 'hero', rarity: 'epic', usable: false },
  { id: 'shield8', name: 'Щит мира (8 ч)', desc: 'Защищает город от набегов на 8 часов.', icon: 'shieldItem', cat: 'special', rarity: 'rare', usable: true },
  { id: 'chest_small', name: 'Сундук путника', desc: 'Содержит случайные ресурсы и ускорения.', icon: 'chest', cat: 'special', rarity: 'rare', usable: true },
  { id: 'chest_big', name: 'Сундук лорда', desc: 'Содержит ценные ресурсы, ключи и свитки.', icon: 'chest_gold', cat: 'special', rarity: 'epic', usable: true },
  { id: 'titan_food', name: 'Эфирная эссенция', desc: '+300 опыта титану', icon: 'essence', cat: 'special', rarity: 'epic', usable: false },
];

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
