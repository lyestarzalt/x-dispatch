/**
 * Lookup + search query tests for navCache.
 *
 * Covers exact-match, search, and grouped-count read paths used by procedures,
 * flight plan resolution, and the search UI:
 *  - getNavaidByIdRegion / getWaypointByIdRegion
 *  - getNavaidsByAirport / getNavaidsByAirportRunway
 *  - getNavaidEnrichedById (full-record nearest-by-id)
 *  - searchNavaidsDb / searchWaypointsDb (LIKE-based search)
 *  - getNavaidCountsByType (group-by counter)
 *  - getAirwaysByName
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AirwaySegment, Navaid, Waypoint } from '@/types/navigation';
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
  insertWaypoints,
  insertAirways,
  getNavaidByIdRegion,
  getNavaidEnrichedById,
  getNavaidsByAirport,
  getNavaidsByAirportRunway,
  searchNavaidsDb,
  searchWaypointsDb,
  getNavaidCountsByType,
  getWaypointByIdRegion,
  getWaypointNearestById,
  getAirwaysByName,
} = await import('./navCache');

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeNavaid(
  overrides: Partial<Navaid> & { id: string; latitude: number; longitude: number }
): Navaid {
  return {
    type: 'VOR',
    name: `${overrides.id} VOR`,
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

function makeAirway(
  overrides: Partial<AirwaySegment> & { name: string; fromFix: string; toFix: string }
): AirwaySegment {
  return {
    fromRegion: 'XX',
    fromNavaidType: 11,
    toRegion: 'XX',
    toNavaidType: 11,
    isHigh: false,
    baseFl: 0,
    topFl: 999,
    direction: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('navCache lookups & search', () => {
  beforeEach(async () => {
    await createTestDb();
  });

  afterEach(() => {
    closeTestDb();
  });

  describe('getNavaidByIdRegion', () => {
    beforeEach(async () => {
      await insertNavaids([
        makeNavaid({ id: 'BCN', latitude: 41, longitude: 2, region: 'LE' }), // Spain
        makeNavaid({ id: 'BCN', latitude: 28, longitude: -16, region: 'GC' }), // different region, same id
        makeNavaid({ id: 'PMI', latitude: 39, longitude: 2, region: 'LE' }),
      ]);
    });

    it('returns the exact id+region match', async () => {
      const result = getNavaidByIdRegion('BCN', 'LE');
      expect(result?.id).toBe('BCN');
      expect(result?.region).toBe('LE');
      expect(result?.latitude).toBeCloseTo(41, 4);
    });

    it('disambiguates between two navaids that share an id but differ in region', async () => {
      const spanish = getNavaidByIdRegion('BCN', 'LE');
      const canary = getNavaidByIdRegion('BCN', 'GC');
      expect(spanish?.latitude).toBeCloseTo(41, 4);
      expect(canary?.latitude).toBeCloseTo(28, 4);
    });

    it('matches id and region case-insensitively', async () => {
      const result = getNavaidByIdRegion('bcn', 'le');
      expect(result?.id).toBe('BCN');
      expect(result?.region).toBe('LE');
    });

    it('returns null when id exists but region does not match', async () => {
      const result = getNavaidByIdRegion('BCN', 'KX');
      expect(result).toBeNull();
    });

    it('returns null when the id does not exist at all', async () => {
      const result = getNavaidByIdRegion('XXX', 'LE');
      expect(result).toBeNull();
    });
  });

  describe('getWaypointByIdRegion', () => {
    beforeEach(async () => {
      await insertWaypoints([
        makeWaypoint({ id: 'NORTH', latitude: 50, longitude: 0, region: 'EG' }),
        makeWaypoint({ id: 'NORTH', latitude: -50, longitude: 0, region: 'NZ' }), // antipode same id
      ]);
    });

    it('returns the exact id+region match', async () => {
      const result = getWaypointByIdRegion('NORTH', 'EG');
      expect(result?.region).toBe('EG');
      expect(result?.latitude).toBeCloseTo(50, 4);
    });

    it('disambiguates between two waypoints that share an id but differ in region', async () => {
      const north = getWaypointByIdRegion('NORTH', 'EG');
      const south = getWaypointByIdRegion('NORTH', 'NZ');
      expect(north?.latitude).toBeGreaterThan(0);
      expect(south?.latitude).toBeLessThan(0);
    });

    it('matches id and region case-insensitively', async () => {
      const result = getWaypointByIdRegion('north', 'eg');
      expect(result?.region).toBe('EG');
    });

    it('returns null when no match', async () => {
      expect(getWaypointByIdRegion('NORTH', 'LF')).toBeNull();
      expect(getWaypointByIdRegion('GHOST', 'EG')).toBeNull();
    });
  });

  describe('getNavaidEnrichedById', () => {
    beforeEach(async () => {
      await insertNavaids([
        makeNavaid({
          id: 'EDR',
          latitude: 50.0,
          longitude: 5.0,
          type: 'VOR',
          name: 'Eindhoven',
          frequency: 11420,
        }),
      ]);
    });

    it('returns a fully enriched record (includes name and frequency)', async () => {
      const result = getNavaidEnrichedById('EDR', 50.0, 5.0, 10);
      expect(result?.id).toBe('EDR');
      expect(result?.name).toBe('Eindhoven');
      expect(result?.frequency).toBe(11420);
      expect(result?.type).toBe('VOR');
    });

    it('returns null when no navaid in range', async () => {
      const result = getNavaidEnrichedById('EDR', 0, 0, 1);
      expect(result).toBeNull();
    });
  });

  describe('nearest-by-id lookups across the antimeridian', () => {
    beforeEach(async () => {
      // One fix in Alaska at 170W, one in Japan at 150E, a navaid at 148E.
      await insertWaypoints([
        makeWaypoint({ id: 'NYMPH', latitude: 57, longitude: -170, region: 'PA' }),
        makeWaypoint({ id: 'SWAMP', latitude: 45, longitude: 150, region: 'RJ' }),
      ]);
      await insertNavaids([makeNavaid({ id: 'IXE', latitude: 44, longitude: 148, type: 'VOR' })]);
    });

    it('finds a fix on the far side of 180 in either direction', () => {
      // 175E to 170W is 15 degrees east across the dateline, about 490 nm at 57N.
      expect(getWaypointNearestById('NYMPH', 57, 175, 1500)?.region).toBe('PA');
      // 178W to 150E is 32 degrees west across the dateline, about 1360 nm at 45N.
      expect(getWaypointNearestById('SWAMP', 45, -178, 1500)?.region).toBe('RJ');
    });

    it('finds a navaid on the far side of 180', () => {
      expect(getNavaidEnrichedById('IXE', 44, -179, 1500)?.id).toBe('IXE');
    });

    it('searches the whole circle of longitude near a pole', async () => {
      await insertWaypoints([makeWaypoint({ id: 'POLAR', latitude: 88, longitude: 179 })]);
      // 179 degrees of longitude at 88N is only about 375 nm.
      expect(getWaypointNearestById('POLAR', 88, 0, 1500)?.id).toBe('POLAR');
    });

    it('measures the distance the short way round', () => {
      // 176W to 150E is 34 degrees, about 1440 nm at 45N: inside 1500. Measured the long
      // way it would be 326 degrees and never found.
      expect(getWaypointNearestById('SWAMP', 45, -176, 1500)?.region).toBe('RJ');
      // 150W to 150E is 60 degrees, about 2550 nm: outside, whichever way round.
      expect(getWaypointNearestById('SWAMP', 45, -150, 1500)).toBeNull();
    });
  });

  describe('getNavaidsByAirport', () => {
    beforeEach(async () => {
      await insertNavaids([
        makeNavaid({
          id: 'IKLM',
          latitude: 52,
          longitude: 5,
          type: 'LOC',
          associatedAirport: 'EHAM',
          associatedRunway: '06',
        }),
        makeNavaid({
          id: 'IKLM2',
          latitude: 52,
          longitude: 5,
          type: 'GS',
          associatedAirport: 'EHAM',
          associatedRunway: '06',
        }),
        makeNavaid({
          id: 'IGLA',
          latitude: 51,
          longitude: 4,
          type: 'LOC',
          associatedAirport: 'EBBR',
          associatedRunway: '25R',
        }),
        makeNavaid({ id: 'STANDALONE', latitude: 0, longitude: 0, type: 'VOR' }), // no associatedAirport
      ]);
    });

    it('returns all navaids associated with the airport', async () => {
      const result = getNavaidsByAirport('EHAM');
      const ids = result.map((n) => n.id).sort();
      expect(ids).toEqual(['IKLM', 'IKLM2']);
    });

    it('matches the airport ICAO case-insensitively', async () => {
      const result = getNavaidsByAirport('eham');
      expect(result).toHaveLength(2);
    });

    it('returns empty when no navaids are associated with the airport', async () => {
      expect(getNavaidsByAirport('KJFK')).toEqual([]);
    });

    it('does not return navaids with no associated airport', async () => {
      const all = [...getNavaidsByAirport('EHAM'), ...getNavaidsByAirport('EBBR')];
      expect(all.find((n) => n.id === 'STANDALONE')).toBeUndefined();
    });
  });

  describe('getNavaidsByAirportRunway', () => {
    beforeEach(async () => {
      await insertNavaids([
        makeNavaid({
          id: 'IKLM06',
          latitude: 52,
          longitude: 5,
          type: 'LOC',
          associatedAirport: 'EHAM',
          associatedRunway: '06',
        }),
        makeNavaid({
          id: 'IKLM24',
          latitude: 52,
          longitude: 5,
          type: 'LOC',
          associatedAirport: 'EHAM',
          associatedRunway: '24',
        }),
      ]);
    });

    it('returns navaids matching both airport and runway', async () => {
      const result = getNavaidsByAirportRunway('EHAM', '06');
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('IKLM06');
    });

    it('returns empty when the runway does not match', async () => {
      expect(getNavaidsByAirportRunway('EHAM', '36')).toEqual([]);
    });

    it('matches both airport and runway case-insensitively', async () => {
      const result = getNavaidsByAirportRunway('eham', '06');
      expect(result).toHaveLength(1);
    });
  });

  describe('searchNavaidsDb', () => {
    beforeEach(async () => {
      await insertNavaids([
        makeNavaid({ id: 'AMS', latitude: 52, longitude: 4, name: 'Amsterdam' }),
        makeNavaid({ id: 'AMSEL', latitude: 50, longitude: 7, name: 'Amselstadt' }),
        makeNavaid({ id: 'BIG', latitude: 51, longitude: 0, name: 'Biggin' }),
        makeNavaid({ id: 'OTH', latitude: 40, longitude: 8, name: 'Otherplace' }),
      ]);
    });

    it('matches by id substring', async () => {
      const result = searchNavaidsDb('AMS');
      const ids = result.map((n) => n.id).sort();
      expect(ids).toEqual(['AMS', 'AMSEL']);
    });

    it('matches by name substring', async () => {
      const result = searchNavaidsDb('Amsterdam');
      expect(result.find((n) => n.id === 'AMS')).toBeDefined();
    });

    it('matches case-insensitively', async () => {
      const lower = searchNavaidsDb('ams')
        .map((n) => n.id)
        .sort();
      const upper = searchNavaidsDb('AMS')
        .map((n) => n.id)
        .sort();
      expect(lower).toEqual(upper);
    });

    it('returns empty when nothing matches', async () => {
      expect(searchNavaidsDb('NOTHING_HERE')).toEqual([]);
    });

    it('respects the limit parameter', async () => {
      const result = searchNavaidsDb('AMS', 1);
      expect(result).toHaveLength(1);
    });

    it('uses limit default of 20 when not specified', async () => {
      // Insert 25 matching navaids
      const many: Navaid[] = [];
      for (let i = 0; i < 25; i++) {
        many.push(
          makeNavaid({
            id: `BULK${i.toString().padStart(2, '0')}`,
            latitude: 0,
            longitude: 0,
            name: `Bulk ${i}`,
          })
        );
      }
      await insertNavaids(many);
      const result = searchNavaidsDb('BULK');
      expect(result).toHaveLength(20);
    });
  });

  describe('searchWaypointsDb', () => {
    beforeEach(async () => {
      await insertWaypoints([
        makeWaypoint({ id: 'KOKSY', latitude: 50, longitude: 5 }),
        makeWaypoint({ id: 'KOK', latitude: 51, longitude: 5 }),
        makeWaypoint({ id: 'BUBLI', latitude: 49, longitude: 6 }),
      ]);
    });

    it('matches by id substring', async () => {
      const result = searchWaypointsDb('KOK');
      const ids = result.map((w) => w.id).sort();
      expect(ids).toEqual(['KOK', 'KOKSY']);
    });

    it('matches case-insensitively', async () => {
      expect(searchWaypointsDb('kok')).toHaveLength(2);
    });

    it('returns empty when nothing matches', async () => {
      expect(searchWaypointsDb('XYZ123')).toEqual([]);
    });

    it('respects the limit parameter', async () => {
      const result = searchWaypointsDb('K', 1);
      expect(result).toHaveLength(1);
    });
  });

  describe('getNavaidCountsByType', () => {
    it('groups navaids by type and returns counts', async () => {
      await insertNavaids([
        makeNavaid({ id: 'V1', latitude: 0, longitude: 0, type: 'VOR' }),
        makeNavaid({ id: 'V2', latitude: 0, longitude: 0, type: 'VOR' }),
        makeNavaid({ id: 'V3', latitude: 0, longitude: 0, type: 'VOR' }),
        makeNavaid({ id: 'N1', latitude: 0, longitude: 0, type: 'NDB' }),
        makeNavaid({ id: 'D1', latitude: 0, longitude: 0, type: 'DME' }),
        makeNavaid({ id: 'D2', latitude: 0, longitude: 0, type: 'DME' }),
      ]);

      const counts = getNavaidCountsByType();
      expect(counts.VOR).toBe(3);
      expect(counts.NDB).toBe(1);
      expect(counts.DME).toBe(2);
    });

    it('returns an empty object when no navaids exist', async () => {
      expect(getNavaidCountsByType()).toEqual({});
    });

    it('does not include types with zero count', async () => {
      await insertNavaids([makeNavaid({ id: 'V1', latitude: 0, longitude: 0, type: 'VOR' })]);
      const counts = getNavaidCountsByType();
      expect(counts).not.toHaveProperty('NDB');
      expect(counts).not.toHaveProperty('DME');
    });
  });

  describe('getAirwaysByName', () => {
    beforeEach(async () => {
      await insertAirways([
        makeAirway({ name: 'L607', fromFix: 'AAA', toFix: 'BBB' }),
        makeAirway({ name: 'L607', fromFix: 'BBB', toFix: 'CCC' }),
        makeAirway({ name: 'L607', fromFix: 'CCC', toFix: 'DDD' }),
        makeAirway({ name: 'UN857', fromFix: 'EEE', toFix: 'FFF', isHigh: true }),
      ]);
    });

    it('returns all segments of an airway in any order', async () => {
      const result = getAirwaysByName('L607');
      expect(result).toHaveLength(3);
      // All segments belong to the same airway
      for (const seg of result) {
        expect(seg.name).toBe('L607');
      }
    });

    it('matches case-insensitively', async () => {
      expect(getAirwaysByName('l607')).toHaveLength(3);
    });

    it('does not return segments of unrelated airways', async () => {
      const result = getAirwaysByName('L607');
      expect(result.find((s) => s.name === 'UN857')).toBeUndefined();
    });

    it('returns empty when the airway name does not exist', async () => {
      expect(getAirwaysByName('Z999')).toEqual([]);
    });

    it('preserves the high/low altitude flag through the round-trip', async () => {
      const high = getAirwaysByName('UN857');
      expect(high[0]?.isHigh).toBe(true);
    });
  });
});
