import { describe, expect, it } from 'vitest';
import { snapFromFeature } from './snap';

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

  it('returns null for unknown layers or missing idents', () => {
    expect(snapFromFeature('something-else', { id: 'X' })).toBeNull();
    expect(snapFromFeature('airports-hitbox', {})).toBeNull();
  });
});
