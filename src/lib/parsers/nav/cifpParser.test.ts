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

describe('parseCIFP', () => {
  it('keeps the runway of a single-runway SID so it can be filtered', () => {
    const { sids } = parseCIFP(LFMC, 'LFMC');
    const byName = Object.fromEntries(sids.map((s) => [s.name, s]));
    expect(byName.GILON1?.runway).toBe('RW09');
    expect(byName.GILON2?.runway).toBe('RW27');
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
});
