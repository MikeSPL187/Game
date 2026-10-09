import { useState } from 'preact/hooks';
import { fmt } from '../../core/format';
import { ACHIEVEMENTS, ACHIEVEMENT_FAMILIES, MAX_ACHIEVEMENT_POINTS, type AchievementDef } from '../../data/achievements';
import { Bar, Btn, Icon, Panel, RewardList, act, useGame } from '../core';
import { showReward } from './misc';

const TIER_COLOR = ['#c8a070', '#c8d0dc', '#ffcf4a', '#7fe3ff', '#ff8ad8'];

/** One card per family: shows the current tier (first unclaimed), with pips for all tiers. */
export function AchievementsPanel() {
  const g = useGame();
  const [filter, setFilter] = useState<'all' | 'ready' | 'done'>('all');
  const pts = g.achievementPoints();
  const ready = g.achievementsReady();
  const claimedN = g.s.achievements.claimed.length;
  const cards = ACHIEVEMENT_FAMILIES.map((f) => {
    const tiers = ACHIEVEMENTS.filter((a) => a.family === f.id);
    const cur = tiers.find((a) => g.achievementState(a) !== 'claimed');
    return { f, tiers, cur };
  }).filter(({ tiers, cur }) => {
    if (filter === 'ready') return cur && g.achievementState(cur) === 'ready';
    if (filter === 'done') return !cur || tiers.some((a) => g.achievementState(a) === 'claimed');
    return true;
  });
  // ready first, then by completion ratio
  const ratio = (c: (typeof cards)[0]) => (c.cur ? Math.min(1, g.achievementValue(c.cur) / c.cur.target) : 2);
  cards.sort((a, b) => Number(!!b.cur && g.achievementState(b.cur) === 'ready') - Number(!!a.cur && g.achievementState(a.cur) === 'ready') || ratio(b) - ratio(a));
  return (
    <Panel title="Достижения" width={1040} icon="trophy"
      tabs={[{ id: 'all', label: 'Все' }, { id: 'ready', label: 'Готовы', badge: ready > 0 }, { id: 'done', label: 'Полученные' }]}
      tab={filter} onTab={(t) => setFilter(t as typeof filter)}>
      <div class="col" style={{ gap: 10 }}>
        <div class="card row" style={{ gap: 14 }}>
          <Icon name="trophy" size={48} />
          <div class="col grow" style={{ gap: 4 }}>
            <div class="row"><b class="grow">Очки славы</b><b style={{ fontSize: 22, color: 'var(--gold2)' }}>{fmt(pts)}</b><span class="mute">&nbsp;/ {fmt(MAX_ACHIEVEMENT_POINTS)}</span></div>
            <Bar value={pts} max={MAX_ACHIEVEMENT_POINTS} kind="gold" h={10} />
          </div>
          <div class="col center" style={{ width: 120 }}><b style={{ fontSize: 22 }}>{claimedN} / {ACHIEVEMENTS.length}</b><span class="mute" style={{ fontSize: 12 }}>получено</span></div>
        </div>
        <div class="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {cards.map(({ f, tiers, cur }) => <Card key={f.id} name={f.name} icon={f.icon} tiers={tiers} cur={cur} />)}
          {!cards.length && <div class="mute" style={{ padding: 20 }}>{filter === 'ready' ? 'Нет наград, ожидающих получения.' : 'Пока ничего не получено.'}</div>}
        </div>
      </div>
    </Panel>
  );
}

function Card({ name, icon, tiers, cur }: { name: string; icon: string; tiers: AchievementDef[]; cur?: AchievementDef }) {
  const g = useGame();
  const shown = cur ?? tiers[tiers.length - 1];
  const st = cur ? g.achievementState(cur) : 'claimed';
  const v = Math.min(g.achievementValue(shown), shown.target);
  const col = TIER_COLOR[shown.tier];
  return (
    <div class="card col" style={{ width: 'calc(33.333% - 6px)', gap: 6, boxShadow: st === 'ready' ? `inset 0 0 0 2px var(--gold2), 0 0 14px rgba(255,200,80,.25)` : undefined, opacity: st === 'claimed' ? 0.75 : 1 }}>
      <div class="row" style={{ gap: 10 }}>
        <div style={{ position: 'relative', width: 50, height: 50, flex: 'none', borderRadius: 25, background: `radial-gradient(circle at 50% 35%, ${col}55, rgba(0,0,0,.4))`, boxShadow: `0 0 0 2px ${col}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={34} />
        </div>
        <div class="grow col" style={{ gap: 1, minWidth: 0 }}>
          <b style={{ fontSize: 14, color: col }}>{cur ? shown.name : name}</b>
          <span class="mute" style={{ fontSize: 12 }}>{shown.desc}</span>
        </div>
        <span class="mute" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>+{shown.points}</span>
      </div>
      <div class="row" style={{ gap: 4 }}>
        {tiers.map((t) => {
          const s = g.achievementState(t);
          return <div style={{ flex: 1, height: 5, borderRadius: 3, background: s === 'claimed' ? TIER_COLOR[t.tier] : s === 'ready' ? 'var(--gold2)' : 'rgba(255,255,255,.12)' }} />;
        })}
      </div>
      {st === 'claimed' ? (
        <div class="good center" style={{ fontSize: 13, padding: '4px 0' }}><Icon name="check" size={18} /> Все ступени пройдены</div>
      ) : (
        <>
          <Bar value={v} max={shown.target} kind={st === 'ready' ? 'gold' : 'blue'} h={14} label={`${fmt(v)} / ${fmt(shown.target)}`} />
          <div class="row" style={{ gap: 6 }}>
            <div class="grow" style={{ transform: 'scale(.82)', transformOrigin: 'left center' }}><RewardList r={shown.reward} compact /></div>
            <Btn size="small" kind="green" off={st !== 'ready'} class={st === 'ready' ? 'pulse' : ''} onClick={() => {
              const r = g.claimAchievement(shown.id);
              if (act(r, 'collect') && r.ok && r.reward) showReward(r.reward, shown.name);
            }}>Забрать</Btn>
          </div>
        </>
      )}
    </div>
  );
}
