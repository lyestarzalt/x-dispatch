import { describe, expect, it } from 'vitest';
import type { TaxiNetwork } from '@/types/apt';
import { buildTaxiGraph } from './buildGraph';
import { routeSummary } from './routeSummary';

const deg = 1 / 111_320;

/** Taxiway C from node 1 to 3, then Z from 3 to 4. */
const graph = buildTaxiGraph({
  nodes: [
    [1, 0, 0],
    [2, 100, 0],
    [3, 200, 0],
    [4, 200, 100],
  ].map(([id, x, y]) => ({ id: id!, latitude: y! * deg, longitude: x! * deg, usage: 'both' })),
  edges: [
    [1, 2, 'C'],
    [2, 3, 'C'],
    [3, 4, 'Z'],
  ].map(([from, to, name]) => ({
    fromNodeId: from as number,
    toNodeId: to as number,
    direction: 'twoway',
    widthClass: 'E',
    name: name as string,
  })),
} as unknown as TaxiNetwork);

describe('routeSummary', () => {
  it('names each taxiway once, in the order the route takes them', () => {
    expect(routeSummary(graph, [1, 2, 3, 4])?.taxiways).toEqual(['C', 'Z']);
  });

  it('measures the route: three legs of 100 m', () => {
    expect(routeSummary(graph, [1, 2, 3, 4])?.meters).toBeCloseTo(300, -1);
  });

  it('has nothing to say about a route of fewer than two points or without a graph', () => {
    expect(routeSummary(graph, [1])).toBeNull();
    expect(routeSummary(null, [1, 2])).toBeNull();
  });
});
