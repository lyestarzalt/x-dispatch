import type { GuidanceDirection, GuidanceLeg, GuidanceRoute, GuidanceSource } from '../types';

/** Test origin near LFBO. Offsets are in metres east (x) and north (y) of it. */
const LAT0 = 43.63;
const LON0 = 1.37;
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((LAT0 * Math.PI) / 180);

export function at(x: number, y: number): { lat: number; lon: number } {
  return { lat: LAT0 + y / M_PER_DEG_LAT, lon: LON0 + x / M_PER_DEG_LON };
}

export function leg(name: string, runways: string[] = [], isRunway = false): GuidanceLeg {
  return { name, isRunway, runways };
}

/** A route through the given metre offsets; `legs[i]` joins `xy[i]` to `xy[i + 1]`. */
export function makeRoute(
  xy: [number, number][],
  legs: GuidanceLeg[],
  opts: {
    direction?: GuidanceDirection;
    runway?: string | null;
    gateName?: string | null;
    source?: GuidanceSource;
  } = {}
): GuidanceRoute {
  return {
    icao: 'LFBO',
    direction: opts.direction ?? 'departure',
    runway: opts.runway ?? null,
    gateName: opts.gateName ?? null,
    source: opts.source ?? 'planned',
    points: xy.map(([x, y]) => at(x, y)),
    legs,
    anchorNodeIds: [],
    nodeIds: [],
  };
}
