import { bus } from '../core/bus';
import type { BuildingId, WorldObject } from '../core/types';
import type { GoTarget } from '../data/quests';
import { PLOT_BY_ID } from '../data/cityLayout';
import { ga, toast, ui } from './core';

/** Find the best plot for a building type (lowest level built, or an empty unlocked plot). */
export function plotFor(type: BuildingId, prefer: 'lowest' | 'highest' = 'lowest'): string | null {
  const g = ga.game;
  const list = g.s.buildings.filter((b) => b.type === type);
  const built = list.filter((b) => b.level > 0);
  if (built.length) {
    built.sort((a, b) => (prefer === 'lowest' ? a.level - b.level : b.level - a.level));
    // skip busy ones for upgrade goals
    const free = built.find((b) => !g.jobForPlot(b.plot));
    return (free ?? built[0]).plot;
  }
  const avail = list.find((b) => PLOT_BY_ID[b.plot].unlock <= g.citadel);
  return (avail ?? list[0])?.plot ?? null;
}

export function focusBuilding(plot: string, open?: string) {
  ga.setView('city');
  ui.closeAll();
  ga.city.focusPlot(plot);
  ga.city.select(plot);
  bus.emit('city-select', { plot, open });
}

export function goTo(t: GoTarget) {
  const g = ga.game;
  if (t.kind === 'panel') { ui.open(t.panel); return; }
  if (t.kind === 'building') {
    const plot = plotFor(t.type);
    if (!plot) return;
    const b = g.building(plot)!;
    if (PLOT_BY_ID[plot].unlock > g.citadel && b.level === 0) {
      toast(`Откроется на ${PLOT_BY_ID[plot].unlock} ур. Цитадели`, true);
      focusBuilding('citadel');
      return;
    }
    focusBuilding(plot);
    if (t.action && t.action !== 'info') {
      setTimeout(() => {
        if (b.level === 0 || t.action === 'upgrade') ui.open('upgrade', { plot });
        else if (t.action === 'train') ui.open('train', { type: b.type });
        else if (t.action === 'research') ui.open('research');
        else if (t.action === 'summon') ui.open('tavern');
      }, 450);
    }
    return;
  }
  // world
  ga.setView('world');
  ui.closeAll();
  const o = findWorldTarget(t.find, t.level, t.titan);
  if (o) {
    ga.world.focusTile(o.x, o.y, 0.7);
    setTimeout(() => { ga.world.markTile(o.x, o.y, 0xffe08a); bus.emit('world-select', { obj: o.id }); }, 500);
  } else toast('Подходящая цель не найдена поблизости — исследуйте карту', true);
}

export function findWorldTarget(kind?: WorldObject['kind'], level?: number, titan?: string, res?: string): WorldObject | null {
  const g = ga.game;
  const c = g.cityPos();
  const n = g.s.world.size;
  let best: WorldObject | null = null, bd = Infinity;
  for (const o of g.s.world.objects) {
    if (kind && o.kind !== kind) continue;
    if (titan && o.titanId !== titan) continue;
    if (res && o.res !== res) continue;
    if (kind === 'node' && o.occupant != null) continue;
    const revealed = o.kind === 'titan' || g.fog[o.y * n + o.x];
    if (!revealed && kind !== 'lord' && kind !== 'rift') continue;
    let d = Math.hypot(o.x - c.x, o.y - c.y);
    if (level != null) {
      d += Math.abs(o.level - level) * 8;
    }
    if (!revealed) d += 40;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
