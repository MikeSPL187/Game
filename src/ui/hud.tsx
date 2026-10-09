import { useEffect, useRef, useState } from 'preact/hooks';
import { bus } from '../core/bus';
import { fmt, fmtTime } from '../core/format';
import type { Currency, Res } from '../core/types';
import { portraitUrl } from '../art/portraits';
import { BUILDINGS } from '../data/buildings';
import { CHAPTERS } from '../data/quests';
import { TECH_BY_ID } from '../data/research';
import { TROOPS } from '../data/troops';
import { BUILDER_COUNT, sumTroops } from '../game/game';
import { Bar, Icon, IconBtn, Timer, ga, haptic, ui, useGame, useNow } from './core';
import { goTo } from './nav';
import { sfx } from '../audio/audio';

const RES: Currency[] = ['food', 'wood', 'stone', 'gold'];

function ResItem({ k, rate }: { k: Currency; rate?: number }) {
  const g = ga.game;
  const [bump, setBump] = useState(0);
  const prev = useRef(g.s.res[k]);
  useEffect(() => {
    const v = g.s.res[k];
    if (v > prev.current + 0.5) setBump((b) => b + 1);
    prev.current = v;
  });
  return (
    <div class={'res' + (k === 'aether' ? ' aether' : '')} data-r={k} key={k + bump} style={bump ? { animation: 'bump .45s' } : undefined}>
      <Icon name={k} size={28} />
      <span>{fmt(g.s.res[k])}</span>
      {rate != null && rate > 0 && <span class="rate">+{fmt(rate)}/ч</span>}
    </div>
  );
}

export function TopBar() {
  const g = useGame();
  const prod = g.totalProduction();
  const lead = g.s.defender && g.s.heroes[g.s.defender]?.owned ? g.s.defender : 'torvald';
  return (
    <div class="hud-top">
      <div class="lordplate act" onClick={() => { sfx('click'); ui.open('profile'); }}>
        <div class="crest"><img src={portraitUrl(lead)} /></div>
        <div class="lordinfo">
          <div class="lordname">{g.s.player.name}</div>
          <div class="power"><Icon name="power" size={22} />{fmt(g.power())}</div>
        </div>
      </div>
      <div class="resbar act">
        {RES.map((k) => <ResItem k={k} rate={prod[k as Res]} />)}
        <ResItem k="aether" />
      </div>
    </div>
  );
}

export function QuestTracker() {
  const g = useGame();
  const q = g.nextQuest();
  const ch = g.chapter();
  if (!ch) return null;
  if (g.chapterDone()) {
    return (
      <div class="quest-tracker shine act" onClick={() => ui.open('quests')}>
        <Icon name="trophy" size={40} />
        <div class="grow"><div class="qc">Глава {ch.n}: {ch.title}</div><div class="qt">Глава завершена! Заберите награду</div></div>
        <button class="btn small green pulse">Забрать</button>
      </div>
    );
  }
  if (!q) return null;
  const p = g.questProgress(q);
  const done = p >= q.target;
  return (
    <div class="quest-tracker act" id="quest-tracker" onClick={() => ui.open('quests')}>
      <Icon name="quest" size={40} />
      <div class="grow">
        <div class="qc">Глава {ch.n} · {ch.title}</div>
        <div class="qt">{q.title}</div>
        <div style={{ marginTop: 4 }}><Bar value={p} max={q.target} h={10} kind="gold" /></div>
      </div>
      {done
        ? <button class="btn small green pulse" onClick={(e) => { e.stopPropagation(); const r = g.claimQuest(q.id); if (r.ok) { sfx('collect'); haptic(); bus.emit('show-reward', { r: q.reward, title: 'Задание выполнено' }); } }}>Забрать</button>
        : <button class="btn small" id="quest-go" onClick={(e) => { e.stopPropagation(); sfx('click'); goTo(q.go); }}>Вперёд</button>}
    </div>
  );
}

