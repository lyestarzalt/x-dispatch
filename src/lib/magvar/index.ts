import { magvar } from 'magvar';
import type { Degrees } from '@/lib/utils/geomath';
import { normalize360 } from '@/lib/utils/math';
import type { MagneticDegrees, TrueDegrees } from '@/types/units';

/**
 * East-positive magnetic variation (declination) at a position, per the
 * current WMM2025-2030 model (`magvar` package — see the spec's package
 * research; the doc's suggested `geomagnetism` ships expired WMM2020 data).
 */
export function magneticVariation(lat: number, lon: number, date?: Date): Degrees {
  return magvar(lat, lon, 0, date) as Degrees;
}

/** Magnetic = True − Variation (variation east-positive). */
export function trueToMagnetic(
  trueDeg: TrueDegrees,
  lat: number,
  lon: number,
  date?: Date
): MagneticDegrees {
  return normalize360(trueDeg - magneticVariation(lat, lon, date)) as MagneticDegrees;
}

/** True = Magnetic + Variation (variation east-positive). */
export function magneticToTrue(
  magDeg: MagneticDegrees,
  lat: number,
  lon: number,
  date?: Date
): TrueDegrees {
  return normalize360(magDeg + magneticVariation(lat, lon, date)) as TrueDegrees;
}
