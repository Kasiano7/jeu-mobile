import { inject, track as vercelTrack } from '@vercel/analytics';
import type { GameStore } from './core/store';

/**
 * Vercel Web Analytics: cookieless, anonymous, same-origin (/_vercel/insights),
 * so it fits the CSP and needs no consent banner. Production builds only;
 * it does nothing until Analytics is enabled in the Vercel project.
 */
const ENABLED = import.meta.env.PROD;

export function track(name: string, props?: Record<string, string | number | boolean>) {
  if (!ENABLED) return;
  try {
    vercelTrack(name, props);
  } catch {
    /* analytics must never break the game */
  }
}

/** Starts page-view tracking and a handful of funnel events (no personal data). */
export function initAnalytics(store: GameStore) {
  if (!ENABLED) return;
  inject({
    mode: 'production',
    // Never send query strings (e.g. ?debug) in the reported URL.
    beforeSend: (event) => ({ ...event, url: event.url.split('?')[0] }),
  });

  const once = new Set<string>();
  const first = (name: string, props?: Record<string, string | number>) => {
    if (once.has(name)) return;
    once.add(name);
    track(name, props);
  };

  store.events.on('stats', () => {
    if (store.state.stats.upgradesBought === 1) first('first_upgrade');
  });
  store.events.on('levelUp', ({ level }) => {
    if ([2, 5, 10, 15, 20, 30].includes(level)) track('level_reached', { level });
  });
  store.events.on('modeChanged', (mode) => {
    if (mode === 'factory') first('factory_opened');
  });
  store.events.on('wheelAdded', (index) => {
    if (index === 0) track('first_wheel');
  });
  store.events.on('boardChanged', (board) => track('board_unlocked', { board: board + 1 }));
  store.events.on('boost', ({ kind }) => {
    if (kind === 'frenzy') first('gift_claimed');
  });
  window.addEventListener('appinstalled', () => track('app_installed'));
}
