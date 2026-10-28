// Rough economy pacing simulation: greedy player buying the best ROI upgrade.
import { D, Decimal, formatMoney } from '../src/core/bignum';
import { BOARDS, DROP_UPGRADES, FACTORY, FACTORY_UPGRADES } from '../src/core/config';
import { createInitialState } from '../src/core/save';
import { getDropStats, getFactoryStats, levelFor } from '../src/core/stats';
import type { GameState } from '../src/core/types';

// Measured on the real Matter board (10 simulated minutes per board, see README):
// average sum of add-gate powers, product of mult-gate powers, and base bin multiplier per coin.
const BOARD_CALIB = [
  { A: 1.97, M: 1.156, bin: 1.70 },
  { A: 1.44, M: 1.236, bin: 1.97 },
  { A: 1.10, M: 1.380, bin: 2.62 },
  { A: 1.29, M: 1.597, bin: 3.05 },
  { A: 1.36, M: 2.053, bin: 3.58 },
];
// Orb rush, bumpers and manual taps on top of the idle flow.
const EXTRAS = 1.15;

function income(s: GameState): Decimal {
  const d = getDropStats(s);
  const k = BOARD_CALIB[d.board.id];
  const perCoin = d.coinValue
    .add(d.gateUnit.mul(k.A))
    .mul(1 + (k.M - 1) * d.gateMultBoost)
    .mul(k.bin * d.binScale)
    .mul(d.incomeMult * EXTRAS);
  const drop = perCoin.mul(d.requestedRate);
  const unlocked = levelFor(s.lifetimeEarned) >= FACTORY.unlockLevel;
  return unlocked ? drop.add(getFactoryStats(s).estimatedIncome) : drop;
}

type Option = { name: string; cost: Decimal; apply: (s: GameState) => void };
function options(s: GameState): Option[] {
  const o: Option[] = [];
  for (const id of Object.keys(DROP_UPGRADES) as (keyof typeof DROP_UPGRADES)[]) {
    const l = s.drop.upgrades[id];
    if (l < DROP_UPGRADES[id].max) o.push({ name: 'drop.' + id, cost: DROP_UPGRADES[id].cost(l), apply: (x) => x.drop.upgrades[id]++ });
  }
  for (const id of Object.keys(FACTORY_UPGRADES) as (keyof typeof FACTORY_UPGRADES)[]) {
    const l = s.factory.upgrades[id];
    if (l < FACTORY_UPGRADES[id].max) o.push({ name: 'fac.' + id, cost: FACTORY_UPGRADES[id].cost(l), apply: (x) => x.factory.upgrades[id]++ });
  }
  if (s.factory.wheels.length < s.factory.slotsUnlocked) o.push({ name: 'wheel', cost: FACTORY.wheelCost(s.factory.wheels.length), apply: (x) => x.factory.wheels.push(0) });
  s.factory.wheels.forEach((lv, i) => lv < FACTORY.wheelMaxLevel && o.push({ name: 'wheelUp', cost: FACTORY.wheelUpgradeCost(i, lv), apply: (x) => x.factory.wheels[i]++ }));
  if (s.factory.slotsUnlocked < FACTORY.maxSlots) o.push({ name: 'expand', cost: FACTORY.expandCost(s.factory.slotsUnlocked), apply: (x) => (x.factory.slotsUnlocked += 2) });
  const nb = BOARDS[s.drop.board + 1];
  if (nb) o.push({ name: 'BOARD ' + nb.name, cost: nb.cost, apply: (x) => x.drop.board++ });
  return o;
}

const s = createInitialState(0);
let t = 0;
const marks = [15, 30, 60, 180, 300, 600, 900, 1800, 3600, 7200, 14400, 28800];
let mi = 0;
const log: string[] = [];
const firstBuys: string[] = [];
while (t < 8 * 3600) {
  const inc = income(s);
  // pick best ROI
  let best: Option | null = null;
  let bestScore = -Infinity;
  for (const op of options(s)) {
    const c = JSON.parse(JSON.stringify(s));
    Object.assign(c, { money: s.money, lifetimeEarned: s.lifetimeEarned, incomeRate: s.incomeRate, prestige: s.prestige });
    op.apply(c);
    const gain = income(c).sub(inc);
    // Lower is better: time to afford it + time for it to pay for itself.
    const wait = Math.max(0, op.cost.sub(s.money).div(inc.max(1e-9)).toNumber());
    const payback = gain.lte(0) ? Infinity : op.cost.div(gain).toNumber();
    const score = -(wait + payback);
    if (score > bestScore) { bestScore = score; best = op; }
  }
  if (best && s.money.gte(best.cost)) {
    s.money = s.money.sub(best.cost);
    best.apply(s);
    if (firstBuys.length < 6) firstBuys.push(`${t}s ${best.name} ${formatMoney(best.cost)}`);
    if (best.name.startsWith('BOARD') || best.name === 'wheel' || best.name === 'expand' || best.name === 'drop.dropper' || best.name === 'drop.obstacles')
      log.push(`${(t / 60).toFixed(1)}min ${best.name} income=${formatMoney(inc)}/s`);
    continue;
  }
  s.money = s.money.add(inc);
  s.lifetimeEarned = s.lifetimeEarned.add(inc);
  t += 1;
  if (t === marks[mi]) {
    mi++;
    console.log(`t=${(t / 60).toFixed(2)}min level=${levelFor(s.lifetimeEarned)} income=${formatMoney(inc)}/s board=${s.drop.board} value=${s.drop.upgrades.value} wheels=${s.factory.wheels.length}`);
  }
}
console.log(firstBuys.join('\n'));
console.log(log.join('\n'));
void D;
