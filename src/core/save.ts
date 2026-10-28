import { D } from './bignum';
import { CARD_IDS, CARD_SLOTS, DROP_UPGRADES, FACTORY, FACTORY_UPGRADES } from './config';
import type { CardId, GameState } from './types';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'money-machine.save.v1';

/** Storage abstraction so a Capacitor Preferences backend can be dropped in later. */
export interface StorageAdapter {
  load(): string | null;
  save(data: string): void;
  clear(): void;
}

export const localStorageAdapter: StorageAdapter = {
  load() {
    try {
      return localStorage.getItem(SAVE_KEY);
    } catch {
      return null;
    }
  },
  save(data) {
    try {
      localStorage.setItem(SAVE_KEY, data);
    } catch {
      /* quota or private mode: game keeps running */
    }
  },
  clear() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  },
};

export function memoryAdapter(): StorageAdapter {
  let data: string | null = null;
  return {
    load: () => data,
    save: (d) => {
      data = d;
    },
    clear: () => {
      data = null;
    },
  };
}

const prefersReducedMotion = () => {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export function createInitialState(now = Date.now()): GameState {
  return {
    version: SAVE_VERSION,
    money: D(0),
    lifetimeEarned: D(0),
    createdAt: now,
    lastSeen: now,
    level: 1,
    drop: {
      upgrades: { value: 0, rate: 0, dropper: 0, gates: 0, bins: 0, obstacles: 0 },
      board: 0,
    },
    factory: {
      upgrades: { speed: 0, multiplier: 0 },
      wheels: [],
      slotsUnlocked: FACTORY.initialSlots,
    },
    cards: {
      owned: {},
      slots: Array.from({ length: CARD_SLOTS.max }, () => null),
      slotsUnlocked: CARD_SLOTS.initial,
      packsBought: 0,
    },
    missions: { claimed: [] },
    boosts: { rushUntil: 0, frenzyUntil: 0, freeRewardReadyAt: 0 },
    incomeRate: D(0),
    pendingOffline: null,
    stats: {
      coinsCollected: 0,
      gateHits: 0,
      bumperHits: 0,
      bestBinHits: 0,
      itemsProcessed: 0,
      upgradesBought: 0,
      orbsCaught: 0,
      packsOpened: 0,
      rewardsClaimed: 0,
      taps: 0,
    },
    settings: { sound: true, haptics: true, reducedMotion: prefersReducedMotion() },
    prestige: { points: D(0), count: 0 },
  };
}

export function serialize(s: GameState): string {
  return JSON.stringify({
    ...s,
    money: s.money.toString(),
    lifetimeEarned: s.lifetimeEarned.toString(),
    incomeRate: s.incomeRate.toString(),
    pendingOffline: s.pendingOffline ? { seconds: s.pendingOffline.seconds, amount: s.pendingOffline.amount.toString() } : null,
    prestige: { ...s.prestige, points: s.prestige.points.toString() },
  });
}

const num = (v: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback;
  return Math.max(min, Math.min(max, n));
};

const dec = (v: unknown) => {
  try {
    const d = D(typeof v === 'string' || typeof v === 'number' ? v : 0);
    // Reject NaN/Infinity mantissas or exponents (a NaN exponent would make every price affordable).
    return Number.isFinite(d.mantissa) && Number.isFinite(d.exponent) && Math.abs(d.exponent) < 9e15 && d.gte(0) ? d : D(0);
  } catch {
    return D(0);
  }
};

/**
 * Parses and validates a save. Unknown/invalid fields fall back to defaults so a
 * corrupted or older save never crashes the game.
 */
export function deserialize(raw: string, now = Date.now()): GameState | null {
  let o: any;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object') return null;
  const base = createInitialState(now);
  const s: GameState = {
    ...base,
    version: SAVE_VERSION,
    money: dec(o.money),
    lifetimeEarned: dec(o.lifetimeEarned),
    incomeRate: dec(o.incomeRate),
    pendingOffline:
      o.pendingOffline && typeof o.pendingOffline === 'object'
        ? { seconds: num(o.pendingOffline.seconds, 0), amount: dec(o.pendingOffline.amount) }
        : null,
    createdAt: num(o.createdAt, now),
    lastSeen: num(o.lastSeen, now),
    level: num(o.level, 1, 1, 1000),
  };
  const du = o.drop?.upgrades ?? {};
  for (const k of Object.keys(base.drop.upgrades) as (keyof typeof base.drop.upgrades)[]) {
    s.drop.upgrades[k] = num(du[k], 0, 0, DROP_UPGRADES[k].max);
  }
  s.drop.board = num(o.drop?.board, 0, 0, 4);
  const fu = o.factory?.upgrades ?? {};
  s.factory.upgrades.speed = num(fu.speed, 0, 0, FACTORY_UPGRADES.speed.max);
  s.factory.upgrades.multiplier = num(fu.multiplier, 0, 0, FACTORY_UPGRADES.multiplier.max);
  s.factory.slotsUnlocked = num(o.factory?.slotsUnlocked, FACTORY.initialSlots, FACTORY.initialSlots, FACTORY.maxSlots);
  const wheels = Array.isArray(o.factory?.wheels) ? o.factory.wheels : [];
  s.factory.wheels = wheels.slice(0, s.factory.slotsUnlocked).map((w: unknown) => num(w, 0, 0, FACTORY.wheelMaxLevel));

  const owned = o.cards?.owned ?? {};
  for (const id of CARD_IDS) {
    const l = num(owned[id], 0, 0, 10);
    if (l > 0) s.cards.owned[id] = l;
  }
  s.cards.slotsUnlocked = num(o.cards?.slotsUnlocked, CARD_SLOTS.initial, CARD_SLOTS.initial, CARD_SLOTS.max);
  const slots: unknown[] = Array.isArray(o.cards?.slots) ? o.cards.slots : [];
  const seen = new Set<string>();
  s.cards.slots = base.cards.slots.map((_, i) => {
    const id = slots[i];
    if (typeof id !== 'string' || !s.cards.owned[id as CardId] || seen.has(id) || i >= s.cards.slotsUnlocked) return null;
    seen.add(id);
    return id as CardId;
  });
  s.cards.packsBought = num(o.cards?.packsBought, 0);

  s.missions.claimed = Array.isArray(o.missions?.claimed) ? o.missions.claimed.filter((x: unknown) => typeof x === 'string') : [];
  s.boosts.rushUntil = num(o.boosts?.rushUntil, 0);
  s.boosts.frenzyUntil = num(o.boosts?.frenzyUntil, 0);
  s.boosts.freeRewardReadyAt = num(o.boosts?.freeRewardReadyAt, 0);
  for (const k of Object.keys(base.stats) as (keyof typeof base.stats)[]) {
    s.stats[k] = num(o.stats?.[k], 0);
  }
  s.settings = {
    sound: o.settings?.sound !== false,
    haptics: o.settings?.haptics !== false,
    reducedMotion: o.settings?.reducedMotion === true,
  };
  s.prestige = { points: dec(o.prestige?.points), count: num(o.prestige?.count, 0) };
  return s;
}
