import { describe, expect, it } from 'vitest';
import { parseCIFP } from './cifpParser';

// Le Luc: every SID is a single common route published for one runway, no runway transitions.
const LFMC = `
SID:010,2,GILON1,RW09, , , , ,    , ,   ,CD, ,LUC,LF,D, ,      ,    ,    ,0870,0085, ,     ,     ,05000, ,   ,    ,   , , , , , , , , ;
SID:020,2,GILON1,RW09,LUC,LF,D, ,V   ,L,   ,CF,Y,LUC,LF,D, ,      ,0000,0000,2490,0090, ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
SID:030,2,GILON1,RW09,GILON,LF,E,A,EE  , ,   ,TF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
SID:010,2,GILON2,RW27,LUC,LF,D, ,V   , ,   ,DF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
SID:020,2,GILON2,RW27,GILON,LF,E,A,EE  , ,   ,TF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
SID:010,2,ALL1,ALL,LUC,LF,D, ,V   , ,   ,DF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
`;

// Doha: RNAV SIDs are a type 5 common route per runway; DEMBO3 adds type 6 enroute transitions.
const OTHH = `
SID:010,5,BUND2C,RW16R,IVENA,OT,P,C,E   , ,010,CF, ,DIA,OT,D, ,      ,1433,0093,1560,0097,+,02500,     ,13000, ,   ,    ,   ,OTHH,OT,P,A, , , , ;
SID:020,5,BUND2C,RW16R,BUNDU,OB,E,A,EE  , ,010,TF, , , , , ,      ,    ,    ,    ,    ,-,FL250,     ,     , ,   ,    ,   , , , , , , , , ;
SID:010,5,BUND2E,RW34R,IVENA,OT,P,C,E   , ,010,CF, ,DIA,OT,D, ,      ,1433,0093,1560,0097,+,02500,     ,13000, ,   ,    ,   ,OTHH,OT,P,A, , , , ;
SID:020,5,BUND2E,RW34R,BUNDU,OB,E,A,EE  , ,010,TF, , , , , ,      ,    ,    ,    ,    ,-,FL250,     ,     , ,   ,    ,   , , , , , , , , ;
SID:010,5,DEMBO3,RW34R,IVENA,OT,P,C,E   , ,010,CF, ,DIA,OT,D, ,      ,1433,0093,1560,0097,+,02500,     ,13000, ,   ,    ,   ,OTHH,OT,P,A, , , , ;
SID:020,5,DEMBO3,RW34R,DEMBO,OT,E,A,E   , ,010,TF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
SID:010,6,DEMBO3,DATRI,DEMBO,OT,E,A,E   , ,010,IF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
SID:020,6,DEMBO3,DATRI,DATRI,OT,E,A,EE  , ,010,TF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
SID:010,6,DEMBO3,ULIKA,DEMBO,OT,E,A,E   , ,010,IF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
SID:020,6,DEMBO3,ULIKA,ULIKA,OT,E,A,EE  , ,010,TF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
`;

// Kennedy: RNAV SID with type 4 runway transitions, a type 5 common route and type 6 enroute
// transitions; conventional STAR with type 1 enroute transitions and a type 2 common route.
const KJFK = `
SID:010,4,DEEZZ5,RW04B, , , , ,    , ,   ,VA, , , , , ,      ,    ,    ,0400,    ,+,00500,     ,     , ,   ,    ,   , , , , , , , , ;
SID:020,4,DEEZZ5,RW04B,DEEZZ,K6,E,A,E   , ,   ,DF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
SID:010,4,DEEZZ5,RW31L, , , , ,    , ,   ,VI, , , , , ,      ,    ,    ,3100,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
SID:020,4,DEEZZ5,RW31L,DEEZZ,K6,E,A,E   , ,   ,CF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
SID:010,5,DEEZZ5, ,DEEZZ,K6,E,A,E  H, ,   ,IF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
SID:020,5,DEEZZ5, ,HEERO,K6,E,A,E   , ,   ,TF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
SID:010,6,DEEZZ5,CANDR,HEERO,K6,E,A,E   , ,   ,IF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
SID:020,6,DEEZZ5,CANDR,CANDR,K6,E,A,EE  , ,   ,TF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
STAR:010,1,PWL2,ALB,ALB,K6,D, ,V   , ,   ,IF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
STAR:020,1,PWL2,ALB,PWL,K6,D, ,VE  , ,   ,TF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
STAR:010,2,PWL2,ALL,PWL,K6,D, ,VE  , ,   ,IF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
STAR:020,2,PWL2,ALL,LOVES,K6,E,A,E   , ,   ,TF, , , , , ,      ,    ,    ,    ,    , ,     ,     ,     , ,   ,    ,   , , , , , , , , ;
`;

