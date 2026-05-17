import { describe, expect, it } from 'vitest';
import { formatAirportCountry } from './index';

describe('formatAirportCountry', () => {
  it('strips leading ISO-3 code when a name follows', () => {
    expect(formatAirportCountry('USA United States')).toBe('United States');
    expect(formatAirportCountry('DZA Algeria')).toBe('Algeria');
    expect(formatAirportCountry('GBR United Kingdom')).toBe('United Kingdom');
    expect(formatAirportCountry('VCT Saint Vincent and the Grenadines')).toBe(
      'Saint Vincent and the Grenadines'
    );
  });

  it('returns the bare ISO code when no name follows', () => {
    expect(formatAirportCountry('VIR')).toBe('VIR');
    expect(formatAirportCountry('FRA')).toBe('FRA');
  });

  it('returns undefined for empty/missing input', () => {
    expect(formatAirportCountry(undefined)).toBeUndefined();
    expect(formatAirportCountry('')).toBeUndefined();
    expect(formatAirportCountry('   ')).toBeUndefined();
  });

  it('does not strip when the leading 3 chars are not all-caps letters', () => {
    expect(formatAirportCountry('usa United States')).toBe('usa United States');
    expect(formatAirportCountry('US2 Something')).toBe('US2 Something');
  });
});
