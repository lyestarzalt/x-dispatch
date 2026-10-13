import { describe, expect, it } from 'vitest';
import type { TaxiGraph } from '@/lib/taxiGraph';
import { useTaxiRouteStore } from '@/stores/taxiRouteStore';
import { guidanceSyncAction } from './useTaxiGuidancePublisher';

type PlannerState = ReturnType<typeof useTaxiRouteStore.getState>;

const graph = { adjacency: new Map(), nodes: new Map(), nodeList: [] } as TaxiGraph;
const base: PlannerState = {
  ...useTaxiRouteStore.getState(),
  mode: 'network',
  direction: 'departure',
  graph,
  activeTaxiIcao: 'LFBO',
  networkNodeIds: [1, 2, 3],
};

describe('guidanceSyncAction', () => {
  it('publishes a planned network route', () => {
    const prev = { ...base, networkNodeIds: [] };
    expect(guidanceSyncAction(prev, base)).toEqual({ type: 'publish' });
  });

  it('publishes again when the pilot takes over a suggested route', () => {
    expect(guidanceSyncAction({ ...base, source: 'auto' }, base)).toEqual({ type: 'publish' });
  });

  it('ignores changes that do not touch the route', () => {
    expect(guidanceSyncAction(base, { ...base, clickModeEnabled: false })).toBeNull();
  });

  it('clears the route when the pilot clears it in the planner', () => {
    expect(guidanceSyncAction(base, { ...base, networkNodeIds: [] })).toEqual({
      type: 'clear',
      direction: 'departure',
    });
  });

  it('keeps the route when the planner closes', () => {
    const closed = { ...base, activeTaxiIcao: null, networkNodeIds: [] };
    expect(guidanceSyncAction(base, closed)).toBeNull();
  });

  it('keeps the departure route when the pilot switches to planning the arrival', () => {
    const arrival = { ...base, direction: 'arrival' as const, networkNodeIds: [] };
    expect(guidanceSyncAction(base, arrival)).toBeNull();
  });
});
