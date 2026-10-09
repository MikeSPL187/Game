import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { simulateBattle, groupsFromTroops, emptyMods, type Army } from '../src/game/combat';

const T0 = 1_700_000_000_000;
const monsters = (): Army => ({ name: 'm', kind: 'monster', groups: groupsFromTroops({ inf1: 400, arc1: 200 }), heroes: [], mods: emptyMods(), retreatAt: 0, titan: null });

describe('hero talents', () => {
  it('grants a point per level and gates rows by branch investment', () => {
    const g = Game.create('order', 'T', 1, T0);
    const h = g.s.heroes.torvald;
    h.level = 10;
    expect(g.talentPoints('torvald')).toBe(9);
    expect(g.learnTalent('torvald', 'm_rage').ok).toBe(false); // row 1 needs 4 points in branch
    for (let i = 0; i < 4; i++) expect(g.learnTalent('torvald', 'm_atk').ok).toBe(true);
    expect(g.learnTalent('torvald', 'm_rage').ok).toBe(true);
    expect(g.talentPoints('torvald')).toBe(4);
    expect(g.learnTalent('torvald', 'm_atk').ok).toBe(true);
    expect(g.learnTalent('torvald', 'm_atk').ok).toBe(false); // max rank 5
    expect(g.learnTalent('aerena', 'm_atk').ok).toBe(false); // not owned
  });

  it('commander talents make the legion stronger; deputy talents do not apply', () => {
    const g = Game.create('order', 'T', 1, T0);
    g.s.heroes.torvald.level = 30;
    const base = simulateBattle(g.legionArmy({ lead: 'torvald', deputy: null, troops: { inf1: 400 } }), monsters(), 3);
    for (const n of ['m_atk', 'm_atk', 'm_atk', 'm_atk', 'm_atk', 'm_rage', 'm_rage', 'm_rage', 'm_skill', 'm_skill', 'm_skill', 'm_skill', 'm_skill', 's_atk', 's_atk', 's_atk', 's_atk', 's_atk']) g.learnTalent('torvald', n);
    const tal = simulateBattle(g.legionArmy({ lead: 'torvald', deputy: null, troops: { inf1: 400 } }), monsters(), 3);
    expect(tal.aEnd).toBeGreaterThan(base.aEnd);
    const asDeputy = g.legionArmy({ lead: 'brenn', deputy: 'torvald', troops: { inf1: 1 } });
    expect(asDeputy.heroes.find((x) => x.id === 'torvald')!.tal).toBeUndefined();
  });

  it('utility talents raise capacity; reset refunds all points', () => {
    const g = Game.create('order', 'T', 1, T0);
    g.s.heroes.torvald.level = 40;
    const cap = g.legionCapacity('torvald');
    for (let i = 0; i < 5; i++) g.learnTalent('torvald', 'g_def');
    for (let i = 0; i < 5; i++) g.learnTalent('torvald', 'g_hp');
    for (let i = 0; i < 2; i++) g.learnTalent('torvald', 'g_heal');
    for (let i = 0; i < 5; i++) expect(g.learnTalent('torvald', 'g_cap').ok).toBe(true);
    expect(g.legionCapacity('torvald')).toBe(cap + 600);
    expect(g.resetTalents('torvald').ok).toBe(true);
    expect(g.talentPoints('torvald')).toBe(39);
    expect(g.legionCapacity('torvald')).toBe(cap);
  });
});
