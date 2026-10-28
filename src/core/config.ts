import { D, Decimal, formatMoney } from './bignum';
import type { BoardDef, CardDef, CardId, DropUpgradeId, FactoryUpgradeId, MissionDef, Rarity } from './types';

/* ------------------------------------------------------------------------- */
/* Money Drop upgrades                                                        */
/* ------------------------------------------------------------------------- */

export interface LevelledUpgradeDef {
  label: string;
  icon: string;
  max: number;
  /** cost(level) -> price to go from level to level+1 */
  cost: (level: number) => Decimal;
  /** Level required (player level) to show it unlocked. */
  minLevel?: number;
}

const geo = (base: number, growth: number) => (l: number) => D(base).mul(Decimal.pow(growth, l)).floor();
const table = (prices: number[]) => (l: number) => D(prices[Math.min(l, prices.length - 1)]);

export const DROP_UPGRADES: Record<DropUpgradeId, LevelledUpgradeDef> = {
  value: { label: 'Valeur', icon: '💵', max: 400, cost: geo(10, 1.3) },
  rate: { label: 'Cadence', icon: '⏱️', max: 25, cost: geo(40, 1.8) },
  dropper: { label: 'Générateur', icon: '🏭', max: 4, cost: table([600, 150_000, 60_000_000, 40_000_000_000]) },
  gates: { label: 'Portes', icon: '✨', max: 150, cost: geo(100, 1.45), minLevel: 1 },
  bins: { label: 'Bacs', icon: '🧺', max: 150, cost: geo(250, 1.5), minLevel: 1 },
  obstacles: { label: 'Obstacles', icon: '🎯', max: 3, cost: table([6_000, 1_500_000, 600_000_000]), minLevel: 2 },
};

export const OBSTACLE_NAMES = ['Aucun', 'Bumpers', 'Hélices', 'Portes Split'];

/* ------------------------------------------------------------------------- */
/* Factory                                                                    */
/* ------------------------------------------------------------------------- */

export const FACTORY_UPGRADES: Record<FactoryUpgradeId, LevelledUpgradeDef> = {
  speed: { label: 'SPEED', icon: '⚡', max: 25, cost: geo(250, 1.8) },
  multiplier: { label: 'MULTIPLIER', icon: '✖️', max: 300, cost: geo(300, 1.3) },
};

export const FACTORY = {
  unlockLevel: 2,
  baseBeltSpeed: 170,
  speedPerLevel: 0.08,
  itemSpacing: 125,
  baseItemValue: 3,
  maxSlots: 8,
  initialSlots: 4,
  wheelBaseMult: 1.3,
  wheelMultPerLevel: 0.1,
  wheelMaxLevel: 25,
  wheelCost: (owned: number) => D(1500).mul(Decimal.pow(10, owned)).floor(),
  wheelUpgradeCost: (index: number, level: number) =>
    D(800).mul(Decimal.pow(6, index)).mul(Decimal.pow(1.7, level)).floor(),
  expandCost: (slotsUnlocked: number) => (slotsUnlocked <= 4 ? D(400_000) : D(3e9)),
};

/* ------------------------------------------------------------------------- */
/* Boards (Money Drop levels)                                                 */
/* ------------------------------------------------------------------------- */

