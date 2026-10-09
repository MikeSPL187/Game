type Handler = (payload?: any) => void;

/** Minimal event bus used to connect simulation, renderer, UI and audio. */
class Bus {
  private map = new Map<string, Set<Handler>>();
  /** called when a listener throws; listeners are isolated so one failure cannot break the emitter */
  onError: (ev: string, err: unknown) => void = (ev, err) => console.error('bus listener failed', ev, err);
  on(ev: string, fn: Handler): () => void {
    if (!this.map.has(ev)) this.map.set(ev, new Set());
    this.map.get(ev)!.add(fn);
    return () => this.map.get(ev)?.delete(fn);
  }
  emit(ev: string, payload?: any) {
    this.map.get(ev)?.forEach((fn) => {
      try { fn(payload); } catch (err) { this.onError(ev, err); }
    });
  }
}

export const bus = new Bus();
