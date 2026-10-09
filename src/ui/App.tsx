import { useEffect, useRef, useState } from 'preact/hooks';
import { bus } from '../core/bus';
import { fmt } from '../core/format';
import type { Report, Reward } from '../core/types';
import { iconUrl } from '../art/icons';
import { BUILDINGS, PRODUCTION_RES } from '../data/buildings';
import { PLOT_BY_ID } from '../data/cityLayout';
import { TECH_BY_ID } from '../data/research';
import { TROOPS, TYPE_INFO } from '../data/troops';
import { HERO_BY_ID } from '../data/heroes';
import { TITAN_BY_ID } from '../data/world';
import { HUD } from './hud';
import { Icon, IconBtn, K, ga, haptic, toast, ui, useGame, useRaf, useStore } from './core';
import { SpeedupPanel, UpgradePanel } from './panels/upgrade';
import { TrainPanel } from './panels/train';
import { ResearchPanel } from './panels/research';
import { HeroesPanel, TavernPanel } from './panels/heroes';
import { DispatchPanel, SearchPanel, WorldSheet } from './panels/world';
import { ArmyPanel, CalendarPanel, InventoryPanel, ProfilePanel, QuestsPanel, RewardPopup, SettingsPanel, StoryDialog, TitansPanel, WallPanel, WelcomeBack } from './panels/misc';
import { ReportsPanel } from './panels/reports';
import { ForgePanel } from './panels/forge';
import { EventPanel } from './panels/event';
import { sfx } from '../audio/audio';
import { CrashScreen, Guard } from './guard';
import { Capacitor } from '@capacitor/core';
import { requestNotifications } from '../core/notify';

const PANELS: Record<string, (p: any) => any> = {
  upgrade: UpgradePanel, speedup: SpeedupPanel, train: TrainPanel, research: ResearchPanel, heroes: HeroesPanel, tavern: TavernPanel,
  dispatch: DispatchPanel, search: SearchPanel, inventory: InventoryPanel, quests: QuestsPanel, reports: ReportsPanel, army: ArmyPanel,
  titans: TitansPanel, wall: WallPanel, forge: ForgePanel, event: EventPanel, calendar: CalendarPanel, settings: SettingsPanel, profile: ProfilePanel,
};

