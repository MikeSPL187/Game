import { Application } from 'pixi.js';
import { bus } from './core/bus';
import { writeSave } from './core/storage';
import { Game } from './game/game';
import { CityScene } from './render/cityScene';
import { WorldScene } from './render/worldScene';
import { setArtRes } from './render/textures';

export type View = 'city' | 'world';

/** Orchestrates renderer, scenes, simulation ticks and autosave. */
export class GameApp {
  app = new Application();
  city!: CityScene;
  world!: WorldScene;
  view: View = 'city';
  private simAcc = 0;
  private saveAcc = 0;
  paused = false;

  constructor(public game: Game) {}

  async init(stage: HTMLElement, progress: (f: number, msg?: string) => void) {
    const low = this.game.s.settings.quality === 'low';
    setArtRes(low ? 1 : Math.min(2, Math.max(1.25, window.devicePixelRatio * 0.8)));
    await this.app.init({
      resizeTo: window,
      background: '#0b0f1a',
      antialias: !low,
      resolution: Math.min(window.devicePixelRatio || 1, low ? 1.25 : 2),
      autoDensity: true,
      powerPreference: 'high-performance',
    });
    stage.appendChild(this.app.canvas);
    this.city = new CityScene(this.app, this.game);
    await this.city.init((f) => progress(f * 0.6, 'Возведение крепости…'));
    this.world = new WorldScene(this.app, this.game);
    await this.world.init((f) => progress(0.6 + f * 0.4, 'Пробуждение земель…'));
    this.app.stage.addChild(this.city.root, this.world.root);
    this.world.leave();
    this.city.enter();
    this.app.ticker.add((t) => this.frame(t.deltaMS / 1000));
    bus.on('state', () => { this.city.refresh(); this.world.refresh(); });
  }

  frame(dt: number) {
    dt = Math.min(dt, 0.1);
    if (this.paused) return;
    this.simAcc += dt;
    if (this.simAcc >= 0.25) {
      this.simAcc = 0;
      this.game.tick(Date.now());
      bus.emit('tick');
    }
    this.saveAcc += dt;
    if (this.saveAcc > 15) { this.saveAcc = 0; this.save(); }
    if (this.view === 'city') this.city.update(dt); else this.world.update(dt);
  }

  setView(v: View) {
    if (v === this.view) return;
    this.view = v;
    if (v === 'city') { this.world.leave(); this.city.enter(); this.city.refresh(); }
    else { this.city.leave(); this.world.enter(); this.world.refresh(); }
    bus.emit('view', v);
  }

  async save() {
    this.game.s.lastSave = Date.now();
    await writeSave(this.game.serialize());
  }
}
