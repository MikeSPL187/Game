import { writeFileSync } from 'fs';
import * as W from '../src/art/worldArt';
const u = (a: { svg: string }) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(a.svg);
const arts = [W.campArt(0), W.campArt(1), W.nodeArt('food', 0), W.nodeArt('wood', 0), W.nodeArt('stone', 0), W.nodeArt('gold', 0), W.ruinArt(0), W.ruinArt(1), W.riftArt(), W.riftVortex(), W.castleArt('#e04a3a', 'ash', 5), W.castleArt('#3a6aff', 'order', 12, true), W.titanArt('roc'), W.titanArt('golem'), W.titanArt('wyrm'), W.mountainArt(0, false), W.mountainArt(1, true), W.mountainArt(2, false), W.hillArt(0), W.treeArt('pine', 1), W.treeArt('oak', 2), W.treeArt('dead', 0), W.treeArt('birch', 1), W.rockArt(1), W.soldierArt('#3a6aff', 'inf'), W.soldierArt('#3a6aff', 'arc'), W.soldierArt('#3a6aff', 'cav'), W.soldierArt('#3a6aff', 'mag'), W.bannerArt('#3a6aff')];
let html = '<html><body style="background:#5a7a3a;margin:0;display:flex;flex-wrap:wrap;gap:4px;align-items:flex-end">';
for (const a of arts) html += `<img src="${u(a)}" style="background:#6a8a4a"/>`;
writeFileSync(process.argv[2], html + '</body></html>');
