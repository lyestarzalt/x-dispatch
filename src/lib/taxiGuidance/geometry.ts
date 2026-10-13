import type { GuidancePoint } from './types';

/**
 * Flat local metres around the route's first point. An airport is a few
 * kilometres across, so an equirectangular projection is well inside the
 * accuracy the guidance needs.
 */
const METRES_PER_DEG_LAT = 111_320;

export interface Vec {
  x: number;
  y: number;
}

export interface RouteGeometry {
  lat0: number;
  lon0: number;
  /** Metres per degree of longitude at `lat0`. */
  kx: number;
  xy: Vec[];
  /** Distance from the start to each point, in metres. */
  cum: number[];
  total: number;
}

export function buildGeometry(points: GuidancePoint[]): RouteGeometry {
  const lat0 = points[0]?.lat ?? 0;
  const lon0 = points[0]?.lon ?? 0;
  const kx = METRES_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
  const xy = points.map((p) => ({
    x: (p.lon - lon0) * kx,
    y: (p.lat - lat0) * METRES_PER_DEG_LAT,
  }));
  const cum: number[] = [];
  let total = 0;
  for (let i = 0; i < xy.length; i++) {
    if (i > 0) total += Math.hypot(xy[i]!.x - xy[i - 1]!.x, xy[i]!.y - xy[i - 1]!.y);
    cum.push(total);
  }
  return { lat0, lon0, kx, xy, cum, total };
}

export function toLocal(g: RouteGeometry, lat: number, lon: number): Vec {
  return { x: (lon - g.lon0) * g.kx, y: (lat - g.lat0) * METRES_PER_DEG_LAT };
}

export function toLatLon(g: RouteGeometry, v: Vec): GuidancePoint {
  return { lat: g.lat0 + v.y / METRES_PER_DEG_LAT, lon: g.lon0 + v.x / g.kx };
}

/** The point `s` metres along the route, clamped to its ends. */
export function pointAtDistance(g: RouteGeometry, s: number): { point: Vec; segIndex: number } {
  const last = g.xy.length - 1;
  if (last <= 0 || s <= 0) return { point: g.xy[0] ?? { x: 0, y: 0 }, segIndex: 0 };
  if (s >= g.total) return { point: g.xy[last]!, segIndex: last - 1 };
  let i = 0;
  while (i < last - 1 && g.cum[i + 1]! < s) i++;
  const a = g.xy[i]!;
  const b = g.xy[i + 1]!;
  const len = g.cum[i + 1]! - g.cum[i]!;
  const t = len > 0 ? (s - g.cum[i]!) / len : 0;
  return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, segIndex: i };
}

/** The stretch of route from `from` to `to` metres along it, as lat/lon points. */
export function routeBetween(g: RouteGeometry, from: number, to: number): GuidancePoint[] {
  if (to <= from) return [];
  const start = pointAtDistance(g, from);
  const end = pointAtDistance(g, to);
  const points = [start.point];
  for (let i = start.segIndex + 1; i <= end.segIndex; i++) points.push(g.xy[i]!);
  points.push(end.point);
  return points.map((p) => toLatLon(g, p));
}

/** True bearing from `a` to `b`, 0 = north, clockwise, in [0, 360). */
export function bearingOf(a: Vec, b: Vec): number {
  const deg = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Signed change of heading from `inDeg` to `outDeg`, in (-180, 180]. Positive turns right. */
export function signedTurn(inDeg: number, outDeg: number): number {
  let d = (outDeg - inDeg) % 360;
  if (d <= -180) d += 360;
  if (d > 180) d -= 360;
  return d;
}

/** Closest point to `p` on segment `ab`, with how far along it (0..1) and how far away. */
export function projectOnSegment(
  p: Vec,
  a: Vec,
  b: Vec
): { t: number; point: Vec; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const point = { x: a.x + dx * t, y: a.y + dy * t };
  return { t, point, distance: Math.hypot(p.x - point.x, p.y - point.y) };
}
