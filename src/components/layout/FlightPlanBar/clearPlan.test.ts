import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanEndpoint } from '@/lib/flightplan/builder/types';
import type { EnrichedFlightPlan } from '@/types/fms';

vi.mock('@/lib/utils/loggerRenderer', () => {
  const noop = new Proxy({}, { get: () => () => {} });
  return { default: new Proxy({}, { get: () => noop }) };
});

const { useFlightPlanStore } = await import('@/stores/flightPlanStore');
const { usePlanBuilderStore } = await import('@/stores/planBuilderStore');
const { clearPlanFromMap } = await import('./clearPlan');

const KBOS = { icao: 'KBOS', latitude: 42.36, longitude: -71.0 } as PlanEndpoint;
const KMIA = { icao: 'KMIA', latitude: 25.79, longitude: -80.29 } as PlanEndpoint;
const plan = { waypoints: [] } as unknown as EnrichedFlightPlan;

beforeEach(() => {
  usePlanBuilderStore.setState({
    departure: KBOS,
    arrival: KMIA,
    routeText: 'SSOXS Q167 KALDA',
    cruiseAltitudeFt: 40000,
    previousPlans: [],
  });
  useFlightPlanStore.setState({
    fmsData: plan,
    fileName: 'KBOS-KMIA',
    simbriefData: null,
    showFlightPlanBar: true,
  });
});

// The strip's X clears the plan, and the plan can come back (GitHub #407).
describe('clearPlanFromMap', () => {
  it('takes the plan off the map and puts it back exactly on undo', () => {
    const undo = clearPlanFromMap();
    expect(useFlightPlanStore.getState().fmsData).toBeNull();
    expect(useFlightPlanStore.getState().showFlightPlanBar).toBe(false);

    undo();
    const map = useFlightPlanStore.getState();
    expect([map.fmsData, map.fileName, map.showFlightPlanBar]).toEqual([plan, 'KBOS-KMIA', true]);
  });

  it("keeps the planner's plan in the previous plans", () => {
    clearPlanFromMap();
    expect(usePlanBuilderStore.getState().previousPlans.map((p) => p.routeText)).toEqual([
      'SSOXS Q167 KALDA',
    ]);
  });

  it("does not file a plan that is not the planner's, such as one from SimBrief", () => {
    useFlightPlanStore.setState({ fileName: 'SimBrief: EHAM-EGLL' });
    clearPlanFromMap();
    expect(usePlanBuilderStore.getState().previousPlans).toEqual([]);
  });
});
