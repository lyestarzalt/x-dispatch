import type { Feet } from '@/lib/utils/geomath';
import type { LengthUnit, Translate } from './types';

const METERS_PER_FOOT = 0.3048;

const SUFFIX_KEY: Record<LengthUnit, string> = {
  ft: 'units.ft',
  m: 'units.m',
};

/** Canonical feet -> the given display unit. */
export function convertLength(ft: Feet, unit: LengthUnit): number {
  return unit === 'm' ? ft * METERS_PER_FOOT : ft;
}

/** Canonical feet -> localized display string with suffix, e.g. "9,397 ft" (a runway). */
export function formatLength(ft: Feet, unit: LengthUnit, t: Translate): string {
  const value = Math.round(convertLength(ft, unit));
  return `${value.toLocaleString()} ${t(SUFFIX_KEY[unit])}`;
}

/**
 * Canonical feet -> a short ground distance, rounded the way a pilot reads it
 * while taxiing: to 10 under 1,000, to 50 above. "120 m", "490 ft".
 */
export function formatShortDistance(ft: Feet, unit: LengthUnit, t: Translate): string {
  const value = convertLength(ft, unit);
  const step = value < 1000 ? 10 : 50;
  return `${(Math.round(value / step) * step).toLocaleString()} ${t(SUFFIX_KEY[unit])}`;
}
