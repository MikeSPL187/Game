import { useEffect, useMemo, useState } from 'preact/hooks';
import { bus } from '../../core/bus';
import { fmt, fmtTime } from '../../core/format';
import type { MarchAction, Point, TroopKey, Troops, WorldObject } from '../../core/types';
import { portraitUrl } from '../../art/portraits';
import { HEROES, HERO_BY_ID } from '../../data/heroes';
import { TROOPS, TYPE_INFO, ALL_TROOP_KEYS } from '../../data/troops';
import { FACTIONS, NODE_INFO, TITAN_BY_ID, campName, campTroops, nodeRate, riftTroops } from '../../data/world';
import { TERRAIN_NAME, passable } from '../../game/terrain';
import { sumTroops } from '../../game/game';
import { Bar, Btn, Icon, Panel, RewardList, Slider, act, ga, toast, ui, useGame, useNow } from '../core';
import { HeroCard } from './heroes';
import { findWorldTarget } from '../nav';
import { sfx } from '../../audio/audio';

type Sel = { obj?: number; tile?: Point; legion?: number } | null;

export function WorldSheet() {
  const g = useGame();
  const [sel, setSel] = useState<Sel>(null);
  useNow(500);
  useEffect(() => {
    const offs = [
      bus.on('world-select', (s: Sel) => { sfx('click'); setSel(s); }),
      bus.on('view', () => setSel(null)),
      bus.on('ui-open', () => setSel(null)),
    ];
    return () => offs.forEach((o) => o());
  }, []);
  if (!sel || ga.view !== 'world') return null;
  const close = () => { setSel(null); ga.world.clearMark(); };
  const stationed = g.s.legions.filter((l) => l.state === 'station');

  if (sel.legion != null) {
    const l = g.s.legions.find((x) => x.id === sel.legion);
    if (!l) { setTimeout(close, 0); return null; }
    const names: Record<string, string> = { march: 'В марше', return: 'Возвращается', gather: 'Добывает', station: 'Стоит лагерем', battle: 'В бою', idle: '' };
    const tgt = g.obj(l.targetId);
    return (
      <div class="sheet panel act">
        <div class="panel-head"><img src={portraitUrl(l.lead!)} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', objectPosition: '50% 20%' }} /><div class="panel-title" style={{ fontSize: 19 }}>Легион · {HERO_BY_ID[l.lead!].name}</div><button class="panel-close" onClick={close}>✕</button></div>
        <div class="panel-body col">
          <div class="row"><b class="grow">{names[l.state]}</b>{tgt && <span class="mute">{objTitle(tgt)}</span>}</div>
          {l.state === 'gather' && <Bar value={Date.now() - l.gatherStart} max={l.gatherEnd - l.gatherStart} label={fmtTime(l.gatherEnd - Date.now())} />}
          {(l.state === 'march' || l.state === 'return') && <Bar kind="blue" value={Date.now() - l.pathT0} max={g.arrivalTime(l) - l.pathT0} label={fmtTime(g.arrivalTime(l) - Date.now())} />}
          <TroopsLine t={l.troops} />
          {Object.keys(l.carry).length > 0 && <RewardList r={{ res: l.carry }} compact />}
          <div class="row">
            {l.state !== 'return' && <Btn kind="red" wide onClick={() => { act(g.recall(l.id), 'horn'); }}><Icon name="home" size={20} /> Отозвать</Btn>}
            {l.state === 'station' && <Btn kind="dark" onClick={() => toast('Выберите цель на карте — отряд выполнит приказ', false)}>Приказ</Btn>}
          </div>
        </div>
      </div>
    );
  }

  if (sel.tile) {
    const { x, y } = sel.tile;
    const tt = g.ter.t[y * g.ter.size + x];
    const fog = !g.fog[y * g.ter.size + x];
    return (
      <div class="sheet panel act">
        <div class="panel-head"><Icon name="move" size={30} /><div class="panel-title" style={{ fontSize: 19 }}>{fog ? 'Неизведанные земли' : TERRAIN_NAME[tt]}</div><button class="panel-close" onClick={close}>✕</button></div>
        <div class="panel-body col">
          <div class="mute">Координаты: X {x} · Y {y}</div>
          {!passable(tt) ? <div class="bad">Сюда не пройти</div> : (
            <>
              <Btn kind="blue" wide onClick={() => { close(); openDispatch('move', { x, y }, null); }}><Icon name="flag" size={20} /> Разбить лагерь здесь</Btn>
              {stationed.map((l) => <Btn kind="dark" wide onClick={() => { act(g.command(l.id, 'move', { x, y }, null), 'horn'); close(); }}>Переместить легион {HERO_BY_ID[l.lead!].name}</Btn>)}
            </>
          )}
        </div>
      </div>
    );
  }

  const o = g.obj(sel.obj);
  if (!o) { setTimeout(close, 0); return null; }
  return (
    <div class="sheet panel act">
      <div class="panel-head"><Icon name={objIcon(o)} size={32} /><div class="panel-title" style={{ fontSize: 19 }}>{objTitle(o)}</div><button class="panel-close" onClick={close}>✕</button></div>
      <div class="panel-body col scroll" style={{ maxHeight: 360 }}>
        <ObjDetails o={o} />
      </div>
    </div>
  );
}

