import type {
  Degrees,
  Feet,
  FeetPerMinute,
  Kilograms,
  Knots,
  Meters,
  NauticalMiles,
  Seconds,
} from '@/types/units';

export type FlightPhase =
  | 'preflight'
  | 'taxi-out'
  | 'takeoff'
  | 'climb'
  | 'cruise'
  | 'descent'
  | 'approach'
  | 'landed'
  | 'taxi-in'
  | 'parked';

/**
 * One recorded position: `[epochMs, lat, lon, altFtMsl, gsKt, headingDeg, vsFpm, aglFt]`.
 * Tuples keep flight files and IPC payloads small; a ten-hour flight at one
 * point per second is a few megabytes.
 */
export type TrackPointTuple = [
  t: number,
  lat: number,
  lon: number,
  alt: Feet,
  gs: Knots,
  hdg: Degrees,
  vs: FeetPerMinute,
  agl: Feet,
];

export const TRACK_T = 0;
export const TRACK_LAT = 1;
export const TRACK_LON = 2;
export const TRACK_ALT = 3;
export const TRACK_GS = 4;
export const TRACK_HDG = 5;
export const TRACK_VS = 6;
export const TRACK_AGL = 7;

/**
 * Same bands as LandingRate for FlyWithLua, so the verdict matches what
 * pilots already compare against.
 */
export type LandingRating = 'butter' | 'great' | 'acceptable' | 'hard' | 'severe';

export type FlareGrade = 'veryGood' | 'goodEarly' | 'goodLate' | 'poorEarly' | 'poorLate';

export interface LandingRunway {
  icao: string;
  airportName: string;
  /** Runway end that was landed on, e.g. "27L". */
  runway: string;
  runwayLengthM: Meters;
  /** Along-track distance from the landing threshold; negative means short. */
  distancePastThresholdM: Meters;
  /** Lateral offset from the centreline, positive to the right of the landing direction. */
  centerlineOffsetM: Meters;
}

export interface LandingReport {
  /** Wall clock of the first main-gear contact. */
  at: number;
  lat: number;
  lon: number;
  headingDeg: Degrees;
  groundspeedKt: Knots;
  /** Descent rate at contact from the height-above-ground slope, negative going down. */
  touchdownRateFpm: FeetPerMinute;
  /** X-Plane's own vertical speed in the last airborne frame, for comparison. */
  indicatedRateFpm: FeetPerMinute;
  /** Highest normal load factor in the second after contact. */
  peakG: number;
  pitchDeg: Degrees;
  rollDeg: Degrees;
  /** Body pitch rate at contact, degrees per second. Positive is nose up. */
  pitchRateDegSec: number;
  flare: FlareGrade;
  /** Pitch rate when the nose gear came down, null if it never did before the report closed. */
  noseRateDegSec: number | null;
  /** Seconds between crossing 15 m above ground and first contact. */
  floatSec: Seconds;
  bounces: number;
  /** Descent rate of each subsequent contact after a bounce. */
  bounceRatesFpm: FeetPerMinute[];
  rating: LandingRating;
  runway: LandingRunway | null;
}

export interface FlightAirport {
  icao: string;
  name: string;
}

export interface FlightAircraft {
  icao: string | null;
  name: string | null;
  livery: string | null;
}

export type FlightStatus = 'active' | 'complete' | 'aborted';

export interface FlightSummary {
  id: string;
  startedAt: number;
  endedAt: number | null;
  status: FlightStatus;
  aircraft: FlightAircraft;
  departure: FlightAirport | null;
  arrival: FlightAirport | null;
  /** Wall-clock seconds from first movement to parking. */
  blockTimeSec: Seconds;
  /** Wall-clock seconds spent airborne. */
  airTimeSec: Seconds;
  distanceNm: NauticalMiles;
  maxAltFt: Feet;
  maxGroundspeedKt: Knots;
  fuelStartKg: Kilograms | null;
  fuelEndKg: Kilograms | null;
  /** Most recent landing, also the one shown on the card. */
  landing: LandingReport | null;
  landingCount: number;
  pointCount: number;
  /** Small equirectangular preview of the track for list thumbnails, `[lat, lon]` pairs. */
  preview: [number, number][];
}

export interface FlightDetail extends FlightSummary {
  track: TrackPointTuple[];
  landings: LandingReport[];
}

export interface LiveRecorderState {
  flight: FlightSummary | null;
  phase: FlightPhase;
  track: TrackPointTuple[];
}

export type FlightRecorderEvent =
  | { type: 'flightStarted'; flight: FlightSummary }
  | { type: 'phase'; flightId: string; phase: FlightPhase }
  | { type: 'track'; flightId: string; points: TrackPointTuple[] }
  | { type: 'landing'; flightId: string; report: LandingReport }
  | { type: 'flightUpdated'; flight: FlightSummary }
  | { type: 'flightEnded'; flight: FlightSummary };

export interface AircraftHint {
  icao: string | null;
  name: string | null;
  livery: string | null;
}

export function landingRating(touchdownRateFpm: FeetPerMinute): LandingRating {
  if (touchdownRateFpm >= -125) return 'butter';
  if (touchdownRateFpm >= -250) return 'great';
  if (touchdownRateFpm >= -350) return 'acceptable';
  if (touchdownRateFpm >= -600) return 'hard';
  return 'severe';
}
