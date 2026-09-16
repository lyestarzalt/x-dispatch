import { describe, expect, it } from 'vitest';
import type { TaxiNetwork } from '@/types/apt';
import { createRoutingNetworkGeoJSON } from './geoJsonFactory';

/** Two nodes a short distance apart, plus a third for branching. */
const NODES: TaxiNetwork['nodes'] = [
  { id: 1, latitude: 50.0, longitude: 8.0, usage: 'init' },
  { id: 2, latitude: 50.001, longitude: 8.001, usage: 'junc' },
  { id: 3, latitude: 50.002, longitude: 8.002, usage: 'dest' },
];

function network(overrides: Partial<TaxiNetwork> = {}): TaxiNetwork {
  return {
    nodes: NODES,
    edges: [],
    truckEdges: [],
    truckParkings: [],
    truckDestinations: [],
    ...overrides,
  };
}

describe('createRoutingNetworkGeoJSON', () => {
  it('returns empty collections for an empty network', () => {
    const { edges, nodes } = createRoutingNetworkGeoJSON(
      network({ nodes: [], edges: [], truckEdges: [] })
    );
    expect(edges.features).toHaveLength(0);
    expect(nodes.features).toHaveLength(0);
  });

  it('draws a taxi edge between its two nodes', () => {
    const { edges } = createRoutingNetworkGeoJSON(
      network({
        edges: [{ fromNodeId: 1, toNodeId: 2, direction: 'twoway', widthClass: 'C', name: 'A1' }],
      })
    );
    expect(edges.features).toHaveLength(1);
    expect(edges.features[0]?.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [8.0, 50.0],
        [8.001, 50.001],
      ],
    });
    expect(edges.features[0]?.properties).toMatchObject({
      kind: 'taxi',
      oneway: false,
      name: 'A1',
    });
  });

  it('classifies runway edges separately from taxi edges', () => {
    const { edges } = createRoutingNetworkGeoJSON(
      network({
        edges: [
          { fromNodeId: 1, toNodeId: 2, direction: 'twoway', widthClass: 'runway', name: '07L' },
          { fromNodeId: 2, toNodeId: 3, direction: 'twoway', widthClass: 'A', name: 'B' },
        ],
      })
    );
    expect(edges.features.map((f) => f.properties?.kind)).toEqual(['runway', 'taxi']);
  });

  it('marks one-way edges, which is what the arrows are filtered on', () => {
    const { edges } = createRoutingNetworkGeoJSON(
      network({
        edges: [
          { fromNodeId: 1, toNodeId: 2, direction: 'oneway', widthClass: 'C', name: 'A1' },
          { fromNodeId: 2, toNodeId: 3, direction: 'twoway', widthClass: 'C', name: 'A2' },
        ],
      })
    );
    expect(edges.features.map((f) => f.properties?.oneway)).toEqual([true, false]);
  });

  it('includes the service road network, which shares the taxi nodes', () => {
    const { edges } = createRoutingNetworkGeoJSON(
      network({
        edges: [{ fromNodeId: 1, toNodeId: 2, direction: 'twoway', widthClass: 'C', name: 'A1' }],
        truckEdges: [{ fromNodeId: 2, toNodeId: 3, direction: 'oneway', name: 'svc' }],
      })
    );
    expect(edges.features.map((f) => f.properties?.kind)).toEqual(['taxi', 'truck']);
    expect(edges.features[1]?.properties).toMatchObject({ oneway: true, name: 'svc' });
  });

  it('tolerates a truck edge with no name', () => {
    const { edges } = createRoutingNetworkGeoJSON(
      network({ truckEdges: [{ fromNodeId: 1, toNodeId: 2, direction: 'twoway' }] })
    );
    expect(edges.features[0]?.properties?.name).toBe('');
  });

  it('drops edges referencing a node that is not in the file', () => {
    // Drawing these would streak a line to (0, 0) across the map.
    const { edges } = createRoutingNetworkGeoJSON(
      network({
        edges: [
          { fromNodeId: 1, toNodeId: 999, direction: 'twoway', widthClass: 'C', name: 'ghost' },
          { fromNodeId: 404, toNodeId: 2, direction: 'twoway', widthClass: 'C', name: 'ghost2' },
          { fromNodeId: 1, toNodeId: 2, direction: 'twoway', widthClass: 'C', name: 'real' },
        ],
      })
    );
    expect(edges.features).toHaveLength(1);
    expect(edges.features[0]?.properties?.name).toBe('real');
  });

  it('carries the node usage flag through, since nodes are coloured by it', () => {
    const { nodes } = createRoutingNetworkGeoJSON(network());
    expect(nodes.features).toHaveLength(3);
    expect(nodes.features.map((f) => f.properties?.usage)).toEqual(['init', 'junc', 'dest']);
    expect(nodes.features[0]?.geometry).toEqual({ type: 'Point', coordinates: [8.0, 50.0] });
  });
});
