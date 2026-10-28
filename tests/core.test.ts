import { describe, expect, it } from 'vitest';
import { D, formatMoney, formatNumber, geometricCost } from '../src/core/bignum';
import { BOARDS, DROP_UPGRADES, FACTORY, levelThreshold } from '../src/core/config';
import { createInitialState, deserialize, memoryAdapter, serialize } from '../src/core/save';
import { computeOffline, getDropStats, getFactoryStats, levelFor } from '../src/core/stats';
import { GameStore } from '../src/core/store';

function makeStore(t0 = 1_000_000) {
  let t = t0;
  const storage = memoryAdapter();
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const store = new GameStore(storage, clock.now, rand);
  return { store, storage, clock };
}

describe('formatting', () => {
  it('formats small and large numbers', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(12_345)).toBe('12.3K');
    expect(formatNumber(999_999)).toBe('999K');
    expect(formatNumber(1_000_000)).toBe('1M');
    expect(formatNumber(2.5e9)).toBe('2.5B');
    expect(formatNumber(1e12)).toBe('1T');
    expect(formatNumber(D('1e60'))).toMatch(/^1[a-z]{2}$/);
    expect(formatMoney(1234)).toBe('$1.23K');
  });

  it('handles huge values without precision errors', () => {
    const big = D('1e300').mul(3);
    expect(big.gt(D('1e300'))).toBe(true);
    expect(formatNumber(big).length).toBeLessThan(8);
  });

  it('computes geometric costs', () => {
    expect(geometricCost(10, 2, 3).toNumber()).toBe(80);
    expect(DROP_UPGRADES.value.cost(0).toNumber()).toBe(15);
    expect(DROP_UPGRADES.value.cost(5).gt(DROP_UPGRADES.value.cost(4))).toBe(true);
  });
});

describe('store economy', () => {
  it('credits real earnings and applies boosts', () => {
    const { store } = makeStore();
    expect(store.earn(D(100), 'drop').toNumber()).toBe(100);
    expect(store.state.money.toNumber()).toBe(100);
    store.state.boosts.rushUntil = Number.MAX_SAFE_INTEGER;
    expect(store.earn(D(100), 'drop').toNumber()).toBe(200);
    expect(store.earn(D(100), 'factory').toNumber()).toBe(100);
    expect(store.state.lifetimeEarned.toNumber()).toBe(400);
  });

  it('buys upgrades only when affordable, with increasing prices', () => {
    const { store } = makeStore();
    expect(store.buyDropUpgrade('value')).toBe(false);
    store.earn(D(1000), 'drop');
    const before = store.dropStats.coinValue;
    const cost0 = store.dropUpgradeCost('value');
    const money0 = store.state.money.toNumber();
    expect(store.buyDropUpgrade('value')).toBe(true);
    expect(store.state.money.toNumber()).toBe(money0 - cost0.toNumber());
    expect(store.dropStats.coinValue.gt(before)).toBe(true);
    expect(store.dropUpgradeCost('value').gt(cost0)).toBe(true);
  });

  it('rate upgrades reduce the spawn interval', () => {
    const { store } = makeStore();
    store.earn(D(1e6), 'drop');
    const i0 = store.dropStats.spawnInterval;
    store.buyDropUpgrade('rate');
    expect(store.dropStats.spawnInterval).toBeLessThan(i0);
  });

  it('adds wheels up to the unlocked slots, then needs expansion', () => {
    const { store } = makeStore();
    store.earn(D('1e12'), 'drop');
    const m0 = store.factoryStats.totalMult;
    for (let i = 0; i < FACTORY.initialSlots; i++) expect(store.addWheel()).toBe(true);
    expect(store.addWheel()).toBe(false);
    expect(store.factoryStats.totalMult).toBeGreaterThan(m0);
    expect(store.factoryStats.wheelMults).toHaveLength(FACTORY.initialSlots);
    expect(store.expandFactory()).toBe(true);
    expect(store.addWheel()).toBe(true);
    const mult = store.factoryStats.wheelMults[0];
    expect(store.upgradeWheel(0)).toBe(true);
    expect(store.factoryStats.wheelMults[0]).toBeGreaterThan(mult);
  });

  it('levels up from lifetime earnings and grants rewards', () => {
    const { store } = makeStore();
    const levels: number[] = [];
    store.events.on('levelUp', (e) => levels.push(e.level));
    store.earn(levelThreshold(4), 'drop');
    expect(levels).toEqual([2, 3, 4]);
    expect(store.factoryUnlocked).toBe(true);
    expect(Object.keys(store.state.cards.owned).length).toBeGreaterThan(0);
  });

  it('cards change derived stats only when equipped', () => {
    const { store } = makeStore();
    store.state.cards.owned.goldenTouch = 2;
    const v0 = store.dropStats.coinValue;
    expect(store.equipCard('goldenTouch')).toBe(true);
    expect(store.dropStats.coinValue.toNumber()).toBeCloseTo(v0.toNumber() * 1.5);
    store.unequipSlot(0);
    expect(store.dropStats.coinValue.toNumber()).toBeCloseTo(v0.toNumber());
  });

  it('missions are claimable once complete', () => {
    const { store } = makeStore();
    const first = store.activeMissions()[0];
    expect(store.claimMission(first.id)).toBe(false);
    store.state.stats.coinsCollected = 25;
    expect(store.claimMission(first.id)).toBe(true);
    expect(store.activeMissions()[0].id).not.toBe(first.id);
  });

  it('free reward has a cooldown', () => {
    const { store, clock } = makeStore();
    expect(store.claimFreeReward()).not.toBeNull();
    expect(store.claimFreeReward()).toBeNull();
    clock.advance(5 * 60_000);
    expect(store.claimFreeReward()).not.toBeNull();
  });

  it('board unlock raises the coin value multiplier', () => {
    const { store } = makeStore();
    store.earn(BOARDS[1].cost, 'drop');
    const v0 = store.dropStats.coinValue;
    expect(store.buyNextBoard()).toBe(true);
    expect(store.dropStats.coinValue.div(v0).toNumber()).toBeCloseTo(BOARDS[1].mult);
  });
});

