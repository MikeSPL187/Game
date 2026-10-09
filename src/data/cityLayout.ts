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
export const WALL_RX = 600;
export const WALL_RY = 310;

export const PLOTS: Plot[] = [
  { id: 'citadel', type: 'citadel', x: 1400, y: 840, unlock: 0, scale: 1.25 },
  { id: 'wall', type: 'wall', x: 1400, y: 1150, unlock: 0 },
  { id: 'tavern', type: 'tavern', x: 1130, y: 700, unlock: 1 },
  { id: 'warehouse', type: 'warehouse', x: 1670, y: 700, unlock: 1 },
  { id: 'barracks', type: 'barracks', x: 1650, y: 1000, unlock: 1 },
  { id: 'infirmary', type: 'infirmary', x: 975, y: 860, unlock: 2 },
  { id: 'academy', type: 'academy', x: 1150, y: 1000, unlock: 3 },
  { id: 'range', type: 'range', x: 1830, y: 860, unlock: 4 },
  { id: 'watchtower', type: 'watchtower', x: 790, y: 1240, unlock: 4 },
  { id: 'stable', type: 'stable', x: 2060, y: 1200, unlock: 7 },
  { id: 'sanctum', type: 'sanctum', x: 1400, y: 1460, unlock: 8, scale: 1.1 },
  { id: 'spire', type: 'spire', x: 2270, y: 1050, unlock: 10 },

  { id: 'farm1', type: 'farm', x: 620, y: 1080, unlock: 1 },
  { id: 'farm2', type: 'farm', x: 430, y: 950, unlock: 1 },
  { id: 'farm3', type: 'farm', x: 470, y: 1220, unlock: 5 },
  { id: 'farm4', type: 'farm', x: 270, y: 1090, unlock: 11 },
  { id: 'saw1', type: 'sawmill', x: 700, y: 640, unlock: 1 },
  { id: 'saw2', type: 'sawmill', x: 500, y: 740, unlock: 2 },
  { id: 'saw3', type: 'sawmill', x: 880, y: 520, unlock: 6 },
  { id: 'saw4', type: 'sawmill', x: 320, y: 820, unlock: 12 },
  { id: 'quarry1', type: 'quarry', x: 2030, y: 560, unlock: 3 },
  { id: 'quarry2', type: 'quarry', x: 2230, y: 660, unlock: 7 },
  { id: 'quarry3', type: 'quarry', x: 1880, y: 460, unlock: 13 },
  { id: 'gold1', type: 'goldmine', x: 2380, y: 820, unlock: 5 },
  { id: 'gold2', type: 'goldmine', x: 2520, y: 960, unlock: 9 },
  { id: 'gold3', type: 'goldmine', x: 2440, y: 640, unlock: 14 },
];

export const PLOT_BY_ID: Record<string, Plot> = Object.fromEntries(PLOTS.map((p) => [p.id, p]));
