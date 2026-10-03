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
