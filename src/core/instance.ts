import { GameStore } from './store';

/** The single game store shared by the Phaser scenes and the React UI. */
export const store = new GameStore();

if (typeof window !== 'undefined') {
  // Read-only debugging / automated test hook.
  (window as any).__MM__ = store;
}
