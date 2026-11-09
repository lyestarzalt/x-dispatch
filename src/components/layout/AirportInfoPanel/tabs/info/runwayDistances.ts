import { type Feet, metersToFeet, runwayLengthFeet } from '@/lib/utils/geomath';
import type { Runway } from '@/types/apt';

/**
 * Landing distance available when landing on `endIndex`: the full length less
 * that end's displaced threshold (apt.dat `dthr_length`, metres). Equals the
 * full length when the threshold is not displaced.
 */
export function landingDistanceFeet(runway: Runway, endIndex: 0 | 1): Feet {
  const full = runwayLengthFeet(runway.ends[0], runway.ends[1]);
  const displaced = metersToFeet(Math.max(0, runway.ends[endIndex].dthr_length));
  return Math.max(0, full - displaced) as Feet;
}
