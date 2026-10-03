import { describe, expect, it } from 'vitest';
import { buildProfileRows } from './profileRows';
import { CLASS_PERFORMANCE, computeRouteProfile } from './routeProfile';

describe('buildProfileRows', () => {
  const wps = [
    { id: 'A', latitude: 0, longitude: 0, via: 'ADEP' },
    { id: 'B', latitude: 0, longitude: 2, via: 'DRCT' },
    { id: 'C', latitude: 0, longitude: 4, via: 'ADES' },
  ];
  const profile = computeRouteProfile(wps, 20000, CLASS_PERFORMANCE.jet);
  const total = profile.totalDistanceNm;

  it('interleaves terrain samples with the planned points and fills both series on every row', () => {
    const terrain = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      latitude: 0,
      longitude: f * 4,
      distanceNm: f * total,
      elevationFt: 1000 * f,
    }));
    const rows = buildProfileRows(profile, terrain, [2500, 3500]);
    for (let i = 1; i < rows.length; i++)
      expect(rows[i]!.distance).toBeGreaterThanOrEqual(rows[i - 1]!.distance);
    for (const r of rows) {
      expect(r.altitude).not.toBeNull();
      expect(r.groundHeight).not.toBeNull();
    }
    // The waypoint row at the midpoint keeps its ident and takes the terrain's ground height there.
    const b = rows.find((r) => r.ident === 'B')!;
    expect(b.groundHeight).toBeCloseTo(500, 0);
    expect(b.legSafe).toBe(2500); // the boundary belongs to the first leg
    // A terrain sample in the second half carries the second leg's safe altitude.
    const late = rows.find((r) => !r.ident && r.distance > total * 0.7)!;
    expect(late.legSafe).toBe(3500);
    expect(late.altitude).toBeGreaterThan(0);
  });

  it('works with no terrain yet: ground and safe altitude stay null', () => {
    const rows = buildProfileRows(profile, undefined, undefined);
    expect(rows).toHaveLength(profile.points.length);
    expect(rows.every((r) => r.groundHeight === null && r.legSafe === null)).toBe(true);
  });
});
