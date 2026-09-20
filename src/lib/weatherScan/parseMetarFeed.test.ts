import { describe, expect, it } from 'vitest';
import { parseMetarFeed, parseMetarLine } from './parseMetarFeed';

// Fixed reference time so ageMinutes is deterministic.
const NOW = new Date(Date.UTC(2026, 8, 20, 15, 0));

function parse(line: string) {
  return parseMetarLine(line, NOW);
}

describe('parseMetarLine', () => {
  it('reads station, issue time and raw text', () => {
    const o = parse('PALP 201350Z 02003KT 10SM -SN OVC038 00/M01 A2954');
    expect(o?.icao).toBe('PALP');
    expect(o?.issued).toBe('201350Z');
    expect(o?.ageMinutes).toBe(70);
  });

  it('ignores lines with no station code', () => {
    expect(parse('020852Z AUTO 22009KT 10SM CLR 15/M09 A2998')).toBeNull();
    expect(parse('')).toBeNull();
  });

  describe('snow', () => {
    it.each([
      ['-SN', 'PALP 201350Z 02003KT 10SM -SN OVC038 00/M01 A2954'],
      ['SN with BR', 'PABA 201456Z AUTO 31005KT 4SM -SN BR BKN024 M01/M01'],
      ['ice crystals', 'NZSP 201150Z 11008KT 6000 IC BR FEW000 M62/ A2794'],
      ['blowing snow', 'CYRB 201400Z 19017KT 3000 BLSN OVC003 M01/M01'],
    ])('detects %s', (_label, line) => {
      expect(parse(line)?.categories).toContain('snow');
    });

    // TSNO is a remark meaning thunderstorm information is not available. It
    // contains SN and appears on a large share of automated US reports, so a
    // parser that reads remarks reports snow across half the country.
    it('does not read TSNO in remarks as snow', () => {
      const o = parse('KGNC 201430Z AUTO 00000KT 10SM CLR 22/18 A3012 RMK AO2 TSNO');
      expect(o?.categories).not.toContain('snow');
      expect(o?.categories).not.toContain('thunderstorm');
    });
  });

  describe('visibility', () => {
    it('parses metre visibility', () => {
      const o = parse('ENBS 201450Z AUTO 02009KT 0200 FG VV001 08/08 Q0989');
      expect(o?.visibilityMetres).toBe(200);
      expect(o?.categories).toContain('lowVisibility');
    });

    it('parses a bare fraction below one mile', () => {
      const o = parse('CYCP 201431Z 00000KT 1/4SM FG BKN280 04/04 A3014');
      expect(o?.visibilityMetres).toBeCloseTo(402.3, 0);
      expect(o?.visibilityLabel).toBe('1/4SM');
    });

    // The whole number and the fraction are separate tokens. Reading only the
    // fraction turns two and a half miles into half a mile.
    it('joins a whole number to its fraction', () => {
      const o = parse('KBDR 201452Z 15009KT 2 1/2SM +RA BR SCT010 18/17 A3006');
      expect(o?.visibilityMetres).toBeCloseTo(2.5 * 1609.34, 0);
      expect(o?.visibilityLabel).toBe('2 1/2SM');
      expect(o?.categories).not.toContain('lowVisibility');
    });

    it('marks M-prefixed visibility as less-than', () => {
      const o = parse('K06D 201455Z AUTO 03006KT M1/4SM FG OVC002 09/09 A3032');
      expect(o?.visibilityLabel).toBe('<1/4SM');
      expect(o?.categories).toContain('lowVisibility');
    });

    it('does not treat the wind group as metre visibility', () => {
      const o = parse('EGLL 201450Z 09008KT 9999 FEW040 18/12 Q1021');
      expect(o?.visibilityMetres).toBe(9999);
    });
  });

  describe('intensity and trends', () => {
    it('detects heavy precipitation', () => {
      const o = parse('KEFT 201455Z AUTO 04013G24KT 5SM +RA OVC004 16/16 A3000');
      expect(o?.categories).toContain('heavyPrecipitation');
    });

    // TEMPO describes a forecast change, not present weather.
    it('ignores weather inside a TEMPO group', () => {
      const o = parse('RJAA 201430Z AUTO 04011KT 4900 RA BR BKN003 22/22 Q1005 TEMPO 2000 +TSRA');
      expect(o?.categories).not.toContain('heavyPrecipitation');
      expect(o?.categories).not.toContain('thunderstorm');
    });

    it('detects thunderstorms', () => {
      expect(parse('DRRM 201400Z 18008KT 9999 TS SCT010TCU 33/24 Q1013')?.categories).toContain(
        'thunderstorm'
      );
    });
  });

  describe('freezing precipitation', () => {
    it.each([
      ['freezing rain', 'CYQT 201400Z 09012KT 2SM FZRA OVC008 M02/M03 A2960'],
      ['freezing drizzle', 'KDLH 201453Z 12008KT 3SM FZDZ BR OVC004 M01/M02 A3001'],
      ['freezing fog', 'UUEE 201430Z 20003KT 0400 FZFG VV002 M05/M06 Q1024'],
    ])('detects %s', (_label, line) => {
      expect(parse(line)?.categories).toContain('freezing');
    });

    it('does not flag ordinary rain as freezing', () => {
      expect(parse('EGLL 201450Z 09008KT 6000 RA BKN012 08/06 Q1015')?.categories).not.toContain(
        'freezing'
      );
    });
  });

  describe('ceiling', () => {
    it('takes the lowest broken or overcast layer', () => {
      const o = parse('KAOH 201443Z 18003KT 2SM RA FEW005 BKN030 OVC070 20/19 A2998');
      expect(o?.ceilingFeet).toBe(3000);
    });

    // Scattered and few layers are not a ceiling.
    it('ignores FEW and SCT', () => {
      const o = parse('KMSO 201453Z 00000KT 10SM SCT017 FEW005 08/07 A3024');
      expect(o?.ceilingFeet).toBeNull();
      expect(o?.categories).not.toContain('lowCeiling');
    });

    it('treats vertical visibility as a ceiling', () => {
      const o = parse('CYKD 201400Z 14003KT 2SM VV001 01/01 A2944');
      expect(o?.ceilingFeet).toBe(100);
      expect(o?.categories).toContain('lowCeiling');
    });

    it('flags a low overcast', () => {
      expect(parse('CYRB 201400Z 19017KT 3SM OVC003 M01/M01 A2974')?.categories).toContain(
        'lowCeiling'
      );
    });

    it('leaves a high ceiling unflagged', () => {
      expect(parse('EDDF 201420Z 25010KT 9999 OVC035 14/09 Q1012')?.categories).not.toContain(
        'lowCeiling'
      );
    });
  });

  describe('severe and dust', () => {
    it.each([
      ['hail', 'LFPG 201430Z 27015KT 3000 TSGR SCT020CB 12/09 Q1008'],
      ['squall', 'KDEN 201453Z 30025G40KT 5SM SQ BKN025 15/08 A2990'],
      ['funnel cloud', 'KICT 201455Z 18020G35KT 5SM FC BKN015 24/21 A2985'],
    ])('detects %s', (_label, line) => {
      expect(parse(line)?.categories).toContain('severe');
    });

    it.each([
      ['blowing dust', 'FTTJ 201400Z 15018KT 4500 BLDU BKN033 29/22 Q1011'],
      ['sandstorm', 'OEJN 201400Z 32020KT 1500 SS FEW030 38/06 Q1004'],
      ['duststorm', 'DAAG 201400Z 24018KT 2000 DS SCT025 33/12 Q1010'],
    ])('detects %s', (_label, line) => {
      expect(parse(line)?.categories).toContain('dustSand');
    });
  });

  describe('clear conditions', () => {
    it('detects CAVOK', () => {
      const o = parse('LIRF 201420Z 23008KT CAVOK 24/12 Q1018');
      expect(o?.categories).toEqual(['clear']);
      expect(o?.visibilityLabel).toBe('CAVOK');
    });

    it('detects unlimited visibility with no cloud', () => {
      expect(parse('KPHX 201451Z 27006KT 10SM CLR 34/06 A2989')?.categories).toEqual(['clear']);
    });

    // Anything actually happening disqualifies it, even with good visibility.
    it('is not clear when weather is present', () => {
      const o = parse('KDEN 201453Z 30028KT 10SM SKC 15/08 A2990');
      expect(o?.categories).toContain('strongWind');
      expect(o?.categories).not.toContain('clear');
    });

    it('is not clear with a low ceiling', () => {
      expect(parse('EGSS 201420Z 24006KT 9999 OVC004 12/11 Q1012')?.categories).not.toContain(
        'clear'
      );
    });
  });

  describe('wind', () => {
    it('flags gusts above the threshold', () => {
      const o = parse('KMWN 201449Z 22024G32KT 1/16SM -SHRA FG VV000 02/02');
      expect(o?.gustKt).toBe(32);
      expect(o?.categories).toContain('strongWind');
    });

    it('leaves light wind unflagged', () => {
      const o = parse('PALP 201350Z 02003KT 10SM -SN OVC038 00/M01 A2954');
      expect(o?.categories).not.toContain('strongWind');
      expect(o?.gustKt).toBeNull();
    });

    it('handles variable wind', () => {
      expect(parse('KBDQ 201435Z AUTO VRB01KT M1/4SM +DZ HZ VV000 27/18')?.windLabel).toBe(
        'VRB01KT'
      );
    });
  });
});

describe('parseMetarFeed', () => {
  const feed = [
    'PALP 201350Z 02003KT 10SM -SN OVC038 00/M01 A2954',
    'KGNC 201430Z AUTO 00000KT 10SM CLR 22/18 A3012 RMK AO2 TSNO',
    'ESKS 191720Z AUTO 24010KT 9999 BKN059/// 11/07 Q0991',
    'ENBS 201450Z AUTO 02009KT 0200 FG VV001 08/08 Q0989',
    '',
  ].join('\n');

  it('keeps only recent reports that matched a category', () => {
    // ESKS is a day stale. KGNC reports 10SM CLR, which is the clear category.
    const results = parseMetarFeed(feed, { now: NOW });
    expect(results.map((r) => r.icao)).toEqual(['PALP', 'KGNC', 'ENBS']);
  });

  it('drops reports older than the age limit', () => {
    // PALP is 70 minutes old, KGNC 30 and ENBS 10.
    const results = parseMetarFeed(feed, { now: NOW, maxAgeMinutes: 30 });
    expect(results.map((r) => r.icao)).toEqual(['KGNC', 'ENBS']);
  });
});