// ———————————————————————————————————————— building context menu
function BuildingMenu() {
  const g = useGame();
  const [plot, setPlot] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const offs = [
      bus.on('city-select', (e: { plot: string; open?: string }) => { setPlot(e.plot); }),
      bus.on('city-deselect', () => setPlot(null)),
      bus.on('view', () => setPlot(null)),
      bus.on('ui-open', () => { setPlot(null); ga.city.select(null); }),
      bus.on('city-bubble', (e: { plot: string; kind: string }) => {
        const b = ga.game.building(e.plot)!;
        if (e.kind === 'hammer') ui.open('upgrade', { plot: e.plot });
        else if (e.kind === 'sword') ui.open('train', { type: b.type });
        else if (e.kind === 'book') ui.open('research');
        else if (e.kind === 'key_silver') ui.open('tavern');
      }),
    ];
    return () => offs.forEach((o) => o());
  }, []);
  useRaf(() => {
    if (!plot || !ref.current || ga.view !== 'city') return;
    const p = ga.city.plotScreen(plot);
    const k = K();
    ref.current.style.left = `${p.x / k}px`;
    ref.current.style.top = `${Math.max(150, p.top / k + 30)}px`;
  });
  if (!plot || ga.view !== 'city') return null;
  const b = g.building(plot)!;
  const def = BUILDINGS[b.type];
  const job = g.jobForPlot(plot);
  const trainJob = g.s.jobs.find((j) => j.kind === 'train' && j.plot === b.type);
  const researchJob = b.type === 'academy' ? g.jobsOf('research')[0] : undefined;
  const locked = b.level === 0 && PLOT_BY_ID[plot].unlock > g.citadel;
  const close = () => { setPlot(null); ga.city.select(null); };
  const btns: { icon: string; label: string; fn: () => void; pulse?: boolean }[] = [];
  if (locked) btns.push({ icon: 'lock', label: `Цитадель ${PLOT_BY_ID[plot].unlock}`, fn: () => toast(`Участок откроется на ${PLOT_BY_ID[plot].unlock} ур. Цитадели`) });
  else if (b.level === 0 && !job) btns.push({ icon: 'hammer', label: 'Построить', fn: () => ui.open('upgrade', { plot }), pulse: true });
  else {
    btns.push({ icon: 'info', label: 'Инфо', fn: () => ui.open('upgrade', { plot }) });
    if (!job && b.level < def.maxLevel) btns.push({ icon: 'arrowUp', label: 'Улучшить', fn: () => ui.open('upgrade', { plot }), pulse: g.canUpgrade(plot).ok });
    const tt = Object.values(TYPE_INFO).find((t) => t.building === b.type);
    if (tt && b.level > 0) btns.push({ icon: Object.keys(TYPE_INFO).find((k) => TYPE_INFO[k as 'inf'].building === b.type)!, label: 'Обучить', fn: () => ui.open('train', { type: b.type }) });
    if (b.type === 'academy' && b.level > 0) btns.push({ icon: 'book', label: 'Наука', fn: () => ui.open('research') });
    if (b.type === 'tavern' && b.level > 0) btns.push({ icon: 'key_gold', label: 'Призыв', fn: () => ui.open('tavern'), pulse: g.s.freeSummonAt <= Date.now() });
    if (b.type === 'infirmary' && b.level > 0) btns.push({ icon: 'heart', label: 'Лечение', fn: () => ui.open('army') });
    if (b.type === 'sanctum' && b.level > 0) btns.push({ icon: 'titan', label: 'Титаны', fn: () => ui.open('titans') });
    if (b.type === 'forge' && b.level > 0) btns.push({ icon: 'gauntlet', label: 'Ковка', fn: () => ui.open('forge') });
    if ((b.type === 'wall' || b.type === 'watchtower') && b.level > 0) btns.push({ icon: 'tower', label: 'Оборона', fn: () => ui.open('wall') });
    if (b.type === 'citadel') btns.push({ icon: 'castle', label: 'Профиль', fn: () => ui.open('profile') });
    if (PRODUCTION_RES[b.type] && b.stored >= 1) btns.push({ icon: PRODUCTION_RES[b.type]!, label: 'Собрать', fn: () => { g.collect(plot); ga.city.refresh(); } });
    const anyJob = job ?? trainJob ?? researchJob;
    if (anyJob) btns.push({ icon: 'hourglass', label: 'Ускорить', fn: () => ui.open('speedup', { jobId: anyJob.id }) });
  }
  return (
    <div class="bmenu act" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div class="title">{def.name}{b.level > 0 ? ` · ${b.level}` : ''}</div>
      <div class="acts">
        {btns.map((x) => <IconBtn icon={x.icon} label={x.label} pulse={x.pulse} onClick={() => { x.fn(); if (x.label !== 'Собрать') close(); }} />)}
      </div>
    </div>
  );
}

