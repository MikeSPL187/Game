import { useEffect, useState } from 'preact/hooks';
import { fmt } from '../../core/format';
import type { ArmySummary, Report } from '../../core/types';
import { portraitUrl } from '../../art/portraits';
import { HERO_BY_ID } from '../../data/heroes';
import { TITAN_BY_ID } from '../../data/world';
import { Bar, Btn, Icon, Panel, RewardList, ga, ui, useGame } from '../core';
import { sfx } from '../../audio/audio';
import { BattleReplay } from '../battle';

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

function ArmyCard({ a, side, now }: { a: ArmySummary; side: 'me' | 'foe'; now?: number }) {
  const img = a.kind === 'titan' && a.portrait ? null : a.heroes[0] ? portraitUrl(a.heroes[0].id) : null;
  const cur = now ?? a.survived;
  return (
    <div class={'army col grow ' + side} style={{ gap: 4 }}>
      <div class="row" style={{ gap: 8 }}>
        {img ? <img src={img} style={{ width: 44, height: 52, objectFit: 'cover', objectPosition: '50% 20%', borderRadius: 8, boxShadow: '0 0 0 2px var(--gold3)' }} /> : <Icon name={a.kind === 'titan' ? 'titan' : a.kind === 'monster' ? 'camp' : 'castle'} size={46} />}
        <div class="grow col" style={{ gap: 2, minWidth: 0 }}>
          <div class="row" style={{ gap: 6 }}>
            <b class="grow" style={{ fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.kind === 'titan' && a.portrait ? TITAN_BY_ID[a.portrait]?.name ?? a.name : a.name}</b>
            <span class="row" style={{ gap: 3, fontSize: 12 }}><Icon name="power" size={15} />{fmt(a.power)}</span>
          </div>
          <div class="mute" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.heroes.map((h) => `${HERO_BY_ID[h.id]?.name ?? h.id} ${h.level}`).join(' · ') || '—'}</div>
          <Bar value={cur} max={Math.max(1, a.start)} kind={side === 'me' ? 'blue' : 'red'} label={`${fmt(cur)} / ${fmt(a.start)}`} h={12} />
        </div>
      </div>
      <div class="row" style={{ gap: 12, fontSize: 12, justifyContent: 'space-between' }}>
        <span><span class="mute">Погибло </span><b class="bad">{fmt(a.lost)}</b></span>
        {a.wounded > 0 && <span><span class="mute">Ранено </span><b class="warn">{fmt(a.wounded)}</b></span>}
        <span><span class="mute">Уцелело </span><b class="good">{fmt(a.survived)}</b></span>
      </div>
    </div>
  );
}

export function ReportView({ r, onBack }: { r: Report; onBack: () => void }) {
  const rounds = r.rounds ?? [];
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(!rounds.length);
  const [speed, setSpeed] = useState(1);
  const [skip, setSkip] = useState(false);
  useEffect(() => { setRound(0); setDone(!rounds.length); setSkip(false); }, [r.id]);
  const cur = round > 0 ? rounds[Math.min(round, rounds.length) - 1] : null;
  const myIsAttacker = r.kind !== 'defense';
  const end = () => { setDone(true); sfx(r.win ? 'victory' : 'defeat'); };
  return (
    <Panel title={r.title} width={980} icon={r.kind === 'defense' ? 'tower' : 'attack'} onClose={onBack}>
      {r.attacker && r.defender ? (
        <div class="col" style={{ gap: 8 }}>
          {rounds.length > 0 && (
            <div style={{ position: 'relative' }}>
              <BattleReplay r={r} myIsAttacker={myIsAttacker} speed={speed} skip={skip} onRound={setRound} onEnd={end} />
              <div class={'ribbon ' + (r.win ? 'win' : 'lose')} style={{ position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)', margin: 0, opacity: done ? 1 : 0.85, fontSize: done ? undefined : 16 }}>
                {done ? (r.win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ') : `Раунд ${Math.max(1, round)} / ${rounds.length}`}
              </div>
              {!done && (
                <div class="row" style={{ position: 'absolute', right: 10, bottom: 10, gap: 6 }}>
                  <Btn size="small" kind="dark" onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1)}>×{speed}</Btn>
                  <Btn size="small" kind="dark" onClick={() => setSkip(true)}>Пропустить</Btn>
                </div>
              )}
            </div>
          )}
          {!rounds.length && <div class={'ribbon ' + (r.win ? 'win' : 'lose')}>{r.win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}</div>}
          <div class="row" style={{ gap: 10, alignItems: 'stretch' }}>
            <ArmyCard a={r.attacker} side={myIsAttacker ? 'me' : 'foe'} now={done ? undefined : cur ? cur.a : r.attacker.start} />
            <ArmyCard a={r.defender} side={myIsAttacker ? 'foe' : 'me'} now={done ? undefined : cur ? cur.d : r.defender.start} />
          </div>
          {r.text && <div class="card" style={{ fontSize: 13 }}>{r.text}</div>}
          {r.rewards && done && <div class="row center" style={{ gap: 10 }}><b class="h" style={{ color: 'var(--gold2)' }}>Трофеи</b><RewardList r={r.rewards} compact /></div>}
          <div class="row" style={{ justifyContent: 'center' }}>
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