const variants = (list: { name: string; runway: string | null; transition: string | null }[]) =>
  list.map((p) => `${p.name}/${p.runway ?? '-'}/${p.transition ?? '-'}`).sort();

// Real CIFP lines (X-Plane 12 Custom Data/CIFP), verified field-by-field against atools'
// ProcedureFieldIndex enum (src/fs/xp/xpcifpreader.cpp) - the authoritative field map Little
// Navmap's own backend uses. Kept as single-line fixtures for the fields they each exercise.

// LFMN D22LB (Nice VOR/DME 22L): AF leg off AZR DME (recNavaid/theta/rho = arc radius),
// transitioning onto an HM hold-in-lieu-of-PT with a speed-at-or-below restriction.
const LFMN_AF_LEG =
  'APPCH:040,A,D22LB,MUS,D099T,LF,P,C,E   ,L,   ,AF, ,AZR,LF,D, ,      ,0990,0200,1450,    ,+,04000,     ,     ,-,200,    ,   , , , , , ,0, ,S;';
const LFMN_HM_LEG =
  'APPCH:070,D,D22LB, ,NERAS,LF,E,A,EE H,R,   ,HM, , , , , ,      ,    ,    ,2960,0050, ,03000,     ,     ,-,230,    ,   , , , , , ,0, ,S;';

// RJTT R23 (Haneda RNP transition TTRF1): RF constant-radius arc with its own center fix,
// vertical path angle and a tight 0.3 NM RNP.
const RJTT_RF_LEG =
  'APPCH:023,R,R23, ,TT303,RJ,P,C,E   ,L,302,RF, , , , , ,003100,    ,    ,    ,0070, ,01496,     ,     ,-,165,-300,   ,TTRF1,RJ,P,C, ,B,P,S;';

// KSUN NDMA (Sun Valley NDB/DME-A): PI procedure turn referencing the LKT navaid.
const KSUN_PI_LEG =
  'APPCH:030,A,NDMA,KINZE,HLE,K1,D,B,E  A,L,   ,PI, ,LKT,K1,D, ,      ,1709,1017,2000,0100,+,08100,     ,     , ,   ,    ,   , , , , , ,0, ,C;';

// DAAG I23 ZEM (Algiers ILS Z 23): ZEM transition into the common final approach, whose missed
// approach (CA/CI/FM-ALR after RW23) is flagged only by DESC_CODE's 3rd character, not route type.
const DAAG_I23_ZEM = `
APPCH:010,A,I23,ZEM,ZEM,DA,D, ,V  H, ,   ,IF, , , , , ,      ,    ,    ,    ,    ,+,FL050,     ,     , ,   ,    ,   , , , , , ,0,D,S;
APPCH:020,A,I23,ZEM,CI23,DA,P,C,EE B, ,   ,CF, ,AG,DA,P,I,      ,0508,0109,2710,0084,+,02300,     ,     , ,   ,    ,   , , , , , ,0,D,S;
APPCH:010,I,I23, ,CI23,DA,P,C,E  I, ,   ,IF, ,AG,DA,P,I,      ,0508,0109,    ,    ,J,02300,02300,     , ,   ,    ,   , , , , , ,0,D,S;
APPCH:020,I,I23, ,FI23,DA,P,C,E  F, ,   ,CF, ,AG,DA,P,I,      ,0508,0089,2310,0020,H,02300,02300,     , ,   ,-300,   ,ZEM,DA,D, , ,0,D,S;
APPCH:030,I,I23, ,RW23,DA,P,G,G  M, ,   ,CF, ,AG,DA,P,I,      ,0508,0021,2310,0068, ,00131,     ,     , ,   ,-300,   , , , , , ,0,D,S;
APPCH:040,I,I23, , , , , ,  M , ,   ,CA, , , , , ,      ,    ,    ,2310,    ,+,00660,     ,     , ,   ,    ,   , , , , , ,0,D,S;
APPCH:050,I,I23, , , , , ,    , ,   ,CI, , , , , ,      ,    ,    ,3130,    , ,     ,     ,     ,-,190,    ,   , , , , , ,0,D,S;
APPCH:060,I,I23, ,ALR,DA,D, ,VE  , ,   ,FM, ,ALR,DA,D, ,      ,0000,0000,3430,    , ,02470,     ,     , ,   ,    ,   , , , , , ,0,D,S;
`;

