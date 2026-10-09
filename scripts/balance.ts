import { Game } from '../src/game/game';
import { simulateBattle, groupsFromTroops, emptyMods, armyPower, type Army } from '../src/game/combat';
import { campTroops } from '../src/data/world';
import { Troops } from '../src/core/types';

const g = Game.create('order', 'T', 1, 0);
function mon(t: Troops, lvl: number): Army { const a: Army = { name: 'm', kind: 'monster', groups: groupsFromTroops(t), heroes: [], mods: emptyMods(), retreatAt: 0, titan: null }; a.mods.atk = lvl * 0.01; a.mods.def = lvl * 0.01; return a; }
const armies: [string, Troops, number][] = [
  ['start 180 T1', { inf1: 120, arc1: 60 }, 3],
  ['400 T1', { inf1: 200, arc1: 120, cav1: 80 }, 8],
  ['1000 T2', { inf2: 500, arc2: 300, cav2: 200 }, 15],
  ['2500 T2', { inf2: 1200, arc2: 800, cav2: 500 }, 22],
  ['3000 T3', { inf3: 1400, arc3: 900, cav3: 700 }, 30],
  ['5000 T4', { inf4: 2200, arc4: 1500, mag4: 1300 }, 45],
];
for (const [name, t, hl] of armies) {
  g.s.heroes.torvald.level = hl; g.s.heroes.brenn.level = hl;
  const row: string[] = [];
  for (let lvl = 1; lvl <= 25; lvl++) {
    const a = g.legionArmy({ lead: 'torvald', deputy: 'brenn', troops: t });
    const r = simulateBattle(a, mon(campTroops(lvl), lvl), lvl);
    row.push(`${lvl}:${r.win ? 'W' : 'L'}${Math.round((r.aStart - r.aEnd) / r.aStart * 100)}`);
  }
  console.log(name.padEnd(14), row.join(' '));
}
for (let l = 1; l <= 25; l += 3) { const t = campTroops(l); console.log(l, JSON.stringify(t), armyPower(mon(t, l))); }

import { titanGroup } from '../src/game/combat';
import { TITANS, riftTroops } from '../src/data/world';
const tests: [string, Troops, number][] = [['1500 T2', { inf2: 700, arc2: 500, cav2: 300 }, 20], ['3000 T2', { inf2: 1400, arc2: 1000, cav2: 600 }, 25], ['4000 T3', { inf3: 1800, arc3: 1200, cav3: 1000 }, 35], ['8000 T4', { inf4: 3500, arc4: 2500, mag4: 2000 }, 50], ['12000 T4', { inf4: 5000, arc4: 4000, mag4: 3000 }, 60]];
for (const [name, t, hl] of tests) {
  g.s.heroes.torvald.level = hl; g.s.heroes.brenn.level = hl;
  const row: string[] = [];
  for (const ti of TITANS) {
    const a = g.legionArmy({ lead: 'torvald', deputy: 'brenn', troops: t });
    const d: Army = { name: 't', kind: 'titan', groups: [titanGroup(ti.id), ...groupsFromTroops(campTroops(ti.level))], heroes: [], mods: emptyMods(), retreatAt: 0, titan: null };
    const r = simulateBattle(a, d, 5);
    row.push(`${ti.id}:${r.win ? 'W' : 'L'} loss${Math.round((r.aStart - r.aEnd) / r.aStart * 100)} dealt${Math.round((r.dStart - r.dEnd) / r.dStart * 100)}`);
  }
  for (const rl of [8, 14, 20]) {
    const a = g.legionArmy({ lead: 'torvald', deputy: 'brenn', troops: t });
    const r = simulateBattle(a, mon(riftTroops(rl), rl), 3);
    row.push(`rift${rl}:${r.win ? 'W' : 'L'} dealt${Math.round((r.dStart - r.dEnd) / r.dStart * 100)}`);
  }
  console.log(name.padEnd(10), row.join(' | '));
}
