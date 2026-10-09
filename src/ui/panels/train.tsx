import { useState } from 'preact/hooks';
import { fmt, fmtTime } from '../../core/format';
import type { BuildingId, TroopKey, TroopType } from '../../core/types';
import { maxTier, trainBatch, BUILDINGS } from '../../data/buildings';
import { TIERS, TROOPS, TYPE_INFO, TROOP_TYPES } from '../../data/troops';
import { mulBag } from '../../game/game';
import { Bar, Btn, Cost, Icon, Panel, Slider, Timer, act, ui, useGame } from '../core';
import { goTo } from '../nav';

function typeOf(b: BuildingId | TroopType): TroopType {
  if ((TROOP_TYPES as string[]).includes(b)) return b as TroopType;
  return TROOP_TYPES.find((t) => TYPE_INFO[t].building === b) ?? 'inf';
}

export function TrainPanel({ type }: { type: BuildingId | TroopType }) {
  const g = useGame();
  const [tt, setTT] = useState<TroopType>(typeOf(type));
  const info = TYPE_INFO[tt];
  const bLevel = g.level(info.building);
  const mt = maxTier(g.citadel);
  const [tier, setTier] = useState<number>(Math.min(mt, 4));
  const key = `${tt}${tier}` as TroopKey;
  const d = TROOPS[key];
  const max = g.maxTrainable(key);
  const batch = trainBatch(bLevel);
  const [count, setCount] = useState(Math.min(batch, Math.max(1, max)));
  const c = Math.max(0, Math.min(count, batch));
  const job = g.s.jobs.find((j) => j.kind === 'train' && j.plot === info.building);
  const cost = mulBag(d.cost, c);
  return (
    <Panel title={`${BUILDINGS[info.building].name} · ${info.name}`} width={940} icon={tt}
      tabs={TROOP_TYPES.map((t) => ({ id: t, label: TYPE_INFO[t].name }))} tab={tt} onTab={(t) => { setTT(t as TroopType); }}>
      {bLevel <= 0 ? (
        <div class="col center" style={{ padding: 30 }}>
          <div class="h" style={{ fontSize: 20 }}>Требуется: {BUILDINGS[info.building].name}</div>
          <Btn onClick={() => goTo({ kind: 'building', type: info.building, action: 'upgrade' })}>Построить</Btn>
        </div>
      ) : (
        <div class="col" style={{ gap: 12 }}>
          <div class="row" style={{ gap: 10 }}>
            {TIERS.map((t) => {
              const k = `${tt}${t}` as TroopKey;
              const lock = t > mt;
              return (
                <div class={'card col center' + (t === tier ? ' hl' : '')} style={{ flex: 1, cursor: 'pointer', opacity: lock ? 0.45 : 1, gap: 2 }} onClick={() => { if (!lock) { setTier(t); setCount(Math.min(trainBatch(bLevel), Math.max(1, g.maxTrainable(k)))); } }}>
                  <div class="row"><Icon name={tt} size={36} /><b style={{ fontSize: 20, color: 'var(--gold2)' }}>T{t}</b></div>
                  <b style={{ fontSize: 13 }}>{TROOPS[k].name}</b>
                  <span class="mute" style={{ fontSize: 12 }}>{lock ? `Цитадель ${[0, 1, 5, 11, 18][t]}` : `В армии: ${fmt(Math.floor(g.s.troops[k] ?? 0))}`}</span>
                </div>
              );
            })}
          </div>
          <div class="row" style={{ alignItems: 'stretch', gap: 12 }}>
            <div class="card col" style={{ width: 300, gap: 4 }}>
              <div class="h" style={{ color: 'var(--gold2)' }}>{d.name}</div>
              <div class="statline"><span class="mute">Атака</span><b>{d.atk}</b></div>
              <div class="statline"><span class="mute">Защита</span><b>{d.def}</b></div>
              <div class="statline"><span class="mute">Здоровье</span><b>{d.hp}</b></div>
              <div class="statline"><span class="mute">Скорость</span><b>{d.speed}</b></div>
              <div class="statline"><span class="mute">Грузоподъёмность</span><b>{d.load}</b></div>
              <div class="statline"><span class="mute">Мощь</span><b>{d.power}</b></div>
              <div class="mute" style={{ fontSize: 12, marginTop: 4 }}>{info.desc}</div>
            </div>
            <div class="col grow" style={{ gap: 10 }}>
              {job ? (
                <div class="card hl col">
                  <div class="row"><Icon name={TROOPS[job.troop!].type} size={30} /><b class="grow">Обучение: {TROOPS[job.troop!].name} ×{job.count}</b><b><Timer end={job.end} /></b></div>
                  <Bar value={Date.now() - job.start} max={job.end - job.start} kind="gold" />
                  <Btn kind="blue" onClick={() => ui.open('speedup', { jobId: job.id })}><Icon name="hourglass" size={20} /> Ускорить</Btn>
                </div>
              ) : (
                <>
                  <div class="card col">
                    <div class="row"><b class="grow">Количество</b><b style={{ fontSize: 22, color: 'var(--gold2)' }}>{c}</b><span class="mute">/ {batch}</span></div>
                    <div class="row">
                      <Btn kind="dark" size="small" onClick={() => setCount(Math.max(1, c - 10))}>−</Btn>
                      <div class="grow"><Slider value={c} max={batch} min={1} onInput={setCount} /></div>
                      <Btn kind="dark" size="small" onClick={() => setCount(Math.min(batch, c + 10))}>+</Btn>
                      <Btn kind="dark" size="small" onClick={() => setCount(Math.max(1, Math.min(batch, max)))}>Макс</Btn>
                    </div>
                  </div>
                  <div class="card col">
                    <div class="row"><b class="grow">Стоимость</b><Icon name="clock" size={20} /><b>{fmtTime(g.trainTime(key, c, info.building))}</b></div>
                    <Cost cost={cost} />
                  </div>
                  <Btn kind="green" size="big" off={!g.has(cost) || c <= 0} onClick={() => { act(g.train(key, c), 'build'); }}>
                    <Icon name={tt} size={26} /> Обучить {c}
                  </Btn>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
