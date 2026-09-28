/**
 * Daylight along a flight: which twilight phase the sun is in at a point and
 * time, how that changes along a route, and when to take off so the flight
 * meets a lighting goal (land at sunset, stay in daylight, ...).
 *
 * Sun geometry comes from the map's solar model so the plan builder, the sky
 * lighting and the city lights all agree on where the sun is.
 */
import * as SunCalc from 'suncalc';
import { sunPosition } from '@/lib/map/solar/solarPosition';
import { haversineDistance } from '@/lib/utils/geomath';

export type LightPhase = 'day' | 'civil' | 'nautical' | 'astro' | 'night';

export const LIGHT_PHASES: readonly LightPhase[] = ['day', 'civil', 'nautical', 'astro', 'night'];

/** Sun altitude, degrees, at the lower edge of each twilight band. */
export const TWILIGHT_ALTITUDE = { civil: -6, nautical: -12, astro: -18 } as const;

/**
 * Altitude at which sunrise and sunset are conventionally called, allowing
 * for refraction and the sun's radius. Same figure suncalc uses.
 */
const HORIZON_ALTITUDE = -0.833;

/**
 * A "daylight" flight keeps the sun at least this high the whole way. Just
 * above the horizon still looks like dawn or dusk on the map and in the sim,
 * so the goal aims for real daylight rather than the first minute after sunrise.
 */
export const DAYLIGHT_MIN_ALTITUDE = 6;

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

const MIN_MS = 60_000;
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export function phaseForAltitude(altitudeDeg: number): LightPhase {
  if (altitudeDeg > 0) return 'day';
  if (altitudeDeg > TWILIGHT_ALTITUDE.civil) return 'civil';
  if (altitudeDeg > TWILIGHT_ALTITUDE.nautical) return 'nautical';
  if (altitudeDeg > TWILIGHT_ALTITUDE.astro) return 'astro';
  return 'night';
}

export function sunAltitudeAt(timeMs: number, lat: number, lon: number): number {
  return sunPosition(timeMs, lat, lon).altitude;
}

export function phaseAt(timeMs: number, lat: number, lon: number): LightPhase {
  return phaseForAltitude(sunAltitudeAt(timeMs, lat, lon));
}

/** Point a fraction `f` of the way along the great circle from `a` to `b`. */
export function greatCirclePoint(a: RoutePoint, b: RoutePoint, f: number): RoutePoint {
  const phi1 = a.latitude * RAD;
  const lam1 = a.longitude * RAD;
  const phi2 = b.latitude * RAD;
  const lam2 = b.longitude * RAD;

  const cosD =
    Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(lam2 - lam1);
  const d = Math.acos(Math.min(1, Math.max(-1, cosD)));
  if (d < 1e-9) return a;

  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(phi1) * Math.cos(lam1) + B * Math.cos(phi2) * Math.cos(lam2);
  const y = A * Math.cos(phi1) * Math.sin(lam1) + B * Math.cos(phi2) * Math.sin(lam2);
  const z = A * Math.sin(phi1) + B * Math.sin(phi2);

  return {
    latitude: Math.atan2(z, Math.sqrt(x * x + y * y)) * DEG,
    longitude: Math.atan2(y, x) * DEG,
  };
}

/**
 * Point a fraction `f` of the total distance along a polyline of route
 * points, interpolating along the great circle inside each leg.
 */
export function routePointAt(points: RoutePoint[], f: number): RoutePoint {
  const first = points[0];
  if (!first) throw new Error('routePointAt needs at least one point');
  if (points.length === 1) return first;

  const legs: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const next = points[i]!;
    const len = haversineDistance(prev.latitude, prev.longitude, next.latitude, next.longitude);
    legs.push(len);
    total += len;
  }
  if (total === 0) return first;

  const target = Math.min(1, Math.max(0, f)) * total;
  let walked = 0;
  for (let i = 0; i < legs.length; i++) {
    const len = legs[i]!;
    if (walked + len >= target || i === legs.length - 1) {
      const within = len === 0 ? 0 : (target - walked) / len;
      return greatCirclePoint(points[i]!, points[i + 1]!, Math.min(1, Math.max(0, within)));
    }
    walked += len;
  }
  return points[points.length - 1]!;
}