function objIcon(o: WorldObject) {
  return { camp: 'camp', node: o.res ?? 'pick', city: 'castle', lord: 'castle', titan: 'titan', ruin: 'ruin', rift: 'rift' }[o.kind];
}
export function objTitle(o: WorldObject): string {
  const g = ga.game;
  switch (o.kind) {
    case 'camp': return `${campName(o.level)} · ${o.level} ур.`;
    case 'node': return `${NODE_INFO[o.res!].name} · ${o.level} ур.`;
    case 'city': return g.s.player.name;
    case 'lord': { const l = g.s.lords.find((x) => x.id === o.lordId); return l ? l.name : 'Лорд'; }
    case 'titan': return `${TITAN_BY_ID[o.titanId!].name} · ${o.level} ур.`;
    case 'ruin': return 'Древние руины';
    case 'rift': return `Эфирный разлом · ${o.level} ур.`;
  }
}

function TroopsLine({ t }: { t: Troops }) {
  const groups: Record<string, number> = {};
  for (const [k, n] of Object.entries(t)) if (n) groups[TROOPS[k as TroopKey].type] = (groups[TROOPS[k as TroopKey].type] ?? 0) + n;
  return <div class="cost">{Object.entries(groups).map(([k, n]) => <span class="chip"><Icon name={k} size={20} />{fmt(n)}</span>)}</div>;
}

