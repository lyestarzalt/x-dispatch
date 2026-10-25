import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';
import { importFmsFile } from './importFms';

// electron-log's renderer transport waits for the main process, which a node test never has.
vi.mock('@/lib/utils/loggerRenderer', () => {
  const scope = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { default: new Proxy({}, { get: () => scope }) };
});

// As SimBrief writes it.
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

beforeEach(() => {
  usePlanBuilderStore.getState().reset();
  usePlanBuilderStore.setState({ isOpen: false });
});

describe('importFmsFile', () => {
  it('opens the planner on the file with the airports named from the list', () => {
    const ok = importFmsFile(simBrief, [{ icao: 'LEMD', name: 'Madrid Barajas' }]);
    expect(ok).toBe(true);
    const state = usePlanBuilderStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.departure).toMatchObject({ icao: 'LEMD', name: 'Madrid Barajas', runway: '36L' });
    expect(state.arrival).toMatchObject({ icao: 'LEZL', runway: '27' });
    expect(state.routeText).toBe('VTB N10 HIJ');
    expect(state.cruiseAltitudeFt).toBe(31000);
    expect(state.filedProcedures).toEqual({ sid: { name: 'VTB2X' }, star: { name: 'HIJ4E' } });
  });

  it('refuses a file that is not an .fms and leaves the planner alone', () => {
    expect(importFmsFile('not a plan', [])).toBe(false);
    expect(usePlanBuilderStore.getState().isOpen).toBe(false);
  });
});

// As the Zibo 737's MCDU writes it: the X-Plane 10 format, with the runway as a fix.
const zibo = `I
3 version
0
5
1 LFLS 0 45.362936111 5.332663889
11 BELUS 0 45.675277778 5.593888889
11 INDIS 0 46.024444444 5.797
11 RW04 0 46.228019418293 6.0942099234697
11 SPR 0 46.468694444 6.448055556
1 LSGG 0 46.238333333 6.109444444
`;

describe('importFmsFile (version 3)', () => {
  it('opens the planner on an X-Plane 10 format file', () => {
    expect(importFmsFile(zibo, [{ icao: 'LSGG', name: 'Geneva' }])).toBe(true);
    const state = usePlanBuilderStore.getState();
    expect(state.departure).toMatchObject({ icao: 'LFLS' });
    expect(state.arrival).toMatchObject({ icao: 'LSGG', name: 'Geneva', runway: '04' });
    expect(state.routeText).toBe('BELUS INDIS');
    expect(state.cruiseAltitudeFt).toBeNull();
  });
});
