import { describe, expect, it } from 'vitest';
import {
  chartCarriesMapPosition,
  chartTitleTags,
  faaChartIndexFromJson,
  faaChartIndexToJson,
  faaChartUrl,
  groupFaaCharts,
  hasCopterChart,
  ilsOrLocIdentifier,
  markFaaChartNames,
  parseFaaChartIndex,
} from './faaChartIndex';

const record = (code: string, name: string, ident: string, pdf = 'X.PDF', civil = 'C') => `
        <record>
          <chartseq>90100</chartseq>
          <chart_code>${code}</chart_code>
          <chart_name>${name}</chart_name>
          <pdf_name>${pdf}</pdf_name>
          <procuid>1</procuid>
          ${ident ? `<faanfd18>${ident}</faanfd18>` : '<faanfd18/>'}
          <civil>${civil}</civil>
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
    <city_name ID="HONOLULU" volume="SW-4">
      <airport_name ID="DANIEL K INOUYE INTL" military="N" apt_ident="HNL" icao_ident="PHNL" alnum="4">
${record('IAP', 'ILS RWY 08L', '')}
${record('IAP', 'LOC RWY 08L', '')}
${record('IAP', 'ILS Y RWY 04R', '')}
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

  // GitHub #417: the chart titles say ILS OR LOC, so IN_CIFP.txt is no longer needed.
  it('lists the ILS approaches charted with localizer minima, by their CIFP identifier', () => {
    const index = parseFaaChartIndex(metafile);
    expect([...index.ilsOrLoc.get('KGJT')!]).toEqual(['I11']);
    // PHNL charts its ILS and its localizer apart: neither is ILS OR LOC.
    expect(index.ilsOrLoc.has('PHNL')).toBe(false);
  });

  it('reads the cycle the file is for', () => {
    expect(parseFaaChartIndex(metafile).cycle).toBe('2610');
  });

  it('reads nothing from a file that is not the metafile', () => {
    const index = parseFaaChartIndex('KBOS\tSIAP\tI04R');
    expect(
      index.obstacleDepartures.size +
        index.rnavDepartures.size +
        index.rnavArrivals.size +
        index.ilsOrLoc.size
    ).toBe(0);
    expect(index.cycle).toBeNull();
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

// Real titles from cycle 2610, each with the identifier X-Plane's CIFP gives the approach.
describe('ilsOrLocIdentifier', () => {
  it.each([
    ['ILS OR LOC RWY 04R', 'I04R'], // KJFK
    ['ILS OR LOC RWY 4R', 'I04R'],
    ['ILS Y OR LOC Y RWY 05', 'I05-Y'], // KANB
    ['ILS Y OR LOC RWY 28', 'I28-Y'], // KMGM: the variant on the ILS alone
    ['ILS Z OR LOC Z RWY 01L', 'I01LZ'], // KAPC: no dash after a runway letter
    ['HI-ILS Y OR LOC Y RWY 10', 'I10-Y'], // KMGM
    ['HI-ILS OR LOC/DME RWY 03R', 'I03R'], // KLUF
    ['ILS OR LOC/DME Y RWY 06', 'I06-Y'],
  ])('%s is %s', (title, identifier) => {
    expect(ilsOrLocIdentifier(title)).toBe(identifier);
  });

  it.each([
    'ILS RWY 08L', // PHNL: the localizer has a chart of its own
    'LOC RWY 08L',
    'ILS Z RWY 28',
    'COPTER ILS Z OR LOC Z RWY 33', // KMKT: X-Plane's data has no helicopter procedures
    'RNAV (GPS) RWY 04R',
    'LOC/DME BC-B',
  ])('%s is not ILS OR LOC', (title) => {
    expect(ilsOrLocIdentifier(title)).toBeNull();
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

    const elsewhere = { sids: [{ name: 'MONMT3' }], stars: [], approaches: [{ name: 'I11' }] };
    markFaaChartNames(elsewhere, index, 'KDEN');
    expect(elsewhere.sids).toEqual([{ name: 'MONMT3' }]);
    expect(elsewhere.approaches).toEqual([{ name: 'I11' }]);
  });

  it('marks the ILS approaches charted as ILS OR LOC', () => {
    const kgjt = { sids: [], stars: [], approaches: [{ name: 'I11' }, { name: 'R11' }] };
    markFaaChartNames(kgjt, parseFaaChartIndex(metafile), 'KGJT');
    expect(kgjt.approaches).toEqual([{ name: 'I11', orLocalizer: true }, { name: 'R11' }]);
  });
});

describe('faaChartIndexToJson', () => {
  it('survives the trip through the download cache', () => {
    const index = parseFaaChartIndex(metafile);
    const back = faaChartIndexFromJson(JSON.parse(JSON.stringify(faaChartIndexToJson(index))));
    expect(back).toEqual(index);
  });

  it('refuses a cache that is not one', () => {
    expect(faaChartIndexFromJson({ cycle: 2610 })).toBeNull();
    expect(faaChartIndexFromJson(null)).toBeNull();
  });
});

describe('chartTitleTags', () => {
  it('orders the tags as a chart title does', () => {
    expect(chartTitleTags({ rnav: true, obstacle: true })).toEqual(['obstacle', 'rnav']);
    expect(chartTitleTags({ rnav: true })).toEqual(['rnav']);
    expect(chartTitleTags({})).toEqual([]);
  });

  it('puts COPTER before RNAV, as HUDSN ONE (COPTER) (RNAV) is titled', () => {
    expect(chartTitleTags({ rnav: true, helicopter: true })).toEqual(['copter', 'rnav']);
  });
});

// The West 30th Street heliport as the FAA lists it (GitHub #432), beside an airport with no
// helicopter chart.
describe('hasCopterChart', () => {
  const index = parseFaaChartIndex(`<digital_tpp cycle="2611">
      <airport_name ID="WEST 30TH ST" military="N" apt_ident="JRA" icao_ident="KJRA" alnum="10972">
