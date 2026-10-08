import { describe, expect, it } from 'vitest';
import type { EnrichedWaypoint } from '@/types/fms';
import { createLegLabelGeoJSON, createProcedureNameGeoJSON } from './FlightPlanLayer';
import { waypointBadgeId } from './routeStyle';

const wp = (over: Partial<EnrichedWaypoint>): EnrichedWaypoint => ({
  type: 11,
  id: 'FIX',
  via: 'DRCT',
  altitude: 0,
  latitude: 0,
  longitude: 0,
  found: true,
  ...over,
});

describe('createLegLabelGeoJSON', () => {
  it('labels each leg with its distance and magnetic course on a two-point line for along-leg placement', () => {
    const waypoints = [
      wp({ id: 'A', latitude: 40, longitude: -80 }),
      wp({ id: 'B', latitude: 40, longitude: -79 }),
      wp({ id: 'C', latitude: 41, longitude: -79 }),
    ];
    const { features } = createLegLabelGeoJSON(waypoints);
    expect(features).toHaveLength(2);
    // One point at the leg's midpoint (as drawn: a straight line in Mercator), rotated to lie
    // along it and kept upright - eastbound reads left to right, so no flip.
    expect(features[0]?.geometry.type).toBe('Point');
    const [lon, lat] = (features[0]?.geometry as GeoJSON.Point).coordinates;
    expect(lon).toBeCloseTo(-79.5, 6);
    expect(lat).toBeCloseTo(40, 6);
    expect(features[0]?.properties?.rotate).toBeCloseTo(0, 5);
    // Northbound (B->C) lies along the vertical: rotated -90 so the text runs up the line.
    expect(features[1]?.properties?.rotate).toBeCloseTo(-90, 5);
    // Unit suffixes come from i18n, which isn't loaded here; the numbers and shape are what matter.
    const label = String(features[0]?.properties?.label);
    expect(label).toMatch(/^46\.0 /); // ~45.9 NM at 40N
    expect(label).toMatch(/ 0\d\d°/); // eastbound, a bit south of 090 true once magnetic
  });

  it('skips the leg from the approach runway to the airport when an approach is flown (no line is drawn there)', () => {
    const waypoints = [
      wp({ id: 'Z', latitude: 39.5, longitude: -80 }),
      wp({ id: 'A', latitude: 40, longitude: -80 }),
      wp({ id: 'RW36', via: 'I36', latitude: 40.5, longitude: -80 }),
      wp({ id: 'EHAM', via: 'ADES', latitude: 40.52, longitude: -80.01 }),
    ];
    const { features } = createLegLabelGeoJSON(waypoints, [
      { via: 'I36', kind: 'approach', path: [] },
    ]);
    // Only Z->A: A->RW36 is the approach's own leg, RW36->EHAM has no line at all.
    expect(features).toHaveLength(1);
  });

  it('leaves procedure legs to the procedure-name label and only tags enroute legs', () => {
    const waypoints = [
      wp({ id: 'EGLL', via: 'ADEP', latitude: 51.5, longitude: -0.4 }),
      wp({ id: 'S1', via: 'MODM1J', latitude: 51.6, longitude: -0.2 }),
      wp({ id: 'S2', via: 'MODM1J', latitude: 51.7, longitude: 0 }),
      wp({ id: 'E1', via: 'UL620', latitude: 52, longitude: 1 }),
      wp({ id: 'EHAM', via: 'ADES', latitude: 52.3, longitude: 4.7 }),
    ];
    const paths = [{ via: 'MODM1J', kind: 'sid' as const, path: [] }];
    const { features } = createLegLabelGeoJSON(waypoints, paths);
    // ADEP->S1 and S1->S2 belong to the SID; S2->E1 and E1->EHAM are enroute.
    expect(features).toHaveLength(2);
  });

  it('writes each procedure name along its drawn path', () => {
    const paths = [
      {
        via: 'MODM1J',
        kind: 'sid' as const,
        path: [
          { latitude: 51.5, longitude: -0.4 },
          { latitude: 51.7, longitude: 0 },
        ],
      },
      { via: 'I36C', kind: 'approach' as const, path: [{ latitude: 52, longitude: 4 }] },
    ];
    // The chip goes on the longest straight stretch, here the second segment.
    const long = createProcedureNameGeoJSON([
      {
        via: 'MOLI2A',
        kind: 'star' as const,
        path: [
          { latitude: 52, longitude: 4 },
          { latitude: 52, longitude: 4.1 },
          { latitude: 52, longitude: 5.1 },
        ],
      },
    ]).features[0]!;
    expect((long.geometry as GeoJSON.Point).coordinates[0]).toBeCloseTo(4.6, 6);
    const { features } = createProcedureNameGeoJSON(paths);
    expect(features).toHaveLength(1); // a single point has no line to write along
    expect(features[0]?.properties).toMatchObject({
      name: 'MODM1J',
      kind: 'sid',
      chip: 'route-chip-sid',
    });
    expect(features[0]?.geometry.type).toBe('Point');
    expect(typeof features[0]?.properties?.rotate).toBe('number');
  });

  it('flips westbound and southbound leg text so it never reads upside down', () => {
    const west = createLegLabelGeoJSON([
      wp({ id: 'A', latitude: 40, longitude: -79 }),
      wp({ id: 'B', latitude: 40, longitude: -80 }),
    ]).features[0]!;
    expect(west.properties?.rotate).toBeCloseTo(0, 5);
    const south = createLegLabelGeoJSON([
      wp({ id: 'A', latitude: 41, longitude: -80 }),
      wp({ id: 'B', latitude: 40, longitude: -80 }),
    ]).features[0]!;
    expect(south.properties?.rotate).toBeCloseTo(-90, 5);
  });

  it('turns diagonal leg text by the angle the leg has on screen (Mercator), not a lat/lon ratio', () => {
    // At the equator a 1 x 1 degree step is a 45-degree line on screen.
    const ne = createLegLabelGeoJSON([
      wp({ id: 'A', latitude: 0, longitude: 0 }),
      wp({ id: 'B', latitude: 1, longitude: 1 }),
    ]).features[0]!;
    expect(ne.properties?.rotate).toBeCloseTo(-45, 1);
    // South-east (like MANOK -> RUSOS at 127 degrees) tilts the other way, text still upright.
    const se = createLegLabelGeoJSON([
      wp({ id: 'A', latitude: 1, longitude: 0 }),
      wp({ id: 'B', latitude: 0, longitude: 1 }),
    ]).features[0]!;
    expect(se.properties?.rotate).toBeCloseTo(45, 1);
  });

  it('names the airway once per run of legs on it, on the longest leg, and never for directs', () => {
    const waypoints = [
      wp({ id: 'A', via: 'DRCT', latitude: 40, longitude: -80 }),
      wp({ id: 'B', via: 'UL620', latitude: 40, longitude: -79 }),
      wp({ id: 'C', via: 'UL620', latitude: 40, longitude: -77 }),
      wp({ id: 'D', via: 'UL620', latitude: 40, longitude: -76.5 }),
      wp({ id: 'E', via: 'M150', latitude: 40, longitude: -76 }),
      wp({ id: 'F', via: 'DRCT', latitude: 40, longitude: -75 }),
    ];
    const { features } = createLegLabelGeoJSON(waypoints);
    expect(features.map((f) => [f.properties?.airway, f.properties?.showAirway])).toEqual([
      ['UL620', false],
      ['UL620', true],
      ['UL620', false],
      ['M150', true],
      ['', false],
    ]);
    for (const f of features) expect(f.properties?.chip).toBe('route-chip-enroute');
  });

  it('puts the track designator in the track chip on legs flown on a NAT track', () => {
    const waypoints = [
      wp({ id: 'A', via: 'DRCT', latitude: 54, longitude: -15 }),
      wp({ id: '5420N', via: 'NATA', latitude: 54, longitude: -20 }),
      wp({ id: '5530N', via: 'NATA', latitude: 55, longitude: -30 }),
      wp({ id: 'B', via: 'DRCT', latitude: 50, longitude: -60 }),
    ];
    const { features } = createLegLabelGeoJSON(waypoints);
    expect(features.map((f) => [f.properties?.airway, f.properties?.chip])).toEqual([
      ['NATA', 'route-chip-track'],
      ['NATA', 'route-chip-track'],
      ['', 'route-chip-enroute'],
    ]);
  });

  it('skips zero-length legs', () => {
    const waypoints = [
      wp({ id: 'A', latitude: 40, longitude: -80 }),
      wp({ id: 'A2', latitude: 40, longitude: -80 }),
    ];
    expect(createLegLabelGeoJSON(waypoints).features).toHaveLength(0);
  });
});

describe('waypointBadgeId', () => {
  const paths = [
    { via: 'MODM1J', kind: 'sid' as const },
    { via: 'MOLI2A', kind: 'star' as const },
    { via: 'I36C', kind: 'approach' as const },
  ];
  it('colours airports, procedure fixes and enroute fixes differently', () => {
    expect(waypointBadgeId('ADEP', paths)).toBe('route-badge-airport');
    expect(waypointBadgeId('ADES', paths)).toBe('route-badge-airport');
    expect(waypointBadgeId('MODM1J', paths)).toBe('route-badge-sid');
    expect(waypointBadgeId('MOLI2A', paths)).toBe('route-badge-star');
    expect(waypointBadgeId('I36C', paths)).toBe('route-badge-approach');
    expect(waypointBadgeId('UL620', paths)).toBe('route-badge-enroute');
    expect(waypointBadgeId('DRCT')).toBe('route-badge-enroute');
  });
});
