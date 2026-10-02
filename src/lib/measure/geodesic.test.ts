import { describe, expect, it } from 'vitest';
import { finalBearing, greatCircleArc, greatCircleMidpoint } from './geodesic';

describe('greatCircleArc', () => {
  it('starts and ends exactly on the input points', () => {
    const arc = greatCircleArc([2.35, 48.86], [-73.98, 40.71], 50);
    expect(arc).toHaveLength(51);
    expect(arc[0]).toEqual([2.35, 48.86]);
    const last = arc[50] as [number, number];
    expect(last[0]).toBeCloseTo(-73.98, 6);
    expect(last[1]).toBeCloseTo(40.71, 6);
  });

  it('bows poleward between Paris and New York', () => {
    const arc = greatCircleArc([2.35, 48.86], [-73.98, 40.71], 50);
    expect((arc[25] as [number, number])[1]).toBeGreaterThan(50);
  });

  it('unwraps longitudes across the antimeridian instead of jumping', () => {
    const arc = greatCircleArc([170, 0], [-170, 0], 10);
    for (let i = 1; i < arc.length; i++) {
      const cur = arc[i] as [number, number];
      const prev = arc[i - 1] as [number, number];
      expect(Math.abs(cur[0] - prev[0])).toBeLessThan(10);
    }
  });

  it('returns just the two points for a degenerate line', () => {
    expect(greatCircleArc([10, 10], [10, 10], 20)).toEqual([
      [10, 10],
      [10, 10],
    ]);
  });
});

describe('finalBearing', () => {
  it('equals the initial bearing on a short line', () => {
    expect(finalBearing(48, 2, 48.1, 2.1)).toBeCloseTo(33.8, 0);
  });

  it('differs from the initial bearing on a long east-west line', () => {
    // Paris -> New York starts ~292° true and arrives ~234° true.
    expect(finalBearing(48.86, 2.35, 40.71, -73.98)).toBeCloseTo(233.7, 0);
  });
});

describe('greatCircleMidpoint', () => {
  it('is the midpoint of the arc, not the chord', () => {
    const [lon, lat] = greatCircleMidpoint([2.35, 48.86], [-73.98, 40.71]);
    expect(lat).toBeGreaterThan(50);
    expect(lon).toBeLessThan(-30);
  });
});
