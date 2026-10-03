import type { FeetPerMinute, Translate, VerticalSpeedUnit } from './types';

// fpm -> m/s: feet-per-minute to meters-per-second. Matches littlenavmap's
// `speedVertFpmOther` (feetToMeter(fpm) / 60) — see the spec's Source references.
const METERS_PER_SEC_PER_FPM = 0.3048 / 60;

const SUFFIX_KEY: Record<VerticalSpeedUnit, string> = {
  fpm: 'units.fpm',
  ms: 'units.ms',
};

/** Canonical fpm -> the given display unit. */
export function convertVerticalSpeed(fpm: FeetPerMinute, unit: VerticalSpeedUnit): number {
  return unit === 'ms' ? fpm * METERS_PER_SEC_PER_FPM : fpm;
}

/** Canonical fpm -> localized display string with suffix. fpm shows 0 decimals, m/s shows 2. */
export function formatVerticalSpeed(
  fpm: FeetPerMinute,
  unit: VerticalSpeedUnit,
  t: Translate
): string {
  const converted = convertVerticalSpeed(fpm, unit);
  const value = unit === 'ms' ? converted.toFixed(2) : Math.round(converted).toLocaleString();
  return `${value} ${t(SUFFIX_KEY[unit])}`;
}

/** Display unit -> canonical fpm, for user-typed values. */
export function parseVerticalSpeedInput(value: number, unit: VerticalSpeedUnit): FeetPerMinute {
  return (unit === 'ms' ? value / METERS_PER_SEC_PER_FPM : value) as FeetPerMinute;
}