/** Sun altitude at `samples` evenly spaced positions and times along the flight. */
export function sampleRouteAltitudes(
  points: RoutePoint[],
  fromMs: number,
  toMs: number,
  samples: number
): number[] {
  const out: number[] = [];
  const n = Math.max(1, samples);
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0 : i / (n - 1);
    const { latitude, longitude } = routePointAt(points, f);
    out.push(sunAltitudeAt(fromMs + f * (toMs - fromMs), latitude, longitude));
  }
  return out;
}

export function sampleRoute(
  points: RoutePoint[],
  fromMs: number,
  toMs: number,
  samples: number
): LightPhase[] {
  return sampleRouteAltitudes(points, fromMs, toMs, samples).map(phaseForAltitude);
}

export interface SunEvents {
  sunriseMs: number | null;
  sunsetMs: number | null;
}

/** Sunrise and sunset for the solar day containing `timeMs` at a place, null under midnight sun or polar night. */
export function sunEvents(timeMs: number, lat: number, lon: number): SunEvents {
  const times = SunCalc.getTimes(new Date(timeMs), lat, lon);
  // suncalc hands back null (typed as Date) when the sun never crosses the horizon.
  const valid = (d: Date | null): number | null =>
    d === null || Number.isNaN(d.getTime()) ? null : d.getTime();
  return { sunriseMs: valid(times.sunrise), sunsetMs: valid(times.sunset) };
}

export type LightGoal =
  'daylight' | 'night' | 'dawnDeparture' | 'duskDeparture' | 'dawnArrival' | 'duskArrival';

export const LIGHT_GOALS: readonly LightGoal[] = [
  'daylight',
  'night',
  'dawnDeparture',
  'duskDeparture',
  'dawnArrival',
  'duskArrival',
];

export interface SolveOptions {
  points: RoutePoint[];
  eteMinutes: number;
  /** Earliest takeoff considered. */
  fromMs: number;
  stepMinutes?: number;
  horizonHours?: number;
  samples?: number;
}

/**
 * Earliest takeoff at or after `fromMs` that meets the goal, or null when no
 * takeoff within the horizon does. Dawn and dusk goals put the endpoint at
 * the sunrise or sunset moment to within one step; daylight means the sun
 * is up along the whole route, night means it is below civil twilight the
 * whole way.
 */
export function solveTakeoff(goal: LightGoal, options: SolveOptions): number | null {
  const step = (options.stepMinutes ?? 5) * MIN_MS;
  const horizon = (options.horizonHours ?? 24) * 60 * MIN_MS;
  const samples = options.samples ?? 40;
  const ete = options.eteMinutes * MIN_MS;
  const dep = options.points[0];
  const arr = options.points[options.points.length - 1];
  if (!dep || !arr) return null;

  const crosses = (point: RoutePoint, atMs: number, direction: 'rise' | 'set'): boolean => {
    const before = sunAltitudeAt(atMs, point.latitude, point.longitude) - HORIZON_ALTITUDE;
    const after = sunAltitudeAt(atMs + step, point.latitude, point.longitude) - HORIZON_ALTITUDE;
    return direction === 'rise' ? before < 0 && after >= 0 : before >= 0 && after < 0;
  };

  const meets = (takeoffMs: number): boolean => {
    switch (goal) {
      case 'daylight':
        return sampleRouteAltitudes(options.points, takeoffMs, takeoffMs + ete, samples).every(
          (alt) => alt >= DAYLIGHT_MIN_ALTITUDE
        );
      case 'night':
        return sampleRouteAltitudes(options.points, takeoffMs, takeoffMs + ete, samples).every(
          (alt) => alt <= TWILIGHT_ALTITUDE.civil
        );
      case 'dawnDeparture':
        return crosses(dep, takeoffMs, 'rise');
      case 'duskDeparture':
        return crosses(dep, takeoffMs, 'set');
      case 'dawnArrival':
        return crosses(arr, takeoffMs + ete, 'rise');
      case 'duskArrival':
        return crosses(arr, takeoffMs + ete, 'set');
    }
  };

  // Scan on a fixed grid rather than from `fromMs` itself, so the answer
  // holds still while the clock creeps forward between calls.
  const start = Math.ceil(options.fromMs / step) * step;
  for (let t = start; t <= start + horizon; t += step) {
    if (meets(t)) return t;
  }
  return null;
}