function ObjDetails({ o }: { o: WorldObject }) {
  const g = ga.game;
  const mine = g.s.legions.find((l) => l.targetId === o.id && (l.state === 'gather' || l.state === 'march'));
  switch (o.kind) {
    case 'city':
      return <><div class="mute">Ваша столица. Здесь размещён гарнизон.</div><Btn wide onClick={() => ga.setView('city')}>Войти в город</Btn></>;
    case 'camp':
      return (
        <>
          <div class="mute" style={{ fontSize: 13 }}>Твари Пустоты разоряют окрестности. Победите их, чтобы получить ресурсы, опыт героев и трофеи.</div>
          <div class="row"><b class="grow">Враги</b><TroopsLine t={campTroops(o.level)} /></div>
          <div class="h" style={{ color: 'var(--gold2)' }}>Возможная добыча</div>
          <RewardList r={{ res: { food: Math.round(350 * Math.pow(o.level, 1.55)), wood: Math.round(350 * Math.pow(o.level, 1.55)) }, items: { tome1: 1, speed5: 1 } }} compact />
          {o.level > g.s.stats.maxCampLevel && <div class="good" style={{ fontSize: 12 }}>Первая победа над этим уровнем: +Серебряный ключ и Эфир</div>}
          <Btn kind="red" wide onClick={() => openDispatch('attack', o, o.id)}><Icon name="attack" size={22} /> Атаковать</Btn>
        </>
      );
    case 'rift':
      return (
        <>
          <div class="mute" style={{ fontSize: 13 }}>Разрыв ткани мира. Из него лезут сильнейшие твари. Здоровье разлома сохраняется между атаками.</div>
          <Bar value={o.hp ?? 1} max={1} kind="red" label={`${Math.round((o.hp ?? 1) * 100)}%`} />
          <div class="row"><b class="grow">Враги</b><TroopsLine t={riftTroops(o.level)} /></div>
          <RewardList r={{ items: { key_gold: 1, chest_big: 1, tome2: 2 }, res: { aether: 40 } }} compact />
          <Btn kind="red" wide onClick={() => openDispatch('attack', o, o.id)}><Icon name="attack" size={22} /> Атаковать</Btn>
        </>
      );
    case 'titan': {
      const t = TITAN_BY_ID[o.titanId!];
      return (
        <>
          <div class="h" style={{ color: t.color }}>{t.title}</div>
          <div class="mute" style={{ fontSize: 13 }}>{t.desc} Победив титана, вы приручите его — он будет сражаться на вашей стороне.</div>
          <Bar value={o.hp ?? 1} max={1} kind="red" label={`Здоровье ${Math.round((o.hp ?? 1) * 100)}%`} />
          <div class="mute" style={{ fontSize: 12 }}>Урон сохраняется: атакуйте несколькими легионами подряд. Титан медленно восстанавливается.</div>
          <div class="cost">
            {t.buff.atk && <span class="chip">Атака +{Math.round(t.buff.atk * 100)}%</span>}
            {t.buff.def && <span class="chip">Защита +{Math.round(t.buff.def * 100)}%</span>}
            {t.buff.hp && <span class="chip">Здоровье +{Math.round(t.buff.hp * 100)}%</span>}
          </div>
          <Btn kind="red" wide onClick={() => openDispatch('attack', o, o.id)}><Icon name="attack" size={22} /> Бросить вызов</Btn>
        </>
      );
    }
    case 'node': {
      const pct = (o.amount ?? 0) / (o.max ?? 1);
      return (
        <>
          <div class="row"><Icon name={o.res!} size={32} /><div class="grow"><b>{fmt(o.amount ?? 0)}</b> <span class="mute">осталось</span></div><span class="mute" style={{ fontSize: 12 }}>~{fmt(nodeRate(o.level, o.res!) * 3600)}/ч</span></div>
          <Bar value={pct} max={1} kind="gold" />
          {mine ? <Btn kind="red" wide onClick={() => act(g.recall(mine.id), 'horn')}>Отозвать отряд</Btn>
            : o.occupant != null ? <div class="warn">Занято</div>
            : <Btn kind="green" wide onClick={() => openDispatch('gather', o, o.id)}><Icon name="pick" size={22} /> Добывать</Btn>}
        </>
      );
    }
    case 'ruin':
      return (
        <>
          <div class="mute" style={{ fontSize: 13 }}>Развалины эпохи до Раскола. Внутри могут скрываться ресурсы, ключи и осколки героев.</div>
          <Btn kind="gold" wide onClick={() => openDispatch('explore', o, o.id)}><Icon name="ruin" size={22} /> Исследовать</Btn>
        </>
      );
    case 'lord': {
      const lord = g.s.lords.find((l) => l.id === o.lordId)!;
      g.ensureLordTroops(lord);
      return (
        <>
          <div class="row"><span class="chip" style={{ color: FACTIONS[lord.faction].color }}>{FACTIONS[lord.faction].name}</span><span class="chip">Цитадель {lord.citadel}</span></div>
          <div class="row"><b class="grow">Гарнизон</b><TroopsLine t={lord.troops} /></div>
          <div class="mute" style={{ fontSize: 13 }}>Победа над гарнизоном принесёт трофеи и отсрочит набеги этого лорда. Потери в боях с лордами частично безвозвратны.</div>
          <div class="mute" style={{ fontSize: 12 }}>Побед над ним: {lord.defeats}</div>
          <Btn kind="red" wide onClick={() => openDispatch('attack', o, o.id)}><Icon name="attack" size={22} /> Штурмовать</Btn>
        </>
      );
    }
  }
}

// ———————————————————————————————————————— dispatch
let lastPick: { lead: string | null; deputy: string | null } = { lead: null, deputy: null };

export function openDispatch(action: MarchAction, target: Point, targetId: number | null) {
  const g = ga.game;
  const stationed = g.s.legions.filter((l) => l.state === 'station');
  if (g.freeLegionSlots() <= 0 && !stationed.length) { toast('Все легионы заняты. Улучшайте Цитадель, чтобы открыть новые.', true); return; }
  ui.open('dispatch', { action, target: { x: target.x, y: target.y }, targetId });
}

