import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanEndpoint } from '@/lib/flightplan/builder/types';
import type { EnrichedFlightPlan } from '@/types/fms';
import { useFlightPlanStore } from './flightPlanStore';
import { routerOwnsRoute, usePlanBuilderStore } from './planBuilderStore';

// electron-log's renderer transport waits for the main process, which a node test never has.
vi.mock('@/lib/utils/loggerRenderer', () => {
  const scope = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { default: new Proxy({}, { get: () => scope }) };
});

const LFMC = { icao: 'LFMC', name: 'Le Luc Le Cannet', latitude: 43.38, longitude: 6.39 };
const LFLN = { icao: 'LFLN', name: 'Saint Yan', latitude: 46.41, longitude: 4.01 };

/** A builder that has drawn its plan on the map. */
function drawnPlan() {
  usePlanBuilderStore.setState({
    departure: LFMC as PlanEndpoint,
    arrival: LFLN as PlanEndpoint,
    routeText: 'XATEL UY30 MTL',
    cruiseAltitudeFt: 5000,
    status: 'ready',
    result: {} as never,
  });
  useFlightPlanStore.setState({
    fmsData: { waypoints: [] } as unknown as EnrichedFlightPlan,
    fileName: 'LFMC-LFLN',
    showFlightPlanBar: true,
  });
}

beforeEach(() => {
  usePlanBuilderStore.getState().reset();
  useFlightPlanStore.getState().clearFlightPlan();
});

describe('planBuilderStore — starting over', () => {
  it('reset empties the planner and removes its plan from the map', () => {
    drawnPlan();
    usePlanBuilderStore.getState().reset();

    const builder = usePlanBuilderStore.getState();
    expect(builder.departure).toBeNull();
    expect(builder.arrival).toBeNull();
    expect(builder.routeText).toBe('');
    expect(builder.cruiseAltitudeFt).toBeNull();
    expect(useFlightPlanStore.getState().fmsData).toBeNull();
  });

  it('reset hands back the draft so the user can undo it', () => {
    drawnPlan();
    usePlanBuilderStore.setState({ alternate: LFMC as PlanEndpoint, aircraftClass: 'prop' });
    const previous = usePlanBuilderStore.getState().reset();
    usePlanBuilderStore.getState().restoreDraft(previous);

    const builder = usePlanBuilderStore.getState();
    expect(builder.departure?.icao).toBe('LFMC');
    expect(builder.arrival?.icao).toBe('LFLN');
    expect(builder.alternate?.icao).toBe('LFMC');
    expect(builder.routeText).toBe('XATEL UY30 MTL');
    expect(builder.cruiseAltitudeFt).toBe(5000);
    expect(builder.aircraftClass).toBe('prop');
    expect(builder.status).toBe('idle');
  });

  it('clearing an airport removes the drawn plan', () => {
    drawnPlan();
    usePlanBuilderStore.getState().setDeparture(null);

    expect(usePlanBuilderStore.getState().departure).toBeNull();
    expect(usePlanBuilderStore.getState().arrival?.icao).toBe('LFLN');
    expect(useFlightPlanStore.getState().fmsData).toBeNull();
  });

  it('clearing an airport leaves a plan the planner did not draw', () => {
    useFlightPlanStore.setState({
      fmsData: { waypoints: [] } as unknown as EnrichedFlightPlan,
      fileName: 'simbrief.fms',
    });
    usePlanBuilderStore.setState({ arrival: LFLN as PlanEndpoint });
    usePlanBuilderStore.getState().setArrival(null);

    expect(useFlightPlanStore.getState().fmsData).not.toBeNull();
  });
});

describe('planBuilderStore — auto route via a chosen NAT track', () => {
  it('sends the chosen track with the request and keeps the returned route', async () => {
    const autoRoute = vi.fn().mockResolvedValue({ routeText: 'MALOT NATA 5250N', distanceNm: 1 });
    vi.stubGlobal('window', { flightPlanAPI: { autoRoute } });
    usePlanBuilderStore.setState({
      departure: { icao: 'EIDW', latitude: 53.4, longitude: -6.3 } as PlanEndpoint,
      arrival: { icao: 'KJFK', latitude: 40.6, longitude: -73.8 } as PlanEndpoint,
    });
    const ok = await usePlanBuilderStore.getState().autoRoute(undefined, 'NATA');
    expect(ok).toBe(true);
    expect(autoRoute).toHaveBeenCalledWith(expect.objectContaining({ track: 'NATA' }));
    expect(usePlanBuilderStore.getState().routeText).toBe('MALOT NATA 5250N');
    // The dialog re-routes on a cruise change only while the route is still the router's.
    expect(usePlanBuilderStore.getState().autoRoutedText).toBe('MALOT NATA 5250N');
    usePlanBuilderStore.getState().setRouteText('MALOT NATA 5250N DCT XYZ');
    expect(usePlanBuilderStore.getState().autoRoutedText).toBe('MALOT NATA 5250N');
    vi.unstubAllGlobals();
  });
});