export const BOARDS: BoardDef[] = [
  {
    id: 0,
    name: 'Copper Falls',
    cost: D(0),
    mult: 1,
    palette: { bg1: 0x2a1460, bg2: 0x120838, accent: 0x38e8c6, peg: 0xd6e2ff, frame: 0xff9f1c, css: '#38e8c6' },
    bins: [
      { mult: 5, width: 1 },
      { mult: 2, width: 1 },
      { mult: 1.5, width: 1 },
      { mult: 1, width: 1.1 },
      { mult: 1.5, width: 1 },
      { mult: 2, width: 1 },
      { mult: 5, width: 1 },
    ],
    gates: [
      { kind: 'add', power: 1, x: 0.3, band: 0, width: 0.24 },
      { kind: 'add', power: 1, x: 0.7, band: 0, width: 0.24 },
      { kind: 'mult', power: 1.5, x: 0.5, band: 1, width: 0.26 },
      { kind: 'add', power: 3, x: 0.18, band: 1, width: 0.18 },
      { kind: 'add', power: 3, x: 0.82, band: 1, width: 0.18 },
    ],
    pegRows: 9,
    luckyCoins: false,
  },
  {
    id: 1,
    name: 'Silver Rapids',
    cost: D(8e6),
    mult: 5,
    palette: { bg1: 0x0f3b5f, bg2: 0x061a33, accent: 0x7cf3ff, peg: 0xe8f6ff, frame: 0xc0d6ff, css: '#7cf3ff' },
    bins: [
      { mult: 8, width: 0.9 },
      { mult: 3, width: 1 },
      { mult: 1.5, width: 1 },
      { mult: 1.2, width: 1.1 },
      { mult: 1.5, width: 1 },
      { mult: 3, width: 1 },
      { mult: 8, width: 0.9 },
    ],
    gates: [
      { kind: 'add', power: 1, x: 0.25, band: 0, width: 0.22, sway: 0.08 },
      { kind: 'mult', power: 1.2, x: 0.75, band: 0, width: 0.22 },
      { kind: 'mult', power: 2, x: 0.5, band: 1, width: 0.22, sway: 0.12 },
      { kind: 'add', power: 4, x: 0.15, band: 1, width: 0.16 },
      { kind: 'add', power: 4, x: 0.85, band: 1, width: 0.16 },
    ],
    pegRows: 9,
    luckyCoins: true,
  },
  {
    id: 2,
    name: 'Golden Canyon',
    cost: D(5e9),
    mult: 25,
    palette: { bg1: 0x5a2a05, bg2: 0x2a0f02, accent: 0xffd23f, peg: 0xfff1c2, frame: 0xffb000, css: '#ffd23f' },
    bins: [
      { mult: 10, width: 0.9 },
      { mult: 3, width: 1 },
      { mult: 1.5, width: 1 },
      { mult: 25, width: 0.62, jackpot: true },
      { mult: 1.5, width: 1 },
      { mult: 3, width: 1 },
      { mult: 10, width: 0.9 },
    ],
    gates: [
      { kind: 'mult', power: 1.5, x: 0.28, band: 0, width: 0.22, sway: 0.1 },
      { kind: 'add', power: 2, x: 0.72, band: 0, width: 0.22, sway: 0.1 },
      { kind: 'mult', power: 2, x: 0.5, band: 1, width: 0.22 },
      { kind: 'add', power: 6, x: 0.15, band: 1, width: 0.16 },
      { kind: 'mult', power: 1.2, x: 0.85, band: 1, width: 0.16 },
    ],
    pegRows: 10,
    luckyCoins: true,
  },
  {
    id: 3,
    name: 'Emerald Vault',
    cost: D(2e12),
    mult: 125,
    palette: { bg1: 0x0b4a32, bg2: 0x03211a, accent: 0x5dff9c, peg: 0xe4fff0, frame: 0x2fd27a, css: '#5dff9c' },
    bins: [
      { mult: 12, width: 0.9 },
      { mult: 4, width: 1 },
      { mult: 2, width: 1 },
      { mult: 30, width: 0.62, jackpot: true },
      { mult: 2, width: 1 },
      { mult: 4, width: 1 },
      { mult: 12, width: 0.9 },
    ],
    gates: [
      { kind: 'mult', power: 2, x: 0.25, band: 0, width: 0.2, sway: 0.12 },
      { kind: 'mult', power: 2, x: 0.75, band: 0, width: 0.2, sway: 0.12 },
      { kind: 'add', power: 10, x: 0.5, band: 1, width: 0.22 },
      { kind: 'mult', power: 1.5, x: 0.15, band: 1, width: 0.16 },
      { kind: 'mult', power: 1.5, x: 0.85, band: 1, width: 0.16 },
    ],
    pegRows: 10,
    luckyCoins: true,
  },
  {
    id: 4,
    name: 'Diamond Sky',
    cost: D(1e15),
    mult: 625,
    palette: { bg1: 0x3a0f5c, bg2: 0x14052a, accent: 0xff6bd6, peg: 0xffe9fb, frame: 0xb08cff, css: '#ff6bd6' },
    bins: [
      { mult: 15, width: 0.9 },
      { mult: 5, width: 1 },
      { mult: 2, width: 1 },
      { mult: 50, width: 0.6, jackpot: true },
      { mult: 2, width: 1 },
      { mult: 5, width: 1 },
      { mult: 15, width: 0.9 },
    ],
    gates: [
      { kind: 'mult', power: 2, x: 0.22, band: 0, width: 0.2, sway: 0.14 },
      { kind: 'add', power: 12, x: 0.5, band: 0, width: 0.18 },
      { kind: 'mult', power: 2, x: 0.78, band: 0, width: 0.2, sway: 0.14 },
      { kind: 'mult', power: 3, x: 0.5, band: 1, width: 0.2, sway: 0.1 },
      { kind: 'mult', power: 1.5, x: 0.14, band: 1, width: 0.15 },
      { kind: 'mult', power: 1.5, x: 0.86, band: 1, width: 0.15 },
    ],
    pegRows: 11,
    luckyCoins: true,
  },
];

/* ------------------------------------------------------------------------- */
/* Cards                                                                      */
/* ------------------------------------------------------------------------- */

const pct = (v: number) => `+${Math.round(v * 100)}%`;

