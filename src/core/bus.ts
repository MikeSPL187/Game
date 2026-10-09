type Handler = (payload?: any) => void;

/** Minimal event bus used to connect simulation, renderer, UI and audio. */
class Bus {
  private map = new Map<string, Set<Handler>>();
  on(ev: string, fn: Handler): () => void {
    if (!this.map.has(ev)) this.map.set(ev, new Set());
    this.map.get(ev)!.add(fn);
    return () => this.map.get(ev)?.delete(fn);
  }
  emit(ev: string, payload?: any) {
    this.map.get(ev)?.forEach((fn) => fn(payload));
  }
}

export const bus = new Bus();
