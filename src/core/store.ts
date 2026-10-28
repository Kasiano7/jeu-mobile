import { D, Decimal, ZERO, formatMoney } from './bignum';
import {
  BOARDS,
  CARDS,
  CARD_IDS,
  CARD_SLOTS,
  DROP_UPGRADES,
  FACTORY,
  FACTORY_UPGRADES,
  FREE_REWARD,
  MISSIONS,
  RARITY_WEIGHT,
  RUSH,
  endlessMission,
  packCost,
} from './config';
import { Emitter } from './emitter';
import { createInitialState, deserialize, localStorageAdapter, serialize, type StorageAdapter } from './save';
import { computeOffline, getDropStats, getFactoryStats, levelFor } from './stats';
import type {
  CardId,
  DropStats,
  DropUpgradeId,
  FactoryStats,
  FactoryUpgradeId,
  GameEvents,
  GameState,
  IncomeSource,
  MissionDef,
  Mode,
  Rarity,
  Settings,
} from './types';

const BUCKETS = 60;

export interface OfflineReport {
  seconds: number;
  amount: Decimal;
}

export class GameStore {
  state: GameState;
  mode: Mode = 'drop';
  readonly events = new Emitter<GameEvents>();
  /** Bumped (throttled) whenever anything visible changes; drives React re-renders. */
  version = 0;
  pendingOffline: OfflineReport | null = null;

