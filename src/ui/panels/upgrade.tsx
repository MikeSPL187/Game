import { useState } from 'preact/hooks';
import { fmt, fmtTime } from '../../core/format';
import { BUILDINGS, buildingPerks } from '../../data/buildings';
import { PLOT_BY_ID } from '../../data/cityLayout';
import { buildingArt, tierOf } from '../../art/buildings';
import { svgUrl } from '../../art/svg';
import { FREE_SPEEDUP_MS } from '../../game/game';
import { Bar, Btn, Cost, Icon, Panel, Timer, act, ga, toast, ui, useGame } from '../core';
import { focusBuilding, plotFor } from '../nav';
import { sfx } from '../../audio/audio';
import { HelpBtn } from './alliance';

const artCache = new Map<string, string>();
export function buildingImg(type: any, level: number) {
  const f = ga.game.s.player.faction;
  const k = `${type}:${tierOf(Math.max(1, level))}:${f}`;
  let u = artCache.get(k);
  if (!u) { u = svgUrl(buildingArt(type, Math.max(1, level), f).svg); artCache.set(k, u); }
  return u;
}

export function UpgradePanel({ plot }: { plot: string }) {
  const g = useGame();
  const [, setN] = useState(0);
  const info = g.upgradeInfo(plot);
  const { b, def, cost, time, reqs, maxed } = info;
  const job = g.jobForPlot(plot);
  const next = b.level + 1;
  const cur = buildingPerks(b.type, b.level);
  const nxt = buildingPerks(b.type, next);
  const can = g.canUpgrade(plot);
  const lacking = !g.has(cost);
  const buyCost = g.resourceAetherCost(g.missing(cost));
  const locked = b.level === 0 && PLOT_BY_ID[plot].unlock > g.citadel;
  const title = b.level === 0 ? `Строительство: ${def.name}` : `${def.name} · ${b.level} ур.`;
  return (
    <Panel title={title} width={880} icon="hammer">
      <div class="row" style={{ alignItems: 'stretch', gap: 16 }}>
        <div class="col center" style={{ width: 280, flex: 'none', background: 'radial-gradient(circle at 50% 60%, rgba(232,184,74,.18), transparent 70%)', borderRadius: 14 }}>
          <img src={buildingImg(b.type, Math.max(1, b.level))} style={{ width: 260, maxHeight: 250, objectFit: 'contain', filter: 'drop-shadow(0 8px 12px rgba(0,0,0,.5))' }} />
          <div class="mute" style={{ fontSize: 13, textAlign: 'center', padding: '0 6px' }}>{def.desc}</div>
        </div>
        <div class="col grow" style={{ gap: 10 }}>
          {job ? (
            <div class="card hl col">
              <div class="row"><Icon name="hammer" size={28} /><b class="grow">Строится уровень {job.toLevel}</b><b><Timer end={job.end} /></b></div>
              <Bar value={Date.now() - job.start} max={job.end - job.start} />
              <div class="row">
                {job.end - Date.now() <= FREE_SPEEDUP_MS
                  ? <Btn kind="green" wide onClick={() => { if (act(g.freeFinish(job.id), 'complete')) ui.close(); }}>Бесплатно завершить</Btn>
                  : <Btn kind="blue" wide onClick={() => ui.open('speedup', { jobId: job.id })}><Icon name="hourglass" size={22} /> Ускорить</Btn>}
                <HelpBtn job={job} />
                <Btn kind="dark" size="small" onClick={() => { if (confirm('Отменить строительство? Вернётся 50% ресурсов.')) { act(g.cancelJob(job.id)); } }}>Отмена</Btn>
              </div>
            </div>
          ) : maxed ? (
            <div class="card hl center h" style={{ fontSize: 20, padding: 20 }}>Достигнут максимальный уровень</div>
          ) : (
            <>
              <div class="card">
                <div class="h" style={{ color: 'var(--gold2)', marginBottom: 6 }}>{b.level === 0 ? 'После постройки' : `Уровень ${b.level} → ${next}`}</div>
                {nxt.map((p, i) => (
                  <div class="statline"><span class="mute">{p.label}</span><span><b>{cur[i]?.value ?? '—'}</b> <span class="good">→ {p.value}</span></span></div>
                ))}
                {!nxt.length && <div class="mute">Улучшение повышает мощь владения.</div>}
              </div>
              {(reqs.length > 0 || locked) && (
                <div class="card col" style={{ gap: 4 }}>
                  <div class="h" style={{ color: 'var(--gold2)' }}>Требования</div>
                  {reqs.map((r) => (
                    <div class="row">
                      <Icon name={r.ok ? 'check' : 'lock'} size={20} />
                      <span class={'grow ' + (r.ok ? 'good' : 'bad')}>{r.text}</span>
                      {!r.ok && r.go && <Btn size="small" kind="dark" onClick={() => { focusBuilding(r.go!); setTimeout(() => ui.open('upgrade', { plot: r.go }), 450); }}>Перейти</Btn>}
                    </div>
                  ))}
                </div>
              )}
              <div class="card col" style={{ gap: 8 }}>
                <div class="row"><b class="grow">Стоимость</b><span class="row" style={{ gap: 4 }}><Icon name="clock" size={20} /> <b>{fmtTime(time)}</b>{time <= FREE_SPEEDUP_MS && <span class="good" style={{ fontSize: 12 }}>(бесплатно)</span>}</span></div>
                <Cost cost={cost} />
              </div>
              <div class="row" style={{ gap: 10 }}>
                {lacking && !locked && reqs.every((r) => r.ok) && (
                  <Btn kind="purple" onClick={() => { if (act(g.buyMissing(cost), 'coins')) setN((n) => n + 1); }}>
                    <Icon name="aether" size={20} /> {buyCost} · Восполнить
                  </Btn>
                )}
                <Btn kind="green" size="big" wide off={!can.ok} onClick={() => {
                  const r = g.upgrade(plot);
                  if (act(r, 'build')) { ui.close(); ga.city.refresh(); }
                }}>
                  <Icon name="arrowUp" size={24} /> {b.level === 0 ? 'Построить' : 'Улучшить'}
                </Btn>
              </div>
              {!can.ok && <div class="bad" style={{ fontSize: 13, textAlign: 'center' }}>{can.error}</div>}
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** Speed-up selector */
export function SpeedupPanel({ jobId }: { jobId: number }) {
  const g = useGame();
  const job = g.s.jobs.find((j) => j.id === jobId);
  if (!job) { setTimeout(() => ui.close(), 0); return null; }
  const rem = g.remaining(job);
  const items = ['speed1', 'speed5', 'speed15', 'speed60', 'speed180'];
  const ms: Record<string, number> = { speed1: 60e3, speed5: 300e3, speed15: 900e3, speed60: 3600e3, speed180: 10800e3 };
  const ac = g.aetherCost(rem);
  return (
    <Panel title="Ускорение" width={620} icon="hourglass">
      <div class="col">
        <div class="card row"><Icon name="clock" size={30} /><b class="grow">Осталось</b><b style={{ fontSize: 22 }}><Timer end={job.end} /></b></div>
        <Bar value={Date.now() - job.start} max={job.end - job.start} kind="blue" />
        <HelpBtn job={job} wide />
        {(job.kind === 'build' || job.kind === 'research') && rem <= FREE_SPEEDUP_MS && <Btn kind="green" wide onClick={() => { if (act(g.freeFinish(job.id), 'complete')) ui.close(); }}>Бесплатно завершить</Btn>}
        {items.map((id) => {
          const n = g.s.inventory[id] ?? 0;
          return (
            <div class="card row" style={{ opacity: n ? 1 : 0.5 }}>
              <Icon name="hourglass" size={36} />
              <div class="grow"><b>{fmtTime(ms[id])}</b><div class="mute" style={{ fontSize: 12 }}>В наличии: {n}</div></div>
              <Btn size="small" kind="blue" off={!n} onClick={() => { if (n && act(g.useSpeedItem(job.id, id, 1), 'levelup')) { if (!g.s.jobs.find((j) => j.id === jobId)) ui.close(); } }}>Применить</Btn>
              {n > 1 && <Btn size="small" kind="dark" onClick={() => {
                const need = Math.min(n, Math.ceil(g.remaining(job) / ms[id]));
                if (act(g.useSpeedItem(job.id, id, need), 'levelup')) { if (!g.s.jobs.find((j) => j.id === jobId)) ui.close(); }
              }}>×{Math.min(n, Math.ceil(rem / ms[id]))}</Btn>}
            </div>
          );
        })}
        <Btn kind="purple" wide onClick={() => { if (act(g.finishWithAether(job.id), 'complete')) ui.close(); else toast('Эфир добывается в заданиях, разломах и руинах', false); }}>
          <Icon name="aether" size={22} /> {ac} · Завершить мгновенно
        </Btn>
      </div>
    </Panel>
  );
}

export { plotFor, fmt, BUILDINGS, sfx };
