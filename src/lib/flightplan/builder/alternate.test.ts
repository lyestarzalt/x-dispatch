import { describe, expect, it } from 'vitest';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { suggestAlternate } from './alternate';

const airport = (
  icao: string,
  lat: number,
  lon: number,
  extra: Partial<Airport> = {}
): Airport => ({
  icao,
  name: icao,
  lat,
  lon,
  type: 'land',
  isCustom: false,
  runwayCount: 2,
  surfaceType: 'paved',
  elevation: 0,
  country: 'XX',
  ...extra,
});

const arrival = { icao: 'DEST', latitude: 50, longitude: 8 };

describe('suggestAlternate', () => {
  it('picks the nearest paved field outside the immediate vicinity', () => {
    const list = [
      airport('DEST', 50, 8),
      airport('TOOC', 50.1, 8), // 6 nm, too close
      airport('GOOD', 50.8, 8), // 48 nm
      airport('FARR', 52.5, 8), // 150 nm plus
      airport('GRAS', 50.5, 8, { surfaceType: 'unpaved' }),
    ];
    expect(suggestAlternate(list, arrival, 'ORIG', 'jet')?.icao).toBe('GOOD');
  });

  it('lets a piston use grass and never the departure', () => {
    const list = [airport('ORIG', 50.6, 8), airport('GRAS', 50.5, 8, { surfaceType: 'unpaved' })];
    expect(suggestAlternate(list, arrival, 'ORIG', 'prop')?.icao).toBe('GRAS');
    expect(suggestAlternate(list, arrival, 'ORIG', 'jet')).toBeNull();
  });

  it('prefers a second runway for jets when the distances are close', () => {
    const list = [
      airport('ONE', 50.6, 8, { runwayCount: 1 }), // 36 nm
      airport('TWO', 50.9, 8, { runwayCount: 2 }), // 54 nm
    ];
    expect(suggestAlternate(list, arrival, null, 'jet')?.icao).toBe('TWO');
    expect(suggestAlternate(list, arrival, null, 'turboprop')?.icao).toBe('ONE');
  });
});
