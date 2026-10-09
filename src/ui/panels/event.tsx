import { fmt } from '../../core/format';
import { EVENTS } from '../../data/events';
import { Bar, Icon, Panel, RewardList, Timer, act, useGame } from '../core';
import { showReward } from './misc';

export function EventPanel() {
  const g = useGame();
  const cur = g.currentEvent();
  const ev = EVENTS[cur.type];
  const pts = Math.floor(g.s.event.points);
  const ranking = g.eventRanking();
  const myRank = ranking.findIndex((r) => r.me) + 1;
  // evenly spaced chests; the bar fills piecewise between milestone thresholds
  const n = ev.milestones.length;
  let progress = 0;
  for (let i = 0; i < n; i++) {
    const lo = i === 0 ? 0 : ev.milestones[i - 1].points, hi = ev.milestones[i].points;
    if (pts >= hi) progress = (i + 1) / n;
    else { progress += Math.max(0, (pts - lo) / (hi - lo)) / n; break; }
  }
  return (
    <Panel title={ev.name} width={1000} icon={ev.icon}>
      <div class="row" style={{ alignItems: 'stretch', gap: 12 }}>
        <div class="col grow" style={{ gap: 10 }}>
          <div class="card row" style={{ gap: 12, boxShadow: `inset 4px 0 0 ${ev.color}` }}>
            <Icon name={ev.icon} size={56} />
            <div class="grow">
              <div style={{ fontSize: 14 }}>{ev.desc}</div>
              <div class="mute" style={{ fontSize: 12, marginTop: 4 }}>До конца события: <b style={{ color: 'var(--gold2)' }}><Timer end={cur.end} /></b> · затем начнётся следующее</div>
            </div>
          </div>
          <div class="card col" style={{ gap: 6 }}>
            <div class="row"><b class="grow">Очки события</b><b style={{ fontSize: 22, color: ev.color }}>{fmt(pts)}</b></div>
            <div style={{ position: 'relative', height: 74 }}>
              <div style={{ position: 'absolute', left: 0, right: 30, top: 30 }}><Bar value={progress} max={1} kind="purple" h={12} /></div>
              {ev.milestones.map((m, i) => {
                const got = g.s.event.claimed.includes(i);
                const ready = !got && pts >= m.points;
                return (
                  <button class={ready ? 'pulse' : ''} style={{ position: 'absolute', left: `calc(${((i + 1) / n) * 100}% - 46px)`, top: 0, width: 56, textAlign: 'center', opacity: got ? 0.4 : 1, borderRadius: 12 }}
                    onClick={() => { if (ready && act(g.claimEventMilestone(i), 'collect')) showReward(m.reward, 'Награда события'); }}>
                    <Icon name={i >= 3 ? 'chest_gold' : 'chest'} size={46} />
                    <div style={{ fontSize: 11, fontWeight: 800 }}>{fmt(m.points)}</div>
                  </button>
                );
              })}
            </div>
            <div class="mute" style={{ fontSize: 12 }}>Неполученные награды выдаются автоматически, когда событие заканчивается.</div>
          </div>
          <div class="card col" style={{ gap: 4 }}>
            <b>Как заработать очки</b>
            {ev.how.map((h) => <div class="row" style={{ fontSize: 13 }}><Icon name="check" size={18} />{h}</div>)}
          </div>
        </div>
        <div class="card col" style={{ width: 330, flex: 'none', gap: 4 }}>
          <div class="row"><Icon name="trophy" size={30} /><b class="grow">Рейтинг лордов</b><span class="mute" style={{ fontSize: 12 }}>вы: {myRank} место</span></div>
          {ranking.map((r, i) => (
            <div class="row" style={{ padding: '4px 6px', borderRadius: 8, background: r.me ? 'rgba(232,184,74,.15)' : undefined, boxShadow: r.me ? 'inset 0 0 0 1px var(--gold3)' : undefined }}>
              <b style={{ width: 22, color: i < 3 ? 'var(--gold2)' : 'var(--mute)' }}>{i + 1}</b>
              <span class="grow" style={{ color: r.color, fontWeight: r.me ? 800 : 600, fontSize: 13 }}>{r.name}</span>
              <b style={{ fontSize: 13 }}>{fmt(r.score)}</b>
            </div>
          ))}
          <div class="sep" />
          <b style={{ fontSize: 13 }}>Награды за место</b>
          {ev.rankRewards.map((r, i) => <div class="row" style={{ fontSize: 12 }}><b style={{ width: 22, color: 'var(--gold2)' }}>{i + 1}</b><div style={{ transform: 'scale(.85)', transformOrigin: 'left center' }}><RewardList r={r} compact /></div></div>)}
          {cur.type === 'night' && <div class="mute" style={{ fontSize: 12 }}>Волн отражено подряд: <b>{g.s.event.wave}</b></div>}
        </div>
      </div>
    </Panel>
  );
}
