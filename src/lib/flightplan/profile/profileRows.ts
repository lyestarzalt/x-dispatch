/**
 * Merges the planned profile and the sampled terrain into one distance-ordered series for the
 * chart: terrain samples get the planned altitude interpolated at their distance, profile
 * points get the ground height interpolated from the terrain, and every row carries the safe
 * altitude of the leg it lies on.
 */
import type { ProfilePoint, RouteProfile } from './routeProfile';
import type { TerrainSample } from './terrainSampler';

export interface ProfileChartRow {
  distance: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  groundHeight: number | null;
  legSafe: number | null;
  ident?: string;
  isTopOfClimb?: boolean;
  isTopOfDescent?: boolean;
}

function interpolateSeries(xs: number[], ys: number[], x: number): number | null {
  if (xs.length === 0) return null;
  if (x <= xs[0]!) return ys[0]!;
  if (x >= xs[xs.length - 1]!) return ys[ys.length - 1]!;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! <= x) lo = mid;
    else hi = mid;
  }
  const span = xs[hi]! - xs[lo]!;
  if (span === 0) return ys[lo]!;
  return ys[lo]! + ((x - xs[lo]!) / span) * (ys[hi]! - ys[lo]!);
}

/** Index of the leg (between input waypoints) a distance lies on. */
function legIndexAt(distancesNm: number[], d: number): number {
  for (let i = 1; i < distancesNm.length; i++) if (d <= distancesNm[i]!) return i - 1;
  return Math.max(0, distancesNm.length - 2);
}

export function buildProfileRows(
  profile: RouteProfile,
  terrain: TerrainSample[] | undefined,
  legSafeFt: number[] | undefined
): ProfileChartRow[] {
  const pts: ProfilePoint[] = profile.points;
  const px = pts.map((p) => p.distanceNm);
  const py = pts.map((p) => p.altitudeFt);
  const tx = (terrain ?? []).map((t) => t.distanceNm);
  const ty = (terrain ?? []).map((t) => t.elevationFt);
  const safeAt = (d: number): number | null =>
    legSafeFt && legSafeFt.length > 0
      ? (legSafeFt[legIndexAt(profile.distancesNm, d)] ?? null)
      : null;

  const rows: ProfileChartRow[] = pts.map((p) => ({
    distance: p.distanceNm,
    latitude: p.latitude,
    longitude: p.longitude,
    altitude: p.altitudeFt,
    groundHeight: interpolateSeries(tx, ty, p.distanceNm),
    legSafe: safeAt(p.distanceNm),
    ident: p.ident,
    isTopOfClimb: p.isTopOfClimb,
    isTopOfDescent: p.isTopOfDescent,
  }));
  for (const t of terrain ?? []) {
    // A sample right on a waypoint would duplicate its row; the waypoint row wins.
    if (pts.some((p) => Math.abs(p.distanceNm - t.distanceNm) < 1e-6)) continue;
    rows.push({
      distance: t.distanceNm,
      latitude: t.latitude,
      longitude: t.longitude,
      altitude: interpolateSeries(px, py, t.distanceNm),
      groundHeight: t.elevationFt,
      legSafe: safeAt(t.distanceNm),
    });
  }
  rows.sort((a, b) => a.distance - b.distance);
  return rows;
}
