import { describe, expect, it } from 'vitest';
import {
  ApproachLighting,
  RunwayEndIdentifierLights,
  RunwayMarking,
  ShoulderSurfaceType,
  SurfaceType,
} from '@/types/apt';
import type { Runway } from '@/types/apt';
import {
  getDisplacedThresholdMarkings,
  getDisplacedThresholdPoint,
  getMarkingProfile,
  getRunwayOverrunPolygons,
  getRunwayPolygon,
  getRunwayShoulderPolygon,
} from './runwayHelper';

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

// ---------------------------------------------------------------------------
// True bearing — the polygon follows the end coordinates, not the number
// ---------------------------------------------------------------------------

/** Initial bearing in degrees from a to b, both [lon, lat]. */
function bearingBetween(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(a[1]);
  const φ2 = toRad(b[1]);
  const Δλ = toRad(b[0] - a[0]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * A runway numbered 07R/25L whose end coordinates bear about 096°: the
 * number alone would put the strip 26° off the ground truth.
 */
function makeSkewedRunway(overrides: Partial<Runway> = {}): Runway {
  return {
    ...makeKJFKRunway(),
    ends: [makeEnd('07R', 33.9369, -118.4199), makeEnd('25L', 33.9335, -118.3842)],
    ...overrides,
  };
}

describe('getRunwayPolygon — orientation', () => {
  it('cuts the ends perpendicular to the true bearing between the end coordinates', () => {
    const runway = makeSkewedRunway();
    const polygon = getRunwayPolygon(runway);
    const trueBearing = bearingBetween(
      [runway.ends[0].longitude, runway.ends[0].latitude],
      [runway.ends[1].longitude, runway.ends[1].latitude]
    );
    // End edge runs from the left corner to the right corner: true bearing + 90°.
    const endEdge = bearingBetween(polygon[0]!, polygon[1]!);
    const expected = (trueBearing + 90) % 360;
    expect(Math.abs(endEdge - expected)).toBeLessThan(0.5);
    // And it is clearly not what the number alone (070° + 90°) would give.
    expect(Math.abs(endEdge - 160)).toBeGreaterThan(5);
  });

  it('keeps the full runway width when the number and true bearing differ', () => {
    const polygon = getRunwayPolygon(makeSkewedRunway());
    expect(Math.abs(haversineDistance(polygon[0]!, polygon[1]!) - 61)).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// Displaced thresholds and overruns
// ---------------------------------------------------------------------------

describe('getDisplacedThresholdPoint', () => {
  it('returns the end itself when nothing is displaced', () => {
    const runway = makeKJFKRunway();
    const point = getDisplacedThresholdPoint(runway, 0);
    expect(point[0]).toBeCloseTo(runway.ends[0].longitude, 9);
    expect(point[1]).toBeCloseTo(runway.ends[0].latitude, 9);
  });

  it('moves the threshold along the runway toward the far end by the displaced length', () => {
    const runway = makeKJFKRunway();
    runway.ends[0].dthr_length = 300;
    const point = getDisplacedThresholdPoint(runway, 0);
    const end = [runway.ends[0].longitude, runway.ends[0].latitude] as [number, number];
    const far = [runway.ends[1].longitude, runway.ends[1].latitude] as [number, number];
    expect(Math.abs(haversineDistance(end, point) - 300)).toBeLessThan(1);
    expect(haversineDistance(point, far)).toBeLessThan(haversineDistance(end, far));
  });
});

describe('getRunwayOverrunPolygons', () => {
  it('returns nothing when no end has an overrun', () => {
    expect(getRunwayOverrunPolygons(makeKJFKRunway())).toEqual([]);
  });

  it('extends beyond the end, away from the runway, by the overrun length and the full width', () => {
    const runway = makeKJFKRunway();
    runway.ends[1].overrun_length = 120;
    const overruns = getRunwayOverrunPolygons(runway);
    expect(overruns).toHaveLength(1);
    const { endName, polygon } = overruns[0]!;
    expect(endName).toBe('22R');
    expect(polygon).toHaveLength(5);
    // Long side is the overrun length, short side the runway width.
    expect(Math.abs(haversineDistance(polygon[1]!, polygon[2]!) - 120)).toBeLessThan(1);
    expect(Math.abs(haversineDistance(polygon[0]!, polygon[1]!) - 61)).toBeLessThan(0.5);
    // Every corner is at least as far from the opposite end as the runway end is.
    const far = [runway.ends[0].longitude, runway.ends[0].latitude] as [number, number];
    const endDist = haversineDistance(far, [runway.ends[1].longitude, runway.ends[1].latitude]);
    for (const corner of polygon) {
      expect(haversineDistance(far, corner)).toBeGreaterThan(endDist - 31);
    }
  });
});

describe('getDisplacedThresholdMarkings', () => {
  it('returns nothing when no end is displaced', () => {
    const markings = getDisplacedThresholdMarkings(makeKJFKRunway());
    expect(markings.bars).toEqual([]);
    expect(markings.centerlines).toEqual([]);
  });

  it('draws a full-width bar at the displaced threshold and a centerline back to the end', () => {
    const runway = makeKJFKRunway();
    runway.ends[0].dthr_length = 250;
    const { bars, centerlines } = getDisplacedThresholdMarkings(runway);
    expect(bars).toHaveLength(1);
    expect(centerlines).toHaveLength(1);
    const threshold = getDisplacedThresholdPoint(runway, 0);
    const bar = bars[0]!;
    // Bar spans the runway width across the displaced threshold point.
    expect(Math.abs(haversineDistance(bar[0]!, bar[1]!) - 61)).toBeLessThan(0.5);
    const mid: [number, number] = [(bar[0]![0] + bar[1]![0]) / 2, (bar[0]![1] + bar[1]![1]) / 2];
    expect(haversineDistance(mid, threshold)).toBeLessThan(2);
    // Centerline runs from the runway end to the displaced threshold.
    const line = centerlines[0]!;
    expect(line).toHaveLength(2);
    expect(
      haversineDistance(line[0]!, [runway.ends[0].longitude, runway.ends[0].latitude])
    ).toBeLessThan(0.5);
    expect(haversineDistance(line[1]!, threshold)).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// Marking profile — explicit per apt.dat code, never a numeric comparison
// ---------------------------------------------------------------------------

describe('getMarkingProfile', () => {
  it('draws nothing for unmarked runways', () => {
    expect(getMarkingProfile(0)).toEqual({
      thresholdStripes: false,
      aimingPoint: false,
      touchdownZone: false,
    });
  });

  it('visual runways get threshold stripes only', () => {
    expect(getMarkingProfile(RunwayMarking.VISUAL)).toEqual({
      thresholdStripes: true,
      aimingPoint: false,
      touchdownZone: false,
    });
  });

  it('non-precision runways add the aiming point', () => {
    expect(getMarkingProfile(RunwayMarking.NON_PRECISION)).toEqual({
      thresholdStripes: true,
      aimingPoint: true,
      touchdownZone: false,
    });
  });

  it('precision runways add the touchdown zone', () => {
    expect(getMarkingProfile(RunwayMarking.PRECISION)).toEqual({
      thresholdStripes: true,
      aimingPoint: true,
      touchdownZone: true,
    });
  });

  it('UK and EASA codes follow their precision class, not their numeric order', () => {
    expect(getMarkingProfile(RunwayMarking.UK_NON_PRECISION)).toEqual(
      getMarkingProfile(RunwayMarking.NON_PRECISION)
    );
    expect(getMarkingProfile(RunwayMarking.EASA_NON_PRECISION)).toEqual(
      getMarkingProfile(RunwayMarking.NON_PRECISION)
    );
    expect(getMarkingProfile(RunwayMarking.UK_PRECISION)).toEqual(
      getMarkingProfile(RunwayMarking.PRECISION)
    );
    expect(getMarkingProfile(RunwayMarking.EASA_PRECISION)).toEqual(
      getMarkingProfile(RunwayMarking.PRECISION)
    );
  });

  it('unknown codes draw nothing rather than guessing', () => {
    expect(getMarkingProfile(42)).toEqual({
      thresholdStripes: false,
      aimingPoint: false,
      touchdownZone: false,
    });
  });
});
