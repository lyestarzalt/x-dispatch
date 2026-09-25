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
});
