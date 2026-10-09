import { useState } from 'preact/hooks';
import { portraitUrl } from '../../art/portraits';
import { BLUEPRINTS, BLUEPRINT_BY_ID, GEAR_RARITY, MATERIALS, SETS, SLOTS, itemStats, rarityOdds, statLabel, type GearItem, type SetId, type Slot } from '../../data/gear';
import { HERO_BY_ID } from '../../data/heroes';
import { Btn, Icon, Panel, act, haptic, toast, ui, useGame } from '../core';
import { goTo } from '../nav';
import { sfx } from '../../audio/audio';

const slotIcon = (s: Slot) => SLOTS.find((x) => x.id === s)!.icon;

export function StatList({ stats, small }: { stats: Record<string, number | undefined>; small?: boolean }) {
  return (
    <div class="col" style={{ gap: 1, fontSize: small ? 11 : 13 }}>
      {Object.entries(stats).filter(([, v]) => v).map(([k, v]) => <span class="good">{statLabel(k, v!)}</span>)}
    </div>
  );
}

export function GearCard({ it, onClick, sel, showHero }: { it: GearItem; onClick?: () => void; sel?: boolean; showHero?: boolean }) {
  const bp = BLUEPRINT_BY_ID[it.bp];
  const r = GEAR_RARITY[it.rarity];
  return (
    <div class={`card row r-${r.css}${sel ? ' hl' : ''}`} style={{ gap: 8, padding: 6, cursor: 'pointer', boxShadow: `inset 3px 0 0 ${r.color}` }} onClick={() => { sfx('click'); onClick?.(); }}>
      <div class={`icell r-${r.css}`} style={{ width: 48, flex: 'none' }}><Icon name={slotIcon(bp.slot)} size={34} /></div>
      <div class="grow">
        <div style={{ fontWeight: 800, fontSize: 13, color: r.color }}>{bp.name}</div>
        <div style={{ fontSize: 11, color: SETS[bp.set].color }}>{SETS[bp.set].name}</div>
        <StatList stats={itemStats(it) as any} small />
      </div>
      {showHero && it.hero && <img src={portraitUrl(it.hero)} title={HERO_BY_ID[it.hero].name} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', objectPosition: '50% 20%', boxShadow: '0 0 0 2px var(--gold3)' }} />}
    </div>
  );
}

function Materials() {
  const g = useGame();
  return (
    <div class="row wrap" style={{ gap: 6 }}>
      {MATERIALS.map((m) => <span class="chip" title={m.desc}><Icon name={m.icon} size={24} />{g.s.inventory[m.id] ?? 0}</span>)}
    </div>
  );
}

export function ForgePanel() {
  const g = useGame();
  const [tab, setTab] = useState<'craft' | 'arsenal'>('craft');
  const [set, setSet] = useState<SetId>('sun');
  const [sel, setSel] = useState<string>('sun_weapon');
  const [result, setResult] = useState<GearItem | null>(null);
  const [selItem, setSelItem] = useState<number | null>(null);
  const lvl = g.level('forge');
  if (lvl <= 0) {
    return <Panel title="Кузница" width={600} icon="hammer"><div class="col center" style={{ padding: 30 }}><div class="h">Постройте Кузницу, чтобы ковать снаряжение героям</div><Btn onClick={() => goTo({ kind: 'building', type: 'forge', action: 'upgrade' })}>Перейти</Btn></div></Panel>;
  }
  if (result) {
    const r = GEAR_RARITY[result.rarity];
    return (
      <Panel title="Выковано!" width={620} icon="hammer" onClose={() => setResult(null)}>
        <div class="summon-stage" style={{ height: 230, '--rc': r.color } as any}>
          <div class="rays" />
          <div class="summon-card" style={{ width: 320 }}><GearCard it={result} /></div>
        </div>
        <div class="col center">
          <div class="h" style={{ fontSize: 24, color: r.color }}>{r.name}</div>
          <div class="row"><Btn kind="dark" onClick={() => setResult(null)}>Ещё</Btn><Btn onClick={() => { setResult(null); setTab('arsenal'); setSelItem(result.uid); }}>В арсенал</Btn></div>
        </div>
      </Panel>
    );
  }
  const bp = BLUEPRINT_BY_ID[sel];
  const odds = rarityOdds(lvl);
  const lacking = Object.entries(bp.cost).some(([m, n]) => (g.s.inventory[m] ?? 0) < (n ?? 0));
  const items = [...g.s.gear].sort((a, b) => b.rarity - a.rarity || a.bp.localeCompare(b.bp));
  const item = items.find((x) => x.uid === selItem) ?? null;
  return (
    <Panel title={`Кузница · ${lvl} ур.`} width={1040} icon="hammer" tabs={[{ id: 'craft', label: 'Ковка' }, { id: 'arsenal', label: `Арсенал (${g.s.gear.length})` }]} tab={tab} onTab={(t) => setTab(t as any)}>
      <div class="row" style={{ marginBottom: 8 }}><b class="grow">Материалы</b><Materials /></div>
      {tab === 'craft' ? (
        <div class="row" style={{ alignItems: 'stretch', gap: 12 }}>
          <div class="col grow" style={{ gap: 8 }}>
            <div class="row" style={{ gap: 6 }}>
              {(Object.keys(SETS) as SetId[]).map((s) => (
                <button class={'tab' + (s === set ? ' on' : '')} style={{ borderRadius: 10, borderBottom: '1px solid', color: s === set ? SETS[s].color : undefined }} onClick={() => { sfx('page'); setSet(s); setSel(`${s}_${bp.slot}`); }}>{SETS[s].name}</button>
              ))}
            </div>
            <div class="mute" style={{ fontSize: 12, fontStyle: 'italic' }}>{SETS[set].desc}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {BLUEPRINTS.filter((b) => b.set === set).map((b) => (
                <button class={'card row' + (b.id === sel ? ' hl' : '')} style={{ gap: 6, padding: 6, textAlign: 'left', opacity: lvl >= b.forge ? 1 : 0.5 }} onClick={() => { sfx('click'); setSel(b.id); }}>
                  <Icon name={slotIcon(b.slot)} size={30} />
                  <div><div style={{ fontWeight: 800, fontSize: 12 }}>{b.name}</div><div class="mute" style={{ fontSize: 11 }}>{SLOTS.find((x) => x.id === b.slot)!.name}</div></div>
                </button>
              ))}
            </div>
            <div class="card col" style={{ gap: 4 }}>
              <b style={{ color: SETS[set].color }}>Бонусы комплекта</b>
              {SETS[set].bonus.map((b) => <span style={{ fontSize: 12 }}><b>{b.n} предмета:</b> {b.text}</span>)}
            </div>
          </div>
          <div class="card col" style={{ width: 330, flex: 'none', gap: 8 }}>
            <div class="row"><Icon name={slotIcon(bp.slot)} size={44} /><div><div class="h" style={{ fontSize: 18, color: 'var(--gold2)' }}>{bp.name}</div><div style={{ fontSize: 12, color: SETS[bp.set].color }}>{SETS[bp.set].name}</div></div></div>
            <div class="mute" style={{ fontSize: 12 }}>Характеристики (обычный → легендарный):</div>
            <div class="col" style={{ gap: 1, fontSize: 12 }}>
              {Object.entries(bp.stats).map(([k, v]) => <span>{statLabel(k, v!)} <span class="mute">→</span> <b style={{ color: GEAR_RARITY[3].color }}>{statLabel(k, v! * GEAR_RARITY[3].mult).replace(/^[^+]*/, '')}</b></span>)}
            </div>
            <div class="mute" style={{ fontSize: 12 }}>Шансы редкости:</div>
            <div class="row" style={{ height: 14, borderRadius: 7, overflow: 'hidden', gap: 0 }}>
              {odds.map((o, i) => <div title={`${GEAR_RARITY[i].name}: ${Math.round(o * 100)}%`} style={{ width: `${o * 100}%`, height: '100%', background: GEAR_RARITY[i].color }} />)}
            </div>
            <div class="row wrap" style={{ gap: 6, fontSize: 11 }}>{odds.map((o, i) => <span style={{ color: GEAR_RARITY[i].color }}>{GEAR_RARITY[i].name} {Math.round(o * 100)}%</span>)}</div>
            <div class="cost">
              {Object.entries(bp.cost).map(([m, n]) => {
                const mat = MATERIALS.find((x) => x.id === m)!;
                return <span class={'chip' + ((g.s.inventory[m] ?? 0) < (n ?? 0) ? ' lack' : '')}><Icon name={mat.icon} size={20} />{n}</span>;
              })}
            </div>
            {lvl < bp.forge
              ? <div class="bad" style={{ fontSize: 13 }}>Требуется Кузница {bp.forge} ур.</div>
              : <Btn kind="green" size="big" off={lacking} onClick={() => {
                  const r = g.craft(bp.id);
                  if (!r.ok) { toast(r.error!, true); return; }
                  sfx(r.item!.rarity >= 2 ? 'legendary' : 'build'); haptic(true);
                  setResult(r.item!);
                }}><Icon name="hammer" size={22} /> Выковать</Btn>}
            {lacking && <div class="mute" style={{ fontSize: 12 }}>Материалы добываются в логовах Пустоты, руинах, разломах и у титанов.</div>}
          </div>
        </div>
      ) : (
        <div class="row" style={{ alignItems: 'stretch', gap: 12 }}>
          <div class="col grow scroll" style={{ gap: 6, maxHeight: 340 }}>
            {items.map((it) => <GearCard it={it} sel={it.uid === selItem} showHero onClick={() => setSelItem(it.uid)} />)}
            {!items.length && <div class="mute" style={{ padding: 20 }}>Арсенал пуст. Выкуйте первое снаряжение!</div>}
          </div>
          <div class="card col" style={{ width: 300, flex: 'none' }}>
            {item ? (
              <>
                <GearCard it={item} />
                {item.hero ? <div class="row"><img src={portraitUrl(item.hero)} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', objectPosition: '50% 20%' }} /><span class="grow">Надето: <b>{HERO_BY_ID[item.hero].name}</b></span><Btn size="small" kind="dark" onClick={() => act(g.unequip(item.uid))}>Снять</Btn></div> : <div class="mute" style={{ fontSize: 12 }}>Надеть предмет можно в окне героя → «Снаряжение».</div>}
                <Btn kind="red" size="small" onClick={() => { if (confirm('Разобрать предмет? Вернётся часть материалов.')) { if (act(g.salvage(item.uid), 'page')) setSelItem(null); } }}>Разобрать</Btn>
              </>
            ) : <div class="mute">Выберите предмет</div>}
          </div>
        </div>
      )}
    </Panel>
  );
}

/** Equipment tab inside hero details */
export function HeroGear({ id }: { id: string }) {
  const g = useGame();
  const [slot, setSlot] = useState<Slot | null>(null);
  const worn = g.heroGear(id);
  const fx = g.tal(id);
  const sets: Record<string, number> = {};
  for (const it of worn) { const s = BLUEPRINT_BY_ID[it.bp].set; sets[s] = (sets[s] ?? 0) + 1; }
  const busy = g.busyHeroes().has(id);
  const options = slot ? g.s.gear.filter((it) => BLUEPRINT_BY_ID[it.bp].slot === slot && it.hero !== id).sort((a, b) => b.rarity - a.rarity) : [];
  return (
    <div class="row" style={{ alignItems: 'stretch', gap: 12 }}>
      <div class="col" style={{ width: 420, flex: 'none', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {SLOTS.map((s) => {
            const it = worn.find((x) => BLUEPRINT_BY_ID[x.bp].slot === s.id);
            return it ? (
              <div style={{ outline: slot === s.id ? '2px solid var(--gold2)' : undefined, borderRadius: 12 }}><GearCard it={it} onClick={() => setSlot(s.id)} /></div>
            ) : (
              <button class={'card row' + (slot === s.id ? ' hl' : '')} style={{ gap: 8, padding: 6, opacity: 0.8 }} onClick={() => { sfx('click'); setSlot(s.id); }}>
                <div class="icell" style={{ width: 48, flex: 'none', filter: 'grayscale(1)', opacity: 0.6 }}><Icon name={s.icon} size={30} /></div>
                <span class="mute">{s.name}: пусто</span>
              </button>
            );
          })}
        </div>
        <div class="card col" style={{ gap: 2 }}>
          <b>Итог снаряжения и талантов</b>
          <StatList stats={fx as any} small />
          {Object.entries(sets).map(([s, n]) => <span style={{ fontSize: 12, color: SETS[s as SetId].color }}>{SETS[s as SetId].name}: {n}/6 · {SETS[s as SetId].bonus.filter((b) => n >= b.n).map((b) => b.text).join(', ') || 'нет бонуса'}</span>)}
        </div>
      </div>
      <div class="card col grow" style={{ gap: 6 }}>
        {busy && <div class="warn" style={{ fontSize: 13 }}>Герой в походе — снаряжение меняется после возвращения.</div>}
        {slot ? (
          <>
            <div class="row"><b class="grow">{SLOTS.find((x) => x.id === slot)!.name}</b>
              {worn.find((x) => BLUEPRINT_BY_ID[x.bp].slot === slot) && <Btn size="small" kind="dark" onClick={() => act(g.unequip(worn.find((x) => BLUEPRINT_BY_ID[x.bp].slot === slot)!.uid))}>Снять</Btn>}
            </div>
            <div class="col scroll" style={{ gap: 6, maxHeight: 300 }}>
              {options.map((it) => <GearCard it={it} showHero onClick={() => act(g.equip(it.uid, id), 'levelup')} />)}
              {!options.length && <div class="mute">Нет подходящих предметов. <a style={{ color: 'var(--gold2)', cursor: 'pointer' }} onClick={() => { ui.close(); ui.open('forge'); }}>Открыть Кузницу</a></div>}
            </div>
          </>
        ) : <div class="mute">Выберите слот, чтобы надеть предмет. Снаряжение действует, когда герой — командир легиона.</div>}
      </div>
    </div>
  );
}
