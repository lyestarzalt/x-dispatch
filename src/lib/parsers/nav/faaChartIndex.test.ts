import { describe, expect, it } from 'vitest';
import { markObstacleDepartures, parseFaaObstacleDepartures } from './faaChartIndex';

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

describe('parseFaaObstacleDepartures', () => {
  it('lists the obstacle departures per airport by their computer code', () => {
    const index = parseFaaObstacleDepartures(metafile);
    expect([...index.get('KGJT')!]).toEqual(['MONMT3']);
  });

  it('leaves out an obstacle departure the FAA gives no code, and airports with none', () => {
    expect(parseFaaObstacleDepartures(metafile).has('KXYZ')).toBe(false);
  });

  it('reads nothing from a file that is not the metafile', () => {
    expect(parseFaaObstacleDepartures('KBOS\tSIAP\tI04R').size).toBe(0);
  });
});

describe('parseFaaObstacleDepartures at a field without an ICAO code', () => {
  it('files it under its FAA identifier', () => {
    const xml = `<airport_name ID="SMALL" military="N" apt_ident="1G4" icao_ident="" alnum="3">${record(
      'ODP',
      'CANYON ONE (OBSTACLE)',
      'CANYN1.PGS'
    )}</airport_name>`;
    expect([...parseFaaObstacleDepartures(xml).get('1G4')!]).toEqual(['CANYN1']);
  });
});

describe('markObstacleDepartures', () => {
  it('marks the matching SIDs at that airport only', () => {
    const index = parseFaaObstacleDepartures(metafile);
    const sids: { name: string; obstacle?: boolean }[] = [{ name: 'MONMT3' }, { name: 'JNC1' }];
    markObstacleDepartures(sids, index, 'kgjt');
    expect(sids).toEqual([{ name: 'MONMT3', obstacle: true }, { name: 'JNC1' }]);

    const elsewhere: { name: string; obstacle?: boolean }[] = [{ name: 'MONMT3' }];
    markObstacleDepartures(elsewhere, index, 'KDEN');
    expect(elsewhere).toEqual([{ name: 'MONMT3' }]);
  });
});
