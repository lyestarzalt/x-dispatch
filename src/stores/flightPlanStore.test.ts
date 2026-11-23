import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnrichedFlightPlan } from '@/types/fms';

vi.mock('@/lib/utils/loggerRenderer', () => {
  const noop = new Proxy({}, { get: () => () => {} });
  return { default: new Proxy({}, { get: () => noop }) };
});

const { useFlightPlanStore } = await import('./flightPlanStore');

const plan = { waypoints: [] } as unknown as EnrichedFlightPlan;

beforeEach(() => {
  useFlightPlanStore.setState({ fmsData: plan, fileName: 'KBOS-KMIA', showFlightPlanBar: true });
});

// Hiding the strip is the toggle in the plan's panel; the plan stays on the map (GitHub #407).
describe('setFlightPlanBarShown', () => {
  it('hides the strip and keeps the plan on the map', () => {
    useFlightPlanStore.getState().setFlightPlanBarShown(false);
    expect(useFlightPlanStore.getState().showFlightPlanBar).toBe(false);
    expect(useFlightPlanStore.getState().fmsData).toBe(plan);
    expect(useFlightPlanStore.getState().fileName).toBe('KBOS-KMIA');
  });

  it('shows it again', () => {
    useFlightPlanStore.getState().setFlightPlanBarShown(false);
    useFlightPlanStore.getState().setFlightPlanBarShown(true);
    expect(useFlightPlanStore.getState().showFlightPlanBar).toBe(true);
  });
});
