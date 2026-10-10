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

const current = (t: OceanicTrackInfo) => ({ track: t, status: 'current' as const });

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

  it('carries the message status so upcoming and ended sets draw dotted and dimmer', () => {
    const { features } = natTracksGeoJSON(
      [
        current(track('A', [350])),
        { track: track('B', [350]), status: 'upcoming' },
        { track: track('C', [350]), status: 'expired' },
      ],
      null
    );
    expect(features.map((f) => f.properties?.status)).toEqual([
      'current',
      'current',
      'upcoming',
      'upcoming',
      'expired',
      'expired',
    ]);
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
    const html = natTrackPopupHtml(f, 'upcoming');
    expect(html).toContain('NATF');
    expect(html).toContain('350 360');
    expect(html).toContain('N82A');
    expect(html).toContain('REGHI');
    expect(html).not.toContain('<script');
  });

  it('tags a track from the last published set', () => {
    // i18n is not initialised in tests, so the key stands in for the text.
    expect(natTrackPopupHtml(track('A', [350]), 'expired')).toContain(
      'planBuilder.tracks.lastPublished'
    );
    expect(natTrackPopupHtml(track('A', [350]), 'current')).not.toContain('lastPublished');
  });
});