const choice = (name: string) => ({ name, transition: null });

describe('planBuilderStore — swapping ends', () => {
  it('starts the return leg over: route, cruise, alternate and procedures are re-suggested', () => {
    usePlanBuilderStore.setState({
      departure: { ...LFMC, runway: '13', sid: choice('LUC1A') } as PlanEndpoint,
      arrival: {
        ...LFLN,
        runway: '15',
        star: choice('YAN2B'),
        approach: choice('I15'),
      } as PlanEndpoint,
      alternate: LFMC as PlanEndpoint,
      routeText: 'XATEL UY30 MTL',
      cruiseAltitudeFt: 35000,
      status: 'ready',
      result: {} as never,
      procedures: { sid: {} as never },
      savedPath: '/tmp/LFMC-LFLN.fms',
    });
    usePlanBuilderStore.getState().swapEndpoints();
    const state = usePlanBuilderStore.getState();
    expect(state.departure).toMatchObject({ icao: 'LFLN', runway: '15' });
    expect(state.departure?.sid).toBeUndefined();
    expect(state.departure?.star).toBeUndefined();
    expect(state.arrival).toMatchObject({ icao: 'LFMC', runway: '13' });
    expect(state.arrival?.sid).toBeUndefined();
    expect(state.arrival?.approach).toBeUndefined();
    expect(state.routeText).toBe('');
    expect(state.cruiseAltitudeFt).toBeNull();
    expect(state.alternate).toBeNull();
    expect(state.result).toBeNull();
    expect(state.procedures).toEqual({});
    expect(state.savedPath).toBeNull();
  });

  it('swaps a single endpoint without inventing the other', () => {
    usePlanBuilderStore.setState({ departure: LFMC as PlanEndpoint, arrival: null });
    usePlanBuilderStore.getState().swapEndpoints();
    expect(usePlanBuilderStore.getState().departure).toBeNull();
    expect(usePlanBuilderStore.getState().arrival?.icao).toBe('LFMC');
  });
});

