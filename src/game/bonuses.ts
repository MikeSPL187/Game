import type { GameState } from '../core/types';
import type { EffectKey } from '../data/research';
import { TECH_BY_ID } from '../data/research';
import { FACTIONS } from '../data/world';
import { HERO_BY_ID } from '../data/heroes';
import { ALLIANCE_TECH_BY_ID } from '../data/alliance';

export type Effects = Record<EffectKey, number>;

const ZERO: Effects = {
  prod: 0, prod_food: 0, prod_wood: 0, prod_stone: 0, prod_gold: 0,
  build_speed: 0, research_speed: 0, train_speed: 0, heal_speed: 0,
  gather_speed: 0, load: 0, march_speed: 0,
  atk: 0, def: 0, hp: 0, inf_def: 0, arc_atk: 0, cav_atk: 0, mag_atk: 0, inf_hp: 0,
  capacity: 0, infirmary_cap: 0, monster_dmg: 0, city_def: 0,
};

export function computeEffects(s: GameState): Effects {
  const e: Effects = { ...ZERO };
  for (const [id, lvl] of Object.entries(s.research)) {
    const t = TECH_BY_ID[id];
    if (t && lvl > 0) e[t.effect] += t.per * lvl;
  }
  for (const [id, t] of Object.entries(s.alliance?.techs ?? {})) {
    const def = ALLIANCE_TECH_BY_ID[id];
    if (def && t.level > 0) e[def.effect] += def.per * t.level;
  }
  const f = FACTIONS[s.player.faction];
  for (const [k, v] of Object.entries(f.bonuses)) e[k as EffectKey] += v ?? 0;
  return e;
}

/** Bonuses that come from a specific legion's heroes (gathering/speed/capacity). */
export function heroUtility(lead: string | null, deputy: string | null) {
  const out = { gather: 0, speed: 0, capacity: 0 };
  for (const [id, share] of [[lead, 1], [deputy, 0.5]] as const) {
    if (!id) continue;
    const d = HERO_BY_ID[id];
    for (const p of d.passives) {
      out.gather += (p.gather ?? 0) * share;
      out.speed += (p.speed ?? 0) * share;
      out.capacity += (p.capacity ?? 0) * share;
    }
  }
  return out;
}
