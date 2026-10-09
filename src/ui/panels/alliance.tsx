import { useState } from 'preact/hooks';
import { portraitUrl } from '../../art/portraits';
import type { Job } from '../../core/types';
import { fmt } from '../../core/format';
import {
  ALLIANCE_NAME, ALLIANCE_SHOP, ALLIANCE_TECHS, DONATION_CONTRIB, DONATION_PROGRESS, HELP_CONTRIB, HELP_DAILY_CAP, HELPS_PER_JOB, MEMBERS,
  allianceLevelXp, donationCost, techNeed,
} from '../../data/alliance';
import { ITEM_BY_ID } from '../../data/items';
import { BUILDINGS } from '../../data/buildings';
import { TECH_BY_ID } from '../../data/research';
import { Bar, Btn, Cost, Icon, Panel, act, game, toast, useGame } from '../core';
import { showReward } from './misc';

const MEMBER_BY_ID = Object.fromEntries(MEMBERS.map((m) => [m.id, m]));

/** "Ask the alliance" button for build / research jobs. */
export function HelpBtn({ job, wide }: { job: Job; wide?: boolean }) {
  const g = useGame();
  if (!g.allianceOn() || (job.kind !== 'build' && job.kind !== 'research')) return null;
  const max = HELPS_PER_JOB(g.level('embassy'));
  if (job.helpReq) {
    return <div class="row mute" style={{ fontSize: 12, gap: 4, flex: wide ? 1 : 'none', justifyContent: 'center' }}><Icon name="banner" size={18} />Помощь союза: <b style={{ color: 'var(--gold2)' }}>{job.helps ?? 0}/{max}</b></div>;
  }
  return <Btn kind="gold" size={wide ? undefined : 'small'} wide={wide} class="pulse" onClick={() => act(g.requestHelp(job.id), 'click')}><Icon name="banner" size={20} /> Помощь</Btn>;
}

const fmtPct = (v: number) => `+${Math.round(v * 1000) / 10}%`;

export function AlliancePanel({ tab: initial }: { tab?: string }) {
  const g = useGame();
  const [tab, setTab] = useState(initial ?? 'home');
  const a = g.s.alliance;
  const on = g.allianceOn();
  const tabs = [
    { id: 'home', label: 'Союз', badge: a.gifts.length > 0 },
    { id: 'help', label: 'Помощь', badge: a.requests.length > 0 && a.helpsToday < HELP_DAILY_CAP },
    { id: 'tech', label: 'Технологии' },
    { id: 'shop', label: 'Лавка' },
  ];
  if (!on) {
    return (
      <Panel title={ALLIANCE_NAME} width={720} icon="banner">
        <div class="card col center" style={{ gap: 10, padding: 24, textAlign: 'center' }}>
          <Icon name="banner" size={72} />
          <div class="h" style={{ fontSize: 20 }}>Союз ждёт вашего посла</div>
          <div class="mute">Постройте Посольство (Цитадель 3), чтобы вступить в союз «{ALLIANCE_NAME}»: союзники ускоряют ваше строительство, присылают подарки и выходят с вами против титанов.</div>
        </div>
      </Panel>
    );
  }
  return (
    <Panel title={ALLIANCE_NAME} width={1000} icon="banner" tabs={tabs} tab={tab} onTab={setTab}>
      {tab === 'home' && <Home />}
      {tab === 'help' && <Help />}
      {tab === 'tech' && <Techs />}
      {tab === 'shop' && <Shop />}
    </Panel>
  );
}

