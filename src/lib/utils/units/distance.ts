import type { NauticalMiles } from '@/lib/utils/geomath';
import { roundForDisplay } from './precision';
import type { DistanceUnit, Translate } from './types';

// 1 NM = 1.852 km exactly (international standard). See the spec's Source
// references for why this intentionally differs from atools' 1852.216.
const KM_PER_NM = 1.852;
const MI_PER_NM = 1.150779448;

const SUFFIX_KEY: Record<DistanceUnit, string> = {
  nm: 'units.nm',
  km: 'units.km',
  mi: 'units.mi',
};

/** Canonical NM -> the given display unit. */
export function convertDistance(nm: NauticalMiles, unit: DistanceUnit): number {
  switch (unit) {
    case 'km':
      return nm * KM_PER_NM;
    case 'mi':
      return nm * MI_PER_NM;
    case 'nm':
    default:
      return nm;
  }
}

/** Canonical NM -> localized display string with suffix, e.g. "12.5 NM". */
export function formatDistance(nm: NauticalMiles, unit: DistanceUnit, t: Translate): string {
  const value = roundForDisplay(convertDistance(nm, unit), 1);
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${t(SUFFIX_KEY[unit])}`;
}

/** Display unit -> canonical NM, for user-typed values. */
export function parseDistanceInput(value: number, unit: DistanceUnit): NauticalMiles {
  switch (unit) {
    case 'km':
      return (value / KM_PER_NM) as NauticalMiles;
    case 'mi':
      return (value / MI_PER_NM) as NauticalMiles;
    case 'nm':
    default:
      return value as NauticalMiles;
  }
}
