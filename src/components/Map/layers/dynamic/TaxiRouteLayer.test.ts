import { describe, expect, it } from 'vitest';
import { dedupCoincident } from './TaxiRouteLayer';

describe('dedupCoincident', () => {
  it('returns the input unchanged when no points are coincident', () => {
    const points = [
      { longitude: 0, latitude: 0 },
      { longitude: 1, latitude: 1 },
      { longitude: 2, latitude: 2 },
    ];
    expect(dedupCoincident(points)).toEqual(points);
  });

  it('drops consecutive points that share the same lat/lon (the chevron-flip root cause)', () => {
    // Junction node from one A* sub-path stitched to a different junction
    // node at the same physical position from the next sub-path. Distinct
    // ids, identical coords → dedup must collapse them.
    const points = [
      { longitude: 5.32932, latitude: 45.36296 },
      { longitude: 5.32945, latitude: 45.36302 },
      { longitude: 5.32945, latitude: 45.36302 },
      { longitude: 5.33001, latitude: 45.36315 },
    ];
    expect(dedupCoincident(points)).toEqual([
      { longitude: 5.32932, latitude: 45.36296 },
      { longitude: 5.32945, latitude: 45.36302 },
      { longitude: 5.33001, latitude: 45.36315 },
    ]);
  });

  it('drops sub-epsilon drift (~10 cm at the equator at 1e-6)', () => {
    // 5e-7 of a degree ≈ 5.5 cm — well below the 1e-6 default threshold.
    const points = [
      { longitude: 5.0, latitude: 45.0 },
      { longitude: 5.0000005, latitude: 45.0000005 },
      { longitude: 5.001, latitude: 45.001 },
    ];
    expect(dedupCoincident(points)).toEqual([
      { longitude: 5.0, latitude: 45.0 },
      { longitude: 5.001, latitude: 45.001 },
    ]);
  });

  it('keeps drift just above the threshold', () => {
    // 2e-6 of a degree ≈ 22 cm — above the 1e-6 default, must survive.
    const points = [
      { longitude: 5.0, latitude: 45.0 },
      { longitude: 5.000002, latitude: 45.0 },
      { longitude: 5.001, latitude: 45.0 },
    ];
    expect(dedupCoincident(points)).toEqual(points);
  });

  it('handles empty and singleton inputs', () => {
    expect(dedupCoincident([])).toEqual([]);
    const single = [{ longitude: 1, latitude: 2 }];
    expect(dedupCoincident(single)).toEqual(single);
  });
});