export const CARDS: Record<CardId, CardDef> = {
  goldenTouch: {
    id: 'goldenTouch', name: 'Golden Touch', icon: '🪙', rarity: 'common', effect: 'dropValue', perLevel: 0.25, maxLevel: 10,
    describe: (l) => `${pct(0.25 * l)} valeur des pièces`,
  },
  luckyBins: {
    id: 'luckyBins', name: 'Lucky Bins', icon: '🍀', rarity: 'common', effect: 'binMult', perLevel: 0.12, maxLevel: 10,
    describe: (l) => `${pct(0.12 * l)} multiplicateurs des bacs`,
  },
  gatekeeper: {
    id: 'gatekeeper', name: 'Gatekeeper', icon: '🚪', rarity: 'common', effect: 'gatePower', perLevel: 0.2, maxLevel: 10,
    describe: (l) => `${pct(0.2 * l)} puissance des portes`,
  },
  turboBelt: {
    id: 'turboBelt', name: 'Turbo Belt', icon: '🛞', rarity: 'common', effect: 'factorySpeed', perLevel: 0.08, maxLevel: 10,
    describe: (l) => `${pct(0.08 * l)} vitesse de l'usine`,
  },
  overclock: {
    id: 'overclock', name: 'Overclock', icon: '🔥', rarity: 'rare', effect: 'dropRate', perLevel: 0.06, maxLevel: 10,
    describe: (l) => `${pct(0.06 * l)} cadence des générateurs`,
  },
  cogMaster: {
    id: 'cogMaster', name: 'Cog Master', icon: '⚙️', rarity: 'rare', effect: 'wheelMult', perLevel: 0.1, maxLevel: 10,
    describe: (l) => `${pct(0.1 * l)} multiplicateur des roues`,
  },
  nightShift: {
    id: 'nightShift', name: 'Night Shift', icon: '🌙', rarity: 'rare', effect: 'offline', perLevel: 1, maxLevel: 10,
    describe: (l) => `+${l}h plafond hors ligne, ${pct(0.08 * l)} efficacité`,
  },
  rushHour: {
    id: 'rushHour', name: 'Rush Hour', icon: '⚡', rarity: 'epic', effect: 'rush', perLevel: 1, maxLevel: 10,
    describe: (l) => `+${5 * l}s de Rush, orbes ${pct(0.12 * l)} plus fréquents`,
  },
  bouncer: {
    id: 'bouncer', name: 'Bouncer', icon: '🔴', rarity: 'epic', effect: 'bumper', perLevel: 0.5, maxLevel: 10,
    describe: (l) => `${pct(0.5 * l)} bonus des bumpers`,
  },
  midas: {
    id: 'midas', name: 'Midas', icon: '👑', rarity: 'legendary', effect: 'allIncome', perLevel: 0.15, maxLevel: 10,
    describe: (l) => `${pct(0.15 * l)} tous les revenus`,
  },
};

export const CARD_IDS = Object.keys(CARDS) as CardId[];

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, rare: 28, epic: 10, legendary: 2 };
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Commune', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire' };

export const CARD_SLOTS = {
  max: 6,
  initial: 3,
  cost: (unlocked: number) => D([0, 0, 0, 25_000, 3_000_000, 900_000_000][unlocked] ?? 1e12),
};

export const packCost = (bought: number) => D(400).mul(Decimal.pow(3.1, bought)).floor();

/* ------------------------------------------------------------------------- */
/* Progression                                                                */
/* ------------------------------------------------------------------------- */

/** Lifetime earnings required to reach `level` (level 1 is free). */
export const levelThreshold = (level: number): Decimal =>
  level <= 1 ? D(0) : D(120).mul(Decimal.pow(3.4, level - 2)).floor();

export const FREE_REWARD = {
  cooldownMs: 4 * 60_000,
  incomeSeconds: 120,
  minMoney: 60,
  frenzyMs: 30_000,
  frenzyMult: 2,
};

export const RUSH = { baseDurationMs: 20_000, mult: 2, baseOrbInterval: 38 };

export const OFFLINE = { baseCapHours: 2, baseEfficiency: 0.5, minSeconds: 30 };

/* ------------------------------------------------------------------------- */
/* Missions                                                                   */
/* ------------------------------------------------------------------------- */

const equippedCount = (s: import('./types').GameState) => s.cards.slots.filter(Boolean).length;
const lifetime = (s: import('./types').GameState) => s.lifetimeEarned.toNumber();

