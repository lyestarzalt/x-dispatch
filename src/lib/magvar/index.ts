import { magvar } from 'magvar';
import type { Degrees } from '@/lib/utils/geomath';

const normalize360 = (deg: number): number => ((deg % 360) + 360) % 360;

/**
 * East-positive magnetic variation (declination) at a position, per the
 * current WMM2025-2030 model (`magvar` package — see the spec's package
 * research; the doc's suggested `geomagnetism` ships expired WMM2020 data).
 */
export function magneticVariation(lat: number, lon: number, date?: Date): Degrees {
  return magvar(lat, lon, 0, date) as Degrees;
}

/** Magnetic = True − Variation (variation east-positive). */
export function trueToMagnetic(trueDeg: Degrees, lat: number, lon: number, date?: Date): Degrees {
  return normalize360(trueDeg - magneticVariation(lat, lon, date)) as Degrees;
}

/** True = Magnetic + Variation (variation east-positive). */
export function magneticToTrue(magDeg: Degrees, lat: number, lon: number, date?: Date): Degrees {
  return normalize360(magDeg + magneticVariation(lat, lon, date)) as Degrees;
}
