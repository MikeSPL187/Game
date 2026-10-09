import type { FactionId, GameState, HeroState, Stats } from '../core/types';
import { HEROES } from '../data/heroes';
import { PLOTS } from '../data/cityLayout';
import { dayKey } from '../core/format';
import { encodeFog } from './worldgen';
import { generateWorld } from './worldgen';
import { WORLD_SIZE } from './terrain';

export const SAVE_VERSION = 3;

export function emptyStats(): Stats {
  return {
    campsDefeated: 0, maxCampLevel: 0, gathered: 0, troopsTrained: 0, summons: 0, ruinsExplored: 0,
    raidsDefended: 0, raidsLost: 0, lordsDefeated: 0, riftsCleared: 0, collects: 0, researchDone: 0,
    heroLevelUps: 0, buildsDone: 0, healed: 0, crafted: 0, allianceHelps: 0,
  };
}

export function newGame(faction: FactionId, name: string, seed = (Math.random() * 1e9) | 0, now = Date.now()): GameState {
  const heroes: Record<string, HeroState> = {};
  for (const h of HEROES) heroes[h.id] = { id: h.id, level: 1, xp: 0, stars: 1, shards: 0, owned: false };
  heroes.torvald.owned = true;
  heroes.brenn.owned = true;
  heroes.torvald.level = 3;

  const world = generateWorld(seed);
  const buildings = PLOTS.map((p) => ({ plot: p.id, type: p.type, level: 0, stored: 0 }));
  const lvl = (id: string, l: number) => { const b = buildings.find((x) => x.plot === id)!; b.level = l; };
  lvl('citadel', 1); lvl('wall', 1); lvl('farm1', 1); lvl('saw1', 1); lvl('barracks', 1); lvl('tavern', 1);
  buildings.find((b) => b.plot === 'farm1')!.stored = 820;
  buildings.find((b) => b.plot === 'saw1')!.stored = 640;

  const s: GameState = {
    version: SAVE_VERSION,
    created: now,
    lastTick: now,
    lastSave: now,
    player: { name, faction, crest: 0 },
    res: { food: 3000, wood: 3000, stone: 1200, gold: 600, aether: 150 },
    buildings,
    jobs: [],
    troops: { inf1: 120, arc1: 60 },
    wounded: {},
    heroes,
    pity: { gold: 0, silver: 0 },
    freeSummonAt: now,
    research: {},
    legions: [],
    world: { seed, size: WORLD_SIZE, objects: world.objects, fog: encodeFog(new Uint8Array(WORLD_SIZE * WORLD_SIZE)), nextObjId: world.nextId, lastRespawn: now },
    lords: world.lords,
    raids: [],
    shieldUntil: 0,
    raidCooldown: 0,
    inventory: { speed1: 5, speed5: 3, key_silver: 1, tome1: 2 },
    gear: [],
    alliance: { level: 1, xp: 0, contribution: 0, day: '', helpsToday: 0, donationsToday: 0, techs: {}, gifts: [], requests: [], nextGift: 0, nextRequest: 0, shopToday: {} },
    event: { key: '', points: 0, claimed: [], wave: 0, nextWave: 0 },
    reports: [],
    stats: emptyStats(),
    quests: { chapter: 1, claimed: [], chapterClaimed: [], dailyDate: dayKey(now), daily: { ...emptyStats() } as any, dailyClaimed: [], dailyChests: [], dailyPoints: 0 },
    calendar: { day: 0, last: '' },
    titans: { tamed: {}, active: null },
    defender: 'torvald',
    tutorial: { step: 0, done: false },
    settings: { sound: true, music: true, haptics: true, quality: 'high', dayNight: true, showFps: false, notifications: true },
    nextId: 1,
    introSeen: false,
    flags: {},
  };
  return s;
}