/**
 * Build a synthetic CIFP data line from field overrides, indexed exactly like atools'
 * ProcedureFieldIndex (shifted down by 1, since we split off the TYPE: prefix separately).
 * Defaults to a minimal TF leg to AZELE/ZZ so only the overridden fields vary.
 */
function buildLine(overrides: Record<number, string>): string {
  const fields: string[] = [
    '010', // 0 seq
    '2', // 1 route type
    'TEST1', // 2 name
    'RW09', // 3 runway/trans
    'AZELE', // 4 fix
    'ZZ', // 5 fix region
    'E', // 6 fix type
    'A', // 7 sub code
    'E', // 8 desc code
    '', // 9 turn direction
    '', // 10 RNP
    'TF', // 11 path terminator
    '', // 12 TDV
    '', // 13 recd navaid
    '', // 14 recd navaid region
    '', // 15 recd sec code
    '', // 16 recd sub code
    '', // 17 arc radius
    '', // 18 theta
    '', // 19 rho
    '', // 20 mag course
    '', // 21 route dist / hold dist-time
    '', // 22 alt descriptor
    '', // 23 altitude1
    '', // 24 altitude2
    '', // 25 trans alt
    '', // 26 speed descriptor
    '', // 27 speed limit
    '', // 28 vertical angle
    '', // 29 unknown
    '', // 30 center fix
    '', // 31 center fix region
    '', // 32 center sec code
    '', // 33 center sub code
    '', // 34 multi code
    '', // 35 gnss/fms indicator
    '', // 36 route qual 1
    '', // 37 route qual 2
  ];
  for (const [idx, value] of Object.entries(overrides)) fields[Number(idx)] = value;
  return `SID:${fields.join(',')};`;
}

