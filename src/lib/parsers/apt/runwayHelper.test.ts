import { describe, expect, it } from 'vitest';
import {
  ApproachLighting,
  RunwayEndIdentifierLights,
  RunwayMarking,
  ShoulderSurfaceType,
  SurfaceType,
} from '@/types/apt';
import type { Runway } from '@/types/apt';
import { getRunwayPolygon, getRunwayShoulderPolygon } from './runwayHelper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EARTH_RADIUS = 6371e3;

/** Haversine distance in meters between two [lon, lat] GeoJSON points */
function haversineDistance(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(x));
}

/** Minimal RunwayEnd factory */
function makeEnd(name: string, latitude: number, longitude: number): Runway['ends'][0] {
  return {
    name,
    latitude,
    longitude,
    dthr_length: 0,
    overrun_length: 0,
    marking: RunwayMarking.PRECISION,
    lighting: ApproachLighting.NONE,
    tdz_lighting: false,
    reil: RunwayEndIdentifierLights.NONE,
  };
}

/**
 * KJFK runway 04L/22R approximate coordinates.
 * End 04L: 40.6181°N, -73.7780°W
 * End 22R: 40.6390°N, -73.7573°W
 * Width: 61 m (200 ft)
 */
function makeKJFKRunway(overrides: Partial<Runway> = {}): Runway {
  return {
    width: 61,
    surface_type: SurfaceType.ASPHALT,
    shoulder_surface_type: ShoulderSurfaceType.NONE,
    shoulder_width: 0,
    smoothness: 0.25,
    centerline_lights: true,
    edge_lights: true,
    auto_distance_remaining_signs: true,
    ends: [makeEnd('04L', 40.6181, -73.778), makeEnd('22R', 40.639, -73.7573)],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getRunwayPolygon
// ---------------------------------------------------------------------------

describe('getRunwayPolygon', () => {
  it('returns 5 points (closed polygon)', () => {
    const runway = makeKJFKRunway();
    const polygon = getRunwayPolygon(runway);
    expect(polygon).toHaveLength(5);
  });

  it('first and last points are equal (closed ring)', () => {
    const runway = makeKJFKRunway();
    const polygon = getRunwayPolygon(runway);
    expect(polygon[0]![0]).toBeCloseTo(polygon[4]![0], 6);
    expect(polygon[0]![1]).toBeCloseTo(polygon[4]![1], 6);
  });

  it('polygon width roughly matches runway width', () => {
    const runway = makeKJFKRunway();
    const polygon = getRunwayPolygon(runway);
    // Side 1: corner[0] → corner[1] (left and right at end 1)
    const side1 = haversineDistance(polygon[0]!, polygon[1]!);
    expect(side1).toBeCloseTo(runway.width, 0); // within 1 m
  });

  it('polygon length roughly matches distance between runway ends', () => {
    const runway = makeKJFKRunway();
    const end1 = runway.ends[0];
    const end2 = runway.ends[1];
    const polygon = getRunwayPolygon(runway);

    const expectedLength = haversineDistance(
      [end1.longitude, end1.latitude],
      [end2.longitude, end2.latitude]
    );

    // Side length: corner[1] → corner[2] (along runway from end1 to end2)
    const sideLength = haversineDistance(polygon[1]!, polygon[2]!);
    // Tolerate up to 5 m difference (haversine precision vs calculateVertex)
    expect(Math.abs(sideLength - expectedLength)).toBeLessThan(5);
  });

  it('polygon is oriented approximately along the runway heading', () => {
    const runway = makeKJFKRunway();
    const polygon = getRunwayPolygon(runway);

    // The long side (corner[1] → corner[2]) should be oriented roughly 40° (heading 04L = 040°)
    const dx = polygon[2]![0] - polygon[1]![0]; // delta lon
    const dy = polygon[2]![1] - polygon[1]![1]; // delta lat
    const bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
    const normalized = ((bearing % 360) + 360) % 360;

    // Heading 04L = 40°, allow ±10° tolerance
    expect(Math.abs(normalized - 40)).toBeLessThan(10);
  });

  it('works with a narrow runway (width < 30 m)', () => {
    const runway = makeKJFKRunway({ width: 18 });
    const polygon = getRunwayPolygon(runway);
    expect(polygon).toHaveLength(5);
    const side1 = haversineDistance(polygon[0]!, polygon[1]!);
    expect(side1).toBeCloseTo(18, 0);
  });
});

// ---------------------------------------------------------------------------
// getRunwayShoulderPolygon
// ---------------------------------------------------------------------------

describe('getRunwayShoulderPolygon', () => {
  it('returns null when shoulder_surface_type is NONE (0)', () => {
    const runway = makeKJFKRunway({ shoulder_surface_type: ShoulderSurfaceType.NONE });
    expect(getRunwayShoulderPolygon(runway)).toBeNull();
  });

  it('returns a 5-point polygon when shoulder surface is ASPHALT', () => {
    const runway = makeKJFKRunway({ shoulder_surface_type: ShoulderSurfaceType.ASPHALT });
    const polygon = getRunwayShoulderPolygon(runway);
    expect(polygon).not.toBeNull();
    expect(polygon).toHaveLength(5);
  });

  it('shoulder polygon is closed (first == last point)', () => {
    const runway = makeKJFKRunway({ shoulder_surface_type: ShoulderSurfaceType.CONCRETE });
    const polygon = getRunwayShoulderPolygon(runway)!;
    expect(polygon[0]![0]).toBeCloseTo(polygon[4]![0], 6);
    expect(polygon[0]![1]).toBeCloseTo(polygon[4]![1], 6);
  });

  it('shoulder polygon is wider than runway polygon', () => {
    const runway = makeKJFKRunway({ shoulder_surface_type: ShoulderSurfaceType.ASPHALT });
    const runwayPoly = getRunwayPolygon(runway);
    const shoulderPoly = getRunwayShoulderPolygon(runway)!;

    const runwayWidth = haversineDistance(runwayPoly[0]!, runwayPoly[1]!);
    const shoulderWidth = haversineDistance(shoulderPoly[0]!, shoulderPoly[1]!);
    expect(shoulderWidth).toBeGreaterThan(runwayWidth);
  });

  it('narrow runway (< 30 m) gets 3 m shoulders by default', () => {
    // width=18, shoulder_width=0 → default 3 m shoulders → total half-width = 9+3 = 12
    const runway = makeKJFKRunway({
      width: 18,
      shoulder_width: 0,
      shoulder_surface_type: ShoulderSurfaceType.ASPHALT,
    });
    const runwayPoly = getRunwayPolygon(runway);
    const shoulderPoly = getRunwayShoulderPolygon(runway)!;

    const runwayWidth = haversineDistance(runwayPoly[0]!, runwayPoly[1]!);
    const shoulderWidth = haversineDistance(shoulderPoly[0]!, shoulderPoly[1]!);
    // Shoulder should be wider by 2 * 3 = 6 m
    expect(shoulderWidth - runwayWidth).toBeCloseTo(6, 0);
  });

  it('medium runway (30–45 m) gets 4 m shoulders by default', () => {
    const runway = makeKJFKRunway({
      width: 36,
      shoulder_width: 0,
      shoulder_surface_type: ShoulderSurfaceType.ASPHALT,
    });
    const runwayPoly = getRunwayPolygon(runway);
    const shoulderPoly = getRunwayShoulderPolygon(runway)!;

    const runwayWidth = haversineDistance(runwayPoly[0]!, runwayPoly[1]!);
    const shoulderWidth = haversineDistance(shoulderPoly[0]!, shoulderPoly[1]!);
    expect(shoulderWidth - runwayWidth).toBeCloseTo(8, 0);
  });

  it('wide runway (> 45 m) gets 5 m shoulders by default', () => {
    const runway = makeKJFKRunway({
      width: 61,
      shoulder_width: 0,
      shoulder_surface_type: ShoulderSurfaceType.ASPHALT,
    });
    const runwayPoly = getRunwayPolygon(runway);
    const shoulderPoly = getRunwayShoulderPolygon(runway)!;

    const runwayWidth = haversineDistance(runwayPoly[0]!, runwayPoly[1]!);
    const shoulderWidth = haversineDistance(shoulderPoly[0]!, shoulderPoly[1]!);
    expect(shoulderWidth - runwayWidth).toBeCloseTo(10, 0);
  });

  it('explicit shoulder_width overrides the default', () => {
    const runway = makeKJFKRunway({
      width: 61,
      shoulder_width: 10,
      shoulder_surface_type: ShoulderSurfaceType.ASPHALT,
    });
    const runwayPoly = getRunwayPolygon(runway);
    const shoulderPoly = getRunwayShoulderPolygon(runway)!;

    const runwayWidth = haversineDistance(runwayPoly[0]!, runwayPoly[1]!);
    const shoulderWidth = haversineDistance(shoulderPoly[0]!, shoulderPoly[1]!);
    // 2 * 10 = 20 m wider
    expect(shoulderWidth - runwayWidth).toBeCloseTo(20, 0);
  });
});
