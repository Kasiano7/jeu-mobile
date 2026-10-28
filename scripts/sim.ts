// Rough economy pacing simulation: greedy player buying the best ROI upgrade.
import { D, Decimal, formatMoney } from '../src/core/bignum';
import { BOARDS, DROP_UPGRADES, FACTORY, FACTORY_UPGRADES } from '../src/core/config';
import { createInitialState } from '../src/core/save';
import { gateMult, getDropStats, getFactoryStats, levelFor } from '../src/core/stats';
import type { GameState } from '../src/core/types';

function income(s: GameState): Decimal {
  const d = getDropStats(s);
  const coinsPerSec = d.requestedRate;
  const adds = d.board.gates.filter((g) => g.kind === 'add');
  const mults = d.board.gates.filter((g) => g.kind === 'mult');
  const addAvg = adds.reduce((a, g) => a + g.power, 0) * 0.22;
  const multAvg = mults.reduce((a, g) => a * (1 + (gateMult(g.power, d.gateMultBoost) - 1) * 0.3), 1);
  const binAvg = (d.board.bins.reduce((a, b) => a + b.mult, 0) / d.board.bins.length) * 0.75 * d.binScale;
  const coin = d.coinValue.add(d.gateUnit.mul(addAvg)).mul(multAvg).mul(binAvg).mul(d.incomeMult);
  const drop = coin.mul(coinsPerSec);
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
const marks = [60, 180, 300, 600, 900, 1800, 3600, 7200, 14400];
let mi = 0;
const log: string[] = [];
while (t < 4 * 3600) {
  const inc = income(s);
  // pick best ROI
  let best: Option | null = null;
  let bestScore = -1;
  for (const op of options(s)) {
    const c = JSON.parse(JSON.stringify(s));
    Object.assign(c, { money: s.money, lifetimeEarned: s.lifetimeEarned, incomeRate: s.incomeRate, prestige: s.prestige });
    op.apply(c);
    const gain = income(c).sub(inc);
    const score = gain.div(op.cost.max(1)).toNumber() / Math.max(1, op.cost.sub(s.money).div(inc.max(1e-9)).toNumber());
    if (score > bestScore) { bestScore = score; best = op; }
  }
  if (best && s.money.gte(best.cost)) {
    s.money = s.money.sub(best.cost);
    best.apply(s);
    if (best.name.startsWith('BOARD') || best.name === 'wheel' || best.name === 'expand' || best.name === 'drop.dropper' || best.name === 'drop.obstacles')
      log.push(`${(t / 60).toFixed(1)}min ${best.name} income=${formatMoney(inc)}/s`);
    continue;
  }
  s.money = s.money.add(inc);
  s.lifetimeEarned = s.lifetimeEarned.add(inc);
  t += 1;
  if (t === marks[mi]) {
    mi++;
    console.log(`t=${t / 60}min level=${levelFor(s.lifetimeEarned)} income=${formatMoney(inc)}/s board=${s.drop.board} up=${JSON.stringify(s.drop.upgrades)} fac=${JSON.stringify(s.factory)}`);
  }
}
console.log(log.join('\n'));
void D;
