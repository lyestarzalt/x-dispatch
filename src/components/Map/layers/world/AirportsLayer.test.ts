import { describe, expect, it } from 'vitest';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { buildFeatures, buildOpacityExpression } from './AirportsLayer';

const baseAirport: Airport = {
  icao: 'KJFK',
  name: 'John F Kennedy Intl',
  lon: -73.7787,
  lat: 40.6398,
  isCustom: false,
  type: 'land',
  surfaceType: 'paved',
  runwayCount: 4,
  elevation: 13,
  country: 'United States',
} as Airport;

describe('buildFeatures', () => {
  it('marks the home airport as both home and favourite (so the star layer renders it)', () => {
    const features = buildFeatures([baseAirport], new Set(), 'KJFK');
    expect(features).toHaveLength(1);
    expect(features[0]?.properties).toMatchObject({
      icao: 'KJFK',
      isHome: 1,
      isFavorite: 1,
    });
  });

  it('marks a plain favourite as favourite but not home', () => {
    const features = buildFeatures([baseAirport], new Set(['KJFK']), null);
    expect(features[0]?.properties).toMatchObject({
      isHome: 0,
      isFavorite: 1,
    });
  });

  it('leaves a non-starred airport untouched', () => {
    const features = buildFeatures([baseAirport], new Set(['KLAX']), 'EGLL');
    expect(features[0]?.properties).toMatchObject({
      isHome: 0,
      isFavorite: 0,
    });
  });

  it('keeps the icao on every feature so the selected-airport fade can match it', () => {
    const features = buildFeatures([baseAirport], new Set(), null);
    expect(features[0]?.properties?.icao).toBe('KJFK');
  });
});

describe('buildOpacityExpression', () => {
  it('returns the plain interpolated baseline when no airport is selected', () => {
    const expr = buildOpacityExpression(
      [
        [0, 0.4],
        [4, 0.6],
        [6, 0.9],
        [8, 1],
      ],
      null
    );
    expect(expr).toEqual(['interpolate', ['linear'], ['zoom'], 0, 0.4, 4, 0.6, 6, 0.9, 8, 1]);
  });

  it('returns the bare numeric value when the baseline is a single full-opacity stop', () => {
    // Icon layers (custom pin, favourite star) have no zoom-dependent
    // baseline — the unselected case should be a plain `1`.
    const expr = buildOpacityExpression([[0, 1]], null);
    expect(expr).toBe(1);
  });

  it('puts zoom at the OUTER interpolate so MapLibre accepts it (the bug we shipped earlier)', () => {
    // Regression: an earlier version wrapped `interpolate(zoom, …)` inside
    // `case(get(icao), …, base)`. MapLibre's style spec only allows `zoom`
    // as input to the OUTERMOST interpolate/step — that structure silently
    // failed and the selected airport's marker never faded out.
    const expr = buildOpacityExpression([[0, 1]], 'KJFK') as unknown[];
    expect(expr[0]).toBe('interpolate');
    expect(expr[1]).toEqual(['linear']);
    expect(expr[2]).toEqual(['zoom']);
  });

  it('extends the baseline with a fade-to-zero stop at zoom 13 for the selected ICAO', () => {
    const expr = buildOpacityExpression([[0, 1]], 'KJFK') as unknown[];
    // Stops are arg pairs after the (['zoom']) input.
    const stops = expr.slice(3);
    // Last stop must be at zoom 13.
    expect(stops[stops.length - 2]).toBe(13);
    // …and its value must be a `case` selecting the airport's icao to 0.
    expect(stops[stops.length - 1]).toEqual(['case', ['==', ['get', 'icao'], 'KJFK'], 0, 1]);
  });

  it('preserves the baseline value for non-selected airports at the high-zoom stop', () => {
    const expr = buildOpacityExpression(
      [
        [0, 0.4],
        [8, 1],
      ],
      'KJFK'
    ) as unknown[];
    const last = expr[expr.length - 1];
    // The `case`'s "else" arm should match the baseline's last stop, so a
    // non-selected dot stays fully opaque at zoom ≥ 13.
    expect(last).toEqual(['case', ['==', ['get', 'icao'], 'KJFK'], 0, 1]);
  });

  it('keeps the visible-everywhere stop at zoom 11 so the fade is gradual, not sudden', () => {
    // At zoom 11 every airport (including the selected one) is still
    // fully visible. The linear interpolate from 11→13 produces the
    // smooth fade.
    const expr = buildOpacityExpression([[0, 1]], 'KJFK') as unknown[];
    const stops = expr.slice(3);
    // Find the entry at zoom 11.
    const idxOf11 = stops.findIndex((v, i) => i % 2 === 0 && v === 11);
    expect(idxOf11).toBeGreaterThan(-1);
    expect(stops[idxOf11 + 1]).toBe(1);
  });
});