export function Queues() {
  const g = useGame();
  useNow(500);
  const builds = g.jobsOf('build');
  const train = g.jobsOf('train');
  const research = g.jobsOf('research');
  const slots = Array.from({ length: BUILDER_COUNT }, (_, i) => builds[i]);
  return (
    <div class="col" style={{ gap: 6 }}>
      {slots.map((j) => j ? (
        <div class="queue act" onClick={() => { ga.setView('city'); goTo({ kind: 'building', type: g.building(j.plot!)!.type }); }}>
          <Icon name="hammer" size={24} />
          <div class="grow">
            <div style={{ fontWeight: 800 }}>{BUILDINGS[g.building(j.plot!)!.type].name} → {j.toLevel}</div>
            <Bar value={Date.now() - j.start} max={j.end - j.start} h={10} label={fmtTime(j.end - Date.now())} />
          </div>
          {j.end - Date.now() <= 180000 && <button class="btn small green" onClick={(e) => { e.stopPropagation(); g.freeFinish(j.id); sfx('complete'); }}>Готово</button>}
        </div>
      ) : (
        <div class="queue act" style={{ opacity: 0.85 }} onClick={() => { const q = g.nextQuest(); if (q && q.go.kind === 'building') goTo(q.go); else goTo({ kind: 'building', type: 'citadel', action: 'upgrade' }); }}>
          <Icon name="hammer" size={24} style={{ filter: 'grayscale(1)' }} />
          <div class="grow mute">Строитель свободен</div>
          <span class="badge dot" style={{ position: 'static' }} />
        </div>
      ))}
      {train.map((j) => (
        <div class="queue act" onClick={() => goTo({ kind: 'building', type: j.plot as any, action: 'train' })}>
          <Icon name={TROOPS[j.troop!].type} size={24} />
          <div class="grow">
            <div style={{ fontWeight: 800 }}>{TROOPS[j.troop!].name} ×{j.count}</div>
            <Bar value={Date.now() - j.start} max={j.end - j.start} h={10} kind="gold" label={fmtTime(j.end - Date.now())} />
          </div>
        </div>
      ))}
      {research.map((j) => (
        <div class="queue act" onClick={() => ui.open('research')}>
          <Icon name="book" size={24} />
          <div class="grow">
            <div style={{ fontWeight: 800 }}>{TECH_BY_ID[j.tech!].name} {j.toLevel}</div>
            <Bar value={Date.now() - j.start} max={j.end - j.start} h={10} kind="blue" label={fmtTime(j.end - Date.now())} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LegionList() {
  const g = useGame();
  useNow(500);
  const names: Record<string, string> = { march: 'Марш', return: 'Возвращение', gather: 'Сбор', station: 'Стоит', battle: 'Бой', idle: '—' };
  return (
    <div class="col" style={{ gap: 6 }}>
      {g.s.legions.map((l) => {
        const now = Date.now();
        let end = 0, start = 0;
        if (l.state === 'march' || l.state === 'return') { start = l.pathT0; end = g.arrivalTime(l); }
        if (l.state === 'gather') { start = l.gatherStart; end = l.gatherEnd; }
        return (
          <div class="queue act" onClick={() => { const p = g.legionPos(l); ga.world.focusTile(p.x, p.y); bus.emit('world-select', { legion: l.id }); }}>
            <img src={portraitUrl(l.lead!)} style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', objectPosition: '50% 20%' }} />
            <div class="grow">
              <div style={{ fontWeight: 800 }}>{names[l.state]} · {fmt(sumTroops(l.troops))}</div>
              {end > 0 ? <Bar value={now - start} max={end - start} h={10} kind={l.state === 'gather' ? undefined : 'blue'} label={fmtTime(end - now)} /> : <div class="mute" style={{ fontSize: 12 }}>{l.state === 'station' ? 'Ожидает приказа' : ''}</div>}
            </div>
          </div>
        );
      })}
      {g.freeLegionSlots() > 0 && <div class="queue mute" style={{ fontSize: 12 }}><Icon name="flag" size={22} /> Свободных отрядов: {g.freeLegionSlots()}</div>}
    </div>
  );
}

export function RaidAlert() {
  const g = useGame();
  const r = g.incomingRaid();
  if (!r) return null;
  const lord = g.s.lords.find((l) => l.id === r.lordId)!;
  return (
    <div class="raid-alert act" onClick={() => ui.open('wall')}>
      <Icon name="skull" size={30} />
      <div>
        <div>Набег! {lord.name} идёт на город</div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>{g.level('watchtower') >= 3 ? `Войска: ~${fmt(sumTroops(r.troops))} · ` : ''}Прибытие через <Timer end={r.arrive} /></div>
      </div>
      {g.s.legions.some((l) => l.state !== 'return') && (
        <button class="btn small" onClick={(e) => { e.stopPropagation(); const n = g.recallAll(); if (n) { sfx('horn'); haptic(true); } }}>Вернуть войска</button>
      )}
    </div>
  );
}

export function SideRight() {
  const g = useGame();
  const unread = g.unreadReports();
  return (
    <div class="side-right act">
      <IconBtn icon="quest" label="Задания" badge={g.hasClaimable()} onClick={() => ui.open('quests')} />
      <IconBtn icon="gift" label="Награды" badge={g.calendarReady()} pulse={g.calendarReady()} onClick={() => ui.open('calendar')} />
      <IconBtn icon="mail" label="Отчёты" badge={unread || false} onClick={() => ui.open('reports')} />
      {g.level('sanctum') > 0 || Object.keys(g.s.titans.tamed).length ? <IconBtn icon="titan" label="Титаны" onClick={() => ui.open('titans')} /> : null}
      <IconBtn icon="gear" label="Настройки" size={46} onClick={() => ui.open('settings')} />
    </div>
  );
}

export function BottomBar() {
  const g = useGame();
  const view = ga.view;
  const heroBadge = Object.values(g.s.heroes).some((h) => h.owned && ((h.level < g.heroCap(h.id) && Object.keys(g.s.inventory).some((k) => k.startsWith('tome') && g.s.inventory[k] > 0)) || g.talentPoints(h.id) >= 3));
  return (
    <div class="hud-bottom">
      <div class="menubar act">
        <IconBtn icon="hero" label="Герои" badge={heroBadge} onClick={() => ui.open('heroes')} />
        <IconBtn icon="troops" label="Армия" onClick={() => ui.open('army')} />
        <IconBtn icon="book" label="Наука" onClick={() => (g.level('academy') ? ui.open('research') : goTo({ kind: 'building', type: 'academy' }))} />
        <IconBtn icon="bag" label="Сумка" onClick={() => ui.open('inventory')} />
        {view === 'world' && <IconBtn icon="map" label="Поиск" onClick={() => ui.open('search')} />}
        {view === 'world' && <IconBtn icon="home" label="Домой" onClick={() => { const c = g.cityPos(); ga.world.focusTile(c.x, c.y, 0.6); }} />}
      </div>
      <button class="viewbtn act" id="viewbtn" onClick={() => { sfx('horn'); haptic(true); ga.setView(view === 'city' ? 'world' : 'city'); ui.closeAll(); }}>
        <Icon name={view === 'city' ? 'map' : 'castle'} size={56} />
        <span>{view === 'city' ? 'Мир' : 'Город'}</span>
      </button>
    </div>
  );
}

export function HUD() {
  useGame(['view', 'state']);
  const view = ga.view;
  return (
    <div class="pass" style={{ position: 'absolute', inset: 0 }}>
      <TopBar />
      <div class="side-left">
        <QuestTracker />
        {view === 'city' ? <Queues /> : <LegionList />}
      </div>
      <SideRight />
      <BottomBar />
      <RaidAlert />
    </div>
  );
}

export { CHAPTERS };
