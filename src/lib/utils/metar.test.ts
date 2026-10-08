import { parseMetar } from 'metar-taf-parser';
import { describe, expect, it } from 'vitest';
import {
  formatAltimeter,
  formatCeiling,
  formatVisibility,
  formatWind,
  skyCondition,
} from './metar';

const metar = (raw: string) => parseMetar(raw);

describe('formatCeiling', () => {
  it('gives METAR hundreds of feet in compact style, since the parser returns feet', () => {
    const m = metar('EGLL 081250Z 24012KT 9999 FEW040 BKN080 15/09 Q1012');
    expect(formatCeiling(m.clouds, m.verticalVisibility)).toBe('BKN080');
  });

  it('gives feet in verbose style', () => {
    const m = metar('EGLL 081250Z 24012KT 9999 BKN080 15/09 Q1012');
    expect(formatCeiling(m.clouds, m.verticalVisibility, { verbose: true })).toBe('BKN 8,000 ft');
  });

  it('says CLR in every style, so no language needs a translation', () => {
    const m = metar('EGLL 081250Z 24012KT 9999 SKC 15/09 Q1012');
    expect(formatCeiling(m.clouds, m.verticalVisibility)).toBe('CLR');
    expect(formatCeiling(m.clouds, m.verticalVisibility, { verbose: true })).toBe('CLR');
  });
});

describe('formatWind', () => {
  const m = metar('KJFK 081251Z 31015G25KT 10SM FEW250 18/06 A3001');

  it('is always knots', () => {
    expect(formatWind(m.wind)).toBe('310°/15G25kt');
    expect(formatWind(m.wind, { verbose: true })).toBe('310° / 15G25 kt');
    expect(formatWind(m.wind, { bare: true })).toBe('310°/15G25');
  });

  it('keeps visibility and altimeter in the reported units', () => {
    expect(formatVisibility(m.visibility, m.cavok)).toBe('>10SM');
    expect(formatAltimeter(m.altimeter)).toBe('30.01"');
  });
});

describe('skyCondition', () => {
  const sky = (raw: string) => skyCondition(metar(raw));

  it('names present weather first, strongest first', () => {
    expect(sky('EGLL 081250Z 24012KT 9999 TSRA BKN030CB 15/09 Q1012')).toBe('thunderstorm');
    expect(sky('EGLL 081250Z 24012KT 4000 -SN OVC010 M01/M03 Q1012')).toBe('snow');
    expect(sky('EGLL 081250Z 24012KT 6000 -RA BKN012 12/10 Q1012')).toBe('rain');
    expect(sky('EGLL 081250Z 24012KT 6000 -DZ OVC008 12/11 Q1012')).toBe('drizzle');
    expect(sky('EGLL 081250Z 00000KT 0300 FG VV001 08/08 Q1012')).toBe('fog');
  });

  it('falls back to the cloud cover', () => {
    expect(sky('EGLL 081250Z 24012KT CAVOK 15/09 Q1012')).toBe('clear');
    expect(sky('EGLL 081250Z 24012KT 9999 SCT040 15/09 Q1012')).toBe('partlyCloudy');
    expect(sky('EGLL 081250Z 24012KT 9999 FEW020 BKN040 15/09 Q1012')).toBe('cloudy');
    expect(sky('EGLL 081250Z 24012KT 9999 OVC015 15/09 Q1012')).toBe('overcast');
  });
});
