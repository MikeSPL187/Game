import { useEffect, useState } from 'preact/hooks';
import { fmt } from '../../core/format';
import type { ArmySummary, Report } from '../../core/types';
import { portraitUrl } from '../../art/portraits';
import { HERO_BY_ID } from '../../data/heroes';
import { TITAN_BY_ID } from '../../data/world';
import { Bar, Btn, Icon, Panel, RewardList, ga, ui, useGame } from '../core';
import { sfx } from '../../audio/audio';

export function ReportsPanel({ id }: { id?: number }) {
  const g = useGame();
  const [sel, setSel] = useState<number | null>(id ?? null);
  const rep = g.s.reports.find((r) => r.id === sel);
  if (rep) { rep.read = true; return <ReportView r={rep} onBack={() => setSel(null)} />; }
  return (
    <Panel title="Отчёты" width={860} icon="mail">
      <div class="row" style={{ justifyContent: 'flex-end', marginBottom: 6 }}><Btn size="small" kind="dark" onClick={() => { g.s.reports.forEach((r) => (r.read = true)); sfx('page'); ui.emit(); }}>Прочитать все</Btn></div>
      <div class="col" style={{ gap: 2 }}>
        {g.s.reports.map((r) => (
          <div class={'rep' + (r.read ? '' : ' unread')} onClick={() => { sfx('page'); setSel(r.id); }}>
            <Icon name={r.kind === 'battle' ? (r.win ? 'trophy' : 'skull') : r.kind === 'defense' ? 'tower' : r.kind === 'explore' ? 'ruin' : r.kind === 'gather' ? 'pick' : 'hammer'} size={32} />
            <div class="grow"><b class={r.win === false ? 'bad' : r.win ? '' : ''}>{r.title}</b><div class="mute" style={{ fontSize: 12 }}>{new Date(r.time).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</div></div>
            {r.rewards && <RewardList r={{ res: r.rewards.res }} compact />}
          </div>
        ))}
        {!g.s.reports.length && <div class="mute" style={{ padding: 20, textAlign: 'center' }}>Пока нет донесений</div>}
      </div>
    </Panel>
  );
}

function ArmyCard({ a, side }: { a: ArmySummary; side: 'me' | 'foe' }) {
  const img = a.kind === 'titan' && a.portrait ? null : a.heroes[0] ? portraitUrl(a.heroes[0].id) : null;
  return (
    <div class={'army col ' + side} style={{ gap: 4 }}>
      <div class="row">
        {img ? <img src={img} style={{ width: 54, height: 66, objectFit: 'cover', borderRadius: 8, boxShadow: '0 0 0 2px var(--gold3)' }} /> : <Icon name={a.kind === 'titan' ? 'titan' : a.kind === 'monster' ? 'camp' : 'castle'} size={54} />}
        <div class="grow">
          <b style={{ fontSize: 16 }}>{a.kind === 'titan' && a.portrait ? TITAN_BY_ID[a.portrait]?.name ?? a.name : a.name}</b>
          <div class="mute" style={{ fontSize: 12 }}>{a.heroes.map((h) => `${HERO_BY_ID[h.id]?.name ?? h.id} ${h.level}`).join(' · ') || '—'}</div>
          <div class="row" style={{ gap: 4, fontSize: 13 }}><Icon name="power" size={16} />{fmt(a.power)}</div>
        </div>
      </div>
      <div class="statline"><span class="mute">Войск</span><b>{fmt(a.start)}</b></div>
      <div class="statline"><span class="mute">Погибло</span><b class="bad">{fmt(a.lost)}</b></div>
      {a.wounded > 0 && <div class="statline"><span class="mute">Ранено</span><b class="warn">{fmt(a.wounded)}</b></div>}
      <div class="statline"><span class="mute">Уцелело</span><b class="good">{fmt(a.survived)}</b></div>
    </div>
  );
}

export function ReportView({ r, onBack }: { r: Report; onBack: () => void }) {
  const [round, setRound] = useState(0);
  const rounds = r.rounds ?? [];
  useEffect(() => {
    if (!rounds.length) return;
    setRound(0);
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (i > rounds.length) { clearInterval(t); sfx(r.win ? 'victory' : 'defeat'); return; }
      setRound(i);
      const ev = rounds[i - 1]?.events ?? [];
      sfx(ev.length ? 'levelup' : 'battle');
    }, 280);
    return () => clearInterval(t);
  }, [r.id]);
  const cur = round > 0 ? rounds[Math.min(round, rounds.length) - 1] : null;
  const aStart = r.attacker?.start ?? 1, dStart = r.defender?.start ?? 1;
  const aNow = cur ? cur.a : aStart, dNow = cur ? cur.d : dStart;
  const events = rounds.slice(0, round).flatMap((x, i) => x.events.map((e) => ({ e, i: i + 1 }))).slice(-4);
  const myIsAttacker = r.kind !== 'defense';
  return (
    <Panel title={r.title} width={980} icon={r.kind === 'defense' ? 'tower' : 'attack'} onClose={onBack}>
      {r.attacker && r.defender ? (
        <div class="col" style={{ gap: 10 }}>
          <div class={'ribbon ' + (r.win ? 'win' : 'lose')}>{round >= rounds.length ? (r.win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ') : `Раунд ${round}`}</div>
          <div class="vs">
            <ArmyCard a={r.attacker} side={myIsAttacker ? 'me' : 'foe'} />
            <div class="col center" style={{ width: 160 }}>
              <Icon name="attack" size={54} />
              <div style={{ width: '100%' }}><Bar value={aNow} max={aStart} kind={myIsAttacker ? 'blue' : 'red'} label={fmt(aNow)} /></div>
              <div style={{ width: '100%' }}><Bar value={dNow} max={dStart} kind={myIsAttacker ? 'red' : 'blue'} label={fmt(dNow)} /></div>
              <div class="col" style={{ gap: 2, minHeight: 64, fontSize: 11, textAlign: 'center' }}>
                {events.map(({ e }) => {
                  const [side, kind, id, name] = e.split('|');
                  const who = kind === 'titan' ? TITAN_BY_ID[id]?.name : HERO_BY_ID[id]?.name;
                  return <span style={{ color: side === 'A' ? (myIsAttacker ? '#9ad0ff' : '#ff9a8a') : (myIsAttacker ? '#ff9a8a' : '#9ad0ff'), animation: 'popin .3s' }}>{who}: {name}</span>;
                })}
              </div>
            </div>
            <ArmyCard a={r.defender} side={myIsAttacker ? 'foe' : 'me'} />
          </div>
          {r.text && <div class="card" style={{ fontSize: 14 }}>{r.text}</div>}
          {r.rewards && (round >= rounds.length) && <div class="col center"><div class="h" style={{ color: 'var(--gold2)' }}>Трофеи</div><RewardList r={r.rewards} /></div>}
          <div class="row" style={{ justifyContent: 'center' }}>
            {round < rounds.length && <Btn kind="dark" onClick={() => setRound(rounds.length)}>Пропустить</Btn>}
            {r.pos && <Btn kind="dark" onClick={() => { ui.closeAll(); ga.setView('world'); ga.world.focusTile(r.pos!.x, r.pos!.y); }}>На карту</Btn>}
            <Btn onClick={onBack}>Закрыть</Btn>
          </div>
        </div>
      ) : (
        <div class="col">
          {r.text && <div class="card" style={{ fontSize: 15 }}>{r.text}</div>}
          {r.rewards && <RewardList r={r.rewards} />}
          <Btn onClick={onBack}>Закрыть</Btn>
        </div>
      )}
    </Panel>
  );
}