describe('parseCIFP', () => {
  it('keeps the runway of a single-runway SID so it can be filtered', () => {
    const { sids } = parseCIFP(LFMC, 'LFMC');
    const byName = Object.fromEntries(sids.map((s) => [s.name, s]));
    expect(byName.GILON1?.runway).toBe('09');
    expect(byName.GILON2?.runway).toBe('27');
    expect(byName.ALL1?.runway).toBeNull();
  });

  it('keeps fix-less course legs with their distance', () => {
    const { sids } = parseCIFP(LFMC, 'LFMC');
    const gilon1 = sids.find((s) => s.name === 'GILON1')!;
    expect(gilon1.waypoints[0]).toMatchObject({ fixId: '', pathTerminator: 'CD', distance: 8.5 });
    expect(gilon1.waypoints[1]).toMatchObject({
      fixId: 'LUC',
      pathTerminator: 'CF',
      turnDirection: 'L',
    });
  });

  it('treats an RNAV common route with a runway as that runway, and type 6 as transitions', () => {
    const { sids } = parseCIFP(OTHH, 'OTHH');
    expect(variants(sids)).toEqual([
      'BUND2C/16R/-',
      'BUND2E/34R/-',
      'DEMBO3/34R/DATRI',
      'DEMBO3/34R/ULIKA',
    ]);
    const datri = sids.find((s) => s.transition === 'DATRI')!;
    expect(datri.waypoints.map((w) => w.fixId)).toEqual(['IVENA', 'DEMBO', 'DATRI']);
  });

  it('pairs every runway transition with every enroute transition', () => {
    const { sids, stars } = parseCIFP(KJFK, 'KJFK');
    expect(variants(sids)).toEqual(['DEEZZ5/04B/CANDR', 'DEEZZ5/31L/CANDR']);
    const rw31 = sids.find((s) => s.runway === '31L')!;
    expect(rw31.waypoints.map((w) => w.fixId)).toEqual(['', 'DEEZZ', 'HEERO', 'CANDR']);
    expect(variants(stars)).toEqual(['PWL2/-/ALB']);
    expect(stars[0]?.waypoints.map((w) => w.fixId)).toEqual(['ALB', 'PWL', 'LOVES']);
  });

  it('reads speed from SPEED_LIMIT, not the TRANS_ALT field at the same old offset', () => {
    // OTHH's BUND2C leg has TRANS_ALT=13000 at data[25] and no real speed constraint - the old
    // code misread data[25] as `speed`, which would have produced 13000 kt.
    const { sids } = parseCIFP(OTHH, 'OTHH');
    const leg = sids.find((s) => s.name === 'BUND2C')!.waypoints[0]!;
    expect(leg.speed).toBeNull();

    const { approaches: rf } = parseCIFP(`\n${RJTT_RF_LEG}\n`, 'RJTT');
    expect(rf[0]?.waypoints[0]).toMatchObject({ speed: 165, speedDescriptor: '-' });
  });

  it('parses altitude2 for a between ("B") constraint', () => {
    const line = buildLine({ 11: 'TF', 22: 'B', 23: '04000', 24: '06000' });
    const { sids } = parseCIFP(`\n${line}\n`, 'TEST');
    expect(sids[0]?.waypoints[0]?.altitude).toMatchObject({
      descriptor: 'B',
      altitude1: 4000,
      altitude2: 6000,
    });
  });

  it('parses the RTE_DIST_HOLD_DIST_TIME field as distance when there is no T prefix', () => {
    const { approaches } = parseCIFP(`\n${LFMN_HM_LEG}\n`, 'LFMN');
    expect(approaches[0]?.waypoints[0]).toMatchObject({
      pathTerminator: 'HM',
      distance: 5,
      holdTimeMin: null,
    });
  });

  it('parses the RTE_DIST_HOLD_DIST_TIME field as minutes when T-prefixed, instead of NaN', () => {
    const line = buildLine({ 11: 'HM', 20: '0900', 21: 'T010' });
    const { sids } = parseCIFP(`\n${line}\n`, 'TEST');
    expect(sids[0]?.waypoints[0]).toMatchObject({ distance: null, holdTimeMin: 1 });
  });

  it('parses recommended navaid, theta and rho for a DME arc (AF) leg', () => {
    const { approaches } = parseCIFP(`\n${LFMN_AF_LEG}\n`, 'LFMN');
    expect(approaches[0]?.waypoints[0]).toMatchObject({
      pathTerminator: 'AF',
      recNavaid: 'AZR',
      recNavaidRegion: 'LF',
      theta: 99,
      rho: 20,
    });
  });

  it('parses arc radius, center fix, vertical angle and RNP for an RF leg', () => {
    const { approaches } = parseCIFP(`\n${RJTT_RF_LEG}\n`, 'RJTT');
    expect(approaches[0]?.waypoints[0]).toMatchObject({
      pathTerminator: 'RF',
      arcRadius: 31,
      centerFix: 'TTRF1',
      centerFixRegion: 'RJ',
      verticalAngle: -3,
      rnp: 0.3,
    });
  });

  it('leaves center fix null on a non-RF leg, even though the file reuses that column for a TAA reference', () => {
    // OTHH's CF leg has "OTHH,OT,P,A" sitting in the CENTER_FIX_OR_TAA_PT columns - that's an
    // airport reference, not a real arc center, and atools itself only treats this column as a
    // center fix for RF legs (procedurewriter.cpp's `pathTerm == "RF"` branch).
    const { sids } = parseCIFP(OTHH, 'OTHH');
    const leg = sids.find((s) => s.name === 'BUND2C')!.waypoints[0]!;
    expect(leg.pathTerminator).toBe('CF');
    expect(leg.centerFix).toBeNull();
  });

  it('parses recommended navaid, theta and rho for a procedure-turn (PI) leg', () => {
    const { approaches } = parseCIFP(`\n${KSUN_PI_LEG}\n`, 'KSUN');
    const pi = approaches[0]?.waypoints.find((w) => w.pathTerminator === 'PI');
    expect(pi).toMatchObject({ recNavaid: 'LKT', recNavaidRegion: 'K1', theta: 170.9, rho: 101.7 });
  });

  it('flags every leg from the Missed Approach Point onward as the missed approach', () => {
    // DAAG I23 ZEM: real procedure whose missed-approach legs (CA/CI/FM after RW23) are not
    // distinguished by route type - the only signal is DESC_CODE's 3rd character ('M'), checked
    // against atools' own `waypointDescr.at(2) == 'M'` (procedurewriter.cpp), which sets it once
    // it's seen and leaves it set for every later leg in the same procedure.
    const { approaches } = parseCIFP(`\n${DAAG_I23_ZEM}\n`, 'DAAG');
    const byFix = approaches[0]!.waypoints;
    const flags = byFix.map((w) => [w.fixId || w.pathTerminator, w.isMissedApproach] as const);
    expect(flags).toEqual([
      ['ZEM', false],
      ['CI23', false],
      ['FI23', false],
      ['RW23', false],
      ['CA', true],
      ['CI', true],
      ['ALR', true],
    ]);
  });
});
