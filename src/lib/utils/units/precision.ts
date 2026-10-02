/**
 * Shared rounding rule for all quantity formatters: one extra decimal below
 * a threshold, so a small value (e.g. 0.4 NM) doesn't round down to zero.
 * Behaviour matches littlenavmap's `minValPrec` (unit.h:45, unit.cpp:165-180),
 * reimplemented under our own name — see the spec's Source references.
 */
export function roundForDisplay(value: number, precision = 0, threshold = 0): number {
  const decimals = Math.abs(value) < threshold ? precision + 1 : precision;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