describe('save / load', () => {
  it('round-trips state and computes capped offline gains', () => {
    const { store, storage, clock } = makeStore();
    store.earn(D('123456789012345678901234567890'), 'drop');
    store.state.drop.upgrades.value = 7;
    store.state.factory.wheels = [1, 2];
    store.state.cards.owned.midas = 3;
    store.state.cards.slots[0] = 'midas';
    store.state.incomeRate = D(100);
    storage.save(serialize(store.state));
    clock.advance(10 * 3600_000);
    const reloaded = new GameStore(storage, clock.now);
    expect(reloaded.state.money.eq(store.state.money)).toBe(true);
    expect(reloaded.state.drop.upgrades.value).toBe(7);
    expect(reloaded.state.factory.wheels).toEqual([1, 2]);
    expect(reloaded.state.cards.slots[0]).toBe('midas');
    // 2h cap at 50% efficiency.
    expect(reloaded.pendingOffline?.amount.toNumber()).toBe(100 * 7200 * 0.5);
  });

  it('accumulates uncollected offline gains across absences and persists them', () => {
    const { store, storage, clock } = makeStore();
    store.state.incomeRate = D(10);
    store.save();
    clock.advance(600_000);
    const a = new GameStore(storage, clock.now);
    expect(a.pendingOffline?.amount.toNumber()).toBe(10 * 600 * 0.5);
    clock.advance(600_000); // closed again without collecting
    const b = new GameStore(storage, clock.now);
    expect(b.pendingOffline?.amount.toNumber()).toBe(10 * 1200 * 0.5);
    b.resumeAfter(60_000);
    expect(b.pendingOffline?.amount.toNumber()).toBe(10 * 1260 * 0.5);
    expect(b.collectOffline().toNumber()).toBe(6300);
    expect(new GameStore(storage, clock.now).pendingOffline).toBeNull();
  });

  it('does not count temporary boosts in the offline/reward income rate', () => {
    const { store, clock } = makeStore();
    store.state.boosts.rushUntil = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < 5; i++) {
      store.earn(D(100), 'drop');
      clock.advance(1000);
    }
    expect(store.measuredRate(5).toNumber()).toBe(200);
    expect(store.measuredRate(5, true).toNumber()).toBe(100);
  });

  it('never charges for a pack when the collection is complete', () => {
    const { store } = makeStore();
    for (const id of Object.keys(store.state.cards.owned)) delete (store.state.cards.owned as any)[id];
    for (const id of ['goldenTouch', 'luckyBins', 'gatekeeper', 'turboBelt', 'overclock', 'cogMaster', 'nightShift', 'rushHour', 'bouncer', 'midas'] as const)
      store.state.cards.owned[id] = 10;
    store.earn(D(1e9), 'reward');
    const m0 = store.state.money.toString();
    expect(store.buyPack()).toBeNull();
    expect(store.state.money.toString()).toBe(m0);
  });

  it('factory purchases require the factory to be unlocked', () => {
    const { store } = makeStore();
    store.state.money = D(1e12);
    expect(store.factoryUnlocked).toBe(false);
    expect(store.addWheel()).toBe(false);
    expect(store.buyFactoryUpgrade('speed')).toBe(false);
  });

  it('survives corrupted saves', () => {
    expect(deserialize('not json')).toBeNull();
    const s = deserialize(JSON.stringify({ money: 'garbage', drop: { upgrades: { value: -5 } }, cards: { slots: ['nope'] } }))!;
    expect(s.money.toNumber()).toBe(0);
    expect(s.drop.upgrades.value).toBe(0);
    expect(s.cards.slots[0]).toBeNull();
    const bad = deserialize(JSON.stringify({ money: '1eNaN', lifetimeEarned: 'Infinity', drop: { upgrades: { dropper: 10_000 } } }))!;
    expect(bad.money.toNumber()).toBe(0);
    expect(bad.lifetimeEarned.toNumber()).toBe(0);
    expect(bad.drop.upgrades.dropper).toBe(DROP_UPGRADES.dropper.max);
  });

  it('ignores negative elapsed time (clock moved backwards)', () => {
    const s = createInitialState();
    s.incomeRate = D(10);
    expect(computeOffline(s, -5000).amount.toNumber()).toBe(0);
  });
});

