import { describe, expect, it, vi } from 'vitest';

const mockMagvar = vi.fn();
vi.mock('magvar', () => ({ magvar: (...args: unknown[]) => mockMagvar(...args) }));
mockMagvar.mockReturnValue(2);

const { unitExample } = await import('./unitExamples');

const t = (key: string) =>
  ({
    'units.nm': 'NM',
    'units.km': 'km',
    'units.mi': 'mi',
    'units.ft': 'ft',
    'units.m': 'm',
    'units.kts': 'kts',
    'units.kmh': 'km/h',
    'units.mph': 'mph',
    'units.fpm': 'fpm',
    'units.ms': 'm/s',
    'units.degM': 'M',
    'units.degT': 'T',
    'directions.n': 'N',
    'directions.e': 'E',
    'directions.s': 'S',
    'directions.w': 'W',
  })[key] ?? key;

describe('unitExample', () => {
  it('formats the same sample distance in every unit', () => {
    expect(unitExample('distance', 'nm', t)).toBe('12.5 NM');
    expect(unitExample('distance', 'km', t)).toBe('23.2 km');
    expect(unitExample('distance', 'mi', t)).toBe('14.4 mi');
  });

  it('formats altitude, speed, vertical speed and weight', () => {
    expect(unitExample('altitude', 'ft', t)).toBe('3,500 ft');
    expect(unitExample('altitude', 'm', t)).toBe('1,067 m');
    expect(unitExample('speed', 'kts', t)).toBe('250 kts');
    expect(unitExample('speed', 'kmh', t)).toBe('463 km/h');
    expect(unitExample('verticalSpeed', 'fpm', t)).toBe('1,500 fpm');
    expect(unitExample('verticalSpeed', 'ms', t)).toBe('7.62 m/s');
    expect(unitExample('weight', 'lbs', t)).toMatch(/lbs$/);
    expect(unitExample('weight', 'kg', t)).toMatch(/kg$/);
  });

  it('formats the sample position in each coordinate format', () => {
    expect(unitExample('coordinates', 'decimal', t)).toBe('48.8584°N 2.2945°E');
    expect(unitExample('coordinates', 'dms', t)).toBe('N48°51\'30" E2°17\'40"');
    expect(unitExample('coordinates', 'dm', t)).toBe("N48°51.50' E2°17.67'");
  });

  it('formats the sample course in each mode using the model variation', () => {
    expect(unitExample('course', 'magnetic', t)).toBe('088°M');
    expect(unitExample('course', 'true', t)).toBe('090°T');
    expect(unitExample('course', 'both', t)).toBe('088°M · 090°T');
  });
});
