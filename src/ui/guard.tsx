import { Component, type ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { bus } from '../core/bus';
import { APP_VERSION, errorLog, errorReport, reportError } from '../core/errors';
import { Btn, ga, toast, ui } from './core';

/** Error boundary: a crashing panel closes itself instead of taking the whole UI down. */
export class Guard extends Component<{ name: string; onError?: () => void; children: ComponentChildren }, { failed: boolean }> {
  state = { failed: false };
  componentDidCatch(err: unknown) {
    reportError(`ui:${this.props.name}`, err);
    this.setState({ failed: true });
    toast('Окно закрыто из-за ошибки. Игра продолжается.', true);
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function report() {
  const g = ga?.game;
  return errorReport(g ? { view: ga.view, panel: ui.top()?.id ?? '-', citadel: g.citadel, chapter: g.s.quests.chapter, legions: g.s.legions.length } : {});
}

async function copyReport() {
  const text = report();
  try { await navigator.clipboard.writeText(text); toast('Отчёт скопирован'); }
  catch { prompt('Скопируйте отчёт об ошибке:', text); }
}

/** Shown when errors keep repeating; the game is paused and already saved. */
export function CrashScreen() {
  const [crashed, setCrashed] = useState(false);
  const [glLost, setGlLost] = useState(false);
  useEffect(() => {
    const offs = [bus.on('crash', () => setCrashed(true)), bus.on('gl-lost', () => setGlLost(true))];
    return () => offs.forEach((o) => o());
  }, []);
  if (glLost && !crashed) {
    return (
      <div class="overlay act" style={{ zIndex: 200 }}>
        <div class="panel" style={{ width: 520 }}>
          <div class="panel-head"><div class="panel-title">Восстановление графики…</div></div>
          <div class="panel-body col center">
            <div class="mute" style={{ textAlign: 'center' }}>Система освободила видеопамять. Прогресс сохранён — игра перезапустится автоматически.</div>
            <Btn onClick={() => location.reload()}>Перезапустить сейчас</Btn>
          </div>
        </div>
      </div>
    );
  }
  if (!crashed) return null;
  const last = errorLog()[errorLog().length - 1];
  return (
    <div class="overlay act" style={{ zIndex: 200 }}>
      <div class="panel" style={{ width: 640 }}>
        <div class="panel-head"><div class="panel-title">Что-то пошло не так</div></div>
        <div class="panel-body col">
          <div>Игра приостановлена, прогресс сохранён. Можно попробовать продолжить или перезапустить игру.</div>
          {last && <div class="card mute" style={{ fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>{last.where}: {last.message}</div>}
          <div class="mute" style={{ fontSize: 12 }}>Версия {APP_VERSION}. Если ошибка повторяется, скопируйте отчёт и отправьте разработчику.</div>
          <div class="row" style={{ justifyContent: 'flex-end' }}>
            <Btn kind="dark" onClick={copyReport}>Скопировать отчёт</Btn>
            <Btn kind="dark" onClick={() => { ga.save().finally(() => location.reload()); }}>Перезапустить</Btn>
            <Btn kind="green" onClick={() => { setCrashed(false); ga.resume(); }}>Продолжить</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

export { copyReport };
