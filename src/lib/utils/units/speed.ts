import type { Knots, SpeedUnit, Translate } from './types';

const KMH_PER_KT = 1.852;
const MPH_PER_KT = 1.150779448;

const SUFFIX_KEY: Record<SpeedUnit, string> = {
  kts: 'units.kts',
  kmh: 'units.kmh',
  mph: 'units.mph',
};

/** Canonical knots -> the given display unit. */
export function convertSpeed(kts: Knots, unit: SpeedUnit): number {
  switch (unit) {
    case 'kmh':
      return kts * KMH_PER_KT;
    case 'mph':
      return kts * MPH_PER_KT;
    case 'kts':
    default:
      return kts;
  }
}

/** Canonical knots -> localized display string with suffix. */
export function formatSpeed(kts: Knots, unit: SpeedUnit, t: Translate): string {
  const value = Math.round(convertSpeed(kts, unit));
  return `${value.toLocaleString()} ${t(SUFFIX_KEY[unit])}`;
}

/** Display unit -> canonical knots, for user-typed values. */
export function parseSpeedInput(value: number, unit: SpeedUnit): Knots {
  switch (unit) {
    case 'kmh':
      return (value / KMH_PER_KT) as Knots;
    case 'mph':
      return (value / MPH_PER_KT) as Knots;
    case 'kts':
    default:
      return value as Knots;
  }
}
