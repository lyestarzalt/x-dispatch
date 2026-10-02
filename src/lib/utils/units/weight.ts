/**
 * Thin wrapper so `useUnits()` has one surface for all six quantities.
 * The actual conversion/formatting already existed in `lib/utils/format` —
 * this module doesn't duplicate it, just re-exports it under the same
 * per-quantity shape as the other five (convert/format/parse).
 */
import { type WeightUnit, formatWeight, kgToLbs, lbsToKg } from '@/lib/utils/format';

export { formatWeight };

/** Canonical lbs -> the given display unit. */
export function convertWeight(lbs: number, unit: WeightUnit): number {
  return unit === 'kg' ? lbsToKg(lbs) : lbs;
}

/** Display unit -> canonical lbs, for user-typed values. */
export function parseWeightInput(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? kgToLbs(value) : value;
}
