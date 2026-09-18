import { calculateBearing, haversineDistance } from '@/lib/utils/geomath';
import type { LandingRunway } from '@/types/flightRecorder';

export interface RunwayEndGeometry {
  name: string;
  lat: number;
  lon: number;
}

export interface RunwayGeometry {
  widthM: number;
  ends: [RunwayEndGeometry, RunwayEndGeometry];
}

export interface AirportRunways {
  icao: string;
  name: string;
  runways: RunwayGeometry[];
}

export interface TouchdownPoint {
  lat: number;
  lon: number;
  headingDeg: number;
}

const MAX_HEADING_DIFF_DEG = 40;
const MIN_LATERAL_TOLERANCE_M = 60;
const ALONG_TRACK_SLACK_M = 400;
const EARTH_RADIUS_M = 6_371_000;

function headingDiff(a: number, b: number): number {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

/**
 * Pick the runway end the aircraft landed on and where on the runway it
 * touched. Local flat-earth projection is fine at runway scale.
 */
export function matchRunway(
  touchdown: TouchdownPoint,
  airports: readonly AirportRunways[]
): LandingRunway | null {
  let best: { score: number; result: LandingRunway } | null = null;
  const cosLat = Math.cos((touchdown.lat * Math.PI) / 180);

  for (const airport of airports) {
    for (const runway of airport.runways) {
      for (let i = 0; i < 2; i++) {
        const threshold = runway.ends[i]!;
        const farEnd = runway.ends[1 - i]!;
        const bearing = calculateBearing(threshold.lat, threshold.lon, farEnd.lat, farEnd.lon);
        const diff = headingDiff(bearing, touchdown.headingDeg);
        if (diff > MAX_HEADING_DIFF_DEG) continue;

        const lengthM = haversineDistance(threshold.lat, threshold.lon, farEnd.lat, farEnd.lon);
        const dx = ((touchdown.lon - threshold.lon) * Math.PI * EARTH_RADIUS_M * cosLat) / 180;
        const dy = ((touchdown.lat - threshold.lat) * Math.PI * EARTH_RADIUS_M) / 180;
        const theta = (bearing * Math.PI) / 180;
        const along = dx * Math.sin(theta) + dy * Math.cos(theta);
        const cross = dx * Math.cos(theta) - dy * Math.sin(theta);

        const lateralTolerance = Math.max(MIN_LATERAL_TOLERANCE_M, runway.widthM * 2);
        if (Math.abs(cross) > lateralTolerance) continue;
        if (along < -ALONG_TRACK_SLACK_M || along > lengthM + ALONG_TRACK_SLACK_M) continue;

        const score = Math.abs(cross) + diff * 2;
        if (!best || score < best.score) {
          best = {
            score,
            result: {
              icao: airport.icao,
              airportName: airport.name,
              runway: threshold.name,
              runwayLengthM: Math.round(lengthM),
              distancePastThresholdM: Math.round(along),
              centerlineOffsetM: Math.round(cross * 10) / 10,
            },
          };
        }
      }
    }
  }

  return best?.result ?? null;
}