${record('IAP', 'COPTER RNAV (GPS) 210', '', '10972COPTERR210.PDF')}
${record('DP', 'HUDSN ONE (COPTER) (RNAV)', 'HUDSN1.YOMAN', '10972HUDSN.PDF')}
      </airport_name>
      <airport_name ID="SEATTLE-TACOMA INTL" military="N" apt_ident="SEA" icao_ident="KSEA" alnum="582">
${record('IAP', 'ILS OR LOC RWY 16C', '', '00582IL16C.PDF')}
      </airport_name>
</digital_tpp>`);

  it('is true where a chart is titled COPTER', () => {
    expect(hasCopterChart(index, 'kjra')).toBe(true);
  });

  it('is false elsewhere and for an airport the list does not have', () => {
    expect(hasCopterChart(index, 'KSEA')).toBe(false);
    expect(hasCopterChart(index, 'EGLL')).toBe(false);
  });
});

// KSEA as the FAA lists it in cycle 2612, one chart of each kind and a continuation page.
const kseaCharts = `<digital_tpp cycle="2612">
      <airport_name ID="SEATTLE-TACOMA INTL" military="N" apt_ident="SEA" icao_ident="KSEA" alnum="582">
${record('MIN', 'TAKEOFF MINIMUMS', '', 'NW1TO.PDF')}
${record('MIN', 'DIVERSE VECTOR AREA', '', 'NW1TO.PDF')}
${record('HOT', 'HOT SPOT', '', 'NW1HOTSPOT.PDF')}
${record('STR', 'CHINS FIVE', 'BTG.CHINS5', '00582CHINS.PDF')}
${record('STR', 'CHINS FIVE, CONT.1', 'BTG.CHINS5', '00582CHINS_C.PDF')}
${record('IAP', 'ILS OR LOC RWY 16C', '', '00582IL16C.PDF')}
${record('APD', 'AIRPORT DIAGRAM', '', '00582AD.PDF')}
${record('DP', 'BANGR NINE (RNAV)', 'BANGR9.BANGR', '00582BANGR.PDF')}
${record('IAP', 'NOT A CHART', '', '../../evil.exe')}
      </airport_name>