export const MISSIONS: MissionDef[] = [
  { id: 'm1', label: 'Collecte 25 pièces', target: 25, progress: (s) => s.stats.coinsCollected, reward: { incomeSeconds: 20, minMoney: 40 } },
  { id: 'm2', label: 'Valeur niveau 3', target: 3, progress: (s) => s.drop.upgrades.value, reward: { incomeSeconds: 25, minMoney: 60 } },
  { id: 'm3', label: 'Gagne $500 au total', target: 500, progress: lifetime, reward: { incomeSeconds: 30, minMoney: 120 } },
  { id: 'm4', label: 'Cadence niveau 2', target: 2, progress: (s) => s.drop.upgrades.rate, reward: { incomeSeconds: 30, minMoney: 150 } },
  { id: 'm5', label: 'Ouvre un paquet de cartes', target: 1, progress: (s) => s.stats.packsOpened, reward: { incomeSeconds: 30, minMoney: 200 } },
  { id: 'm6', label: 'Équipe 2 cartes', target: 2, progress: equippedCount, reward: { incomeSeconds: 40, minMoney: 300, card: true } },
  { id: 'm7', label: 'Achète une roue dans l\'usine', target: 1, progress: (s) => s.factory.wheels.length, reward: { incomeSeconds: 45, minMoney: 500 } },
  { id: 'm8', label: 'Possède 2 générateurs', target: 2, progress: (s) => 1 + s.drop.upgrades.dropper, reward: { incomeSeconds: 45, minMoney: 800 } },
  { id: 'm9', label: 'Traverse 150 portes', target: 150, progress: (s) => s.stats.gateHits, reward: { incomeSeconds: 60, minMoney: 1_000 } },
  { id: 'm10', label: 'Attrape un orbe doré', target: 1, progress: (s) => s.stats.orbsCaught, reward: { incomeSeconds: 60, minMoney: 1_500, card: true } },
  { id: 'm11', label: 'Possède 3 roues', target: 3, progress: (s) => s.factory.wheels.length, reward: { incomeSeconds: 60, minMoney: 5_000 } },
  { id: 'm12', label: 'Débloque les bumpers', target: 1, progress: (s) => s.drop.upgrades.obstacles, reward: { incomeSeconds: 60, minMoney: 5_000 } },
  { id: 'm13', label: 'Gagne $50K au total', target: 5e4, progress: lifetime, reward: { incomeSeconds: 90, minMoney: 10_000 } },
  { id: 'm14', label: 'Débloque Silver Rapids', target: 2, progress: (s) => s.drop.board + 1, reward: { incomeSeconds: 90, minMoney: 20_000, card: true } },
  { id: 'm15', label: 'SPEED usine niveau 10', target: 10, progress: (s) => s.factory.upgrades.speed, reward: { incomeSeconds: 90, minMoney: 30_000 } },
  { id: 'm16', label: 'Réclame 3 cadeaux gratuits', target: 3, progress: (s) => s.stats.rewardsClaimed, reward: { incomeSeconds: 90, minMoney: 40_000 } },
  { id: 'm17', label: 'Agrandis l\'usine', target: 6, progress: (s) => s.factory.slotsUnlocked, reward: { incomeSeconds: 120, minMoney: 80_000, card: true } },
  { id: 'm18', label: 'Collecte 3000 pièces', target: 3000, progress: (s) => s.stats.coinsCollected, reward: { incomeSeconds: 120, minMoney: 100_000 } },
  { id: 'm19', label: 'Bacs niveau 20', target: 20, progress: (s) => s.drop.upgrades.bins, reward: { incomeSeconds: 120, minMoney: 200_000 } },
  { id: 'm20', label: 'Débloque Golden Canyon', target: 3, progress: (s) => s.drop.board + 1, reward: { incomeSeconds: 150, minMoney: 1e6, card: true } },
  { id: 'm21', label: 'Possède 8 roues', target: 8, progress: (s) => s.factory.wheels.length, reward: { incomeSeconds: 150, minMoney: 5e6 } },
  { id: 'm22', label: 'Gagne $1B au total', target: 1e9, progress: lifetime, reward: { incomeSeconds: 180, minMoney: 1e7, card: true } },
  { id: 'm23', label: 'Débloque Emerald Vault', target: 4, progress: (s) => s.drop.board + 1, reward: { incomeSeconds: 180, minMoney: 1e8 } },
  { id: 'm24', label: 'Gagne $1T au total', target: 1e12, progress: lifetime, reward: { incomeSeconds: 240, minMoney: 1e10, card: true } },
  { id: 'm25', label: 'Débloque Diamond Sky', target: 5, progress: (s) => s.drop.board + 1, reward: { incomeSeconds: 300, minMoney: 1e11, card: true } },
];

/** Endless missions generated after the authored chain. */
export function endlessMission(n: number): MissionDef {
  const target = 1e13 * Math.pow(20, n);
  return {
    id: `e${n}`,
    label: `Gagne ${formatMoney(target)} au total`,
    target,
    progress: lifetime,
    reward: { incomeSeconds: 300, minMoney: target / 1000, card: true },
  };
}
