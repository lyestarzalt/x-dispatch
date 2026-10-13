import type { GuidanceDirection, GuidanceLeg, GuidancePoint, GuidanceRoute } from './types';

/**
 * The planned routes as the main window hands them to the detached flight strip.
 * The main window owns them; main keeps the last set it was sent and gives it to
 * the strip window when it opens.
 */
export interface GuidanceRoutes {
  departure: GuidanceRoute | null;
  arrival: GuidanceRoute | null;
}

export const NO_GUIDANCE_ROUTES: GuidanceRoutes = { departure: null, arrival: null };

type Fields = Record<string, unknown>;

const isObject = (v: unknown): v is Fields => typeof v === 'object' && v !== null;
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNullableString = (v: unknown): v is string | null => v === null || typeof v === 'string';
const isNumberArray = (v: unknown): v is number[] => Array.isArray(v) && v.every(isFiniteNumber);

function isPoint(v: unknown): v is GuidancePoint {
  return isObject(v) && isFiniteNumber(v.lat) && isFiniteNumber(v.lon);
}

function isLeg(v: unknown): v is GuidanceLeg {
  return (
    isObject(v) &&
    typeof v.name === 'string' &&
    typeof v.isRunway === 'boolean' &&
    Array.isArray(v.runways) &&
    v.runways.every((r) => typeof r === 'string')
  );
}

function parseRoute(v: unknown, direction: GuidanceDirection): GuidanceRoute | null {
  if (!isObject(v) || v.direction !== direction || typeof v.icao !== 'string') return null;
  const { points, legs } = v;
  if (!Array.isArray(points) || points.length < 2 || !points.every(isPoint)) return null;
  if (!Array.isArray(legs) || legs.length !== points.length - 1 || !legs.every(isLeg)) return null;
  if (!isNullableString(v.runway) || !isNullableString(v.gateName)) return null;
  if (v.source !== 'auto' && v.source !== 'planned') return null;
  if (!isNumberArray(v.anchorNodeIds) || !isNumberArray(v.nodeIds)) return null;
  return {
    icao: v.icao,
    direction,
    runway: v.runway,
    gateName: v.gateName,
    source: v.source,
    points,
    legs,
    anchorNodeIds: v.anchorNodeIds,
    nodeIds: v.nodeIds,
  };
}

/** IPC input is untrusted: keep each route only when it is whole. */
export function parseGuidanceRoutes(input: unknown): GuidanceRoutes {
  if (!isObject(input)) return NO_GUIDANCE_ROUTES;
  return {
    departure: parseRoute(input.departure, 'departure'),
    arrival: parseRoute(input.arrival, 'arrival'),
  };
}
