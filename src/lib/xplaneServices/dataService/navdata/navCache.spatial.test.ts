/**
 * Spatial query tests for navCache.
 *
 * Covers the read paths that the map renders against:
 *  - getNavaidsInBounds (with/without type filter, limit, empty)
 *  - getWaypointsInBounds
 *  - getAirspacesInBounds (bbox overlap semantics, not just containment)
 *  - getAirspacesNearPoint (radius -> bbox conversion)
 *  - getNavaidNearestById and getWaypointNearestById (range cutoff, case folding,
 *    nearest selection when multiple share an id)
 *
 * If these regress silently, the map shows wrong nav data — exactly the kind of
 * "no surprises" target the user asked for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Airspace, Navaid, Waypoint } from '@/types/navigation';
import { closeTestDb, createTestDb, getTestDb } from '../../../../../tests/helpers/db';

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => '/tmp' },
}));

vi.mock('@/lib/utils/logger', () => {
  const noop = () => {};
  const channel = { info: noop, warn: noop, error: noop, debug: noop };
  return {
    default: {
      info: noop,
      warn: noop,
      error: noop,
      debug: noop,
      main: channel,
      data: channel,
      ipc: channel,
      security: channel,
      launcher: channel,
      tracker: channel,
      addon: channel,
    },
    getLogPath: () => '/tmp/test.log',
  };
});

vi.mock('@/lib/db', async () => {
  const schema = await import('@/lib/db/schema');
  return {
    ...schema,
    getDb: () => getTestDb(),
    saveDb: vi.fn(),
  };
});

const {
  insertNavaids,
  getNavaidsInBounds,
  getNavaidNearestById,
  insertWaypoints,
  getWaypointsInBounds,
  getWaypointNearestById,
  insertAirspaces,
  getAirspacesInBounds,
  getAirspacesNearPoint,
} = await import('./navCache');

// ---------------------------------------------------------------------------
// Fixture builders — minimal valid records, only fields read by the queries.
// ---------------------------------------------------------------------------

function makeNavaid(
  overrides: Partial<Navaid> & { id: string; latitude: number; longitude: number }
): Navaid {
  return {
    type: 'VOR',
    name: overrides.name ?? `${overrides.id} VOR`,
    elevation: 0,
    frequency: 11400,
    range: 100,
    magneticVariation: 0,
    region: 'XX',
    country: 'XX',
    ...overrides,
  };
}

function makeWaypoint(
  overrides: Partial<Waypoint> & { id: string; latitude: number; longitude: number }
): Waypoint {
  return {
    region: 'XX',
    areaCode: 'XX',
    description: '',
    ...overrides,
  };
}

function makeAirspace(
  overrides: Partial<Airspace> & { name: string; coordinates: [number, number][] }
): Airspace {
  return {
    class: overrides.class ?? 'B',
    name: overrides.name,
    upperLimit: overrides.upperLimit ?? 'FL100',
    lowerLimit: overrides.lowerLimit ?? 'GND',
    coordinates: overrides.coordinates,
  };
}

/** Square polygon centred on (lat, lon) with the given half-extent in degrees. */
function squareAirspace(name: string, lat: number, lon: number, half: number): Airspace {
  return makeAirspace({
    name,
    coordinates: [
      [lon - half, lat - half],
      [lon + half, lat - half],
      [lon + half, lat + half],
      [lon - half, lat + half],
      [lon - half, lat - half],
    ],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('navCache spatial queries', () => {
  beforeEach(async () => {
    await createTestDb();
  });

  afterEach(() => {
    closeTestDb();
  });

  describe('getNavaidsInBounds', () => {
    beforeEach(() => {
      insertNavaids([
        makeNavaid({ id: 'INS', latitude: 10, longitude: 10, type: 'VOR' }),
        makeNavaid({ id: 'EDG', latitude: 12, longitude: 10, type: 'VOR' }),
        makeNavaid({ id: 'OUT', latitude: 20, longitude: 20, type: 'VOR' }),
        makeNavaid({ id: 'NDB1', latitude: 11, longitude: 11, type: 'NDB' }),
        makeNavaid({ id: 'ILS1', latitude: 11, longitude: 11, type: 'LOC' }),
      ]);
    });

    it('returns navaids inside the bounding box', () => {
      const result = getNavaidsInBounds(9, 13, 9, 13);
      const ids = result.map((n) => n.id).sort();
      expect(ids).toEqual(['EDG', 'ILS1', 'INS', 'NDB1']);
    });

    it('excludes navaids outside the bounding box', () => {
      const result = getNavaidsInBounds(9, 13, 9, 13);
      expect(result.find((n) => n.id === 'OUT')).toBeUndefined();
    });

    it('treats bbox edges as inclusive (BETWEEN semantics)', () => {
      // EDG is at exactly (12, 10) — query top edge at lat=12 should include it
      const result = getNavaidsInBounds(11, 12, 9, 11);
      expect(result.find((n) => n.id === 'EDG')).toBeDefined();
    });

    it('filters by type when types array is provided', () => {
      const result = getNavaidsInBounds(9, 13, 9, 13, ['NDB']);
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('NDB1');
    });

    it('includes multiple types when several are provided', () => {
      const result = getNavaidsInBounds(9, 13, 9, 13, ['NDB', 'LOC']);
      const ids = result.map((n) => n.id).sort();
      expect(ids).toEqual(['ILS1', 'NDB1']);
    });

    it('respects the limit parameter', () => {
      const result = getNavaidsInBounds(9, 13, 9, 13, undefined, 2);
      expect(result).toHaveLength(2);
    });

    it('returns empty when bbox contains no navaids', () => {
      const result = getNavaidsInBounds(50, 60, 50, 60);
      expect(result).toEqual([]);
    });

    it('returns empty when types filter matches nothing', () => {
      const result = getNavaidsInBounds(9, 13, 9, 13, ['DME']);
      expect(result).toEqual([]);
    });
  });

  describe('getWaypointsInBounds', () => {
    beforeEach(() => {
      insertWaypoints([
        makeWaypoint({ id: 'INS', latitude: 5, longitude: 5 }),
        makeWaypoint({ id: 'EDG', latitude: 6, longitude: 6 }),
        makeWaypoint({ id: 'OUT', latitude: 50, longitude: 50 }),
      ]);
    });

    it('returns waypoints inside the bounding box', () => {
      const result = getWaypointsInBounds(4, 7, 4, 7);
      const ids = result.map((w) => w.id).sort();
      expect(ids).toEqual(['EDG', 'INS']);
    });

    it('excludes waypoints outside the bounding box', () => {
      const result = getWaypointsInBounds(4, 7, 4, 7);
      expect(result.find((w) => w.id === 'OUT')).toBeUndefined();
    });

    it('respects the limit parameter', () => {
      const result = getWaypointsInBounds(0, 100, 0, 100, 1);
      expect(result).toHaveLength(1);
    });

    it('returns empty when no waypoints fall in the bbox', () => {
      const result = getWaypointsInBounds(80, 90, 80, 90);
      expect(result).toEqual([]);
    });
  });

  describe('getAirspacesInBounds', () => {
    beforeEach(() => {
      // Insert four airspaces at distinct locations.
      insertAirspaces([
        squareAirspace('CONTAINED', 10, 10, 0.5), // small airspace inside query
        squareAirspace('OVERLAPS', 9.5, 9.5, 1), // partially overlaps query
        squareAirspace('CONTAINS_QUERY', 10, 10, 100), // huge airspace covering query
        squareAirspace('FAR', 50, 50, 0.5), // no overlap
      ]);
    });

    it('returns airspaces whose bbox is fully inside the query bbox', () => {
      const result = getAirspacesInBounds(9, 11, 9, 11);
      expect(result.find((a) => a.name === 'CONTAINED')).toBeDefined();
    });

    it('returns airspaces partially overlapping the query bbox', () => {
      const result = getAirspacesInBounds(9, 11, 9, 11);
      expect(result.find((a) => a.name === 'OVERLAPS')).toBeDefined();
    });

    it('returns airspaces that fully contain the query bbox', () => {
      const result = getAirspacesInBounds(9.9, 10.1, 9.9, 10.1);
      expect(result.find((a) => a.name === 'CONTAINS_QUERY')).toBeDefined();
    });

    it('excludes airspaces with no spatial overlap', () => {
      const result = getAirspacesInBounds(9, 11, 9, 11);
      expect(result.find((a) => a.name === 'FAR')).toBeUndefined();
    });

    it('respects the limit parameter', () => {
      const result = getAirspacesInBounds(-90, 90, -180, 180, 2);
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('parses coordinates JSON back into a [lon, lat] array', () => {
      const result = getAirspacesInBounds(9, 11, 9, 11);
      const contained = result.find((a) => a.name === 'CONTAINED');
      expect(Array.isArray(contained?.coordinates)).toBe(true);
      expect(contained?.coordinates.length).toBeGreaterThan(0);
      // Each coord should be a [lon, lat] pair
      expect(contained?.coordinates[0]).toHaveLength(2);
    });
  });

  describe('getAirspacesNearPoint', () => {
    beforeEach(() => {
      // Place airspaces at known offsets from a reference point.
      // 1 degree lat ≈ 60 nm.
      insertAirspaces([
        squareAirspace('NEAR_30NM', 10.5, 10, 0.1), // ~30nm north of (10, 10)
        squareAirspace('NEAR_60NM', 11, 10, 0.1), // ~60nm north of (10, 10)
        squareAirspace('FAR_300NM', 15, 10, 0.1), // ~300nm north of (10, 10)
      ]);
    });

    it('finds airspaces within a small radius', () => {
      const result = getAirspacesNearPoint(10, 10, 50);
      expect(result.find((a) => a.name === 'NEAR_30NM')).toBeDefined();
    });

    it('excludes airspaces clearly beyond the radius', () => {
      const result = getAirspacesNearPoint(10, 10, 100);
      expect(result.find((a) => a.name === 'FAR_300NM')).toBeUndefined();
    });

    it('expands the radius and finds more airspaces', () => {
      const small = getAirspacesNearPoint(10, 10, 40);
      const big = getAirspacesNearPoint(10, 10, 80);
      expect(big.length).toBeGreaterThanOrEqual(small.length);
    });
  });

  describe('getNavaidNearestById', () => {
    beforeEach(() => {
      insertNavaids([
        // Two navaids share the id 'DUPL' at different locations
        makeNavaid({ id: 'DUPL', latitude: 10.0, longitude: 10.0, type: 'VOR', region: 'AA' }),
        makeNavaid({ id: 'DUPL', latitude: 10.5, longitude: 10.0, type: 'VOR', region: 'BB' }),
        makeNavaid({ id: 'SOLO', latitude: 20.0, longitude: 20.0, type: 'VOR' }),
      ]);
    });

    it('returns the navaid by id when within range', () => {
      const result = getNavaidNearestById('SOLO', 20.0, 20.0, 10);
      expect(result?.id).toBe('SOLO');
    });

    it('returns null when no navaid with that id exists', () => {
      const result = getNavaidNearestById('NOPE', 10, 10, 100);
      expect(result).toBeNull();
    });

    it('returns null when the navaid exists but is beyond max distance', () => {
      // SOLO is at (20, 20); search from (10, 10) with maxDist = 1nm
      const result = getNavaidNearestById('SOLO', 10, 10, 1);
      expect(result).toBeNull();
    });

    it('picks the nearest when multiple navaids share the id', () => {
      // Both DUPLs are within bbox; (10.0, 10.0) is closer to query (10.0, 10.0)
      const result = getNavaidNearestById('DUPL', 10.0, 10.0, 60);
      expect(result?.region).toBe('AA');
      expect(result?.latitude).toBeCloseTo(10.0, 4);
    });

    it('matches id case-insensitively (input is uppercased)', () => {
      const result = getNavaidNearestById('solo', 20.0, 20.0, 10);
      expect(result?.id).toBe('SOLO');
    });
  });

  describe('getWaypointNearestById', () => {
    beforeEach(() => {
      insertWaypoints([
        makeWaypoint({ id: 'DUPW', latitude: 5.0, longitude: 5.0, region: 'AA' }),
        makeWaypoint({ id: 'DUPW', latitude: 5.5, longitude: 5.0, region: 'BB' }),
        makeWaypoint({ id: 'SOLO', latitude: 30.0, longitude: 30.0 }),
      ]);
    });

    it('returns the waypoint by id when within range', () => {
      const result = getWaypointNearestById('SOLO', 30.0, 30.0, 10);
      expect(result?.id).toBe('SOLO');
    });

    it('returns null when no waypoint with that id exists', () => {
      const result = getWaypointNearestById('MISSING', 5, 5, 100);
      expect(result).toBeNull();
    });

    it('returns null when the waypoint exists but is beyond max distance', () => {
      const result = getWaypointNearestById('SOLO', 5, 5, 1);
      expect(result).toBeNull();
    });

    it('picks the nearest when multiple waypoints share the id', () => {
      const result = getWaypointNearestById('DUPW', 5.0, 5.0, 60);
      expect(result?.region).toBe('AA');
      expect(result?.latitude).toBeCloseTo(5.0, 4);
    });

    it('matches id case-insensitively', () => {
      const result = getWaypointNearestById('solo', 30.0, 30.0, 10);
      expect(result?.id).toBe('SOLO');
    });
  });
});
