/**
 * The one place a conversion factor is written down. Display code goes through
 * `useUnits()`; these are for code that converts sim or file data into the
 * canonical units (NM, ft, kts, fpm, lbs) or back.
 *
 * Paired factors are kept as written at their original call sites, not derived
 * from each other, so results do not shift in the last digit.
 */
export const METERS_PER_NM = 1852;
export const FEET_PER_METER = 3.28084;
export const METERS_PER_FOOT = 0.3048;
export const KNOTS_PER_MPS = 1.94384;
export const LBS_TO_KG = 0.453592;
export const KG_TO_LBS = 2.20462;
export const HPA_PER_INHG = 33.8639;
/** Metres in one degree of latitude, for flat local projections around an airport. */
export const METERS_PER_DEG_LAT = 111_320;
