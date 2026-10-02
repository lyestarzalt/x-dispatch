import { describe, expect, it } from 'vitest';
import type { Feet, NauticalMiles } from '@/lib/utils/geomath';
import type { FeetPerMinute, Knots } from '@/lib/utils/units';
import { buildUnitFormatters } from './useUnits';

const t = (key: string) =>
  ({
    'units.nm': 'NM',
    'units.ft': 'ft',
    'units.kts': 'kts',
    'units.fpm': 'fpm',
    'directions.n': 'N',
    'directions.e': 'E',
  })[key] ?? key;

const units = {
  distance: 'nm' as const,
  altitude: 'ft' as const,
  speed: 'kts' as const,
  verticalSpeed: 'fpm' as const,
  weight: 'lbs' as const,
  coordinates: 'decimal' as const,
};

describe('buildUnitFormatters', () => {
  const formatters = buildUnitFormatters(units, t);

  it('formats distance using the stored preference', () => {
    expect(formatters.distance(42 as NauticalMiles)).toBe('42.0 NM');
  });

  it('formats altitude using the stored preference', () => {
    expect(formatters.altitude(9197 as Feet)).toBe('9,197 ft');
  });

  it('formats speed using the stored preference', () => {
    expect(formatters.speed(280 as Knots)).toBe('280 kts');
  });

  it('formats vertical speed using the stored preference', () => {
    expect(formatters.verticalSpeed(700 as FeetPerMinute)).toBe('700 fpm');
  });

  it('formats weight using the stored preference', () => {
    expect(formatters.weight(1000)).toBe('1.0k lbs');
  });

  it('formats coordinates using the stored preference', () => {
    expect(formatters.coordinates(43.6653, 7.215)).toBe('43.6653°N 7.2150°E');
  });

  it('exposes raw converted numbers for charts/axes', () => {
    expect(formatters.distanceF(100 as NauticalMiles)).toBeCloseTo(100, 5);
    expect(formatters.altitudeF(1000 as Feet)).toBeCloseTo(1000, 5);
  });
});