function autoFill(cap: number, avail: Troops, prefer: 'balanced' | 'gather'): Troops {
  const out: Troops = {};
  let left = cap;
  const keys = ALL_TROOP_KEYS.filter((k) => (avail[k] ?? 0) >= 1).sort((a, b) => TROOPS[b].tier - TROOPS[a].tier || (prefer === 'gather' ? TROOPS[b].load - TROOPS[a].load : 0));
  if (prefer === 'balanced') {
    // take proportionally from the top tier available of each type
    const total = keys.reduce((s, k) => s + Math.floor(avail[k] ?? 0), 0);
    for (const k of keys) {
      if (left <= 0) break;
      const share = Math.floor(Math.min(avail[k] ?? 0, cap * (Math.floor(avail[k] ?? 0) / Math.max(1, total)) * 1.0 + 1));
      const n = Math.min(left, share);
      if (n > 0) { out[k] = n; left -= n; }
    }
  }
  for (const k of keys) {
    if (left <= 0) break;
    const have = Math.floor(avail[k] ?? 0) - (out[k] ?? 0);
    const n = Math.min(left, have);
    if (n > 0) { out[k] = (out[k] ?? 0) + n; left -= n; }
  }
  return out;
}

export function DispatchPanel({ action, target, targetId }: { action: MarchAction; target: Point; targetId: number | null }) {
  const g = useGame();
  const o = g.obj(targetId);
  const stationed = g.s.legions.filter((l) => l.state === 'station');
  const [src, setSrc] = useState<'new' | number>(g.freeLegionSlots() > 0 ? 'new' : stationed[0]?.id ?? 'new');
  const busy = g.busyHeroes();
  const owned = HEROES.filter((h) => g.s.heroes[h.id].owned && !busy.has(h.id)).sort((a, b) => g.s.heroes[b.id].level - g.s.heroes[a.id].level);
  const initLead = lastPick.lead && owned.some((h) => h.id === lastPick.lead) ? lastPick.lead : owned[0]?.id ?? null;
  const [lead, setLead] = useState<string | null>(initLead);
  const [deputy, setDeputy] = useState<string | null>(lastPick.deputy && lastPick.deputy !== initLead && owned.some((h) => h.id === lastPick.deputy) ? lastPick.deputy : owned.find((h) => h.id !== initLead)?.id ?? null);
  const [picking, setPicking] = useState<'lead' | 'deputy' | null>(null);
  const cap = g.legionCapacity(lead);
  const avail = g.s.troops;
  const [troops, setTroops] = useState<Troops>(() => autoFill(cap, avail, action === 'gather' ? 'gather' : 'balanced'));
  const total = sumTroops(troops);
  const useLegion = src !== 'new' ? g.s.legions.find((l) => l.id === src) : null;
  const effTroops = useLegion ? useLegion.troops : troops;
  const effLead = useLegion ? useLegion.lead : lead;
  const effDep = useLegion ? useLegion.deputy : deputy;
  const from = useLegion ? useLegion.pos : g.cityPos();
  const plan = useMemo(() => g.planMarch(from, target, effTroops, effLead, effDep), [src, JSON.stringify(effTroops), effLead, effDep]);
  const pred = o && action === 'attack' && sumTroops(effTroops) > 0 ? g.predict({ lead: effLead, deputy: effDep, troops: effTroops }, o) : null;
  const load = g.legionLoad(effTroops, effLead, effDep);

  const send = () => {
    let r;
    if (useLegion) r = g.command(useLegion.id, action, target, targetId);
    else {
      if (!lead) { toast('Выберите командира', true); return; }
      lastPick = { lead, deputy };
      r = g.dispatch({ lead, deputy, troops, target, action, targetId });
    }
    if (act(r, 'horn')) { ui.close(); ga.world.clearMark(); }
  };
  const actionLabel = { attack: 'Атаковать', gather: 'Добывать', explore: 'Исследовать', move: 'Выступить', return: 'Вернуться' }[action];

  if (picking) {
    return (
      <Panel title={picking === 'lead' ? 'Выбор командира' : 'Выбор заместителя'} width={900} onClose={() => setPicking(null)}>
        <div class="hgrid">
          {picking === 'deputy' && <div class="hcard center" style={{ display: 'flex', background: '#1a2238' }} onClick={() => { setDeputy(null); setPicking(null); }}><b class="mute">Без заместителя</b></div>}
          {owned.filter((h) => (picking === 'lead' ? h.id !== deputy : h.id !== lead)).map((h) => (
            <HeroCard id={h.id} sel={(picking === 'lead' ? lead : deputy) === h.id} onClick={() => {
              if (picking === 'lead') { setLead(h.id); setTroops(autoFill(g.legionCapacity(h.id), avail, action === 'gather' ? 'gather' : 'balanced')); } else setDeputy(h.id);
              setPicking(null);
            }} />
          ))}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={<span>{actionLabel}: {o ? objTitle(o) : `X ${target.x} · Y ${target.y}`}</span>} width={1040} icon={action === 'attack' ? 'attack' : action === 'gather' ? 'pick' : action === 'explore' ? 'ruin' : 'flag'}
      tabs={stationed.length ? [...(g.freeLegionSlots() > 0 ? [{ id: 'new', label: 'Новый легион' }] : []), ...stationed.map((l) => ({ id: String(l.id), label: `Лагерь: ${HERO_BY_ID[l.lead!].name}` }))] : undefined}
      tab={String(src)} onTab={(t) => setSrc(t === 'new' ? 'new' : Number(t))}>
      <div class="row" style={{ alignItems: 'stretch', gap: 14 }}>
        <div class="col" style={{ width: 230, flex: 'none' }}>
          <div class="h" style={{ color: 'var(--gold2)' }}>Командир</div>
          {effLead ? <HeroCard id={effLead} onClick={() => !useLegion && setPicking('lead')} /> : <div class="hcard center" style={{ display: 'flex' }} onClick={() => setPicking('lead')}><b>+ Выбрать</b></div>}
          <div class="row" style={{ gap: 8, alignItems: 'center' }}>
            <div style={{ width: 96 }}>{effDep ? <HeroCard id={effDep} small onClick={() => !useLegion && setPicking('deputy')} /> : <div class="hcard center" style={{ display: 'flex', width: 96 }} onClick={() => !useLegion && setPicking('deputy')}><b style={{ fontSize: 12 }}>+ Зам.</b></div>}</div>
            <div class="mute" style={{ fontSize: 12 }}>Заместитель даёт 50% бонусов и тоже применяет навык.</div>
          </div>
        </div>
        <div class="col grow" style={{ gap: 8 }}>
          {useLegion ? (
            <div class="card col"><div class="h">Войска лагеря</div><TroopsLine t={useLegion.troops} /></div>
          ) : (
            <div class="card col scroll" style={{ gap: 6, maxHeight: 250 }}>
              <div class="row"><b class="grow">Войска</b>
                <Btn size="small" kind="dark" onClick={() => setTroops(autoFill(cap, avail, action === 'gather' ? 'gather' : 'balanced'))}>Авто</Btn>
                <Btn size="small" kind="dark" onClick={() => setTroops({})}>Сброс</Btn>
              </div>
              {ALL_TROOP_KEYS.filter((k) => (avail[k] ?? 0) >= 1).map((k) => {
                const have = Math.floor(avail[k] ?? 0);
                const v = troops[k] ?? 0;
                const room = cap - total + v;
                return (
                  <div class="row">
                    <Icon name={TROOPS[k].type} size={28} />
                    <div style={{ width: 150 }}><b style={{ fontSize: 13 }}>{TROOPS[k].name}</b> <span class="mute" style={{ fontSize: 11 }}>T{TROOPS[k].tier}</span></div>
                    <div class="grow"><Slider value={v} max={Math.min(have, room)} onInput={(n) => setTroops({ ...troops, [k]: n })} /></div>
                    <b style={{ width: 90, textAlign: 'right' }}>{fmt(v)}<span class="mute" style={{ fontSize: 11 }}>/{fmt(have)}</span></b>
                  </div>
                );
              })}
              {!ALL_TROOP_KEYS.some((k) => (avail[k] ?? 0) >= 1) && <div class="bad">В городе нет войск. Обучите их в Казармах.</div>}
            </div>
          )}
          <div class="card col" style={{ gap: 6 }}>
            {!useLegion && <div class="row"><span class="mute grow">Численность</span><b>{fmt(total)} / {fmt(cap)}</b></div>}
            {!useLegion && <Bar value={total} max={cap} kind="gold" h={10} />}
            <div class="row wrap" style={{ gap: 14 }}>
              <span class="row" style={{ gap: 4 }}><Icon name="boot" size={20} /> Марш: <b>{plan ? fmtTime(plan.ms) : '—'}</b></span>
              {action === 'gather' && o?.res && <span class="row" style={{ gap: 4 }}><Icon name={o.res} size={20} /> Унесут: <b>{fmt(Math.min(load, o.amount ?? 0))}</b></span>}
              <span class="row" style={{ gap: 4 }}><Icon name="power" size={20} /> Мощь: <b>{fmt(g.troopPower(effTroops))}</b></span>
            </div>
            {pred && <div class="row"><span class="grow mute">Прогноз боя</span><b class={pred.tone === 'good' ? 'good' : pred.tone === 'warn' ? 'warn' : 'bad'} style={{ fontSize: 17 }}>{pred.label}</b></div>}
            {!plan && <div class="bad">Путь недоступен</div>}
          </div>
          <Btn kind={action === 'attack' ? 'red' : 'green'} size="big" off={!plan || sumTroops(effTroops) <= 0} onClick={send}>
            <Icon name={action === 'attack' ? 'attack' : 'flag'} size={24} /> {actionLabel}
          </Btn>
        </div>
      </div>
    </Panel>
  );
}

// ———————————————————————————————————————— search
export function SearchPanel() {
  const g = useGame();
  const [kind, setKind] = useState<string>('camp');
  const [lvl, setLvl] = useState(Math.max(1, Math.min(25, g.s.stats.maxCampLevel + 1)));
  const opts = [
    { id: 'camp', label: 'Логово', icon: 'camp' }, { id: 'food', label: 'Поля', icon: 'food' }, { id: 'wood', label: 'Лес', icon: 'wood' },
    { id: 'stone', label: 'Камень', icon: 'stone' }, { id: 'gold', label: 'Золото', icon: 'gold' }, { id: 'ruin', label: 'Руины', icon: 'ruin' },
    { id: 'rift', label: 'Разлом', icon: 'rift' }, { id: 'lord', label: 'Лорд', icon: 'castle' }, { id: 'titan', label: 'Титан', icon: 'titan' },
  ];
  const find = () => {
    const isRes = ['food', 'wood', 'stone', 'gold'].includes(kind);
    const o = findWorldTarget((isRes ? 'node' : kind) as any, kind === 'camp' ? lvl : undefined, undefined, isRes ? kind : undefined);
    if (!o) { toast('Ничего не найдено в разведанных землях', true); return; }
    ui.close();
    ga.world.focusTile(o.x, o.y, 0.7);
    setTimeout(() => { ga.world.markTile(o.x, o.y, 0xffe08a); bus.emit('world-select', { obj: o.id }); }, 500);
  };
  return (
    <Panel title="Поиск" width={720} icon="map">
      <div class="col">
        <div class="row wrap" style={{ gap: 8 }}>
          {opts.map((op) => <button class={'card col center' + (kind === op.id ? ' hl' : '')} style={{ width: 70, padding: 6, gap: 2 }} onClick={() => { sfx('click'); setKind(op.id); }}><Icon name={op.icon} size={34} /><span style={{ fontSize: 12, fontWeight: 800 }}>{op.label}</span></button>)}
        </div>
        {kind === 'camp' && (
          <div class="card row"><b>Уровень</b><div class="grow"><Slider value={lvl} min={1} max={25} onInput={setLvl} /></div><b style={{ fontSize: 22, width: 40, textAlign: 'center', color: 'var(--gold2)' }}>{lvl}</b></div>
        )}
        <Btn size="big" onClick={find}><Icon name="map" size={22} /> Найти ближайшее</Btn>
      </div>
    </Panel>
  );
}

export { HERO_BY_ID, TYPE_INFO };
