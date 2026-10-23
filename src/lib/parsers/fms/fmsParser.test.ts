import { describe, expect, it } from 'vitest';
import { parseFMSFile } from './fmsParser';

// Real files pilots sent in, each from a different planner. They differ in header order, in
// whether the transition lines name a published transition, and in whether NUMENR is right.

const flyCharts = `I
1100 Version
CYCLE 2609
ADEP LEMD
DEPRWY RW36L
ADES LEPA
DESRWY RW24L
NUMENR 20
SID NAND3N
SIDTRANS NANDO
STAR GODO4P
STARTRANS GODOX
1 LEMD ADEP 1998.000000 40.472222 -3.560833
11 NANDO DRCT 31000.000000 39.988861 -2.174556
11 FENXE T257 31000.000000 39.722139 -1.548806
11 MABUX T257 31000.000000 39.549194 -1.149750
11 RETBA T257 31000.000000 39.443667 -0.908778
11 MOPIR M871 31000.000000 39.412444 -0.837833
11 LASPO M871 31000.000000 39.282556 -0.544389
11 ORVUS M871 31000.000000 39.331611 0.431306
11 GODOX M871 31000.000000 39.372611 1.410750
1 LEPA ADES 27.000000 39.551667 2.738889
`;

const simBrief = `I
1100 Version
CYCLE 2606
ADEP LEMD
DEPRWY RW36L
SID VTB2X
ADES LEZL
DESRWY RW27
STAR HIJ4E
NUMENR 6
1 LEMD ADEP 1998.000000 40.472222 -3.560833
3 VTB DRCT 30800.000000 39.780750 -3.464028
11 INPAN N10 31000.000000 39.566111 -3.746111
11 CRISA N10 31000.000000 38.938611 -4.556389
3 HIJ N10 30600.000000 38.508139 -5.099694
1 LEZL ADES 2600.000000 37.418056 -5.898889
`;

const littleNavmap = `I
1100 Version
CYCLE 2606
ADEP LEMD
DEPRWY RW14L
SID VTB3V
ADES LEZL
DESRWY RW27
STAR HIJ4E
APP I27-Z
APPTRANS RUVEN
NUMENR 4
1 LEMD ADEP 1998.000000 40.472221 -3.560833
11 INPAN N10 27451.097656 39.566113 -3.746111
11 CRISA N10 30000.000000 38.938610 -4.556389
1 LEZL ADES 105.000000 37.418056 -5.898889
`;

describe('parseFMSFile', () => {
  it('reads SID and STAR lines written after NUMENR, and every row despite a wrong count', () => {
    const plan = parseFMSFile(flyCharts).data!;
    expect(plan.departure).toEqual({
      icao: 'LEMD',
      runway: '36L',
      sid: 'NAND3N',
      sidTransition: 'NANDO',
    });
    expect(plan.arrival).toEqual({
      icao: 'LEPA',
      runway: '24L',
      star: 'GODO4P',
      starTransition: 'GODOX',
    });
    expect(plan.waypoints.map((w) => w.id)).toEqual([
      'LEMD',
      'NANDO',
      'FENXE',
      'MABUX',
      'RETBA',
      'MOPIR',
      'LASPO',
      'ORVUS',
      'GODOX',
      'LEPA',
    ]);
  });

  it('keeps a SID and STAR filed without transitions', () => {
    const plan = parseFMSFile(simBrief).data!;
    expect(plan.departure).toEqual({ icao: 'LEMD', runway: '36L', sid: 'VTB2X' });
    expect(plan.arrival).toEqual({ icao: 'LEZL', runway: '27', star: 'HIJ4E' });
    expect(plan.waypoints.map((w) => `${w.id}/${w.via}`)).toEqual([
      'LEMD/ADEP',
      'VTB/DRCT',
      'INPAN/N10',
      'CRISA/N10',
      'HIJ/N10',
      'LEZL/ADES',
    ]);
  });

  it('keeps the approach name when a transition line follows it', () => {
    const plan = parseFMSFile(littleNavmap).data!;
    expect(plan.departure).toEqual({ icao: 'LEMD', runway: '14L', sid: 'VTB3V' });
    expect(plan.arrival).toEqual({
      icao: 'LEZL',
      runway: '27',
      star: 'HIJ4E',
      approach: 'I27-Z',
      approachTransition: 'RUVEN',
    });
    expect(plan.waypoints.map((w) => w.id)).toEqual(['LEMD', 'INPAN', 'CRISA', 'LEZL']);
  });

  it('keeps the procedure names when the transition lines come first', () => {
    const text = simBrief
      .replace('SID VTB2X\n', 'SIDTRANS VTB\nSID VTB2X\n')
      .replace('STAR HIJ4E\n', 'STARTRANS HIJ\nSTAR HIJ4E\n');
    const plan = parseFMSFile(text).data!;
    expect(plan.departure.sid).toBe('VTB2X');
    expect(plan.departure.sidTransition).toBe('VTB');
    expect(plan.arrival.star).toBe('HIJ4E');
    expect(plan.arrival.starTransition).toBe('HIJ');
  });

  it('rejects a file without the header', () => {
    expect(parseFMSFile('hello\n').success).toBe(false);
  });
});
