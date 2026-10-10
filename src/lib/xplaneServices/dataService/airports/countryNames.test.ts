import { describe, expect, it } from 'vitest';
import { COUNTRY_NAMES, normalizeCountry } from './countryNames';

describe('normalizeCountry', () => {
  it('maps the Gateway "CODE Name" form to one display name per code', () => {
    expect(normalizeCountry('USA United States')).toBe('United States');
    expect(normalizeCountry('USA United States of America')).toBe('United States');
    expect(normalizeCountry('USA UNITED STATES')).toBe('United States');
    expect(normalizeCountry('USA United Statesv')).toBe('United States');
    expect(normalizeCountry('GBR Great Britain')).toBe('United Kingdom');
  });

  it('accepts a bare code', () => {
    expect(normalizeCountry('USA')).toBe('United States');
    expect(normalizeCountry('AUS')).toBe('Australia');
  });

  it('corrects the known free-text spellings', () => {
    expect(normalizeCountry('Unites States')).toBe('United States');
    expect(normalizeCountry('U,S,')).toBe('United States');
    expect(normalizeCountry('Unied Kingdom')).toBe('United Kingdom');
    expect(normalizeCountry('Swaziland')).toBe('Eswatini');
    expect(normalizeCountry('Burma')).toBe('Myanmar');
  });

  it('matches a plain name against the table, ignoring case', () => {
    expect(normalizeCountry('france')).toBe('France');
    expect(normalizeCountry('Réunion')).toBe('Réunion');
  });

  it('keeps text it cannot place rather than dropping the airport', () => {
    expect(normalizeCountry('Sanaa Intl')).toBe('Sanaa Intl');
  });

  it('returns undefined for empty input', () => {
    expect(normalizeCountry('')).toBeUndefined();
    expect(normalizeCountry('   ')).toBeUndefined();
  });

  it('covers every ISO 3166-1 alpha-3 code the Gateway data uses', () => {
    for (const code of ['USA', 'BRA', 'AUS', 'CAN', 'FRA', 'DEU', 'GBR', 'RUS', 'PHL', 'PNG']) {
      expect(COUNTRY_NAMES[code], code).toBeTruthy();
    }
    expect(Object.keys(COUNTRY_NAMES).length).toBeGreaterThanOrEqual(240);
  });
});
