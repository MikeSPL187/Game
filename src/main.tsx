import '@fontsource/philosopher/cyrillic-400.css';
import '@fontsource/philosopher/cyrillic-700.css';
import '@fontsource/philosopher/latin-400.css';
import '@fontsource/philosopher/latin-700.css';
import '@fontsource/nunito/cyrillic-400.css';
import '@fontsource/nunito/cyrillic-700.css';
import '@fontsource/nunito/cyrillic-800.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import './styles/main.css';
import { render } from 'preact';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';
import { loadSave } from './core/storage';
import { Game } from './game/game';
import { GameApp } from './app';
import { App } from './ui/App';
import { setGa, ui } from './ui/core';
import { IntroScreen } from './ui/panels/misc';
import { initAudio, setMusic, setSound, suspendAudio } from './audio/audio';
import { PRODUCTION_RES } from './data/buildings';
import type { FactionId } from './core/types';

const UI_H = 560;
const uiRoot = document.getElementById('ui')!;

function layout() {
  const k = Math.max(0.5, Math.min(1.7, window.innerHeight / UI_H));
  document.documentElement.style.setProperty('--k', String(k));
  uiRoot.style.width = `${window.innerWidth / k}px`;
  uiRoot.style.height = `${window.innerHeight / k}px`;
}
window.addEventListener('resize', layout);
layout();

const bootEl = document.getElementById('boot')!;
const bar = document.getElementById('bootbar')!;
const tip = document.getElementById('boottip')!;
const TIPS = [
  'Пехота сильна против кавалерии, кавалерия — против лучников, лучники — против пехоты.',
  'Раненые в боях с Пустотой лечатся в лазарете бесплатно.',
  'Строительство короче 3 минут можно завершить мгновенно и бесплатно.',
  'Урон, нанесённый титану, сохраняется — атакуйте несколькими легионами.',
  'Лорды совершают набеги, только пока вы в игре. Никаких сюрпризов после сна.',
  'Хранилище защищает часть ресурсов от разграбления.',
];
tip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];

function showBoot(on: boolean) {
  if (on) { bootEl.style.display = 'flex'; bootEl.style.opacity = '1'; }
  else { bootEl.style.opacity = '0'; setTimeout(() => { bootEl.style.display = 'none'; }, 600); }
}

async function loadFonts() {
  await Promise.race([
    Promise.all(['700 20px Philosopher', '400 20px Philosopher', '400 16px Nunito', '700 16px Nunito', '800 16px Nunito'].map((f) => document.fonts.load(f, 'АБВ abc'))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
}

async function start(game: Game, welcome: { away: number; gained: Record<string, number> } | null) {
  showBoot(true);
  const ga = new GameApp(game);
  setGa(ga);
  (window as any).ga = ga;
  setSound(game.s.settings.sound);
  setMusic(game.s.settings.music);
  await ga.init(document.getElementById('stage')!, (f, m) => { bar.style.width = `${Math.round(f * 100)}%`; if (m) tip.textContent = m; });
  render(<App welcome={welcome} />, uiRoot);
  showBoot(false);
  const unlock = () => { initAudio(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
  // lifecycle
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { ga.save(); suspendAudio(true); ga.paused = true; }
    else { ga.paused = false; suspendAudio(false); ga.game.tick(Date.now(), false); }
  });
  window.addEventListener('beforeunload', () => { ga.save(); });
  if (Capacitor.isNativePlatform()) {
    CapApp.addListener('backButton', () => {
      if (ui.stack.length) ui.close();
      else if (ga.view === 'world') ga.setView('city');
      else CapApp.minimizeApp();
    });
    CapApp.addListener('pause', () => ga.save());
  }
}

async function boot() {
  if (Capacitor.isNativePlatform()) { StatusBar.hide().catch(() => {}); }
  await loadFonts();
  bar.style.width = '10%';
  const params = new URLSearchParams(location.search);
  let game: Game | null = null;
  if (!params.has('new')) {
    const json = await loadSave();
    if (json) game = Game.deserialize(json);
  }
  if (game) {
    // offline progress
    const before: Record<string, number> = { food: 0, wood: 0, stone: 0, gold: 0 };
    for (const b of game.s.buildings) { const r = PRODUCTION_RES[b.type]; if (r) before[r] += b.stored; }
    const resBefore = { ...game.s.res };
    const away = Date.now() - game.s.lastTick;
    game.tick(Date.now(), false);
    const gained: Record<string, number> = {};
    for (const b of game.s.buildings) { const r = PRODUCTION_RES[b.type]; if (r) gained[r] = (gained[r] ?? 0) + b.stored; }
    for (const k of Object.keys(gained)) { gained[k] = Math.max(0, Math.round(gained[k] - before[k] + (game.s.res[k as 'food'] - resBefore[k as 'food']))); if (!gained[k]) delete gained[k]; }
    await start(game, away > 5 * 60_000 && Object.keys(gained).length ? { away, gained } : null);
    return;
  }
  const quick = params.get('new');
  if (quick && ['order', 'wild', 'ash'].includes(quick)) {
    const g = Game.create(quick as FactionId, 'Лорд');
    if (params.has('skipintro')) { g.s.introSeen = true; g.s.tutorial.done = true; }
    await start(g, null);
    return;
  }
  showBoot(false);
  render(<IntroScreen onDone={(f, name) => {
    render(null, uiRoot);
    const g = Game.create(f, name);
    start(g, null);
  }} />, uiRoot);
}

boot();
