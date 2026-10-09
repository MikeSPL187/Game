import { useState } from 'preact/hooks';
import { fmtPct, fmtTime } from '../../core/format';
import { TECHS, TECH_BY_ID } from '../../data/research';
import { Bar, Btn, Cost, Icon, Panel, Timer, act, ui, useGame } from '../core';
import { goTo } from '../nav';

const W = 150, H = 96;

export function ResearchPanel() {
  const g = useGame();
  const [tree, setTree] = useState<'eco' | 'mil'>('eco');
  const list = TECHS.filter((t) => t.tree === tree);
  const job = g.jobsOf('research')[0];
  const [sel, setSel] = useState<string>(job?.tech ?? list[0].id);
  const st = g.researchState(TECH_BY_ID[sel]?.tree === tree ? sel : list[0].id);
  const t = st.t;
  const fmtEff = (v: number) => (t.effect === 'capacity' ? `+${Math.round(v)}` : fmtPct(v));
  if (g.level('academy') <= 0) {
    return <Panel title="Академия" width={600}><div class="col center" style={{ padding: 30 }}><div class="h">Постройте Академию, чтобы открыть исследования</div><Btn onClick={() => goTo({ kind: 'building', type: 'academy', action: 'upgrade' })}>Перейти</Btn></div></Panel>;
  }
  return (
    <Panel title="Академия · Исследования" width={1100} icon="book" tabs={[{ id: 'eco', label: 'Экономика' }, { id: 'mil', label: 'Военное дело' }]} tab={tree} onTab={(x) => { setTree(x as any); setSel(TECHS.find((q) => q.tree === x)!.id); }}>
      <div class="row" style={{ alignItems: 'stretch', gap: 14 }}>
        <div class="tree scroll" style={{ flex: 1, height: 2 * H + 40, overflowX: 'auto', overflowY: 'hidden', touchAction: 'pan-x' }}>
          <svg width={6 * W + 20} height={2 * H + 20} style={{ position: 'absolute', left: 0, top: 0 }}>
            {list.flatMap((n) => n.req.map((r) => {
              const p = TECH_BY_ID[r];
              const on = (g.s.research[r] ?? 0) > 0;
              return <line x1={p.col * W + 128 + 10} y1={p.row * H + 37 + 10} x2={n.col * W + 10} y2={n.row * H + 37 + 10} stroke={on ? '#e8b84a' : 'rgba(255,255,255,.18)'} stroke-width="3" />;
            }))}
          </svg>
          {list.map((n) => {
            const s = g.researchState(n.id);
            const cls = s.maxed ? 'max' : s.reqOk && s.acOk ? 'avail' : 'lock';
            const running = job?.tech === n.id;
            return (
              <div class={'tnode ' + cls + (n.id === t.id ? ' sel' : '')} style={{ left: n.col * W + 10, top: n.row * H + 10 }} onClick={() => setSel(n.id)}>
                <Icon name={n.icon} size={36} />
                <div class="col" style={{ gap: 2 }}>
                  <span class="nm">{n.name}</span>
                  <span class="lv">{s.lvl}/{n.max}</span>
                  {running && <span class="lv" style={{ color: '#9ad0ff' }}>⏳</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div class="card col" style={{ width: 320, flex: 'none', gap: 8 }}>
          <div class="row"><Icon name={t.icon} size={44} /><div><div class="h" style={{ fontSize: 19, color: 'var(--gold2)' }}>{t.name}</div><div class="mute" style={{ fontSize: 13 }}>{t.desc}</div></div></div>
          <div class="statline"><span class="mute">Уровень</span><b>{st.lvl} / {t.max}</b></div>
          <div class="statline"><span class="mute">Эффект</span><b>{fmtEff(t.per * st.lvl)} {!st.maxed && <span class="good">→ {fmtEff(t.per * (st.lvl + 1))}</span>}</b></div>
          {!st.acOk && <div class="bad" style={{ fontSize: 13 }}>Требуется Академия {t.academy} ур.</div>}
          {!st.reqOk && <div class="bad" style={{ fontSize: 13 }}>Требуется: {t.req.map((r) => TECH_BY_ID[r].name).join(', ')}</div>}
          {job ? (
            <div class="col" style={{ gap: 6 }}>
              <div class="row"><b class="grow">{TECH_BY_ID[job.tech!].name} → {job.toLevel}</b><b><Timer end={job.end} /></b></div>
              <Bar value={Date.now() - job.start} max={job.end - job.start} kind="blue" />
              {job.end - Date.now() <= 180000 ? <Btn kind="green" onClick={() => act(g.freeFinish(job.id), 'complete')}>Бесплатно</Btn> : <Btn kind="blue" onClick={() => ui.open('speedup', { jobId: job.id })}>Ускорить</Btn>}
            </div>
          ) : !st.maxed && (
            <>
              <div class="row"><b class="grow">Стоимость</b><Icon name="clock" size={18} /><b>{fmtTime(st.time)}</b></div>
              <Cost cost={st.cost} />
              <Btn kind="green" size="big" off={!st.reqOk || !st.acOk || !g.has(st.cost)} onClick={() => act(g.research(t.id), 'build')}><Icon name="book" size={22} /> Изучить</Btn>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
