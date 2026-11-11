import { beforeEach, describe, expect, it } from 'vitest';
import { buildTaxiGraph, routeSummary } from '@/lib/taxiGraph';
import type { TaxiNetwork } from '@/types/apt';
import { anchorsOnTo, resolvePath, useTaxiRouteStore } from './taxiRouteStore';

const deg = 1 / 111_320;

/** A square of taxiway 1-2-3-4 with a lone node 5 off to the side. */
const graph = buildTaxiGraph({
  nodes: [
    [1, 0, 0],
    [2, 100, 0],
    [3, 100, 100],
    [4, 0, 100],
    [5, 500, 500],
  ].map(([id, x, y]) => ({ id: id!, latitude: y! * deg, longitude: x! * deg, usage: 'both' })),
  edges: [
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 1],
  ].map(([from, to]) => ({
    fromNodeId: from!,
    toNodeId: to!,
    direction: 'twoway',
    widthClass: 'E',
    name: 'A',
  })),
} as unknown as TaxiNetwork);

/** A straight taxiway 1-2-3. */
const line = buildTaxiGraph({
  nodes: [
    [1, 0, 0],
    [2, 100, 0],
    [3, 200, 0],
  ].map(([id, x, y]) => ({ id: id!, latitude: y! * deg, longitude: x! * deg, usage: 'both' })),
  edges: [
    [1, 2],
    [2, 3],
  ].map(([from, to]) => ({
    fromNodeId: from!,
    toNodeId: to!,
    direction: 'twoway',
    widthClass: 'E',
    name: 'A',
  })),
} as unknown as TaxiNetwork);

beforeEach(() => {
  useTaxiRouteStore.getState().deactivate();
  useTaxiRouteStore.getState().setGraph(graph);
  useTaxiRouteStore.getState().setActiveAirport('TEST');
});

describe('resolvePath', () => {
  it('reports a leg with no way through', () => {
    expect(resolvePath([1, 3], graph).complete).toBe(true);
    const cut = resolvePath([1, 5], graph);
    expect(cut.complete).toBe(false);
    expect(cut.nodeIds).toEqual([1, 5]);
  });

  it('keeps a via-point the route has to come back from, and says so', () => {
    // Out to 2 and on round the square to 1 again: nothing is cut away.
    const round = resolvePath([1, 2, 1], graph);
    expect(round.nodeIds).toEqual([1, 2, 3, 4, 1]);
    expect(round.doublesBack).toBe(true);
    expect(resolvePath([1, 3], graph).doublesBack).toBe(false);
  });

  it('flags a picked point past the end that the route taxis out to and back from', () => {
    const out = resolvePath([1, 3, 2], line);
    expect(out.nodeIds).toEqual([1, 2, 3, 2]);
    expect(out.complete).toBe(true);
    expect(out.doublesBack).toBe(true);
    expect(resolvePath([1, 2, 3], line).doublesBack).toBe(false);
  });

  it('rewinds to a picked point behind the route instead of going there and back', () => {
    expect(anchorsOnTo([1, 3], 2, line)).toEqual([1, 2]);
    expect(anchorsOnTo([1, 2], 3, line)).toEqual([1, 2, 3]);
    expect(anchorsOnTo([1, 2, 3], 1, line)).toEqual([1]);
    expect(anchorsOnTo([], 2, line)).toEqual([2]);
    // Round the square and back to the start: the loop is not kept either.
    expect(anchorsOnTo([1, 2], 1, graph)).toEqual([1]);
  });
});

describe('moving an end', () => {
  const restore = () =>
    useTaxiRouteStore.getState().restoreRoute({
      direction: 'departure',
      anchorNodeIds: [2, 3],
      nodeIds: [2, 3],
      runway: null,
      source: 'planned',
      // The stand joins taxiway 1-2 halfway along.
      standLink: { from: { lat: 0, lon: 50 * deg, name: 'A' }, to: null },
    });

  it('keeps the stand while the start stays on the stand taxiway', () => {
    useTaxiRouteStore.getState().setGraph(line);
    restore();
    useTaxiRouteStore.getState().replaceNetworkNode(0, 1);
    const s = useTaxiRouteStore.getState();
    expect(s.networkNodeIds).toEqual([1, 2, 3]);
    expect(s.standLink.from?.name).toBe('A');
  });

  it('drops the stand once the start leaves its taxiway', () => {
    restore();
    useTaxiRouteStore.getState().replaceNetworkNode(0, 4);
    const s = useTaxiRouteStore.getState();
    expect(s.networkNodeIds).toEqual([4, 3]);
    expect(s.standLink.from).toBeNull();
  });
});

describe('clicking points', () => {
  it('never sends the route out and back', () => {
    useTaxiRouteStore.getState().setGraph(line);
    const store = useTaxiRouteStore.getState();
    store.addNetworkNode(1);
    store.addNetworkNode(3);
    store.addNetworkNode(2);
    expect(useTaxiRouteStore.getState().clickedNodeIds).toEqual([1, 2]);
    expect(useTaxiRouteStore.getState().networkNodeIds).toEqual([1, 2]);
  });
});

describe('route editing', () => {
  it('drops a via-point but never an end', () => {
    const store = useTaxiRouteStore.getState();
    store.addNetworkNode(1);
    store.addNetworkNode(2);
    store.addNetworkNode(3);
    store.removeViaNode(0);
    store.removeViaNode(2);
    expect(useTaxiRouteStore.getState().clickedNodeIds).toEqual([1, 2, 3]);
    store.removeViaNode(1);
    expect(useTaxiRouteStore.getState().clickedNodeIds).toEqual([1, 3]);
  });

  it('undoes each change in turn', () => {
    const store = useTaxiRouteStore.getState();
    store.addNetworkNode(1);
    store.addNetworkNode(3);
    store.insertViaNode(0, 4);
    expect(useTaxiRouteStore.getState().clickedNodeIds).toEqual([1, 4, 3]);
    store.undo();
    expect(useTaxiRouteStore.getState().clickedNodeIds).toEqual([1, 3]);
    store.undo();
    expect(useTaxiRouteStore.getState().clickedNodeIds).toEqual([1]);
  });

  it('forgets the stand an end met once that end leaves its taxiway', () => {
    const store = useTaxiRouteStore.getState();
    const from = { lat: 0, lon: 50 * deg, name: 'A' };
    store.setAutoRoute(
      { nodeIds: [2, 3], totalDistance: 150, taxiwayNames: [], from },
      '09',
      'auto'
    );
    store.replaceNetworkNode(1, 4);
    expect(useTaxiRouteStore.getState().standLink.from).toEqual(from);
    store.replaceNetworkNode(0, 3);
    expect(useTaxiRouteStore.getState().standLink.from).toBeNull();
    store.undo();
    store.undo();
    expect(useTaxiRouteStore.getState().standLink.from).toEqual(from);
  });
});

describe('route summary', () => {
  it('names the taxiways of a route drawn by hand and dragged, as soon as it changes', () => {
    // A clicked or dragged route never had a stored summary; the panel showed
    // "via ..." only after a remount rebuilt it.
    const store = useTaxiRouteStore.getState();
    store.addNetworkNode(1);
    store.addNetworkNode(2);
    useTaxiRouteStore.getState().replaceNetworkNode(1, 3);
    const after = useTaxiRouteStore.getState();
    expect(after.autoRouteResult).toBeNull();
    expect(routeSummary(graph, after.networkNodeIds)?.taxiways).toEqual(['A']);
  });
});
