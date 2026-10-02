import { describe, expect, it } from 'vitest';
import type { Feet } from '@/lib/utils/geomath';
import {
  type AltitudeUnit,
  type CoordinateFormat,
  formatAltitude,
  formatCoordinates,
} from '@/lib/utils/units';
import { buildContextPointLabels } from './contextPointLabels';

const t = (key: string) =>
  ({
    'units.ft': 'ft',
    'units.m': 'm',
    'directions.n': 'N',
    'directions.s': 'S',
    'directions.e': 'E',
    'directions.w': 'W',
  })[key] ?? key;

function units(coordinates: CoordinateFormat, altitude: AltitudeUnit) {
  return {
    coordinates: (lat: number, lon: number) => formatCoordinates(lat, lon, coordinates, t),
    altitude: (ft: Feet) => formatAltitude(ft, altitude, t),
  };
}

describe('buildContextPointLabels', () => {
  it('formats the point in the user coordinate format (decimal)', () => {
    const labels = buildContextPointLabels(48.8584, 2.2945, null, units('decimal', 'ft'));
    expect(labels.coordinates).toBe('48.8584°N 2.2945°E');
  });

  it('formats the point in the user coordinate format (DMS)', () => {
    const labels = buildContextPointLabels(48.8584, -2.2945, null, units('dms', 'ft'));
    expect(labels.coordinates).toBe('N48°51\'30" W2°17\'40"');
  });

  it('omits the elevation line when terrain gives no value', () => {
    const labels = buildContextPointLabels(48.8584, 2.2945, null, units('decimal', 'ft'));
    expect(labels.elevation).toBeNull();
  });

  it('converts terrain metres to the user altitude unit (feet)', () => {
    const labels = buildContextPointLabels(0, 0, 1594, units('decimal', 'ft'));
    expect(labels.elevation).toBe('5,230 ft');
  });

  it('keeps metres when the altitude preference is metres', () => {
    const labels = buildContextPointLabels(0, 0, 1594, units('decimal', 'm'));
    expect(labels.elevation).toBe('1,594 m');
  });
});
