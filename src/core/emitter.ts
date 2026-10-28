type Handler<T> = (payload: T) => void;

export class Emitter<E extends { [K in keyof E]: unknown }> {
  private handlers = new Map<keyof E, Set<Handler<any>>>();

  on<K extends keyof E>(event: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  emit<K extends keyof E>(event: K, ...payload: E[K] extends void ? [] : [E[K]]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of [...set]) h(payload[0] as E[K]);
  }
}