// ———————————————————————————————————————— toasts & notes
function Toasts() {
  const [list, setList] = useState<{ id: number; text: string; err?: boolean }[]>([]);
  useEffect(() => bus.on('toast', (t: { text: string; err?: boolean }) => {
    const id = Math.random();
    setList((l) => [...l.slice(-3), { id, ...t }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 2900);
  }), []);
  return <div class="toasts">{list.map((t) => <div class={'toast' + (t.err ? ' err' : '')} key={t.id}>{t.text}</div>)}</div>;
}

function Notes() {
  const [notes, setNotes] = useState<{ id: number; icon: string; text: string; sub?: string; fn?: () => void; tone?: string }[]>([]);
  useEffect(() => {
    const push = (n: Omit<(typeof notes)[0], 'id'>) => {
      const id = Math.random();
      setNotes((l) => [...l.slice(-2), { id, ...n }]);
      setTimeout(() => setNotes((l) => l.filter((x) => x.id !== id)), 5200);
    };
    const offs = [
      bus.on('build-done', (e) => { sfx('complete'); haptic(true); push({ icon: 'hammer', text: `${BUILDINGS[e.type as 'farm'].name}: уровень ${e.level}`, sub: 'Строительство завершено' }); }),
      bus.on('train-done', (e) => { sfx('horn'); push({ icon: TROOPS[e.troop as 'inf1'].type, text: `${TROOPS[e.troop as 'inf1'].name} ×${e.count}`, sub: 'Обучение завершено' }); }),
      bus.on('research-done', (e) => { sfx('complete'); push({ icon: 'book', text: `${TECH_BY_ID[e.tech].name} ${e.level}`, sub: 'Исследование завершено' }); }),
      bus.on('hero-level', (e) => { sfx('levelup'); push({ icon: 'star', text: `${HERO_BY_ID[e.id].name}: уровень ${e.level}`, sub: 'Герой стал сильнее' }); }),
      bus.on('report', (r: Report) => {
        if (r.kind === 'battle' || r.kind === 'defense') { sfx(r.win ? 'victory' : 'defeat'); haptic(true); }
        if (r.kind === 'system') return;
        push({ icon: r.kind === 'battle' ? (r.win ? 'trophy' : 'skull') : r.kind === 'defense' ? 'tower' : 'ruin', text: r.title, sub: 'Нажмите, чтобы открыть отчёт', tone: r.win === false ? 'bad' : undefined, fn: () => ui.open('reports', { id: r.id }) });
      }),
      bus.on('raid', () => { sfx('alarm'); haptic(true); push({ icon: 'skull', text: 'Вражеская армия идёт на город!', sub: 'Подготовьте оборону', tone: 'bad', fn: () => ui.open('wall') }); }),
      bus.on('titan-tamed', (id: string) => { sfx('legendary'); bus.emit('story', { text: `${TITAN_BY_ID[id].name} склонил голову перед вами! Отныне титан будет сражаться на вашей стороне. Загляните в Святилище, чтобы взять его в бой.` }); }),
      bus.on('gather-done', (e) => { if (e.amount > 0) push({ icon: e.res, text: `Добыто: ${fmt(e.amount)}`, sub: 'Отряд возвращается домой' }); }),
      bus.on('legion-home', () => sfx('coins')),
      bus.on('healed', () => push({ icon: 'heart', text: 'Все раненые вылечены', sub: 'Лазарет' })),
    ];
    return () => offs.forEach((o) => o());
  }, []);
  return (
    <div style={{ position: 'absolute', right: 120, bottom: 120, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', pointerEvents: 'none' }}>
      {notes.map((n) => (
        <div key={n.id} class="queue act" style={{ pointerEvents: 'auto', minWidth: 300, animation: 'slidein .25s', boxShadow: n.tone === 'bad' ? '0 0 0 1px var(--bad), 0 6px 14px rgba(0,0,0,.5)' : '0 0 0 1px var(--gold3), 0 6px 14px rgba(0,0,0,.5)', background: 'rgba(14,18,32,.95)', cursor: n.fn ? 'pointer' : 'default' }}
          onClick={() => { n.fn?.(); setNotes((l) => l.filter((x) => x.id !== n.id)); }}>
          <Icon name={n.icon} size={36} />
          <div class="grow"><b>{n.text}</b>{n.sub && <div class="mute" style={{ fontSize: 12 }}>{n.sub}</div>}</div>
        </div>
      ))}
    </div>
  );
}

// ———————————————————————————————————————— flying resources
function FlyRes() {
  const [items, setItems] = useState<{ id: number; res: string; x: number; y: number; tx: number; ty: number; go: boolean; d: number }[]>([]);
  useEffect(() => bus.on('fly-res', (e: { res: string; x: number; y: number }) => {
    const k = K();
    const el = document.querySelector(`.res[data-r="${e.res}"]`) as HTMLElement | null;
    const r = el?.getBoundingClientRect();
    const tx = r ? (r.left + 18) / k : 400, ty = r ? (r.top + 16) / k : 20;
    sfx('collect');
    haptic();
    const batch = Array.from({ length: 6 }, (_, i) => ({ id: Math.random(), res: e.res, x: e.x / k + (Math.random() - 0.5) * 60, y: e.y / k + (Math.random() - 0.5) * 40, tx, ty, go: false, d: i * 45 }));
    setItems((l) => [...l, ...batch]);
    requestAnimationFrame(() => requestAnimationFrame(() => setItems((l) => l.map((it) => (batch.some((b) => b.id === it.id) ? { ...it, go: true } : it)))));
    setTimeout(() => setItems((l) => l.filter((it) => !batch.some((b) => b.id === it.id))), 1200);
  }), []);
  return <>{items.map((it) => (
    <img key={it.id} class="flyres" src={iconUrl(it.res)} style={{ left: 0, top: 0, transform: it.go ? `translate(${it.tx}px, ${it.ty}px) scale(.7)` : `translate(${it.x}px, ${it.y}px) scale(1.2)`, transitionDelay: `${it.d}ms`, opacity: it.go ? 0.2 : 1 }} />
  ))}</>;
}

// ———————————————————————————————————————— tutorial
interface TStep { text: string; target: () => { x: number; y: number } | null; done: () => boolean; when?: () => boolean }
const elPos = (sel: string) => {
  const el = document.querySelector(sel) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const k = K();
  return { x: (r.left + r.width / 2) / k, y: (r.top + r.height / 2) / k };
};
const STEPS: TStep[] = [
  {
    text: 'Урожай созрел! Нажмите на пузырь над фермой, чтобы собрать еду.',
    target: () => { if (ga.view !== 'city') return null; const p = ga.city.views.get('farm1'); if (!p?.bubble) return null; const s = ga.city.camera.toScreen(p.bubble.x, p.bubble.y); const k = K(); return { x: s.x / k, y: s.y / k }; },
    done: () => ga.game.s.stats.collects >= 1,
  },
  { text: 'Задания ведут вас к величию. Нажмите «Вперёд».', target: () => elPos('#quest-go'), done: () => ga.game.s.jobs.some((j) => j.kind === 'build') || ga.game.s.stats.buildsDone > 0 },
  { text: 'Выполненные задания приносят награды. Заберите её!', target: () => elPos('#quest-tracker .btn.green'), done: () => ga.game.s.quests.claimed.length >= 1, when: () => !!document.querySelector('#quest-tracker .btn.green') },
  { text: 'Пора в поход! Откройте карту мира.', target: () => elPos('#viewbtn'), done: () => ga.view === 'world' || ga.game.s.stats.campsDefeated > 0, when: () => ga.game.s.quests.chapter >= 2 && ga.view === 'city' },
];

function Tutorial() {
  const g = useGame(['tick', 'state', 'view', 'ui-open', 'ui-close']);
  const store = useStore();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const t = g.s.tutorial;
  const step = STEPS[t.step];
  useRaf(() => {
    if (!step || store.stack.length) { if (pos) setPos(null); return; }
    if (step.done()) { t.step++; if (t.step >= STEPS.length) t.done = true; setPos(null); return; }
    if (step.when && !step.when()) { if (pos) setPos(null); return; }
    const p = step.target();
    if (!p && pos) setPos(null);
    else if (p && (!pos || Math.abs(p.x - pos.x) > 1 || Math.abs(p.y - pos.y) > 1)) setPos(p);
  });
  if (t.done || !step || !pos || store.stack.length) return null;
  const right = pos.x < 700;
  return (
    <>
      <div class="hand-ring" style={{ left: pos.x, top: pos.y }} />
      <svg class="hand" style={{ left: pos.x - 10, top: pos.y }} viewBox="0 0 64 64"><path d="M22 6c3 0 5 2 5 5v18l3-1c2 0 4 1 4 3l3-1c2 0 4 1 4 3l3-1c3 0 5 2 5 5v11c0 7-6 12-13 12h-6c-5 0-9-3-11-7l-8-15c-1-2 0-5 2-6 2-1 4 0 5 1l3 5V11c0-3 2-5 5-5z" fill="#fff" stroke="#20160e" stroke-width="2.5" /></svg>
      <div class="card" style={{ position: 'absolute', left: right ? pos.x + 50 : pos.x - 330, top: pos.y + 30, width: 280, background: 'rgba(14,18,32,.96)', pointerEvents: 'none', fontWeight: 700, boxShadow: '0 0 0 2px var(--gold), 0 8px 20px rgba(0,0,0,.6)' }}>{step.text}</div>
    </>
  );
}

/** Ask for notification permission at a meaningful moment: the first long timer. */
function NotifyPrompt() {
  const g = useGame(['state', 'job-start']);
  const [show, setShow] = useState(false);
  useEffect(() => bus.on('job-start', (j: { start: number; end: number }) => {
    if (!Capacitor.isNativePlatform() || ga.game.s.flags.notifAsked || !ga.game.s.settings.notifications) return;
    if (j.end - j.start >= 10 * 60_000) setShow(true);
  }), []);
  if (!show) return null;
  const done = (yes: boolean) => {
    g.s.flags.notifAsked = true;
    setShow(false);
    if (yes) requestNotifications().then((ok) => { if (!ok) g.s.settings.notifications = false; });
    else g.s.settings.notifications = false;
  };
  return (
    <div class="card act" style={{ position: 'absolute', left: '50%', top: 90, transform: 'translateX(-50%)', width: 460, background: 'rgba(14,18,32,.97)', boxShadow: '0 0 0 2px var(--gold), 0 10px 30px rgba(0,0,0,.6)', animation: 'panelin .25s' }}>
      <div class="row"><Icon name="clock" size={40} /><div class="grow"><b>Напомнить, когда всё будет готово?</b><div class="mute" style={{ fontSize: 13 }}>Сообщим о завершении строек, исследований и возвращении легионов. Никакой рекламы.</div></div></div>
      <div class="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button class="btn small dark" onClick={() => done(false)}>Не нужно</button>
        <button class="btn small green" onClick={() => done(true)}>Напоминать</button>
      </div>
    </div>
  );
}

function FpsMeter() {
  const g = useGame(['fps', 'state']);
  if (!g.s.settings.showFps) return null;
  return <div class="pass" style={{ position: 'absolute', left: 300, top: 6, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,0,0,.6)', fontSize: 12, fontWeight: 800, color: ga.fps >= 50 ? '#9cf27a' : ga.fps >= 30 ? '#ffb84a' : '#ff6a5a' }}>{ga.fps} FPS · ×{ga.res.toFixed(2)}</div>;
}

// ———————————————————————————————————————— root
export function App({ welcome }: { welcome?: { away: number; gained: Record<string, number> } | null }) {
  const store = useStore();
  const [reward, setReward] = useState<{ r: Reward; title: string } | null>(null);
  const [story, setStory] = useState<string[] | null>(null);
  const [wb, setWb] = useState(welcome ?? null);
  useEffect(() => {
    const offs = [
      bus.on('show-reward', (e) => setReward(e)),
      bus.on('story', (e: { text: string; next?: string }) => setStory([e.text, ...(e.next ? [e.next] : [])])),
    ];
    if (!ga.game.s.introSeen) {
      ga.game.s.introSeen = true;
      setStory([
        `Милорд ${ga.game.s.player.name}! Добро пожаловать в Расколотые земли. Я — Ориан, магистр и ваш советник.`,
        'От былого королевства остались лишь крепость да горстка верных людей. Но под этим небом спят Титаны, а из разломов ползёт Пустота.',
        'Отстроим город, соберём героев и армию — и однажды сами Титаны склонят перед вами головы. Начнём с малого: соберите урожай.',
      ]);
    }
    return () => offs.forEach((o) => o());
  }, []);
  const top = store.top();
  const P = top ? PANELS[top.id] : null;
  return (
    <div style={{ position: 'absolute', inset: 0 }} class="pass">
      <Guard name="hud"><HUD /></Guard>
      <Guard name="bmenu"><BuildingMenu /></Guard>
      <div class="act"><Guard name="sheet"><WorldSheet /></Guard></div>
      <Guard name="notes"><Notes /></Guard>
      {P && <div class="act" style={{ position: 'absolute', inset: 0 }}><Guard name={top!.id} key={top!.id + JSON.stringify(top!.props ?? {})} onError={() => ui.close()}><P {...(top!.props ?? {})} /></Guard></div>}
      {wb && !story && <div class="act" style={{ position: 'absolute', inset: 0 }}><WelcomeBack away={wb.away} gained={wb.gained} onClose={() => setWb(null)} /></div>}
      {story && <div class="act" style={{ position: 'absolute', inset: 0 }}><StoryDialog lines={story} onDone={() => setStory(null)} /></div>}
      {reward && <div class="act" style={{ position: 'absolute', inset: 0 }}><RewardPopup r={reward.r} title={reward.title} onClose={() => setReward(null)} /></div>}
      {!story && !reward && !wb && <Tutorial />}
      <FlyRes />
      <Toasts />
      <NotifyPrompt />
      <FpsMeter />
      <CrashScreen />
    </div>
  );
}