  private listeners = new Set<() => void>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private dropStatsCache: DropStats | null = null;
  private factoryStatsCache: FactoryStats | null = null;
  private buckets: Decimal[] = Array.from({ length: BUCKETS }, () => ZERO);
  private bucketSecond = 0;
  private saveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private storage: StorageAdapter = localStorageAdapter,
    private now: () => number = () => Date.now(),
    private random: () => number = Math.random,
  ) {
    const raw = storage.load();
    const loaded = raw ? deserialize(raw, now()) : null;
    this.state = loaded ?? createInitialState(now());
    this.bucketSecond = Math.floor(now() / 1000);
    if (loaded) {
      const report = computeOffline(this.state, now() - this.state.lastSeen);
      if (report.amount.gt(0)) this.pendingOffline = report;
    }
    // Levels earned before the last save but not yet processed.
    this.state.level = Math.max(this.state.level, 1);
  }

  /* ------------------------------ React bridge ----------------------------- */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = () => this.version;

  /** Schedules a throttled UI refresh (max ~12/s). */
  private touch(immediate = false) {
    if (immediate) {
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = null;
      this.flush();
      return;
    }
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 80);
  }

  private flush() {
    this.version++;
    for (const l of this.listeners) l();
  }

  private statsChanged() {
    this.dropStatsCache = null;
    this.factoryStatsCache = null;
    this.events.emit('stats');
    this.touch(true);
  }

  /* -------------------------------- Derived -------------------------------- */

  get dropStats(): DropStats {
    return (this.dropStatsCache ??= getDropStats(this.state));
  }

  get factoryStats(): FactoryStats {
    return (this.factoryStatsCache ??= getFactoryStats(this.state));
  }

  isRush(t = this.now()) {
    return this.state.boosts.rushUntil > t;
  }

  isFrenzy(t = this.now()) {
    return this.state.boosts.frenzyUntil > t;
  }

  /** Measured income per second over the last `seconds` (real credits from both machines). */
  measuredRate(seconds = 10): Decimal {
    this.rollBuckets();
    const n = Math.max(1, Math.min(BUCKETS - 1, seconds));
    const cur = Math.floor(this.now() / 1000);
    let sum = ZERO;
    for (let i = 1; i <= n; i++) sum = sum.add(this.buckets[(cur - i) % BUCKETS]);
    return sum.div(n);
  }

  get factoryUnlocked() {
    return this.state.level >= FACTORY.unlockLevel;
  }

  /* -------------------------------- Income --------------------------------- */

  private rollBuckets() {
    const cur = Math.floor(this.now() / 1000);
    if (cur <= this.bucketSecond) return;
    const steps = Math.min(BUCKETS, cur - this.bucketSecond);
    for (let i = 1; i <= steps; i++) this.buckets[(this.bucketSecond + i) % BUCKETS] = ZERO;
    this.bucketSecond = cur;
  }

  /** Multiplier currently applied to a credit from `source`. */
  incomeMultiplier(source: IncomeSource): number {
    let m = 1;
    const t = this.now();
    if (source === 'drop') {
      m *= this.dropStats.incomeMult;
      if (this.isRush(t)) m *= RUSH.mult;
    }
    if (source === 'factory') m *= this.factoryStats.incomeMult;
    if ((source === 'drop' || source === 'factory') && this.isFrenzy(t)) m *= FREE_REWARD.frenzyMult;
    return m;
  }

  /**
   * Credits money produced by a machine. Returns the amount actually added
   * (after boosts) so the scene can display the true value.
   */
  earn(base: Decimal, source: IncomeSource): Decimal {
    const amount = base.mul(this.incomeMultiplier(source)).floor();
    if (amount.lte(0)) return ZERO;
    this.addMoney(amount, source);
    return amount;
  }

  private addMoney(amount: Decimal, source: IncomeSource) {
    this.state.money = this.state.money.add(amount);
    this.state.lifetimeEarned = this.state.lifetimeEarned.add(amount);
    if (source === 'drop' || source === 'factory') {
      this.rollBuckets();
      const i = this.bucketSecond % BUCKETS;
      this.buckets[i] = this.buckets[i].add(amount);
    }
    this.events.emit('credit', { amount, source });
    this.checkLevel();
    this.touch();
  }

  private spend(cost: Decimal): boolean {
    if (this.state.money.lt(cost)) return false;
    this.state.money = this.state.money.sub(cost);
    this.state.stats.upgradesBought++;
    this.haptic(12);
    return true;
  }

  private checkLevel() {
    const target = levelFor(this.state.lifetimeEarned);
    while (this.state.level < target) {
      this.state.level++;
      const money = D(25 * this.state.level).max(this.measuredRate(30).mul(10)).floor();
      this.state.money = this.state.money.add(money);
      const card = this.grantRandomCard(this.state.level >= 4 ? 1 : 0, true);
      this.events.emit('levelUp', { level: this.state.level, card, money });
      if (this.state.level === FACTORY.unlockLevel) {
        this.events.emit('toast', { text: '🏭 Money Factory débloquée !', tone: 'good' });
      }
      this.touch(true);
    }
  }

  /* ------------------------------ Money Drop -------------------------------- */

  dropUpgradeCost(id: DropUpgradeId): Decimal {
    return DROP_UPGRADES[id].cost(this.state.drop.upgrades[id]);
  }

  buyDropUpgrade(id: DropUpgradeId): boolean {
    const def = DROP_UPGRADES[id];
    const lvl = this.state.drop.upgrades[id];
    if (lvl >= def.max) return false;
    if ((def.minLevel ?? 0) > this.state.level) return false;
    if (!this.spend(def.cost(lvl))) return false;
    this.state.drop.upgrades[id] = lvl + 1;
    this.statsChanged();
    return true;
  }

  nextBoard() {
    return BOARDS[this.state.drop.board + 1] ?? null;
  }

  buyNextBoard(): boolean {
    const next = this.nextBoard();
    if (!next) return false;
    if (!this.spend(next.cost)) return false;
    this.state.drop.board = next.id;
    this.statsChanged();
    this.events.emit('boardChanged', next.id);
    this.events.emit('toast', { text: `🌟 Nouveau plateau : ${next.name} (×${next.mult})`, tone: 'good' });
    this.save();
    return true;
  }

  recordGateHit() {
    this.state.stats.gateHits++;
  }

  recordBumperHit() {
    this.state.stats.bumperHits++;
  }

  recordCoin(bestBin: boolean) {
    this.state.stats.coinsCollected++;
    if (bestBin) this.state.stats.bestBinHits++;
  }

  recordTap() {
    this.state.stats.taps++;
  }

  activateRush() {
    const t = this.now();
    const until = Math.max(this.state.boosts.rushUntil, t) + this.dropStats.rushDuration;
    this.state.boosts.rushUntil = Math.min(until, t + this.dropStats.rushDuration * 3);
    this.state.stats.orbsCaught++;
    this.events.emit('boost', { kind: 'rush', until: this.state.boosts.rushUntil });
    this.haptic(30);
    this.touch(true);
  }

  /* -------------------------------- Factory -------------------------------- */

  factoryUpgradeCost(id: FactoryUpgradeId): Decimal {
    return FACTORY_UPGRADES[id].cost(this.state.factory.upgrades[id]);
  }

  buyFactoryUpgrade(id: FactoryUpgradeId): boolean {
    const def = FACTORY_UPGRADES[id];
    const lvl = this.state.factory.upgrades[id];
    if (lvl >= def.max) return false;
    if (!this.spend(def.cost(lvl))) return false;
    this.state.factory.upgrades[id] = lvl + 1;
    this.statsChanged();
    return true;
  }

  get wheelCost(): Decimal {
    return FACTORY.wheelCost(this.state.factory.wheels.length);
  }

  get canAddWheel(): boolean {
    return this.state.factory.wheels.length < this.state.factory.slotsUnlocked;
  }

  addWheel(): boolean {
    if (!this.canAddWheel) return false;
    if (!this.spend(this.wheelCost)) return false;
    this.state.factory.wheels.push(0);
    const index = this.state.factory.wheels.length - 1;
    this.statsChanged();
    this.events.emit('wheelAdded', index);
    return true;
  }

  wheelUpgradeCost(index: number): Decimal {
    return FACTORY.wheelUpgradeCost(index, this.state.factory.wheels[index] ?? 0);
  }

  upgradeWheel(index: number): boolean {
    const lvl = this.state.factory.wheels[index];
    if (lvl === undefined || lvl >= FACTORY.wheelMaxLevel) return false;
    if (!this.spend(this.wheelUpgradeCost(index))) return false;
    this.state.factory.wheels[index] = lvl + 1;
    this.statsChanged();
    this.events.emit('wheelUpgraded', index);
    return true;
  }

  get expandCost(): Decimal | null {
    if (this.state.factory.slotsUnlocked >= FACTORY.maxSlots) return null;
    return FACTORY.expandCost(this.state.factory.slotsUnlocked);
  }

  expandFactory(): boolean {
    const cost = this.expandCost;
    if (!cost || !this.spend(cost)) return false;
    this.state.factory.slotsUnlocked = Math.min(FACTORY.maxSlots, this.state.factory.slotsUnlocked + 2);
    this.statsChanged();
    this.events.emit('slotsExpanded', this.state.factory.slotsUnlocked);
    return true;
  }

  recordItem() {
    this.state.stats.itemsProcessed++;
  }

  /* --------------------------------- Cards --------------------------------- */

  get packCost(): Decimal {
    return packCost(this.state.cards.packsBought);
  }

  buyPack(): CardId | null {
    if (!this.spend(this.packCost)) return null;
    this.state.cards.packsBought++;
    const id = this.grantRandomCard(0);
    this.touch(true);
    return id;
  }

  /** Picks a weighted random card; `rarityBoost` shifts odds towards rarer cards. */
  private grantRandomCard(rarityBoost: number, silent = false): CardId | null {
    const available = CARD_IDS.filter((id) => (this.state.cards.owned[id] ?? 0) < CARDS[id].maxLevel);
    if (available.length === 0) return null;
    const weights = available.map((id) => {
      const r: Rarity = CARDS[id].rarity;
      const w = RARITY_WEIGHT[r];
      return r === 'common' ? w : w * (1 + rarityBoost);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = this.random() * total;
    let pick = available[available.length - 1];
    for (let i = 0; i < available.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        pick = available[i];
        break;
      }
    }
    const prev = this.state.cards.owned[pick] ?? 0;
    this.state.cards.owned[pick] = prev + 1;
    this.state.stats.packsOpened++;
    if (prev === 0) {
      // Auto-equip new cards when a slot is free: the player sees the effect immediately.
      const free = this.firstFreeSlot();
      if (free >= 0) this.state.cards.slots[free] = pick;
    }
    this.statsChanged();
    if (!silent) this.events.emit('cardGained', { id: pick, level: prev + 1, isNew: prev === 0 });
    return pick;
  }

  private firstFreeSlot(): number {
    for (let i = 0; i < this.state.cards.slotsUnlocked; i++) if (!this.state.cards.slots[i]) return i;
    return -1;
  }

  equipCard(id: CardId, slot?: number): boolean {
    if (!this.state.cards.owned[id]) return false;
    if (this.state.cards.slots.includes(id)) return false;
    const target = slot ?? this.firstFreeSlot();
    if (target < 0 || target >= this.state.cards.slotsUnlocked) return false;
    this.state.cards.slots[target] = id;
    this.statsChanged();
    return true;
  }

  unequipSlot(slot: number): boolean {
    if (!this.state.cards.slots[slot]) return false;
    this.state.cards.slots[slot] = null;
    this.statsChanged();
    return true;
  }

  get cardSlotCost(): Decimal | null {
    if (this.state.cards.slotsUnlocked >= CARD_SLOTS.max) return null;
    return CARD_SLOTS.cost(this.state.cards.slotsUnlocked);
  }

  buyCardSlot(): boolean {
    const cost = this.cardSlotCost;
    if (!cost || !this.spend(cost)) return false;
    this.state.cards.slotsUnlocked++;
    this.touch(true);
    return true;
  }

  /* ------------------------------- Missions -------------------------------- */

  activeMissions(count = 3): MissionDef[] {
    const out: MissionDef[] = [];
    const claimed = new Set(this.state.missions.claimed);
    for (const m of MISSIONS) {
      if (!claimed.has(m.id)) out.push(m);
      if (out.length >= count) return out;
    }
    for (let n = 0; out.length < count && n < 1000; n++) {
      const m = endlessMission(n);
      if (!claimed.has(m.id)) out.push(m);
    }
    return out;
  }

  missionReward(m: MissionDef): Decimal {
    return D(m.reward.minMoney).max(this.measuredRate(30).mul(m.reward.incomeSeconds)).floor();
  }

  claimMission(id: string): boolean {
    const m = this.activeMissions().find((x) => x.id === id);
    if (!m || m.progress(this.state) < m.target) return false;
    this.state.missions.claimed.push(id);
    const reward = this.missionReward(m);
    this.addMoney(reward, 'mission');
    if (m.reward.card) this.grantRandomCard(1);
    this.events.emit('toast', { text: `✅ Mission : +${formatMoney(reward)}`, tone: 'good' });
    this.haptic(25);
    this.touch(true);
    return true;
  }

  get claimableMissions(): number {
    return this.activeMissions().filter((m) => m.progress(this.state) >= m.target).length;
  }

  /* ------------------------------ Free reward ------------------------------ */

  freeRewardIn(): number {
    return Math.max(0, this.state.boosts.freeRewardReadyAt - this.now());
  }

  freeRewardAmount(): Decimal {
    return D(FREE_REWARD.minMoney).max(this.measuredRate(30).mul(FREE_REWARD.incomeSeconds)).floor();
  }

  claimFreeReward(): Decimal | null {
    if (this.freeRewardIn() > 0) return null;
    const t = this.now();
    const amount = this.freeRewardAmount();
    this.state.boosts.freeRewardReadyAt = t + FREE_REWARD.cooldownMs;
    this.state.boosts.frenzyUntil = Math.max(this.state.boosts.frenzyUntil, t) + FREE_REWARD.frenzyMs;
    this.state.stats.rewardsClaimed++;
    this.addMoney(amount, 'reward');
    this.events.emit('boost', { kind: 'frenzy', until: this.state.boosts.frenzyUntil });
    this.haptic(40);
    this.touch(true);
    return amount;
  }

  /* -------------------------------- Offline -------------------------------- */

  collectOffline(): Decimal {
    const report = this.pendingOffline;
    this.pendingOffline = null;
    if (!report) return ZERO;
    this.addMoney(report.amount, 'offline');
    this.touch(true);
    return report.amount;
  }

  /** Called when the app returns from the background (the game loop was paused). */
  resumeAfter(elapsedMs: number) {
    const report = computeOffline(this.state, elapsedMs);
    if (report.amount.gt(0)) {
      this.pendingOffline = report;
      this.touch(true);
    }
  }

  /* --------------------------------- Misc ---------------------------------- */

  setMode(mode: Mode) {
    if (mode === 'factory' && !this.factoryUnlocked) {
      this.events.emit('toast', { text: `🔒 Usine débloquée au niveau ${FACTORY.unlockLevel}`, tone: 'warn' });
      return;
    }
    if (this.mode === mode) return;
    this.mode = mode;
    this.events.emit('modeChanged', mode);
    this.touch(true);
  }

  updateSettings(patch: Partial<Settings>) {
    this.state.settings = { ...this.state.settings, ...patch };
    this.events.emit('settings', this.state.settings);
    this.save();
    this.touch(true);
  }

  haptic(ms: number) {
    if (!this.state.settings.haptics) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* unsupported */
    }
  }

  save() {
    this.state.lastSeen = this.now();
    // Persist a conservative long-window income rate for offline gains.
    const rate = this.measuredRate(30);
    if (rate.gt(0) || this.state.incomeRate.eq(0)) this.state.incomeRate = rate;
    this.storage.save(serialize(this.state));
  }

  startAutosave(intervalMs = 5000) {
    this.stopAutosave();
    this.saveTimer = setInterval(() => this.save(), intervalMs);
  }

  stopAutosave() {
    if (this.saveTimer) clearInterval(this.saveTimer);
    this.saveTimer = null;
  }

  reset() {
    this.storage.clear();
    const settings = this.state.settings;
    this.state = createInitialState(this.now());
    this.state.settings = settings;
    this.buckets = this.buckets.map(() => ZERO);
    this.pendingOffline = null;
    this.mode = 'drop';
    this.statsChanged();
    this.events.emit('reset');
    this.events.emit('modeChanged', 'drop');
    this.save();
  }
}
