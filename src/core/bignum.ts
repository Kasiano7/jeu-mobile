import Decimal from 'break_infinity.js';

export { Decimal };
export type DecimalSource = Decimal | number | string;

export const D = (v: DecimalSource): Decimal => (v instanceof Decimal ? v : new Decimal(v));
export const ZERO = new Decimal(0);
export const ONE = new Decimal(1);

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid'];

/** Letter notation after the named suffixes run out: aa, ab, ... zz. */
function letterSuffix(index: number): string {
  const n = index - SUFFIXES.length;
  const a = 'abcdefghijklmnopqrstuvwxyz';
  return a[Math.floor(n / 26) % 26] + a[n % 26];
}

function trimNumber(x: number, digits: number): string {
  // 3 significant digits: 1.23 / 12.3 / 123
  const s = x.toFixed(digits);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/**
 * Formats a monetary amount: 999, 1.5K, 12.3M, 1B, 4.56T, ... then aa, ab.
 * Values below 1000 keep up to one decimal when they are not integers and small.
 */
export function formatNumber(value: DecimalSource): string {
  const d = D(value);
  if (d.lt(0)) return '-' + formatNumber(d.neg());
  if (d.lt(1000)) {
    const n = d.toNumber();
    if (n < 10 && n % 1 !== 0) return trimNumber(n, 1);
    return Math.floor(n).toString();
  }
  const e = d.e; // exponent
  const tier = Math.floor(e / 3);
  const mantissa = d.mantissa * Math.pow(10, e - tier * 3);
  // Floor (never round up) so 999.9K stays "999K" instead of jumping a suffix.
  const m = mantissa;
  const t = tier;
  const finalDigits = m >= 100 ? 0 : m >= 10 ? 1 : 2;
  const suffix = t < SUFFIXES.length ? SUFFIXES[t] : letterSuffix(t);
  const p = Math.pow(10, finalDigits);
  return trimNumber(Math.floor(m * p + 1e-6) / p, finalDigits) + suffix;
}

export const formatMoney = (value: DecimalSource): string => '$' + formatNumber(value);

export function formatMult(m: number): string {
  if (m >= 1000) return '×' + formatNumber(m);
  if (m >= 100) return '×' + Math.round(m);
  if (m >= 10) return '×' + Math.round(m * 10) / 10;
  return '×' + Math.round(m * 100) / 100;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`;
  return `${sec}s`;
}

/** Geometric price: base * growth^level. */
export function geometricCost(base: DecimalSource, growth: number, level: number): Decimal {
  return D(base).mul(Decimal.pow(growth, level)).floor();
}
