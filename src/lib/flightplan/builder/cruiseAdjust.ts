/**
 * The cruise altitude a typed route allows. The airways set a floor and a ceiling, the chosen
 * procedures a floor of their own, and the direction of flight picks odd or even thousands.
 * Adjusting moves the current altitude onto the nearest legal level rather than guessing a
 * new one; the first guess for an empty cruise field lives in geometry.ts and is left alone.
 */
import { trueToMagnetic } from '@/lib/magvar';
import type { Degrees } from '@/lib/utils/geomath';
import type { ResolvedProcedure } from '@/types/navigation';
import { type LatLon, bearingDeg, destinationPoint, greatCircleNm } from './geometry';
import type { ProcedureParts } from './procedures';
import type { LevelBand } from './types';

export type CruiseProblem = 'belowFloor' | 'aboveCeiling' | 'parity';

const THOUSAND = 1000;

function constraintFloor(procedure: ResolvedProcedure | undefined): number | null {
  if (!procedure) return null;
  let floor: number | null = null;
  for (const wp of procedure.waypoints) {
    const c = wp.altitude;
    if (!c || c.altitude1 === null) continue;
    let lower: number | null = null;
    if (c.descriptor === '@' || c.descriptor === '+') lower = c.altitude1;
    else if (c.descriptor === 'B') lower = c.altitude2 ?? c.altitude1;
    if (lower !== null) floor = floor === null ? lower : Math.max(floor, lower);
  }
  return floor;
}

/** The highest altitude a chosen procedure says to be at or above; the cruise cannot sit under it. */
export function procedureFloorFt(parts: ProcedureParts): number | null {
  const floors = [parts.sid, parts.star, parts.approach]
    .map(constraintFloor)
    .filter((f): f is number => f !== null);
  return floors.length > 0 ? Math.max(...floors) : null;
}

/** The airway band narrowed by the procedure floor. */
export function cruiseBand(levels: LevelBand, procedureFloor: number | null): LevelBand {
  const minFt =
    procedureFloor === null ? levels.minFt : Math.max(levels.minFt ?? -Infinity, procedureFloor);
  return { minFt, maxFt: levels.maxFt };
}

/**
 * Direction of flight for the odd-or-even rule: the magnetic course halfway along the great
 * circle, which stands for the whole leg better than the course at either end.
 */
export function planIsEastbound(departure: LatLon, arrival: LatLon): boolean {
  const distance = greatCircleNm(departure, arrival);
  const mid =
    distance < 1e-6
      ? departure
      : destinationPoint(departure, bearingDeg(departure, arrival), distance / 2);
  const course = trueToMagnetic(bearingDeg(mid, arrival) as Degrees, mid.latitude, mid.longitude);
  return course < 180;
}

function clamp(feet: number, band: LevelBand): number {
  let out = feet;
  if (band.minFt !== null) out = Math.max(out, band.minFt);
  if (band.maxFt !== null) out = Math.min(out, band.maxFt);
  return out;
}

/** Whether a cruise is a whole thousand of the parity the direction asks for: odd eastbound. */
export function hasParity(feet: number, eastbound: boolean): boolean {
  if (feet % THOUSAND !== 0) return false;
  const odd = (feet / THOUSAND) % 2 === 1;
  return odd === eastbound;
}

/**
 * The nearest legal cruise: inside the band, then up to the next thousand of the right parity.
 * Past the ceiling, the highest right-parity thousand under it; and when the band is too narrow
 * for the rule at all, the band wins and the clamped value is returned as is.
 */
export function adjustCruiseAltitudeFt(
  currentFt: number | null,
  band: LevelBand,
  eastbound: boolean
): number {
  const clamped = clamp(currentFt ?? band.minFt ?? 0, band);
  let up = Math.ceil(clamped / THOUSAND) * THOUSAND;
  if (!hasParity(up, eastbound)) up += THOUSAND;
  if (band.maxFt === null || up <= band.maxFt) return up;
  let down = Math.floor(band.maxFt / THOUSAND) * THOUSAND;
  if (!hasParity(down, eastbound)) down -= THOUSAND;
  if (band.minFt !== null && down < band.minFt) return clamped;
  return down;
}

/** Why the current cruise is not where Adjust would put it, or null when it already is. */
export function cruiseProblem(
  currentFt: number | null,
  band: LevelBand,
  eastbound: boolean
): CruiseProblem | null {
  if (currentFt === null) return null;
  if (band.minFt !== null && currentFt < band.minFt) return 'belowFloor';
  if (band.maxFt !== null && currentFt > band.maxFt) return 'aboveCeiling';
  return adjustCruiseAltitudeFt(currentFt, band, eastbound) === currentFt ? null : 'parity';
}