</digital_tpp>`;

describe('airport charts', () => {
  it('keeps every chart of an airport with its title and PDF, in the FAA order', () => {
    const charts = parseFaaChartIndex(kseaCharts).charts.get('KSEA')!;
    expect(charts.map((c) => `${c.code} ${c.name} ${c.pdf}`)).toEqual([
      'MIN TAKEOFF MINIMUMS NW1TO.PDF',
      'MIN DIVERSE VECTOR AREA NW1TO.PDF',
      'HOT HOT SPOT NW1HOTSPOT.PDF',
      'STR CHINS FIVE 00582CHINS.PDF',
      'STR CHINS FIVE, CONT.1 00582CHINS_C.PDF',
      'IAP ILS OR LOC RWY 16C 00582IL16C.PDF',
      'APD AIRPORT DIAGRAM 00582AD.PDF',
      'DP BANGR NINE (RNAV) 00582BANGR.PDF',
    ]);
  });

  it('leaves out a record whose PDF name is not a plain file name', () => {
    const charts = parseFaaChartIndex(kseaCharts).charts.get('KSEA')!;
    expect(charts.some((c) => c.name === 'NOT A CHART')).toBe(false);
  });

  it('survives the download cache', () => {
    const index = parseFaaChartIndex(kseaCharts);
    const back = faaChartIndexFromJson(JSON.parse(JSON.stringify(faaChartIndexToJson(index))));
    expect(back!.charts.get('KSEA')).toEqual(index.charts.get('KSEA'));
  });

  it('rejects a cache written before charts were kept, so it is downloaded again', () => {
    const { charts: _charts, ...old } = faaChartIndexToJson(parseFaaChartIndex(kseaCharts));
    expect(faaChartIndexFromJson(old)).toBeNull();
  });

  it('marks the approach chart as carrying its map position, and nothing else at KSEA', () => {
    const charts = parseFaaChartIndex(kseaCharts).charts.get('KSEA')!;
    expect(charts.filter((c) => c.mapPosition).map((c) => c.name)).toEqual(['ILS OR LOC RWY 16C']);
  });

  it('knows which charts carry a map position from how the FAA lists them', () => {
    // Checked against the PDFs of cycle 2612.
    expect(chartCarriesMapPosition('IAP', 'ILS OR LOC RWY 16C', 'C')).toBe(true);
    // Joint-use field (KCHS): an FAA chart.
    expect(chartCarriesMapPosition('IAP', 'VOR/DME OR TACAN RWY 33', 'D')).toBe(true);
    // Military field (KNUW TACAN Y RWY 25) and high-altitude charts: Department of Defense.
    expect(chartCarriesMapPosition('IAP', 'TACAN Y RWY 25', 'N')).toBe(false);
    expect(chartCarriesMapPosition('IAP', 'HI-TACAN Z RWY 07', 'H')).toBe(false);
    // A charted visual (KJFK) and a continuation page have no plan view to place.
    expect(chartCarriesMapPosition('IAP', 'BELMONT VISUAL RWY 22L', 'C')).toBe(false);
    expect(chartCarriesMapPosition('IAP', 'ILS OR LOC RWY 16C, CONT.1', 'C')).toBe(false);
    expect(chartCarriesMapPosition('APD', 'AIRPORT DIAGRAM', 'C')).toBe(false);
    expect(chartCarriesMapPosition('DP', 'BANGR NINE (RNAV)', 'C')).toBe(false);
  });

  it('builds the PDF address in the cycle folder', () => {
    expect(faaChartUrl('2612', '00582IL16C.PDF')).toBe(
      'https://aeronav.faa.gov/d-tpp/2612/00582IL16C.PDF'
    );
  });

  it('groups charts the way a pilot looks for them', () => {
    const groups = groupFaaCharts(parseFaaChartIndex(kseaCharts).charts.get('KSEA')!);
    expect(groups.map((g) => [g.group, g.charts.map((c) => c.name)])).toEqual([
      ['airport', ['AIRPORT DIAGRAM', 'HOT SPOT']],
      ['departures', ['BANGR NINE (RNAV)']],
      ['arrivals', ['CHINS FIVE', 'CHINS FIVE, CONT.1']],
      ['approaches', ['ILS OR LOC RWY 16C']],
      ['minimums', ['TAKEOFF MINIMUMS', 'DIVERSE VECTOR AREA']],
    ]);
  });
});
