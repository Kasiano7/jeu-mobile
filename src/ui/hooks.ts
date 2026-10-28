import { useEffect, useState, useSyncExternalStore } from 'react';
import { store } from '../core/instance';
import type { GameEvents } from '../core/types';

/** Re-renders the caller whenever the store publishes a (throttled) change. */
export function useStore() {
  useSyncExternalStore(store.subscribe, store.getVersion);
  return store;
}

/** Re-renders every `ms` (countdowns). */
export function useTicker(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function useStoreEvent<K extends keyof GameEvents>(event: K, handler: (p: GameEvents[K]) => void) {
  useEffect(() => store.events.on(event, handler), [event, handler]);
}
