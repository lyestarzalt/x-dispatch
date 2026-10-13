import { describe, expect, it } from 'vitest';
import { buildTaxiGraph } from '@/lib/taxiGraph';
import type { TaxiNetwork } from '@/types/apt';
import { at } from './__fixtures__/routes';
import { buildGuidanceRoute } from './buildRoute';

function network(): TaxiNetwork {
  const node = (id: number, x: number, y: number) => ({
    id,
    latitude: at(x, y).lat,
    longitude: at(x, y).lon,
    usage: 'junc' as const,
  });
  return {
    nodes: [node(1, 0, 0), node(2, 0, 100), node(3, 0, 100), node(4, 0, 200), node(5, 100, 200)],
    edges: [
      { fromNodeId: 1, toNodeId: 2, direction: 'twoway', widthClass: 'D', name: 'A' },
      { fromNodeId: 3, toNodeId: 2, direction: 'twoway', widthClass: 'D', name: 'A' },
      {
        fromNodeId: 4,
        toNodeId: 3,
        direction: 'twoway',
        widthClass: 'D',
        name: 'M4',
        activeZones: [
          { type: 'departure', runways: ['32R', '14L'] },
          { type: 'ils', runways: ['14L'] },
        ],
      },
      { fromNodeId: 4, toNodeId: 5, direction: 'twoway', widthClass: 'runway', name: '14L/32R' },
    ],
    truckEdges: [],
    truckParkings: [],
    truckDestinations: [],
  } as TaxiNetwork;
}

const meta = {
  icao: 'LFBO',
  direction: 'departure' as const,
  runway: '14L',
  gateName: 'B12',
  source: 'planned' as const,
  anchorNodeIds: [1, 5],
};

describe('buildGuidanceRoute', () => {
  it('keeps each edge name and the runways it is protected for', () => {
    const route = buildGuidanceRoute(buildTaxiGraph(network()), [1, 2, 3, 4, 5], meta)!;
    expect(route.legs).toEqual([
      { name: 'A', isRunway: false, runways: [] },
      { name: 'M4', isRunway: false, runways: ['14L/32R'] },
      { name: '14L/32R', isRunway: true, runways: ['14L/32R'] },
    ]);
  });

  it('files zones that name single runway ends under their runway', () => {
    const graph = buildTaxiGraph({
      ...network(),
      edges: [
        {
          fromNodeId: 1,
          toNodeId: 2,
          direction: 'twoway',
          widthClass: 'D',
          name: 'B3',
          activeZones: [
            { type: 'departure', runways: ['23'] },
            { type: 'arrival', runways: ['05'] },
          ],
        },
        {
          fromNodeId: 3,
          toNodeId: 4,
          direction: 'twoway',
          widthClass: 'D',
          name: 'B3',
          activeZones: [{ type: 'departure', runways: ['32R', '09'] }],
        },
      ],
    } as TaxiNetwork);
    const route = buildGuidanceRoute(graph, [1, 2, 3, 4], meta)!;
    expect(route.legs.map((l) => l.runways)).toEqual([['05/23'], ['14L/32R', '09/27']]);
  });

  it('merges two node IDs at the same spot into one point', () => {
    const route = buildGuidanceRoute(buildTaxiGraph(network()), [1, 2, 3, 4, 5], meta)!;
    expect(route.points).toHaveLength(4);
    expect(route.nodeIds).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns nothing for a route shorter than one edge', () => {
    expect(buildGuidanceRoute(buildTaxiGraph(network()), [1], meta)).toBeNull();
  });
});
