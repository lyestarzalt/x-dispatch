import { describe, expect, it } from 'vitest';
import type { OceanicTrackInfo } from '@/lib/flightplan/builder/types';
import { natTrackPopupHtml, natTracksGeoJSON } from './NatTracksLayer';

const track = (id: string, levels: number[]): OceanicTrackInfo => ({
  id,
  name: `NAT${id}`,
  eastbound: false,
  levels,
  validFrom: '',
  validTo: '',
  nars: [],
  feederFixes: [],
  pbcs: false,
  points: [
    { id: 'ENTRY', latitude: 54, longitude: -15 },
    { id: '5420N', latitude: 54, longitude: -20 },
    { id: 'EXIT', latitude: 53, longitude: -40 },
  ],
});

const current = (t: OceanicTrackInfo) => ({ track: t, upcoming: false });

describe('natTracksGeoJSON', () => {
  it('draws one line per track and marks the chosen one', () => {
    const { features } = natTracksGeoJSON(
      [current(track('A', [340, 350, 360])), current(track('B', []))],
      'NATB'
    );
    const lines = features.filter((f) => f.geometry.type === 'LineString');
    expect(lines).toHaveLength(2);
    expect(lines[0]!.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [-15, 54],
        [-20, 54],
        [-40, 53],
      ],
    });
    expect(lines[0]!.properties).toMatchObject({ name: 'NATA', id: 'A', selected: false });
    expect(lines[1]!.properties).toMatchObject({ name: 'NATB', id: 'B', selected: true });
  });

  it('marks tracks from the upcoming message so they draw dotted and dimmer', () => {
    const { features } = natTracksGeoJSON(
      [current(track('A', [350])), { track: track('B', [350]), upcoming: true }],
      null
    );
    expect(features.map((f) => f.properties?.upcoming)).toEqual([false, false, true, true]);
  });

  it('labels each track once, with its letter and level band, on its longest leg', () => {
    const { features } = natTracksGeoJSON(
      [current(track('A', [340, 350, 360])), current(track('B', []))],
      null
    );
    const labels = features.filter((f) => f.geometry.type === 'Point');
    expect(labels).toHaveLength(2);
    // The longest leg of the fixture runs 5420N -> EXIT; the label sits on its midpoint.
    const [lon, lat] = (labels[0]!.geometry as GeoJSON.Point).coordinates;
    expect(lon).toBeCloseTo(-30, 6);
    expect(lat).toBeGreaterThan(53);
    expect(lat).toBeLessThan(54);
    expect(labels[0]!.properties).toMatchObject({
      name: 'NATA',
      selected: false,
      label: 'A  FL340–FL360',
    });
    expect(typeof labels[0]!.properties?.rotate).toBe('number');
    expect(labels[1]!.properties).toMatchObject({ name: 'NATB', label: 'B' });
  });
});

describe('natTrackPopupHtml', () => {
  it('names the track and lists its levels, window, NARs and feeder fixes', () => {
    const f = { ...track('F', [350, 360]), nars: ['N82A'], feederFixes: ['REGHI'], pbcs: true };
    const html = natTrackPopupHtml(f, true);
    expect(html).toContain('NATF');
    expect(html).toContain('350 360');
    expect(html).toContain('N82A');
    expect(html).toContain('REGHI');
    expect(html).not.toContain('<script');
  });
});
