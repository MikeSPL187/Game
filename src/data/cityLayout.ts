import type { BuildingId } from '../core/types';

export interface Plot {
  id: string;
  type: BuildingId;
  x: number; // city-space pixels, bottom-center anchor
  y: number;
  unlock: number; // citadel level required to build
  scale?: number;
}

/** City space is 2800 x 1800 pixels. The walled core is an iso-diamond around the citadel. */
export const CITY_W = 2800;
export const CITY_H = 1800;
export const CITY_CENTER = { x: 1400, y: 820 };
export const WALL_RX = 680;
export const WALL_RY = 340;
export const GATE = { x: 1060, y: 990 };

export const PLOTS: Plot[] = [
  { id: 'citadel', type: 'citadel', x: 1400, y: 840, unlock: 0 },
  { id: 'wall', type: 'wall', x: GATE.x, y: GATE.y, unlock: 0 },
  { id: 'tavern', type: 'tavern', x: 1110, y: 700, unlock: 1 },
  { id: 'warehouse', type: 'warehouse', x: 1690, y: 700, unlock: 1 },
  { id: 'barracks', type: 'barracks', x: 1650, y: 1000, unlock: 1 },
  { id: 'infirmary', type: 'infirmary', x: 925, y: 830, unlock: 2 },
  { id: 'academy', type: 'academy', x: 1880, y: 840, unlock: 3 },
  { id: 'range', type: 'range', x: 1390, y: 1075, unlock: 4 },
  { id: 'watchtower', type: 'watchtower', x: 880, y: 1130, unlock: 4 },
  { id: 'stable', type: 'stable', x: 2090, y: 1210, unlock: 7 },
  { id: 'sanctum', type: 'sanctum', x: 1400, y: 1440, unlock: 8 },
  { id: 'spire', type: 'spire', x: 2330, y: 1110, unlock: 10 },
  { id: 'forge', type: 'forge', x: 1770, y: 1250, unlock: 6 },

  { id: 'farm1', type: 'farm', x: 640, y: 1080, unlock: 1 },
  { id: 'farm2', type: 'farm', x: 430, y: 960, unlock: 1 },
  { id: 'farm3', type: 'farm', x: 520, y: 1250, unlock: 5 },
  { id: 'farm4', type: 'farm', x: 260, y: 1120, unlock: 11 },
  { id: 'saw1', type: 'sawmill', x: 720, y: 610, unlock: 1 },
  { id: 'saw2', type: 'sawmill', x: 500, y: 730, unlock: 2 },
  { id: 'saw3', type: 'sawmill', x: 900, y: 470, unlock: 6 },
  { id: 'saw4', type: 'sawmill', x: 290, y: 820, unlock: 12 },
  { id: 'quarry1', type: 'quarry', x: 2080, y: 560, unlock: 3 },
  { id: 'quarry2', type: 'quarry', x: 2300, y: 680, unlock: 7 },
  { id: 'quarry3', type: 'quarry', x: 1880, y: 440, unlock: 13 },
  { id: 'gold1', type: 'goldmine', x: 2470, y: 840, unlock: 5 },
  { id: 'gold2', type: 'goldmine', x: 2580, y: 1000, unlock: 9 },
  { id: 'gold3', type: 'goldmine', x: 2520, y: 600, unlock: 14 },
];

export const PLOT_BY_ID: Record<string, Plot> = Object.fromEntries(PLOTS.map((p) => [p.id, p]));
