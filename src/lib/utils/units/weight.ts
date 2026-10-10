/**
 * Thin wrapper so `useUnits()` has one surface for all six quantities.
 * The actual conversion/formatting already existed in `lib/utils/format` —
 * this module doesn't duplicate it, just re-exports it under the same
 * per-quantity shape as the other five (convert/format/parse).
 */
import { type WeightUnit, formatWeight, kgToLbs, lbsToKg } from '@/lib/utils/format';

export { formatWeight };

/**
 * The full figure with a thousands separator, "50,450 lbs" or "22,884 kg", for dispatch
 * numbers where "50k lbs" or "22.9t" would hide the digits a pilot types into the FMS.
 */
export function formatWeightExact(lbs: number, unit: WeightUnit): string {
  const value = Math.round(convertWeight(lbs, unit));
  return `${value.toLocaleString()} ${unit === 'kg' ? 'kg' : 'lbs'}`;
}

/** Canonical lbs -> the given display unit. */
export function convertWeight(lbs: number, unit: WeightUnit): number {
  return unit === 'kg' ? lbsToKg(lbs) : lbs;
}

/** Display unit -> canonical lbs, for user-typed values. */
export function parseWeightInput(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? kgToLbs(value) : value;
}
