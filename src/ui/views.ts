import { formatMoney, formatMult, formatNumber } from '../core/bignum';
import { DROP_UPGRADES, OBSTACLE_NAMES } from '../core/config';
import { getDropStats } from '../core/stats';
import type { GameStore } from '../core/store';
import type { DropStats, DropUpgradeId, GameState, UpgradeView } from '../core/types';

const DROP_ORDER: DropUpgradeId[] = ['value', 'rate', 'dropper', 'gates', 'bins', 'obstacles'];

function describe(id: DropUpgradeId, s: DropStats, level: number): string {
  switch (id) {
    case 'value':
      return formatMoney(s.coinValue);
    case 'rate':
      {
      const r = s.requestedRate;
      return `${r < 10 ? r.toFixed(2) : r.toFixed(1)}/s`;
    }
    case 'dropper':
      return `${s.droppers}`;
    case 'gates':
      return `+${formatNumber(s.gateUnit)}`;
    case 'bins':
      return formatMult(s.binScale);
    case 'obstacles':
      return OBSTACLE_NAMES[level] ?? OBSTACLE_NAMES[OBSTACLE_NAMES.length - 1];
  }
}

function withLevel(state: GameState, id: DropUpgradeId, level: number): GameState {
  return { ...state, drop: { ...state.drop, upgrades: { ...state.drop.upgrades, [id]: level } } };
}

export function dropUpgradeViews(store: GameStore): UpgradeView[] {
  const st = store.state;
  return DROP_ORDER.map((id) => {
    const def = DROP_UPGRADES[id];
    const level = st.drop.upgrades[id];
    const maxed = level >= def.max;
    const cost = def.cost(level);
    const locked = (def.minLevel ?? 0) > st.level ? `Niv. ${def.minLevel}` : undefined;
    const next = maxed ? 'MAX' : describe(id, getDropStats(withLevel(st, id, level + 1)), level + 1);
    return {
      id,
      label: def.label,
      icon: def.icon,
      level,
      maxed,
      cost,
      affordable: !maxed && !locked && st.money.gte(cost),
      locked,
      current: describe(id, store.dropStats, level),
      next,
    };
  });
}
