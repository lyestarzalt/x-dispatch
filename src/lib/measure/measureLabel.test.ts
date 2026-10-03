import { describe, expect, it } from 'vitest';
import type { Degrees, NauticalMiles } from '@/lib/utils/geomath';
import { type MeasureGeometry, buildMeasureLabel } from './measureLabel';

const t = (key: string) =>
  ({
    'units.nm': 'NM',
    'units.km': 'km',
    'units.mi': 'mi',
    'units.ft': 'ft',
    'units.m': 'm',
    'units.degM': 'M',
    'units.degT': 'T',
  })[key] ?? key;

const nm = (v: number) => v as NauticalMiles;
const deg = (v: number) => v as Degrees;

function geometry(over: Partial<MeasureGeometry> = {}): MeasureGeometry {
  return {
    initialTrue: deg(90),
    finalTrue: deg(90),
    distanceNm: nm(23.4),
    startVariation: 3, // east, so magnetic = true - 3
    endVariation: 3,
    snap: null,
    ...over,
  };
}

const base = {
  courseMode: 'magnetic' as const,
  distanceUnit: 'nm' as const,
  shortUnit: 'ft' as const,
  placing: false,
  flipped: false,
};

describe('buildMeasureLabel', () => {
  it('magnetic mode: course line then distance line', () => {
    expect(buildMeasureLabel(geometry(), base, t)).toEqual(['087°M', '23.4 NM']);
  });

  it('true mode uses the true suffix and no variation', () => {
    expect(buildMeasureLabel(geometry(), { ...base, courseMode: 'true' }, t)).toEqual([
      '090°T',
      '23.4 NM',
    ]);
  });

  it('both mode collapses to one course line when magnetic equals true', () => {
    expect(
      buildMeasureLabel(
        geometry({ startVariation: 0, endVariation: 0 }),
        { ...base, courseMode: 'both' },
        t
      )
    ).toEqual(['090°M/T', '23.4 NM']);
  });

  it('both mode puts distance between the magnetic and true course lines', () => {
    expect(buildMeasureLabel(geometry(), { ...base, courseMode: 'both' }, t)).toEqual([
      '087°M',
      '23.4 NM',
      '090°T',
    ]);
  });

  it('shows initial and final course when they differ on a long line', () => {
    expect(
      buildMeasureLabel(geometry({ initialTrue: deg(292), finalTrue: deg(239) }), base, t)[0]
    ).toBe('289°M \\ 236°M');
  });

  it('swaps the two courses when the label is flipped to stay readable', () => {
    expect(
      buildMeasureLabel(
        geometry({ initialTrue: deg(292), finalTrue: deg(239) }),
        { ...base, flipped: true },
        t
      )[0]
    ).toBe('236°M \\ 289°M');
  });

  it('drops the final course while the line is still being placed', () => {
    expect(
      buildMeasureLabel(
        geometry({ initialTrue: deg(292), finalTrue: deg(239) }),
        { ...base, placing: true },
        t
      )[0]
    ).toBe('289°M');
  });

  it('adds the snapped label and a radial for a VOR', () => {
    const g = geometry({ snap: { kind: 'vor', label: 'BRY 114.50', magneticVariation: 3 } });
    expect(buildMeasureLabel(g, base, t)).toEqual(['087°M', 'BRY 114.50 / R087', '23.4 NM']);
  });

  it('adds a radial for an NDB but not for a DME or an airport', () => {
    expect(
      buildMeasureLabel(geometry({ snap: { kind: 'ndb', label: 'CTL 385' } }), base, t)[1]
    ).toBe('CTL 385 / R087');
    expect(
      buildMeasureLabel(geometry({ snap: { kind: 'dme', label: 'ABC 112.10' } }), base, t)[1]
    ).toBe('ABC 112.10');
    expect(
      buildMeasureLabel(geometry({ snap: { kind: 'airport', label: 'LFPG' } }), base, t)[1]
    ).toBe('LFPG');
  });

  it('joins label, radial and distance on one line when both course lines are shown', () => {
    const g = geometry({ snap: { kind: 'vor', label: 'BRY 114.50', magneticVariation: 3 } });
    expect(buildMeasureLabel(g, { ...base, courseMode: 'both' }, t)).toEqual([
      '087°M',
      'BRY 114.50 / R087 / 23.4 NM',
      '090°T',
    ]);
  });

  it('appends feet below 3 NM', () => {
    expect(buildMeasureLabel(geometry({ distanceNm: nm(1.5) }), base, t)[1]).toBe(
      '1.5 NM / 9,114 ft'
    );
  });

  it('appends metres instead when the short unit is metres', () => {
    expect(
      buildMeasureLabel(geometry({ distanceNm: nm(1.5) }), { ...base, shortUnit: 'm' }, t)[1]
    ).toBe('1.5 NM / 2,778 m');
  });

  it('shows only metres below 6 km and only km above', () => {
    expect(
      buildMeasureLabel(
        geometry({ distanceNm: nm(2) }),
        { ...base, distanceUnit: 'km', shortUnit: 'm' },
        t
      )[1]
    ).toBe('3,704 m');
    expect(
      buildMeasureLabel(
        geometry({ distanceNm: nm(23.4) }),
        { ...base, distanceUnit: 'km', shortUnit: 'm' },
        t
      )[1]
    ).toBe('43.3 km');
  });
});
