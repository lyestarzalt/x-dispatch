import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanEndpoint } from '@/lib/flightplan/builder/types';
import type { EnrichedFlightPlan } from '@/types/fms';
import { useFlightPlanStore } from './flightPlanStore';
import { usePlanBuilderStore } from './planBuilderStore';

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
    vi.unstubAllGlobals();
  });
});
