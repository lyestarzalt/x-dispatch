import {
  TRACK_ALT,
  TRACK_GS,
  TRACK_HDG,
  TRACK_LAT,
  TRACK_LON,
  TRACK_T,
  TRACK_VS,
  type TrackPointTuple,
} from '@/types/flightRecorder';

export interface TrailSegmentProps {
  /** Altitude of the segment's end point, feet. */
  alt: number;
  /** Minutes since the segment was flown, relative to `nowMs`. */
  age: number;
}

export type TrailFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  TrailSegmentProps
>;

export const EMPTY_TRAIL: TrailFeatureCollection = { type: 'FeatureCollection', features: [] };

/** Keep the trail continuous across the antimeridian by unwrapping longitudes. */
function unwrapLon(lon: number, prevLon: number): number {
  let out = lon;
  while (out - prevLon > 180) out -= 360;
  while (out - prevLon < -180) out += 360;
  return out;
}

/**
 * One two-point line per consecutive pair so each piece carries its own
 * altitude for the colour ramp. `step` decimates long tracks; the last point
 * is always kept so the trail reaches the aircraft.
 */
export function trailSegments(
  points: readonly TrackPointTuple[],
  opts: { step?: number; nowMs?: number } = {}
): TrailFeatureCollection {
  const step = Math.max(1, Math.floor(opts.step ?? 1));
  const now = opts.nowMs ?? Date.now();
  const features: TrailFeatureCollection['features'] = [];
  if (points.length < 2) return { type: 'FeatureCollection', features };

  let prev = points[0]!;
  let prevLon = prev[TRACK_LON];
  for (let i = step; i < points.length + step - 1; i += step) {
    const idx = Math.min(i, points.length - 1);
    const p = points[idx]!;
    if (p === prev) break;
    const lon = unwrapLon(p[TRACK_LON], prevLon);
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [prevLon, prev[TRACK_LAT]],
          [lon, p[TRACK_LAT]],
        ],
      },
      properties: {
        alt: p[TRACK_ALT],
        age: Math.max(0, (now - p[TRACK_T]) / 60_000),
      },
    });
    prev = p;
    prevLon = lon;
    if (idx === points.length - 1) break;
  }
  return { type: 'FeatureCollection', features };
}

/** Decimation step that keeps a track under `maxSegments` pieces. */
export function trailStep(pointCount: number, maxSegments = 4000): number {
  return Math.max(1, Math.ceil(pointCount / maxSegments));
}

export interface TrackSample {
  lat: number;
  lon: number;
  alt: number;
  gs: number;
  hdg: number;
  vs: number;
  /** Index of the point at or before the sampled time. */
  index: number;
}

function lerpHeading(a: number, b: number, f: number): number {
  const delta = ((b - a + 540) % 360) - 180;
  return (a + delta * f + 360) % 360;
}

/** Position along the track at wall-clock `tMs`, clamped to the ends. */
export function sampleTrack(track: readonly TrackPointTuple[], tMs: number): TrackSample | null {
  if (track.length === 0) return null;
  const first = track[0]!;
  const last = track[track.length - 1]!;
  if (tMs <= first[TRACK_T]) return toSample(first, 0);
  if (tMs >= last[TRACK_T]) return toSample(last, track.length - 1);

  let lo = 0;
  let hi = track.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid]![TRACK_T] <= tMs) lo = mid;
    else hi = mid;
  }
  const a = track[lo]!;
  const b = track[hi]!;
  const span = b[TRACK_T] - a[TRACK_T];
  const f = span > 0 ? (tMs - a[TRACK_T]) / span : 0;
  const lonB = unwrapLon(b[TRACK_LON], a[TRACK_LON]);
  let lon = a[TRACK_LON] + (lonB - a[TRACK_LON]) * f;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return {
    lat: a[TRACK_LAT] + (b[TRACK_LAT] - a[TRACK_LAT]) * f,
    lon,
    alt: a[TRACK_ALT] + (b[TRACK_ALT] - a[TRACK_ALT]) * f,
    gs: a[TRACK_GS] + (b[TRACK_GS] - a[TRACK_GS]) * f,
    hdg: lerpHeading(a[TRACK_HDG], b[TRACK_HDG], f),
    vs: a[TRACK_VS] + (b[TRACK_VS] - a[TRACK_VS]) * f,
    index: lo,
  };
}

function toSample(p: TrackPointTuple, index: number): TrackSample {
  return {
    lat: p[TRACK_LAT],
    lon: p[TRACK_LON],
    alt: p[TRACK_ALT],
    gs: p[TRACK_GS],
    hdg: p[TRACK_HDG],
    vs: p[TRACK_VS],
    index,
  };
}

/** Bounding box `[west, south, east, north]` of a track, or null when empty. */
export function trackBounds(
  track: readonly TrackPointTuple[]
): [number, number, number, number] | null {
  if (track.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const p of track) {
    west = Math.min(west, p[TRACK_LON]);
    east = Math.max(east, p[TRACK_LON]);
    south = Math.min(south, p[TRACK_LAT]);
    north = Math.max(north, p[TRACK_LAT]);
  }
  return [west, south, east, north];
}