describe('planBuilderStore — resolving router output', () => {
  it('resolves the routed text straight away and not again for the same draft', async () => {
    const autoRoute = vi.fn().mockResolvedValue({ routeText: 'MALOT NATA 5250N', distanceNm: 1 });
    const resolveRoute = vi
      .fn()
      .mockResolvedValue({ plan: { waypoints: [] }, tokens: [], distanceNm: 1, enriched: {} });
    vi.stubGlobal('window', { flightPlanAPI: { autoRoute, resolveRoute } });
    usePlanBuilderStore.setState({
      departure: { icao: 'EIDW', latitude: 53.4, longitude: -6.3 } as PlanEndpoint,
      arrival: { icao: 'KJFK', latitude: 40.6, longitude: -73.8 } as PlanEndpoint,
    });
    await usePlanBuilderStore.getState().autoRoute();
    expect(resolveRoute).toHaveBeenCalledTimes(1);
    expect(resolveRoute.mock.calls[0]![0]).toMatchObject({ routeText: 'MALOT NATA 5250N' });
    expect(usePlanBuilderStore.getState().status).toBe('ready');
    // The dialog's debounced resolve follows; the draft has not changed, so nothing is sent.
    await usePlanBuilderStore.getState().resolve();
    expect(resolveRoute).toHaveBeenCalledTimes(1);
    // An edit is a new draft and resolves again.
    usePlanBuilderStore.getState().setRouteText('MALOT NATB 5250N');
    await usePlanBuilderStore.getState().resolve();
    expect(resolveRoute).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});

describe('planBuilderStore — adjust cruise altitude', () => {
  it('moves the cruise into the airway band on the hemispheric level', () => {
    usePlanBuilderStore.setState({
      departure: LFMC as PlanEndpoint,
      arrival: LFLN as PlanEndpoint,
      cruiseAltitudeFt: 18000,
      status: 'ready',
      savedPath: '/tmp/LFMCLFLN.fms',
      result: { levels: { minFt: 24500, maxFt: 46000 } } as never,
    });
    usePlanBuilderStore.getState().adjustCruiseAltitude();
    // Le Luc to Saint Yan heads north-west: even thousands.
    expect(usePlanBuilderStore.getState().cruiseAltitudeFt).toBe(26000);
    expect(usePlanBuilderStore.getState().savedPath).toBeNull();
  });

  it('does nothing without a resolved route', () => {
    usePlanBuilderStore.setState({ cruiseAltitudeFt: 18000, result: null });
    usePlanBuilderStore.getState().adjustCruiseAltitude();
    expect(usePlanBuilderStore.getState().cruiseAltitudeFt).toBe(18000);
  });
});

describe('planBuilderStore — Explore flyout', () => {
  it('openExplore opens the planner with that tab showing', () => {
    usePlanBuilderStore.getState().openExplore('routes');

    const builder = usePlanBuilderStore.getState();
    expect(builder.isOpen).toBe(true);
    expect(builder.explore).toBe('routes');
  });

  it('closing the planner puts the flyout away too', () => {
    usePlanBuilderStore.getState().openExplore('weather');
    usePlanBuilderStore.getState().close();

    expect(usePlanBuilderStore.getState().explore).toBeNull();
  });

  it('setExplore(null) keeps the planner open', () => {
    usePlanBuilderStore.getState().openExplore('random');
    usePlanBuilderStore.getState().setExplore(null);

    const builder = usePlanBuilderStore.getState();
    expect(builder.isOpen).toBe(true);
    expect(builder.explore).toBeNull();
  });
});

describe('planBuilderStore — whose route it is', () => {
  it('the router owns the route it wrote', () => {
    expect(routerOwnsRoute({ routeText: 'XATEL UY30 MTL', autoRoutedText: 'XATEL UY30 MTL' })).toBe(
      true
    );
  });

  it('a route the pilot typed or edited is theirs, so a class change keeps it', () => {
    expect(routerOwnsRoute({ routeText: 'BX LGM TFN', autoRoutedText: null })).toBe(false);
    expect(
      routerOwnsRoute({ routeText: 'XATEL UY30 MTL DCT', autoRoutedText: 'XATEL UY30 MTL' })
    ).toBe(false);
  });

  it('an empty field is nobody’s route', () => {
    expect(routerOwnsRoute({ routeText: '', autoRoutedText: '' })).toBe(false);
  });
});

describe('planBuilderStore — loading an .fms file', () => {
  const draft = {
    departure: { ...LFMC, runway: '13' },
    arrival: { ...LFLN, runway: '15' },
    routeText: 'XATEL UY30 MTL',
    cruiseAltitudeFt: 31000,
    filed: { sid: { name: 'LUC1A', transition: 'XATEL' }, star: { name: 'YAN2B' } },
  };

  it('opens the planner on the file: ends, runways, route, cruise and the filed procedures', () => {
    usePlanBuilderStore.getState().loadFromFms(draft);
    const state = usePlanBuilderStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.departure).toMatchObject({ icao: 'LFMC', runway: '13' });
    expect(state.arrival).toMatchObject({ icao: 'LFLN', runway: '15' });
    expect(state.routeText).toBe('XATEL UY30 MTL');
    expect(state.cruiseAltitudeFt).toBe(31000);
    expect(state.filedProcedures).toEqual(draft.filed);
    expect(state.result).toBeNull();
    expect(state.routeNotes).toEqual([]);
    expect(state.savedPath).toBeNull();
  });

  it('replaces whatever the planner had drawn before', () => {
    drawnPlan();
    usePlanBuilderStore.setState({
      alternate: LFMC as PlanEndpoint,
      procedures: { sid: {} as never },
    });
    usePlanBuilderStore.getState().loadFromFms(draft);
    const state = usePlanBuilderStore.getState();
    expect(useFlightPlanStore.getState().fmsData).toBeNull();
    expect(state.alternate).toBeNull();
    expect(state.procedures).toEqual({});
  });

  it('forgets the filed procedures once the dialog has taken them', () => {
    usePlanBuilderStore.getState().loadFromFms(draft);
    usePlanBuilderStore.getState().setFiledProcedures(null);
    expect(usePlanBuilderStore.getState().filedProcedures).toBeNull();
  });
});

describe('planBuilderStore — panel size', () => {
  it('opens at full size every time, and forgets a half or rail size on close', () => {
    const store = usePlanBuilderStore.getState();
    store.open();
    store.setPanel('rail');
    expect(usePlanBuilderStore.getState().panel).toBe('rail');
    store.open();
    expect(usePlanBuilderStore.getState().panel).toBe('full');
    store.setPanel('half');
    store.close();
    expect(usePlanBuilderStore.getState()).toMatchObject({ isOpen: false, panel: 'full' });
    store.setPanel('rail');
    store.openExplore('random');
    expect(usePlanBuilderStore.getState().panel).toBe('full');
  });
});

describe('planBuilderStore — start at departure', () => {
  it('keeps the planner open in its compact view', () => {
    const store = usePlanBuilderStore.getState();
    store.open();
    store.setDeparture({
      icao: 'DAAG',
      name: 'Houari Boumediene',
      latitude: 36.69,
      longitude: 3.21,
    } as PlanEndpoint);
    store.startAtDeparture();
    expect(usePlanBuilderStore.getState()).toMatchObject({
      isOpen: true,
      panel: 'half',
      explore: null,
    });
  });
});
