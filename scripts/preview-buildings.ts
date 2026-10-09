import { writeFileSync } from 'fs';
import { buildingArt, wallSegment, wallTower, constructionSite, PALETTES } from '../src/art/buildings';
import type { BuildingId } from '../src/core/types';
const ids: BuildingId[] = ['citadel', 'farm', 'sawmill', 'quarry', 'goldmine', 'barracks', 'range', 'stable', 'spire', 'academy', 'infirmary', 'tavern', 'warehouse', 'wall', 'watchtower', 'sanctum'];
const fac = (process.argv[2] ?? 'order') as any;
let html = '<html><body style="background:#5a7a3a;margin:0;display:flex;flex-wrap:wrap;gap:4px">';
for (const id of ids) for (const lvl of [1, 6, 16]) {
  const a = buildingArt(id, lvl, fac);
  html += `<div style="background:#6a8a4a"><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(a.svg)}" width="${a.w * 0.8}"/></div>`;
}
for (const t of [1, 3]) { const a = wallSegment(t, PALETTES[fac], 300, 'x'); html += `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(a.svg)}"/>`; const b = wallTower(t, PALETTES[fac]); html += `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(b.svg)}"/>`; }
html += `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(constructionSite(1).svg)}"/>`;
writeFileSync(process.argv[3], html + '</body></html>');
