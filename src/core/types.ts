export type Res = 'food' | 'wood' | 'stone' | 'gold';
export type Currency = Res | 'aether';
export type ResBag = Partial<Record<Currency, number>>;

export type TroopType = 'inf' | 'arc' | 'cav' | 'mag';
export type Tier = 1 | 2 | 3 | 4;
export type TroopKey = `${TroopType}${Tier}`;
export type Troops = Partial<Record<TroopKey, number>>;

export type FactionId = 'order' | 'wild' | 'ash';

export type BuildingId =
  | 'citadel' | 'farm' | 'sawmill' | 'quarry' | 'goldmine'
  | 'barracks' | 'range' | 'stable' | 'spire'
  | 'academy' | 'infirmary' | 'tavern' | 'warehouse' | 'wall'
  | 'watchtower' | 'sanctum';

export interface BuildingState {
  plot: string;
  type: BuildingId;
  level: number;
  /** produced resource waiting to be collected (production buildings) */
  stored: number;
}

export interface Job {
  id: number;
  kind: 'build' | 'train' | 'research' | 'heal';
  start: number;
  end: number;
  plot?: string;
  toLevel?: number;
  troop?: TroopKey;
  count?: number;
  tech?: string;
  troops?: Troops;
}

export interface HeroState {
  id: string;
  level: number;
  xp: number;
  stars: number;
  shards: number;
  owned: boolean;
}

export type LegionState = 'idle' | 'march' | 'gather' | 'station' | 'return' | 'battle';
export type MarchAction = 'attack' | 'gather' | 'explore' | 'move' | 'return';

export interface Point { x: number; y: number }

export interface Legion {
  id: number;
  lead: string | null;
  deputy: string | null;
  troops: Troops;
  state: LegionState;
  pos: Point; // tile coords (float while marching)
  path: Point[];
  pathT0: number; // ms when path started
  speed: number;  // tiles per second
  action: MarchAction | null;
  targetId: number | null;
  carry: ResBag;
  gatherStart: number;
  gatherEnd: number;
  battleEnd: number;
}

export type WorldObjKind = 'camp' | 'node' | 'city' | 'lord' | 'titan' | 'ruin' | 'rift';

export interface WorldObject {
  id: number;
  kind: WorldObjKind;
  x: number;
  y: number;
  level: number;
  res?: Res;
  amount?: number;
  max?: number;
  lordId?: string;
  titanId?: string;
  /** fraction of remaining HP for titans/rifts (0..1) */
  hp?: number;
  /** legion id currently occupying (gathering) */
  occupant?: number | null;
  variant?: number;
  respawnAt?: number;
  hidden?: boolean;
}

export interface AiLord {
  id: string;
  name: string;
  faction: FactionId;
  color: string;
  objId: number;
  citadel: number;
  power: number;
  troops: Troops;
  heroLevel: number;
  nextRaidAt: number;
  defeats: number;
  wallHp: number;
  lastGrow: number;
  attitude: 'hostile' | 'neutral';
}

export interface IncomingRaid {
  id: number;
  lordId: string;
  troops: Troops;
  heroLevel: number;
  from: Point;
  start: number;
  arrive: number;
}

export interface BattleRound {
  a: number; // attacker troops remaining
  d: number; // defender troops remaining
  events: string[];
}

export interface Report {
  id: number;
  time: number;
  kind: 'battle' | 'gather' | 'explore' | 'defense' | 'system' | 'scout';
  title: string;
  win?: boolean;
  text?: string;
  attacker?: ArmySummary;
  defender?: ArmySummary;
  rounds?: BattleRound[];
  rewards?: Reward;
  read: boolean;
  pos?: Point;
}

export interface ArmySummary {
  name: string;
  heroes: { id: string; level: number }[];
  start: number;
  lost: number;
  wounded: number;
  survived: number;
  power: number;
  kind: 'player' | 'monster' | 'lord' | 'titan';
  portrait?: string;
}

export interface Reward {
  res?: ResBag;
  items?: Record<string, number>;
  heroXp?: number;
  shards?: Record<string, number>;
  troops?: Troops;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  quality: 'high' | 'low';
  dayNight: boolean;
  showFps: boolean;
  notifications: boolean;
}

export interface Stats {
  campsDefeated: number;
  maxCampLevel: number;
  gathered: number;
  troopsTrained: number;
  summons: number;
  ruinsExplored: number;
  raidsDefended: number;
  raidsLost: number;
  lordsDefeated: number;
  riftsCleared: number;
  collects: number;
  researchDone: number;
  heroLevelUps: number;
  buildsDone: number;
  healed: number;
}

export interface QuestState {
  chapter: number;
  claimed: string[];
  chapterClaimed: number[];
  dailyDate: string;
  daily: Record<string, number>;
  dailyClaimed: string[];
  dailyChests: number[];
  dailyPoints: number;
}

export interface GameState {
  version: number;
  created: number;
  lastTick: number;
  lastSave: number;
  player: { name: string; faction: FactionId; crest: number };
  res: Record<Currency, number>;
  buildings: BuildingState[];
  jobs: Job[];
  troops: Troops;
  wounded: Troops;
  heroes: Record<string, HeroState>;
  pity: { gold: number; silver: number };
  freeSummonAt: number;
  research: Record<string, number>;
  legions: Legion[];
  world: { seed: number; size: number; objects: WorldObject[]; fog: string; nextObjId: number; lastRespawn: number };
  lords: AiLord[];
  raids: IncomingRaid[];
  shieldUntil: number;
  /** no new raid from any lord before this time */
  raidCooldown: number;
  inventory: Record<string, number>;
  reports: Report[];
  stats: Stats;
  quests: QuestState;
  calendar: { day: number; last: string };
  titans: { tamed: Record<string, { level: number; xp: number }>; active: string | null };
  defender: string | null;
  tutorial: { step: number; done: boolean };
  settings: Settings;
  nextId: number;
  introSeen: boolean;
}
