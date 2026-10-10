import type { BuildingId, FactionId } from '../core/types';
import { buildingArt, constructionSite, wallTower, type ArtResult } from './buildings';
import { boatArt, campArt, castleArt, hillArt, mountainArt, nodeArt, riftArt, ruinArt, titanArt, treeArt } from './worldArt';
import { PALETTES } from './buildings';

/** File names of raster assets (see docs/art/PROMPTS.md). */
export const bldArtName = (type: BuildingId, faction: FactionId, tier: number) => `bld_${type}_${faction}_t${tier}`;
export const heroArtName = (id: string) => `hero_${id}`;
export const iconArtName = (id: string) => `icon_${id}`;
export const unitArtName = (id: string) => `unit_${id}`;

/** World-map texture keys → raster asset names. */
export function worldArtName(key: string, faction: FactionId): string | null {
  const [k, a] = key.split(':');
  switch (k) {
    case 'wcamp': return `wobj_camp_${Number(a) + 1}`;
    case 'wnode': return `wobj_node_${a}`;
    case 'wruin': return `wobj_ruin_${Number(a) + 1}`;
    case 'wrift': return 'wobj_rift';
    case 'wboat': return 'wobj_boat';
    case 'wcity': return `wobj_city_${faction}`;
    case 'wtitan': return `titan_${a}_map`;
    case 'wmtn': return `wobj_mountain_${Number(a) + 1}`;
    case 'wsnow': return `wobj_snowpeak_${Number(a) + 1}`;
    case 'whill': return 'wobj_hill_1';
    case 'wtree': return `wobj_tree_${a}`;
    default: return null;
  }
}

const TIER_LEVEL = [1, 1, 5, 10, 15];

/**
 * The procedural art an asset replaces. The importer measures it so the new image
 * occupies the same footprint and stands on the same ground point.
 */
export function referenceArt(name: string): ArtResult | null {
  let m = /^bld_([a-z]+)_(order|wild|ash)_t([1-4])$/.exec(name);
  if (m) return buildingArt(m[1] as BuildingId, TIER_LEVEL[Number(m[3])], m[2] as FactionId);
  if (name === 'bld_construction') return constructionSite(1);
  if ((m = /^bld_wall_tower_(order|wild|ash)$/.exec(name))) return wallTower(1, PALETTES[m[1] as FactionId]);
  if ((m = /^wobj_camp_(\d)$/.exec(name))) return campArt(Number(m[1]) - 1);
  if ((m = /^wobj_node_(food|wood|stone|gold)$/.exec(name))) return nodeArt(m[1] as 'food', 0);
  if ((m = /^wobj_ruin_(\d)$/.exec(name))) return ruinArt(Number(m[1]) - 1);
  if (name === 'wobj_rift') return riftArt();
  if (name === 'wobj_boat') return boatArt(PALETTES.order.banner);
  if ((m = /^wobj_city_(order|wild|ash)$/.exec(name))) return castleArt('#ffffff', m[1] as FactionId, 5, true);
  if ((m = /^titan_([a-z]+)_map$/.exec(name))) return titanArt(m[1]);
  if ((m = /^wobj_mountain_(\d)$/.exec(name))) return mountainArt(Number(m[1]) - 1, false);
  if ((m = /^wobj_snowpeak_(\d)$/.exec(name))) return mountainArt(Number(m[1]) - 1, true);
  if (name === 'wobj_hill_1') return hillArt(0);
  if ((m = /^wobj_tree_([a-z]+)$/.exec(name))) return treeArt(m[1] as 'pine', 0);
  return null;
}

export type ArtKind = 'sprite' | 'icon' | 'portrait' | 'art' | 'texture' | 'unit' | 'ui';
/** Processing profile by file name: cut-out sprites vs. full images, and their stored size. */
export function artKind(name: string): { kind: ArtKind; maxPx: number } {
  if (name.startsWith('bld_')) return { kind: 'sprite', maxPx: 768 };
  if (name.startsWith('wobj_') || /^titan_.*_map$/.test(name)) return { kind: 'sprite', maxPx: 512 };
  if (name.startsWith('unit_')) return { kind: 'unit', maxPx: 384 };
  if (name.startsWith('icon_')) return { kind: 'icon', maxPx: 192 };
  if (name.startsWith('ui_')) return { kind: 'ui', maxPx: 1024 };
  if (name.startsWith('hero_')) return { kind: 'portrait', maxPx: 900 };
  if (name.startsWith('tex_')) return { kind: 'texture', maxPx: 512 };
  return { kind: 'art', maxPx: 1600 };
}
