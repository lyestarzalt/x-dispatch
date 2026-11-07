import { describe, expect, it } from 'vitest';
import type { ATCController } from '@/types/navigation';
import { selectAtcForAirport } from './atcSelect';

// KDCA sits at 38.852, -77.038. A big square around DC stands in for the
// KZDC centre sector; a Miami square proves containment excludes far sectors.
const DC_SQUARE: [number, number][] = [
  [-80, 36],
  [-74, 36],
  [-74, 41],
  [-80, 41],
];
const MIAMI_SQUARE: [number, number][] = [
  [-82, 24],
  [-79, 24],
  [-79, 28],
  [-82, 28],
];

function controller(overrides: Partial<ATCController>): ATCController {
  return {
    name: 'TEST',
    facilityId: 'KTST',
    role: 'ctr',
    frequencies: [120.45],
    airspaces: [],
    ...overrides,
  } as ATCController;
}

const KDCA = { icao: 'KDCA', lat: 38.852, lon: -77.038 };

describe('selectAtcForAirport', () => {
  it('keeps the facility whose ICAO list names the airport', () => {
    const potomac = controller({
      name: 'POTOMAC',
      facilityId: 'KDCA',
      role: 'tracon',
      icaos: ['KDCA', 'KIAD', 'KBWI'],
    });
    const miamiApp = controller({
      name: 'MIAMI',
      facilityId: 'KMIA',
      role: 'tracon',
      icaos: ['KMIA'],
    });
    const picked = selectAtcForAirport([miamiApp, potomac], KDCA.icao, KDCA.lat, KDCA.lon);
    expect(picked.map((c) => c.name)).toEqual(['POTOMAC']);
  });

  it('keeps centres whose sector polygon contains the airport', () => {
    const washington = controller({
      name: 'WASHINGTON',
      facilityId: 'KZDC',
      airspaces: [{ minAlt: 0, maxAlt: 60000, polygon: DC_SQUARE }],
    });
    const miami = controller({
      name: 'MIAMI',
      facilityId: 'KZMA',
      airspaces: [{ minAlt: 0, maxAlt: 60000, polygon: MIAMI_SQUARE }],
    });
    const picked = selectAtcForAirport([miami, washington], KDCA.icao, KDCA.lat, KDCA.lon);
    expect(picked.map((c) => c.facilityId)).toEqual(['KZDC']);
  });

  it('falls back to the ICAO region only for polygon-less facilities', () => {
    const polygonless = controller({ name: 'WASHINGTON', facilityId: 'KZDC' });
    const foreign = controller({ name: 'ALGIERS', facilityId: 'DAAA' });
    const picked = selectAtcForAirport([foreign, polygonless], KDCA.icao, KDCA.lat, KDCA.lon);
    expect(picked.map((c) => c.name)).toEqual(['WASHINGTON']);
  });

  it('region fallback compares two letters outside the single-letter countries', () => {
    const brussels = controller({ name: 'BRUSSELS', facilityId: 'EBBU' });
    const amsterdam = controller({ name: 'AMSTERDAM', facilityId: 'EHAA' });
    const picked = selectAtcForAirport([brussels, amsterdam], 'EHAM', 52.3, 4.76);
    expect(picked.map((c) => c.name)).toEqual(['AMSTERDAM']);
  });

  it('orders the chain tower → approach → centre and dedupes', () => {
    const twr = controller({ name: 'WASHINGTON TWR', facilityId: 'KDCA', role: 'twr' });
    const app = controller({
      name: 'POTOMAC',
      facilityId: 'KDCA',
      role: 'tracon',
      icaos: ['KDCA'],
    });
    const ctr = controller({
      name: 'WASHINGTON',
      facilityId: 'KZDC',
      airspaces: [{ minAlt: 0, maxAlt: 60000, polygon: DC_SQUARE }],
    });
    const picked = selectAtcForAirport([ctr, twr, app, app], KDCA.icao, KDCA.lat, KDCA.lon);
    expect(picked.map((c) => c.role)).toEqual(['twr', 'tracon', 'ctr']);
  });

  it('matches a facility on any of its shelves', () => {
    const potomac = controller({
      name: 'POTOMAC',
      facilityId: 'PCT',
      role: 'tracon',
      airspaces: [
        { minAlt: 1500, maxAlt: 10000, polygon: MIAMI_SQUARE },
        { minAlt: 0, maxAlt: 10000, polygon: DC_SQUARE },
      ],
    });
    const picked = selectAtcForAirport([potomac], KDCA.icao, KDCA.lat, KDCA.lon);
    expect(picked.map((c) => c.name)).toEqual(['POTOMAC']);
  });

  it('does not match an antimeridian-crossing oceanic sector on the other side of the world', () => {
    // KZAK Oakland Oceanic: its ring runs from 130°E across 180° to 120°W.
    const oakland = controller({
      name: 'OAKLAND OCEANIC',
      facilityId: 'KZAK',
      airspaces: [
        {
          minAlt: 0,
          maxAlt: 60000,
          polygon: [
            [130, 0],
            [179.999983, 0],
            [-179.999983, 0],
            [-120, 0],
            [-120, 40],
            [-179.999983, 40],
            [179.999983, 40],
            [130, 40],
          ],
        },
      ],
    });
    expect(selectAtcForAirport([oakland], KDCA.icao, KDCA.lat, KDCA.lon)).toEqual([]);
    // ...but still matches Honolulu (21.3°N, 157.9°W) and Guam (13.5°N, 144.8°E).
    expect(selectAtcForAirport([oakland], 'PHNL', 21.3, -157.9)).toHaveLength(1);
    expect(selectAtcForAirport([oakland], 'PGUM', 13.5, 144.8)).toHaveLength(1);
  });
});
