import { parseMetar } from 'metar-taf-parser';
import { describe, expect, it } from 'vitest';
import { groundWeatherFrom } from './groundWeather';

describe('groundWeatherFrom', () => {
  it('reads wind, rain and clear visibility', () => {
    const w = groundWeatherFrom(parseMetar('EHAM 201925Z 23016KT 9999 -RA BKN016 19/16 Q1016'));
    expect(w.windFromDeg).toBe(230);
    expect(w.windKt).toBe(16);
    expect(w.precip).toBe('rain');
    expect(w.fog).toBe(0);
  });

  it('flags snow over rain and scales fog with visibility', () => {
    const w = groundWeatherFrom(parseMetar('ENGM 201950Z 03008KT 1200 SN BR OVC004 M02/M03 Q1001'));
    expect(w.precip).toBe('snow');
    expect(w.fog).toBeGreaterThan(0.8);
    expect(w.fog).toBeLessThanOrEqual(1);
  });

  it('treats calm and CAVOK as no effects', () => {
    const w = groundWeatherFrom(parseMetar('LFPG 201930Z 00000KT CAVOK 22/10 Q1018'));
    expect(w.windFromDeg).toBeNull();
    expect(w.windKt).toBe(0);
    expect(w.fog).toBe(0);
    expect(w.precip).toBe('none');
  });

  it('converts metres per second to knots', () => {
    const w = groundWeatherFrom(parseMetar('UUEE 201930Z 27005MPS 9999 SCT030 15/08 Q1015'));
    expect(w.windKt).toBe(10);
  });
});
