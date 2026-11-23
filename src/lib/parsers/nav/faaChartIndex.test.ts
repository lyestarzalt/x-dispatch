import { describe, expect, it } from 'vitest';
import { chartTitleTags, markFaaChartNames, parseFaaChartIndex } from './faaChartIndex';

const record = (code: string, name: string, ident: string) => `
        <record>
          <chartseq>90100</chartseq>
          <chart_code>${code}</chart_code>
          <chart_name>${name}</chart_name>
          <pdf_name>X.PDF</pdf_name>
          <procuid>1</procuid>
          ${ident ? `<faanfd18>${ident}</faanfd18>` : '<faanfd18/>'}
          <copter/>
        </record>`;

// KGJT as the FAA publishes it: one obstacle departure among the SIDs (GitHub #323, #403).
const metafile = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<digital_tpp cycle="2610">
  <state_code ID="CO" state_fullname="COLORADO">
    <city_name ID="GRAND JUNCTION" volume="SW-1">
      <airport_name ID="GRAND JUNCTION RGNL" military="N" apt_ident="GJT" icao_ident="KGJT" alnum="1">
${record('IAP', 'ILS OR LOC RWY 11', '')}
${record('ODP', 'MONUMENT THREE (OBSTACLE)', 'MONMT3.JNC')}
${record('DP', 'GRAND JUNCTION ONE', 'JNC1.JNC')}
${record('DP', 'NOKXI TWO (RNAV)', 'NOKXI2.NOKXI')}
${record('STR', 'GRUUB ONE (RNAV)', 'BRODE.GRUUB1')}
${record('STR', 'GRUUB ONE (RNAV), CONT.1', 'BRODE.GRUUB1')}
${record('STR', 'OLDWY TWO', 'HBU.OLDWY2')}
      </airport_name>
    </city_name>
    <city_name ID="ELSEWHERE" volume="SW-1">
      <airport_name ID="NO IDENT" military="N" apt_ident="XYZ" icao_ident="KXYZ" alnum="2">
${record('ODP', 'SOMEWHERE ONE (OBSTACLE)', '')}
${record('DP', 'OTHER TWO', 'OTHER2.OTHER')}
      </airport_name>
    </city_name>
  </state_code>
</digital_tpp>`;

describe('parseFaaChartIndex', () => {
  it('lists the obstacle departures per airport by their computer code', () => {
    const index = parseFaaChartIndex(metafile);
    expect([...index.obstacleDepartures.get('KGJT')!]).toEqual(['MONMT3']);
  });

  it('leaves out an obstacle departure the FAA gives no code, and airports with none', () => {
    expect(parseFaaChartIndex(metafile).obstacleDepartures.has('KXYZ')).toBe(false);
  });

  // A departure's code leads with its name, an arrival's ends with it (GitHub #410).
  it('lists the departures and arrivals titled (RNAV), each once', () => {
    const index = parseFaaChartIndex(metafile);
    expect([...index.rnavDepartures.get('KGJT')!]).toEqual(['NOKXI2']);
    expect([...index.rnavArrivals.get('KGJT')!]).toEqual(['GRUUB1']);
  });

  it('reads nothing from a file that is not the metafile', () => {
    const index = parseFaaChartIndex('KBOS\tSIAP\tI04R');
    expect(
      index.obstacleDepartures.size + index.rnavDepartures.size + index.rnavArrivals.size
    ).toBe(0);
  });

  it('files a field without an ICAO code under its FAA identifier', () => {
    const xml = `<airport_name ID="SMALL" military="N" apt_ident="1G4" icao_ident="" alnum="3">${record(
      'ODP',
      'CANYON ONE (OBSTACLE) (RNAV)',
      'CANYN1.PGS'
    )}</airport_name>`;
    const index = parseFaaChartIndex(xml);
    expect([...index.obstacleDepartures.get('1G4')!]).toEqual(['CANYN1']);
    expect([...index.rnavDepartures.get('1G4')!]).toEqual(['CANYN1']);
  });
});

describe('markFaaChartNames', () => {
  it('marks the matching SIDs and STARs at that airport only', () => {
    const index = parseFaaChartIndex(metafile);
    const kgjt = {
      sids: [{ name: 'MONMT3' }, { name: 'JNC1' }, { name: 'NOKXI2' }],
      stars: [{ name: 'GRUUB1' }, { name: 'OLDWY2' }, { name: 'NOKXI2' }],
    };
    markFaaChartNames(kgjt, index, 'kgjt');
    expect(kgjt.sids).toEqual([
      { name: 'MONMT3', obstacle: true },
      { name: 'JNC1' },
      { name: 'NOKXI2', rnav: true },
    ]);
    // An arrival is matched against arrivals only, never a departure of the same name.
    expect(kgjt.stars).toEqual([
      { name: 'GRUUB1', rnav: true },
      { name: 'OLDWY2' },
      { name: 'NOKXI2' },
    ]);

    const elsewhere = { sids: [{ name: 'MONMT3' }], stars: [] };
    markFaaChartNames(elsewhere, index, 'KDEN');
    expect(elsewhere.sids).toEqual([{ name: 'MONMT3' }]);
  });
});

describe('chartTitleTags', () => {
  it('orders the tags as a chart title does', () => {
    expect(chartTitleTags({ rnav: true, obstacle: true })).toEqual(['obstacle', 'rnav']);
    expect(chartTitleTags({ rnav: true })).toEqual(['rnav']);
    expect(chartTitleTags({})).toEqual([]);
  });
});
