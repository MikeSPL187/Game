// Prints raw (un-boosted) Citadel upgrade times to sanity-check pacing.
import { upgradeTimeSec } from '../src/data/buildings';
let tot = 0;
for (let L = 1; L < 25; L++) { const t = upgradeTimeSec('citadel', L) / 3600; tot += t; console.log(`${L}->${L + 1}  ${t.toFixed(2)}h  cum ${tot.toFixed(1)}h`); }
