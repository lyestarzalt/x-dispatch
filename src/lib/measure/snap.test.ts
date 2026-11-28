import { describe, expect, it } from 'vitest';
import { snapAt, snapFromFeature } from './snap';

describe('snapFromFeature', () => {
  it('maps VOR family navaids to vor with ident, frequency and station variation', () => {
    expect(
      snapFromFeature('nav-navaids', {
        id: 'BRY',
        type: 'VOR-DME',
        freqDisplay: '114.50',
        magneticVariation: 2.5,
      })
    ).toEqual({ kind: 'vor', label: 'BRY 114.50', magneticVariation: 2.5 });
    expect(
      snapFromFeature('nav-navaids', {
        id: 'TAC',
        type: 'VORTAC',
        freqDisplay: '113.00',
        magneticVariation: -1,
      })?.kind
    ).toBe('vor');
  });

  it('drops a zero station variation so the model is used instead', () => {
    expect(
      snapFromFeature('nav-navaids', {
        id: 'BRY',
        type: 'VOR',
        freqDisplay: '114.50',
        magneticVariation: 0,
      })
    ).toEqual({
      kind: 'vor',
      label: 'BRY 114.50',
    });
  });

  it('maps NDB and DME without a station variation', () => {
    expect(
      snapFromFeature('nav-navaids', {
        id: 'CTL',
        type: 'NDB',
        freqDisplay: '385 kHz',
        magneticVariation: 1,
      })
    ).toEqual({
      kind: 'ndb',
      label: 'CTL 385 kHz',
    });
    expect(
      snapFromFeature('nav-navaids', { id: 'ABC', type: 'DME', freqDisplay: '112.10' })
    ).toEqual({
      kind: 'dme',
      label: 'ABC 112.10',
    });
  });

  it('ignores navaid types that are not measurement anchors (ILS, glideslope)', () => {
    expect(
      snapFromFeature('nav-navaids', { id: 'IBRY', type: 'ILS', freqDisplay: '110.30' })
    ).toBeNull();
  });

  it('maps plan waypoints and airports by their label', () => {
    expect(snapFromFeature('flightplan-waypoints', { label: 'RESMI' })).toEqual({
      kind: 'waypoint',
      label: 'RESMI',
    });
    expect(snapFromFeature('airports-hitbox', { icao: 'LFPG' })).toEqual({
      kind: 'airport',
      label: 'LFPG',
    });
  });

  it('maps procedure navaids like navaids and procedure fixes by their ident', () => {
    expect(
      snapFromFeature('nav-procedure-navaids', { id: 'BRY', type: 'VOR', freqDisplay: '114.50' })
    ).toEqual({ kind: 'vor', label: 'BRY 114.50' });
    expect(snapFromFeature('procedure-waypoints', { id: 'CF27L' })).toEqual({
      kind: 'waypoint',
      label: 'CF27L',
    });
  });

  it('returns null for unknown layers or missing idents', () => {
    expect(snapFromFeature('something-else', { id: 'X' })).toBeNull();
    expect(snapFromFeature('airports-hitbox', {})).toBeNull();
  });
});

describe('snapAt', () => {
  const feature = (layerId: string, properties: Record<string, unknown>) => ({
    layerId,
    feature: {
      geometry: { type: 'Point' as const, coordinates: [7.2149, 43.6651] },
      properties,
    },
  });

  // Rendered geometry is rebuilt from tile units (8192 per tile), so a fix
  // read from it is off by up to 0.16' at zoom 3. The feature's own position wins.
  it('takes the exact position from the properties, not the tile geometry', () => {
    const hit = snapAt([
      feature('procedure-waypoints', { id: 'NIZ01', latitude: 43.6653, longitude: 7.215 }),
    ]);
    expect(hit).toEqual({
      snap: { kind: 'waypoint', label: 'NIZ01' },
      point: { latitude: 43.6653, longitude: 7.215 },
    });
  });

  it('follows the layer priority and skips features that are not anchors', () => {
    const hit = snapAt([
      feature('nav-navaids', { id: 'IBRY', type: 'ILS', latitude: 1, longitude: 1 }),
      feature('airports-hitbox', { icao: 'LFMN', latitude: 43.6584, longitude: 7.2159 }),
    ]);
    expect(hit?.snap).toEqual({ kind: 'airport', label: 'LFMN' });
  });

  // At zoom 5 the SFO and SJC VOR symbols overlap the hit box around SFO, and
  // MapLibre listed SJC first: the right-click on SFO gave SJC's position.
  it('picks the anchor nearest the cursor when several are under it', () => {
    const sjc = feature('nav-navaids', {
      id: 'SJC',
      type: 'VORTAC',
      latitude: 37.3747,
      longitude: -121.9447,
    });
    const sfo = feature('nav-navaids', {
      id: 'SFO',
      type: 'VORTAC',
      latitude: 37.619486111,
      longitude: -122.373894444,
    });
    const hit = snapAt([sjc, sfo], { latitude: 37.6, longitude: -122.35 });
    expect(hit?.point).toEqual({ latitude: 37.619486111, longitude: -122.373894444 });
  });

  it('does not snap to a feature without its position', () => {
    expect(snapAt([feature('procedure-waypoints', { id: 'NIZ01' })])).toBeNull();
  });

  it('snaps to nothing when nothing is under the cursor', () => {
    expect(snapAt([])).toBeNull();
  });
});