describe('stats', () => {
  it('level thresholds are monotonic', () => {
    for (let l = 2; l < 40; l++) expect(levelThreshold(l + 1).gt(levelThreshold(l))).toBe(true);
    expect(levelFor(D(0))).toBe(1);
    expect(levelFor(levelThreshold(10))).toBe(10);
  });

  it('caps the physical coin flow but keeps the requested production', () => {
    const s = createInitialState();
    s.drop.upgrades.rate = 25;
    s.drop.upgrades.dropper = 4;
    const d = getDropStats(s);
    const physical = d.droppers / d.spawnInterval;
    expect(physical).toBeLessThanOrEqual(6.0001);
    expect(physical * d.batch).toBeCloseTo(d.requestedRate);
    const low = getDropStats(createInitialState());
    expect(low.batch).toBe(1);
  });

  it('derived stats are finite at extreme levels', () => {
    const s = createInitialState();
    s.drop.upgrades = { value: 400, rate: 30, dropper: 4, gates: 150, bins: 150, obstacles: 3 };
    s.drop.board = 4;
    s.factory.upgrades = { speed: 30, multiplier: 300 };
    s.factory.wheels = [25, 25, 25, 25, 25, 25, 25, 25];
    const d = getDropStats(s);
    const f = getFactoryStats(s);
    expect(Number.isFinite(d.coinValue.mantissa)).toBe(true);
    expect(d.spawnInterval).toBeGreaterThan(0.1);
    expect(Number.isFinite(f.estimatedIncome.mantissa)).toBe(true);
  });
});
