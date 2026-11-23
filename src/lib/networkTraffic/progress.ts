/**
 * Where a network flight is along its filed city pair, from the pilot's position and the two
 * airports alone. Nothing here is fetched: the networks give no phase, so it is read off the
 * distances and the altitude against the filed cruise, the way VATSIM Radar does it.
 */
import { type LatLon, greatCircleNm } from '@/lib/flightplan/builder/geometry';
import type { NetworkPilot } from '@/types/networkTraffic';
import type { NauticalMiles } from '@/types/units';

export type FlightPhase =
  | 'departing'
  | 'departed'
  | 'climbing'
  | 'cruising'
  | 'descending'
  | 'arriving'
  | 'arrived'
  | 'unknown';

export interface FlightProgress {
  phase: FlightPhase;
  /** Distance flown from the departure airport, when it is known. */
  flownNm: NauticalMiles | null;
  /** Distance left to the arrival airport, when it is known. */
  remainingNm: NauticalMiles | null;
  /** 0..100 along the city pair; null until both airports are known. */
  percent: number | null;
}

/** Inside this range of either airport the flight counts as departing or arriving. */
const TERMINAL_NM = 40;
/** On the ground within this range of an airport the flight is at that airport. */
const AT_AIRPORT_NM = 10;
/** Within this much of the filed cruise the flight is cruising. */
const CRUISE_TOLERANCE_FT = 500;

export function flightProgress(
  pilot: NetworkPilot,
  departure: LatLon | null,
  arrival: LatLon | null
): FlightProgress {
  const here = { latitude: pilot.latitude, longitude: pilot.longitude };
  const flownNm = departure ? greatCircleNm(departure, here) : null;
  const remainingNm = arrival ? greatCircleNm(here, arrival) : null;
  const percent =
    flownNm !== null && remainingNm !== null && flownNm + remainingNm > 0
      ? Math.round((flownNm / (flownNm + remainingNm)) * 100)
      : null;
  return { phase: phaseOf(pilot, flownNm, remainingNm), flownNm, remainingNm, percent };
}

function phaseOf(
  pilot: NetworkPilot,
  flownNm: NauticalMiles | null,
  remainingNm: NauticalMiles | null
) {
  if (pilot.onGround) {
    if (remainingNm !== null && remainingNm < AT_AIRPORT_NM) return 'arrived';
    if (flownNm !== null && flownNm < AT_AIRPORT_NM) return 'departing';
    return 'unknown';
  }
  if (remainingNm !== null && remainingNm < TERMINAL_NM) return 'arriving';
  if (flownNm !== null && flownNm < TERMINAL_NM) return 'departed';
  const cruise = pilot.flightPlan?.cruiseAltitudeFt ?? null;
  if (cruise !== null && cruise > 0 && pilot.altitudeFt >= cruise - CRUISE_TOLERANCE_FT) {
    return 'cruising';
  }
  if (flownNm !== null && remainingNm !== null) {
    return remainingNm > flownNm ? 'climbing' : 'descending';
  }
  return 'unknown';
}