function Home() {
  const g = useGame();
  const a = g.s.alliance;
  const need = allianceLevelXp(a.level);
  const support = g.allianceSupport();
  return (
    <div class="row" style={{ alignItems: 'stretch', gap: 12 }}>
      <div class="col grow" style={{ gap: 10 }}>
        <div class="card row" style={{ gap: 14, boxShadow: 'inset 4px 0 0 var(--gold2)' }}>
          <Icon name="banner" size={64} />
          <div class="grow col" style={{ gap: 4 }}>
            <div class="row"><b class="h grow" style={{ fontSize: 20 }}>{ALLIANCE_NAME}</b><span class="mute">Уровень</span><b style={{ fontSize: 22, color: 'var(--gold2)' }}>{a.level}</b></div>
            <Bar value={a.xp} max={need} kind="gold" label={`${fmt(a.xp)} / ${fmt(need)}`} />
            <div class="mute" style={{ fontSize: 12 }}>Опыт союза растёт, когда вы помогаете, жертвуете и принимаете подарки.</div>
          </div>
        </div>
        <div class="row" style={{ gap: 10 }}>
          <div class="card col grow" style={{ gap: 2 }}><span class="mute" style={{ fontSize: 12 }}>Очки вклада</span><b style={{ fontSize: 22, color: 'var(--gold2)' }}>{fmt(a.contribution)}</b></div>
          <div class="card col grow" style={{ gap: 2 }}><span class="mute" style={{ fontSize: 12 }}>Помощь сегодня</span><b style={{ fontSize: 22 }}>{a.helpsToday} / {HELP_DAILY_CAP}</b></div>
          <div class="card col grow" style={{ gap: 2 }}><span class="mute" style={{ fontSize: 12 }}>Поддержка в бою</span><b style={{ fontSize: 22, color: 'var(--green, #7ad85a)' }}>{fmtPct(support)}</b><span class="mute" style={{ fontSize: 11 }}>атака против титанов и разломов</span></div>
        </div>
        <div class="card col" style={{ gap: 8 }}>
          <div class="row"><Icon name="gift" size={30} /><b class="grow">Подарки союзников</b><span class="mute" style={{ fontSize: 12 }}>{a.gifts.length} / 5</span></div>
          {a.gifts.length ? (
            <>
              <div class="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {a.gifts.map((gf) => {
                  const m = MEMBER_BY_ID[gf.from];
                  return <div class="col center" style={{ width: 74, gap: 2 }}><Icon name="gift" size={40} /><span style={{ fontSize: 11, textAlign: 'center' }}>{m?.name ?? 'Союзник'}</span></div>;
                })}
              </div>
              <Btn kind="green" wide class="pulse" onClick={() => { const r = g.claimGifts(); if (r) showReward(r, 'Подарки союза'); }}>Забрать все</Btn>
            </>
          ) : <div class="mute" style={{ fontSize: 13 }}>Союзники присылают подарки каждые несколько часов — даже пока вас нет в игре.</div>}
        </div>
      </div>
      <div class="card col" style={{ width: 330, flex: 'none', gap: 6 }}>
        <div class="row"><Icon name="troops" size={28} /><b class="grow">Участники</b><span class="mute" style={{ fontSize: 12 }}>{MEMBERS.length + 1}</span></div>
        <div class="row" style={{ padding: '4px 6px', borderRadius: 8, background: 'rgba(232,184,74,.15)', boxShadow: 'inset 0 0 0 1px var(--gold3)' }}>
          <img src={portraitUrl(g.s.defender && g.s.heroes[g.s.defender]?.owned ? g.s.defender : 'torvald')} style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', objectPosition: '50% 20%' }} />
          <div class="grow col"><b style={{ fontSize: 13 }}>{g.s.player.name}</b><span class="mute" style={{ fontSize: 11 }}>Посол · вы</span></div>
          <b style={{ fontSize: 12 }}>{fmt(g.power())}</b>
        </div>
        {MEMBERS.map((m, i) => (
          <div class="row" style={{ padding: '4px 6px' }}>
            <img src={portraitUrl(m.hero)} style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', objectPosition: '50% 20%' }} />
            <div class="grow col"><b style={{ fontSize: 13 }}>{m.name}</b><span class="mute" style={{ fontSize: 11 }}>{m.title}</span></div>
            <b class="mute" style={{ fontSize: 12 }}>{fmt(Math.round(g.power() * (1.6 - i * 0.12)))}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function Help() {
  const g = useGame();
  const a = g.s.alliance;
  const max = HELPS_PER_JOB(g.level('embassy'));
  const mine = g.s.jobs.filter((j) => j.kind === 'build' || j.kind === 'research');
  const capped = a.helpsToday >= HELP_DAILY_CAP;
  return (
    <div class="row" style={{ alignItems: 'stretch', gap: 12 }}>
      <div class="card col grow" style={{ gap: 6 }}>
        <div class="row"><Icon name="heart" size={28} /><b class="grow">Просьбы союзников</b><span class="mute" style={{ fontSize: 12 }}>сегодня {a.helpsToday}/{HELP_DAILY_CAP}</span></div>
        {a.requests.length ? a.requests.map((r) => {
          const m = MEMBER_BY_ID[r.member];
          return (
            <div class="row" style={{ padding: '4px 6px', gap: 8 }}>
              <img src={portraitUrl(m.hero)} style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', objectPosition: '50% 20%' }} />
              <div class="grow col"><b style={{ fontSize: 13 }}>{m.name}</b><span class="mute" style={{ fontSize: 11 }}>{r.kind}</span></div>
              <span class="mute" style={{ fontSize: 12 }}>+{HELP_CONTRIB} вклада</span>
            </div>
          );
        }) : <div class="mute" style={{ fontSize: 13, padding: 8 }}>Сейчас никто не просит помощи. Загляните позже.</div>}
        <div class="grow" />
        <Btn kind="green" wide off={!a.requests.length || capped} onClick={() => {
          if (capped) { toast('Достигнут дневной лимит помощи', true); return; }
          const n = g.helpAllies();
          if (n) toast(`Вы помогли союзникам: ${n}`); else toast('Некому помогать', true);
        }}>Помочь всем</Btn>
      </div>
      <div class="card col" style={{ width: 380, flex: 'none', gap: 6 }}>
        <div class="row"><Icon name="banner" size={28} /><b class="grow">Ваши просьбы</b></div>
        <div class="mute" style={{ fontSize: 12 }}>Каждая помощь сокращает таймер на 1% (минимум 1 минута). До {max} помощей на одно задание — больше с уровнем Посольства.</div>
        {mine.length ? mine.map((j) => (
          <div class="row" style={{ gap: 8, padding: '4px 0' }}>
            <Icon name={j.kind === 'build' ? 'hammer' : 'book'} size={26} />
            <div class="grow col"><b style={{ fontSize: 13 }}>{jobName(j)}</b><Bar value={Date.now() - j.start} max={j.end - j.start} h={6} /></div>
            <HelpBtn job={j} />
          </div>
        )) : <div class="mute" style={{ fontSize: 13 }}>Нет строительства или исследований.</div>}
      </div>
    </div>
  );
}

function jobName(j: Job): string {
  if (j.kind === 'research') return `${TECH_BY_ID[j.tech!]?.name ?? 'Исследование'} → ${j.toLevel}`;
  const b = j.plot ? game().building(j.plot) : null;
  return `${b ? BUILDINGS[b.type].name : 'Строительство'} → ${j.toLevel}`;
}

function Techs() {
  const g = useGame();
  const a = g.s.alliance;
  const cost = donationCost(g.citadel);
  const affordable = g.has(cost);
  return (
    <div class="col" style={{ gap: 8 }}>
      <div class="card row" style={{ gap: 10 }}>
        <Icon name="coin" size={30} />
        <div class="grow mute" style={{ fontSize: 13 }}>Пожертвование: +{DONATION_PROGRESS} к технологии, +{DONATION_CONTRIB} вклада. Бонусы действуют на весь союз, в том числе на вас. Сегодня: <b>{a.donationsToday}/20</b></div>
        <Cost cost={cost} have={affordable} />
      </div>
      <div class="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {ALLIANCE_TECHS.map((t) => {
          const st = a.techs[t.id] ?? { level: 0, progress: 0 };
          const maxed = st.level >= t.max;
          const need = techNeed(st.level);
          return (
            <div class="card col" style={{ width: 'calc(50% - 4px)', gap: 6 }}>
              <div class="row" style={{ gap: 10 }}>
                <Icon name={t.icon} size={40} />
                <div class="grow"><b>{t.name}</b><div class="mute" style={{ fontSize: 12 }}>{t.desc}: <b class="good">{fmtPct(t.per * st.level)}</b>{!maxed && <span class="mute"> → {fmtPct(t.per * (st.level + 1))}</span>}</div></div>
                <b style={{ color: 'var(--gold2)' }}>{st.level}/{t.max}</b>
              </div>
              {maxed ? <div class="good center" style={{ fontSize: 13 }}>Изучено полностью</div> : (
                <div class="row" style={{ gap: 8 }}>
                  <div class="grow"><Bar value={st.progress} max={need} kind="blue" label={`${st.progress} / ${need}`} /></div>
                  <Btn size="small" kind="gold" off={!affordable || a.donationsToday >= 20} onClick={() => act(g.donate(t.id), 'coins')}>Внести</Btn>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Shop() {
  const g = useGame();
  const a = g.s.alliance;
  return (
    <div class="col" style={{ gap: 8 }}>
      <div class="card row"><Icon name="coin" size={30} /><b class="grow">Лавка союза</b><span class="mute">Вклад:</span><b style={{ fontSize: 20, color: 'var(--gold2)' }}>{fmt(a.contribution)}</b></div>
      <div class="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {ALLIANCE_SHOP.map((it) => {
          const def = ITEM_BY_ID[it.item];
          const bought = a.shopToday[it.id] ?? 0;
          const left = it.daily - bought;
          return (
            <div class="card col center" style={{ width: 'calc(20% - 7px)', gap: 4, opacity: left > 0 ? 1 : 0.5 }}>
              <Icon name={def?.icon ?? 'gift'} size={48} />
              <b style={{ fontSize: 12, textAlign: 'center', minHeight: 30 }}>{def?.name ?? it.item}{it.count > 1 ? ` ×${it.count}` : ''}</b>
              <span class="mute" style={{ fontSize: 11 }}>осталось {left}/{it.daily}</span>
              <Btn size="small" kind="gold" off={left <= 0 || a.contribution < it.price} onClick={() => act(g.buyAlliance(it.id), 'coins')}><Icon name="coin" size={16} /> {it.price}</Btn>
            </div>
          );
        })}
      </div>
    </div>
  );
}
