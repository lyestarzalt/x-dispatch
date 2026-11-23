import type { TaxiEdge } from '@/types/apt';
import type { Meters, TrueDegrees } from '@/types/units';

/** Adjacency list entry — one neighbor reachable from a node */
export interface GraphEdge {
  toNodeId: number;
  /** Distance in metres (haversine between the two nodes) */
  distance: Meters;
  /** True bearing of travel along this edge in degrees, NaN when its two nodes coincide */
  bearing: TrueDegrees;
  /** Reference to the original TaxiEdge for metadata access */
  edge: TaxiEdge;
}

/** Adjacency list keyed by node ID */
export type AdjacencyList = Map<number, GraphEdge[]>;

/** Spatial index entry for nearest-node lookup */
export interface IndexedNode {
  id: number;
  lat: number;
  lon: number;
}

/** Where a stand meets the network: the point on a taxiway edge abeam it. */
export interface StandLink {
  lat: number;
  lon: number;
  /** Name of the taxiway the point is on. */
  name: string;
}

/** Result of a pathfind */
export interface PathResult {
  /** Ordered node IDs from start to end */
  nodeIds: number[];
  /** Where the route joins the network from its stand, before the first node. */
  from?: StandLink;
  /** Where the route leaves the network for its stand, after the last node. */
  to?: StandLink;
  /** Total distance in metres */
  totalDistance: Meters;
  /** Taxiway names traversed in order (may have duplicates for consecutive edges on same taxiway) */
  taxiwayNames: string[];
}

/** Prebuilt graph ready for queries */
export interface TaxiGraph {
  adjacency: AdjacencyList;
  /** One-way edges the wrong way round, for routing through a scenery whose one-way loop dead-ends. */
  againstOneway: AdjacencyList;
  nodes: Map<number, IndexedNode>;
  /** All indexed nodes as flat array for spatial search */
  nodeList: IndexedNode[];
}
