import type { BoardDef, DropStats, GateKind } from '../../core/types';
import { BUMPER_RADIUS, COIN_RADIUS, PEG_RADIUS } from '../shared/textures';

export const WORLD_W = 1080;
export const WALL_BUMP_RADIUS = 30;
const WALL = 26;

export interface GateLayout {
  id: number;
  kind: GateKind;
  power: number;
  x: number;
  y: number;
  w: number;
  h: number;
  sway: number;
  phase: number;
  locked?: boolean;
}

export interface BinLayout {
  x0: number;
  x1: number;
  mult: number;
  jackpot?: boolean;
}

export interface DropLayout {
  W: number;
  H: number;
  wall: number;
  railY: number;
  dropperY: number;
  spawnY: number;
  fieldTop: number;
  fieldBottom: number;
  binTop: number;
  binBottom: number;
  pegs: { x: number; y: number }[];
  bumpers: { x: number; y: number }[];
  /** Half-domes on the side walls; `dir` points towards the board centre. */
  wallBumps: { x: number; y: number; dir: number }[];
  spinners: { id: number; x: number; y: number; dir: number }[];
  gates: GateLayout[];
  bins: BinLayout[];
  /** Candidate centres for the golden orb (gaps between pegs). */
  orbSpots: { x: number; y: number }[];
}

/**
 * Deterministic board layout for a given screen height. Peg spacing keeps a
 * diagonal clearance larger than a coin so nothing can jam permanently.
 */
export function buildDropLayout(board: BoardDef, stats: Pick<DropStats, 'bumpers' | 'spinners' | 'splitter'>, H: number): DropLayout {
  const W = WORLD_W;
  const railY = 96;
  const dropperY = 92;
  const spawnY = 200;
  const fieldTop = 290;
  const binBottom = H - 44;
  const binTop = binBottom - Math.min(270, Math.max(210, H * 0.17));
  const splitY = binTop - 62;
  const fieldBottom = binTop - 130;

  const sx = 150;
  const minDy = 100;
  const span = fieldBottom - fieldTop;
  const rows = Math.max(5, Math.min(board.pegRows + 2, Math.floor(span / minDy) + 1));
  const dy = span / (rows - 1);
  const band0 = Math.round((rows - 1) * 0.28);
  const band1 = Math.round((rows - 1) * 0.66);

  const pegs: { x: number; y: number; row: number }[] = [];
  const wallBumps: { x: number; y: number; dir: number }[] = [];
  const rowY: number[] = [];
  for (let r = 0; r < rows; r++) {
    const y = fieldTop + r * dy;
    rowY.push(y);
    if (r === band0 || r === band1) continue;
    const odd = r % 2 === 1;
    const start = odd ? 90 + sx / 2 : 90;
    for (let x = start; x <= W - 90 + 1; x += sx) {
      // Edge pegs of even rows would sit closer to the wall than a coin's diameter:
      // a coin wedges between them and the frictionless wall. Wall bumps replace them.
      if (!odd && (x < sx || x > W - sx)) continue;
      pegs.push({ x, y, row: r });
    }
    if (!odd) wallBumps.push({ x: WALL, y, dir: 1 }, { x: W - WALL, y, dir: -1 });
  }

  const gates: GateLayout[] = [];
  let gid = 0;
  for (const g of board.gates) {
    gates.push({
      id: gid++,
      kind: g.kind,
      power: g.power,
      x: g.x * W,
      y: rowY[g.band === 0 ? band0 : band1],
      w: g.width * W,
      h: 54,
      sway: (g.sway ?? 0) * W,
      phase: gid * 1.7,
    });
  }
  // Split gate slot: always reserved (shown locked until unlocked).
  gates.push({ id: gid++, kind: 'split', power: 2, x: W / 2, y: splitY, w: 230, h: 54, sway: 0, phase: 0, locked: !stats.splitter });

  const removeNear = (x: number, y: number, rx: number, ry: number) => {
    for (let i = pegs.length - 1; i >= 0; i--) {
      if (Math.abs(pegs[i].x - x) < rx && Math.abs(pegs[i].y - y) < ry) pegs.splice(i, 1);
    }
  };

  const bumpers: { x: number; y: number }[] = [];
  if (stats.bumpers) {
    const r = Math.min(band0 + 1, rows - 1);
    for (const fx of [0.3, 0.7]) {
      const rowPegs = pegs.filter((p) => p.row === r);
      if (!rowPegs.length) continue;
      const target = rowPegs.reduce((a, b) => (Math.abs(b.x - fx * W) < Math.abs(a.x - fx * W) ? b : a));
      removeNear(target.x, target.y, sx * 0.7, dy * 1.2);
      bumpers.push({ x: target.x, y: target.y });
    }
  }

  const spinners: { id: number; x: number; y: number; dir: number }[] = [];
  if (stats.spinners) {
    const r = Math.min(band1 + 1, rows - 1);
    const y = rowY[r] + dy * 0.15;
    [0.27, 0.73].forEach((fx, i) => {
      removeNear(fx * W, y, 210, dy * 1.25);
      spinners.push({ id: 100 + i, x: fx * W, y, dir: i === 0 ? 1 : -1 });
    });
  }

  // Bins
  const inner0 = WALL;
  const inner1 = W - WALL;
  const total = board.bins.reduce((a, b) => a + b.width, 0);
  let cx = inner0;
  const bins: BinLayout[] = board.bins.map((b) => {
    const w = ((inner1 - inner0) * b.width) / total;
    const bin = { x0: cx, x1: cx + w, mult: b.mult, jackpot: b.jackpot };
    cx += w;
    return bin;
  });

  const orbSpots: { x: number; y: number }[] = [];
  for (let r = 1; r < rows - 1; r++) {
    if (r === band0 || r === band1) continue;
    const odd = r % 2 === 1;
    const start = odd ? 90 : 90 + sx / 2;
    for (let x = start; x <= W - 90; x += sx) {
      const y = rowY[r];
      const clear =
        pegs.every((p) => Math.hypot(p.x - x, p.y - y) > PEG_RADIUS + 60) &&
        bumpers.every((b) => Math.hypot(b.x - x, b.y - y) > BUMPER_RADIUS + 70) &&
        spinners.every((s) => Math.hypot(s.x - x, s.y - y) > 200);
      if (clear && x > COIN_RADIUS + WALL && x < W - COIN_RADIUS - WALL) orbSpots.push({ x, y });
    }
  }

  return {
    W,
    H,
    wall: WALL,
    railY,
    dropperY,
    spawnY,
    fieldTop,
    fieldBottom,
    binTop,
    binBottom,
    pegs: pegs.map(({ x, y }) => ({ x, y })),
    wallBumps,
    bumpers,
    spinners,
    gates,
    bins,
    orbSpots,
  };
}
