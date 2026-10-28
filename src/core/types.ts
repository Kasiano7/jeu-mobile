/**
 * Shared contracts between the economy core, the Phaser scenes and the React UI.
 * Scenes never mutate GameState directly: they read derived stats and call store actions.
 */
import type { Decimal } from './bignum';

export type Mode = 'drop' | 'factory';

export type DropUpgradeId = 'value' | 'rate' | 'dropper' | 'gates' | 'bins' | 'obstacles';
export type FactoryUpgradeId = 'speed' | 'multiplier';

export type CardId =
  | 'goldenTouch'
  | 'overclock'
  | 'luckyBins'
  | 'gatekeeper'
  | 'turboBelt'
  | 'cogMaster'
  | 'nightShift'
  | 'midas'
  | 'rushHour'
  | 'bouncer';

export type CardEffect =
  | 'dropValue'
  | 'dropRate'
  | 'binMult'
  | 'gatePower'
  | 'factorySpeed'
  | 'wheelMult'
  | 'offline'
  | 'allIncome'
  | 'rush'
  | 'bumper';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export type IncomeSource = 'drop' | 'factory' | 'reward' | 'offline' | 'mission' | 'level';

export interface Settings {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
}

export interface GameStats {
  coinsCollected: number;
  gateHits: number;
  bumperHits: number;
  bestBinHits: number;
  itemsProcessed: number;
  upgradesBought: number;
  orbsCaught: number;
  packsOpened: number;
  rewardsClaimed: number;
  taps: number;
}

export interface GameState {
  version: number;
  money: Decimal;
  lifetimeEarned: Decimal;
  createdAt: number;
  lastSeen: number;
  /** Level whose rewards have already been granted. */
  level: number;
  drop: {
    upgrades: Record<DropUpgradeId, number>;
    /** Index of the current board (0-based); every board up to it is unlocked. */
    board: number;
  };
  factory: {
    upgrades: Record<FactoryUpgradeId, number>;
    /** One entry per bought wheel, in chain order: the wheel's own upgrade level. */
    wheels: number[];
    slotsUnlocked: number;
  };
  cards: {
    /** Card level; absent or 0 means not owned. */
    owned: Partial<Record<CardId, number>>;
    slots: (CardId | null)[];
    slotsUnlocked: number;
    packsBought: number;
  };
  missions: {
    claimed: string[];
  };
  boosts: {
    rushUntil: number;
    frenzyUntil: number;
    freeRewardReadyAt: number;
  };
  /** Measured income per second (real credits, rolling average), used for offline gains. */
  incomeRate: Decimal;
  stats: GameStats;
  settings: Settings;
  /** Reserved for a future prestige layer. */
  prestige: { points: Decimal; count: number };
}

export interface BinDef {
  mult: number;
  /** Relative width weight. */
  width: number;
  jackpot?: boolean;
}

export type GateKind = 'add' | 'mult' | 'split';

export interface GateDef {
  kind: GateKind;
  /** For 'add' gates: multiplier applied to the gate unit. For 'mult': base multiplier. */
  power: number;
  /** Normalised centre x (0..1) and band index. */
  x: number;
  band: number;
  width: number;
  /** Optional horizontal oscillation amplitude (normalised). */
  sway?: number;
}

export interface BoardDef {
  id: number;
  name: string;
  cost: Decimal;
  /** Permanent multiplier on coin value while this board is active. */
  mult: number;
  palette: { bg1: number; bg2: number; accent: number; peg: number; frame: number; css: string };
  bins: BinDef[];
  gates: GateDef[];
  pegRows: number;
  luckyCoins: boolean;
}

export interface DropStats {
  coinValue: Decimal;
  /** Seconds between two coins of one dropper (after the physics flow cap). */
  spawnInterval: number;
  /** Production rate the upgrades ask for, in coins/s (before the flow cap). */
  requestedRate: number;
  /** Coins represented by each physical coin once the flow cap is reached (>= 1). */
  batch: number;
  droppers: number;
  gateUnit: Decimal;
  gateMultBoost: number;
  binScale: number;
  bumpers: boolean;
  spinners: boolean;
  splitter: boolean;
  bumperBonus: Decimal;
  spinnerMult: number;
  board: BoardDef;
  /** Applied on credit (cards). */
  incomeMult: number;
  rushDuration: number;
  orbInterval: number;
  maxCoins: number;
}

export interface FactoryStats {
  beltSpeed: number;
  itemValue: Decimal;
  wheelMults: number[];
  totalMult: number;
  itemsPerSecond: number;
  /** Theoretical income per second; display only as an estimate, never credited directly. */
  estimatedIncome: Decimal;
  incomeMult: number;
}

export interface UpgradeView {
  id: string;
  label: string;
  icon: string;
  level: number;
  maxed: boolean;
  cost: Decimal;
  affordable: boolean;
  locked?: string;
  current: string;
  next: string;
}

export interface CardDef {
  id: CardId;
  name: string;
  icon: string;
  rarity: Rarity;
  effect: CardEffect;
  perLevel: number;
  maxLevel: number;
  describe: (level: number) => string;
}

export interface MissionDef {
  id: string;
  label: string;
  target: number;
  progress: (s: GameState) => number;
  reward: { incomeSeconds: number; minMoney: number; card?: boolean };
}

export interface GameEvents {
  /** Money credited by a scene (for HUD flashes / sfx). */
  credit: { amount: Decimal; source: IncomeSource };
  /** Upgrades/cards changed: derived stats must be re-read. */
  stats: void;
  boardChanged: number;
  wheelAdded: number;
  wheelUpgraded: number;
  slotsExpanded: number;
  levelUp: { level: number; card: CardId | null; money: Decimal };
  cardGained: { id: CardId; level: number; isNew: boolean };
  modeChanged: Mode;
  boost: { kind: 'rush' | 'frenzy'; until: number };
  toast: { text: string; tone?: 'good' | 'info' | 'warn' };
  ui: { open: 'wheel'; index: number };
  settings: Settings;
  reset: void;
}
