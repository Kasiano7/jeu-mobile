import { D, Decimal } from './bignum';
import { BOARDS, CARDS, FACTORY, OFFLINE, RUSH, levelThreshold } from './config';
import type { CardEffect, DropStats, FactoryStats, GameState } from './types';

/** Sum of perLevel * level over equipped cards with the given effect. */
export function cardBonus(s: GameState, effect: CardEffect): number {
  let total = 0;
  for (const id of s.cards.slots) {
    if (!id) continue;
    const def = CARDS[id];
    if (def.effect !== effect) continue;
    total += def.perLevel * (s.cards.owned[id] ?? 0);
  }
  return total;
}

/** Linear growth with a ×2 milestone every 25 levels (keeps payback times increasing). */
export const milestone = (level: number) => Math.pow(2, Math.floor(level / 25));

export function coinBaseValue(valueLevel: number): Decimal {
  return D(1 + valueLevel).mul(milestone(valueLevel));
}

/** Max physical coins spawned per second on the board. */
export const MAX_COIN_FLOW = 6;

export function getDropStats(s: GameState): DropStats {
  const u = s.drop.upgrades;
  const board = BOARDS[Math.min(s.drop.board, BOARDS.length - 1)];
  const coinValue = coinBaseValue(u.value)
    .mul(board.mult)
    .mul(1 + cardBonus(s, 'dropValue'));
  const rateMult = (1 + 0.1 * u.rate) * (1 + cardBonus(s, 'dropRate'));
  const gatePower = 1 + cardBonus(s, 'gatePower');
  const gateUnit = coinValue.mul(1.5 * (1 + 0.2 * u.gates) * gatePower);
  const rushLevel = cardBonus(s, 'rush');
  const droppers = 1 + u.dropper;
  const rawInterval = 1.5 / rateMult;
  const requestedRate = droppers / rawInterval;
  // Physics can only route so many coins at once: beyond the cap, each coin carries a batch.
  const batch = Math.max(1, requestedRate / MAX_COIN_FLOW);
  return {
    coinValue,
    spawnInterval: rawInterval * batch,
    requestedRate,
    batch,
    droppers,
    gateUnit,
    gateMultBoost: (1 + 0.06 * u.gates) * gatePower,
    binScale: (1 + 0.1 * u.bins) * (1 + cardBonus(s, 'binMult')),
    bumpers: u.obstacles >= 1,
    spinners: u.obstacles >= 2,
    splitter: u.obstacles >= 3,
    bumperBonus: coinValue.mul(0.5 * (1 + cardBonus(s, 'bumper'))),
    spinnerMult: 1.25,
    board,
    incomeMult: 1 + cardBonus(s, 'allIncome'),
    rushDuration: RUSH.baseDurationMs + rushLevel * 5000,
    orbInterval: RUSH.baseOrbInterval / (1 + 0.12 * rushLevel),
    maxCoins: 70,
  };
}

/** Effective multiplier of a gate with base power `p` (e.g. 1.5) under the given boost. */
export const gateMult = (p: number, boost: number) => 1 + (p - 1) * boost;

export function wheelMult(s: GameState, level: number): number {
  return (FACTORY.wheelBaseMult + FACTORY.wheelMultPerLevel * level) * (1 + cardBonus(s, 'wheelMult'));
}

export function getFactoryStats(s: GameState): FactoryStats {
  const f = s.factory.upgrades;
  const board = BOARDS[Math.min(s.drop.board, BOARDS.length - 1)];
  const beltSpeed = FACTORY.baseBeltSpeed * (1 + FACTORY.speedPerLevel * f.speed) * (1 + cardBonus(s, 'factorySpeed'));
  const itemValue = D(FACTORY.baseItemValue)
    .mul(1 + f.multiplier)
    .mul(milestone(f.multiplier))
    .mul(board.mult);
  const wheelMults = s.factory.wheels.map((lvl) => wheelMult(s, lvl));
  const totalMult = wheelMults.reduce((a, b) => a * b, 1);
  const itemsPerSecond = beltSpeed / FACTORY.itemSpacing;
  const incomeMult = 1 + cardBonus(s, 'allIncome');
  return {
    beltSpeed,
    itemValue,
    wheelMults,
    totalMult,
    itemsPerSecond,
    estimatedIncome: itemValue.mul(totalMult).mul(itemsPerSecond).mul(incomeMult),
    incomeMult,
  };
}

/** Level reached for a lifetime earning amount. */
export function levelFor(lifetime: Decimal): number {
  let l = 1;
  while (l < 500 && lifetime.gte(levelThreshold(l + 1))) l++;
  return l;
}

export function levelProgress(s: GameState): { level: number; progress: number; next: Decimal } {
  const level = levelFor(s.lifetimeEarned);
  const cur = levelThreshold(level);
  const next = levelThreshold(level + 1);
  const span = next.sub(cur);
  const progress = span.lte(0) ? 1 : Math.min(1, s.lifetimeEarned.sub(cur).div(span).toNumber());
  return { level, progress, next };
}

export function offlineParams(s: GameState): { capSeconds: number; efficiency: number } {
  const n = cardBonus(s, 'offline');
  return {
    capSeconds: (OFFLINE.baseCapHours + n) * 3600,
    efficiency: Math.min(1, OFFLINE.baseEfficiency + 0.08 * n),
  };
}

/** Offline gains for `elapsedMs` of absence, based on the measured income rate. */
export function computeOffline(s: GameState, elapsedMs: number): { seconds: number; amount: Decimal } {
  if (!(elapsedMs > 0)) return { seconds: 0, amount: D(0) };
  const { capSeconds, efficiency } = offlineParams(s);
  const seconds = Math.min(elapsedMs / 1000, capSeconds);
  if (seconds < OFFLINE.minSeconds) return { seconds: 0, amount: D(0) };
  return { seconds, amount: s.incomeRate.mul(seconds * efficiency).floor() };
}
