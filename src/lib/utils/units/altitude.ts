import type { Feet } from '@/lib/utils/geomath';
import type { AltitudeUnit, Translate } from './types';

const METERS_PER_FOOT = 0.3048;

const SUFFIX_KEY: Record<AltitudeUnit, string> = {
  ft: 'units.ft',
  m: 'units.m',
};

/** Canonical feet -> the given display unit. */
export function convertAltitude(ft: Feet, unit: AltitudeUnit): number {
  return unit === 'm' ? ft * METERS_PER_FOOT : ft;
}

/** Canonical feet -> localized display string with suffix, e.g. "9,197 ft". */
export function formatAltitude(ft: Feet, unit: AltitudeUnit, t: Translate): string {
  const value = Math.round(convertAltitude(ft, unit));
  return `${value.toLocaleString()} ${t(SUFFIX_KEY[unit])}`;
}

/** Display unit -> canonical feet, for user-typed values. */
export function parseAltitudeInput(value: number, unit: AltitudeUnit): Feet {
  return (unit === 'm' ? value / METERS_PER_FOOT : value) as Feet;
}

/**
 * Canonical feet -> a short ground distance in the altitude unit, rounded the way
 * a pilot reads it while taxiing: to 10 under 1,000, to 50 above. "120 m", "490 ft".
 */
export function formatShortDistance(ft: Feet, unit: AltitudeUnit, t: Translate): string {
  const value = convertAltitude(ft, unit);
  const step = value < 1000 ? 10 : 50;
  return `${(Math.round(value / step) * step).toLocaleString()} ${t(SUFFIX_KEY[unit])}`;
}
