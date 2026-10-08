import { describe, expect, it } from 'vitest';
import { navInfoFromFeature, pickNavInfoFeature, plannedAltitudeFt } from './navInfo';

describe('navInfoFromFeature', () => {
  it('describes a navaid with its type and frequency', () => {
    const info = navInfoFromFeature(
      'nav-navaids',
      { id: 'DIA', name: 'DOHA', type: 'VOR-DME', freqDisplay: '114.40' },
      25.26,
      51.56
    );
    expect(info).toMatchObject({ id: 'DIA', kind: 'VOR-DME', frequency: '114.40 MHz' });
  });

  it('carries the navaid station elevation', () => {
    const info = navInfoFromFeature(
      'nav-navaids',
      { id: 'DIA', type: 'VOR-DME', freqDisplay: '114.40', elevation: 35 },
      0,
      0
    );
    expect(info?.elevationFt).toBe(35);
  });

  it('leaves elevation out when the feature has none', () => {
    const info = navInfoFromFeature('nav-navaids', { id: 'DIA', type: 'VOR-DME' }, 0, 0);
    expect(info?.elevationFt).toBeUndefined();
  });

  it('keeps kHz for an NDB', () => {
    const info = navInfoFromFeature(
      'nav-navaids',
      { id: 'LUC', type: 'NDB', freqDisplay: '375 kHz' },
      0,
      0
    );
    expect(info?.frequency).toBe('375 kHz');
  });

  it('describes a plan waypoint with its planned altitude', () => {
    const info = navInfoFromFeature(
      'flightplan-waypoints',
      { id: 'IVENA', navType: 11, frequency: 0, altitudeLabel: 'FL250' },
      0,
      0
    );
    expect(info).toMatchObject({ id: 'IVENA', kind: 'WPT', altitudeLabel: 'FL250' });
    expect(info?.frequency).toBeUndefined();
  });

  it('carries the route index of a plan waypoint', () => {
    const info = navInfoFromFeature(
      'flightplan-waypoints',
      { id: 'XATEL', navType: 11, index: 2, altitudeLabel: '' },
      0,
      0
    );
    expect(info?.routeIndex).toBe(2);
  });

  it('ignores badge features without an id', () => {
    expect(navInfoFromFeature('flightplan-waypoints', { index: -1 }, 0, 0)).toBeNull();
  });
});

describe('plannedAltitudeFt', () => {
  const route = [
    { id: 'LFMC', latitude: 43.38, longitude: 6.39 },
    { id: 'GILON', latitude: 43.6, longitude: 6.2 },
    { id: 'XATEL', latitude: 45.1, longitude: 4.6 },
    { id: 'MTL', latitude: 44.56, longitude: 4.78 },
  ];
  const altitudes = [500, 1500, 4500, 5000];
  const pick = (id: string, latitude: number, longitude: number, routeIndex?: number) => ({
    id,
    kind: 'WPT',
    latitude,
    longitude,
    routeIndex,
  });

  it('reads the profile altitude at the clicked route index', () => {
    expect(plannedAltitudeFt(pick('XATEL', 45.1, 4.6, 2), route, altitudes)).toBe(4500);
  });

  it('finds a navaid on the route by id and position', () => {
    expect(plannedAltitudeFt(pick('MTL', 44.5601, 4.7799), route, altitudes)).toBe(5000);
  });

  it('skips a same-named fix elsewhere', () => {
    expect(plannedAltitudeFt(pick('MTL', 10, 10), route, altitudes)).toBeNull();
  });

  it('is null without a computed profile', () => {
    expect(plannedAltitudeFt(pick('XATEL', 45.1, 4.6, 2), route, [])).toBeNull();
  });
});

describe('pickNavInfoFeature', () => {
  const feature = (layerId: string, id: string) =>
    ({
      layer: { id: layerId },
      properties: { id },
    }) as unknown as import('maplibre-gl').MapGeoJSONFeature;

  it('prefers the station under a plan waypoint, whichever is drawn on top', () => {
    const picked = pickNavInfoFeature([
      feature('flightplan-waypoints', 'MTL'),
      feature('nav-navaids', 'MTL'),
    ]);
    expect(picked?.layer.id).toBe('nav-navaids');
  });

  it('prefers a localizer over a plan waypoint', () => {
    const picked = pickNavInfoFeature([
      feature('flightplan-waypoints', 'IMTL'),
      feature('nav-ils', 'IMTL'),
    ]);
    expect(picked?.layer.id).toBe('nav-ils');
  });

  it('falls back to the topmost feature', () => {
    const picked = pickNavInfoFeature([feature('flightplan-waypoints', 'GILON')]);
    expect(picked?.layer.id).toBe('flightplan-waypoints');
    expect(pickNavInfoFeature([])).toBeUndefined();
  });
});

describe('navInfoFromFeature for stations and typed plan waypoints', () => {
  it('describes a localizer with its runway, frequency and true course', () => {
    const info = navInfoFromFeature(
      'nav-ils',
      {
        id: 'IMTL',
        name: 'MONTELIMAR',
        type: 'ILS',
        freqDisplay: '110.30',
        runway: '02',
        bearing: 15.2,
      },
      44.58,
      4.73
    );
    expect(info).toMatchObject({
      id: 'IMTL',
      kind: 'ILS',
      name: 'MONTELIMAR',
      frequency: '110.30 MHz',
      runway: '02',
      courseTrue: 15.2,
    });
  });

  it('shows the real station type of a plan navaid instead of a generic VOR badge', () => {
    const info = navInfoFromFeature(
      'flightplan-waypoints',
      {
        id: 'MTL',
        navType: 3,
        frequency: 113.65,
        navaidType: 'VOR-DME',
        name: 'MONTELIMAR',
        index: 3,
      },
      0,
      0
    );
    expect(info).toMatchObject({ kind: 'VOR-DME', name: 'MONTELIMAR', frequency: '113.65 MHz' });
  });

  it('keeps the generic badge when the plan carries no station type', () => {
    const info = navInfoFromFeature(
      'flightplan-waypoints',
      { id: 'MTL', navType: 3, frequency: 0, navaidType: '', index: 3 },
      0,
      0
    );
    expect(info).toMatchObject({ kind: 'VOR' });
    expect(info?.frequency).toBeUndefined();
  });
});
