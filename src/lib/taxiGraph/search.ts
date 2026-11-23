import type { Degrees } from '@/types/units';
import { turnDeg } from './geo';
import type { GraphEdge, PathResult, TaxiGraph } from './types';

/**
 * How strict a search is. A looser tier only wins when its route is cheaper
 * by more than its penalty, so a scenery with a gap in its network still gets
 * a route, just a less tidy one.
 */
export interface Tier {
  /** Whether the route may taxi along a runway, beyond just crossing it. */
  allowRunway: boolean;
  /** Sharpest heading change allowed at a junction, in degrees. */
  maxTurn: number;
  /** Whether one-way edges may be taken the wrong way, for networks that dead-end. */
  ignoreOneway?: boolean;
  /** Metres of taxiing a route under this tier has to save to be chosen. */
  penalty: number;
}

export const TIERS: readonly Tier[] = [
  { allowRunway: false, maxTurn: 120, penalty: 0 },
  { allowRunway: false, maxTurn: 150, penalty: 500 },
  { allowRunway: true, maxTurn: 150, penalty: 1500 },
  { allowRunway: true, maxTurn: 180, penalty: 3000 },
  { allowRunway: true, maxTurn: 180, ignoreOneway: true, penalty: 5000 },
];

/** Cost of a 90° turn in metres of taxiing; grows with the square of the angle. */
const TURN_COST_M = 20;
/** Taxiing along a runway costs this many times the distance, when a tier allows it at all. */
const RUNWAY_COST_FACTOR = 3;
/**
 * A runway edge no longer than this is a crossing: sceneries draw a taxiway
 * crossing as a short stretch of runway between two centreline nodes.
 */
const CROSSING_MAX_M = 100;

export interface SearchStart {
  nodeId: number;
  /** Cost already spent reaching this node, in metres. */
  cost: number;
  /** Heading the aircraft arrives at the node on, or null when it is free to leave any way. */
  bearing: number | null;
  /** Node it came from, if any, so the state matches one reached along that edge. */
  prevNodeId: number | null;
}

export interface SearchSpec {
  starts: SearchStart[];
  /**
   * Extra cost of ending at `nodeId` having arrived on `bearing`, or null when
   * it is no goal. `maxTurn` is the current tier's limit, for goals that go on
   * to turn somewhere.
   */
  goal: (nodeId: number, bearing: number | null, maxTurn: number) => number | null;
  /** Edges the route must never use, by the node they leave from. */
  blocked?: (fromNodeId: number, edge: GraphEdge) => boolean;
  /** Extra cost of stepping from `prev` onto `next`, such as entering a runway's protected area. */
  stepCost?: (prev: GraphEdge | null, next: GraphEdge) => number;
  /** ICAO size code (A–F) of the aircraft: taxiways narrower than it are left out while any route fits. */
  sizeCode?: string | null;
}

interface State {
  nodeId: number;
  cost: number;
  bearing: number | null;
  /** The edge taken into this node, null for a start. */
  via: GraphEdge | null;
  parent: string | null;
}

interface HeapItem {
  cost: number;
  key: string;
  /** A finished route ending at this state, its cost including the goal's own. */
  final: boolean;
}

class MinHeap {
  private items: HeapItem[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: HeapItem): void {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.cost <= a[i]!.cost) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }

  pop(): HeapItem | undefined {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0 && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.cost < a[m]!.cost) m = l;
        if (r < a.length && a[r]!.cost < a[m]!.cost) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

function stateKey(prevNodeId: number | null, nodeId: number): string {
  return `${prevNodeId ?? ''}>${nodeId}`;
}

/** Cheapest route under one tier, as node IDs with its cost, or null when there is none. */
function searchTier(
  graph: TaxiGraph,
  spec: SearchSpec,
  tier: Tier
): { nodeIds: number[]; cost: number } | null {
  const states = new Map<string, State>();
  const settled = new Set<string>();
  const heap = new MinHeap();

  const offer = (key: string, state: State) => {
    const known = states.get(key);
    if (known && known.cost <= state.cost) return;
    states.set(key, state);
    heap.push({ cost: state.cost, key, final: false });
  };

  for (const s of spec.starts) {
    offer(stateKey(s.prevNodeId, s.nodeId), {
      nodeId: s.nodeId,
      cost: s.cost,
      bearing: s.bearing,
      via: null,
      parent: null,
    });
  }

  while (heap.size > 0) {
    const item = heap.pop()!;
    const state = states.get(item.key)!;

    if (item.final) {
      const nodeIds: number[] = [];
      let key: string | null = item.key;
      while (key !== null) {
        const s: State = states.get(key)!;
        nodeIds.unshift(s.nodeId);
        key = s.parent;
      }
      return { nodeIds, cost: item.cost };
    }

    if (settled.has(item.key) || item.cost > state.cost) continue;
    settled.add(item.key);

    const goalCost = spec.goal(state.nodeId, state.bearing, tier.maxTurn);
    if (goalCost !== null) heap.push({ cost: state.cost + goalCost, key: item.key, final: true });

    const out = graph.adjacency.get(state.nodeId) ?? [];
    const wrongWay = tier.ignoreOneway ? (graph.againstOneway.get(state.nodeId) ?? []) : [];
    for (const next of [...out, ...wrongWay]) {
      const alongRunway = next.edge.widthClass === 'runway' && next.distance > CROSSING_MAX_M;
      if (alongRunway && !tier.allowRunway) continue;
      if (spec.blocked?.(state.nodeId, next)) continue;

      let cost = state.cost + next.distance * (alongRunway ? RUNWAY_COST_FACTOR : 1);
      let bearing = state.bearing;
      if (!Number.isNaN(next.bearing)) {
        if (state.bearing !== null) {
          const turn = turnDeg(state.bearing, next.bearing);
          if (turn > tier.maxTurn) continue;
          cost += TURN_COST_M * (turn / 90) ** 2;
        }
        bearing = next.bearing;
      }
      cost += spec.stepCost?.(state.via, next) ?? 0;

      const key = stateKey(state.nodeId, next.toNodeId);
      if (settled.has(key)) continue;
      offer(key, { nodeId: next.toNodeId, cost, bearing, via: next, parent: item.key });
    }
  }
  return null;
}

/** Whether an aircraft of ICAO size code `sizeCode` fits along the edge. */
function fits(edge: GraphEdge, sizeCode: string): boolean {
  const cls = edge.edge.widthClass;
  return cls === 'runway' || cls >= sizeCode;
}

/**
 * Cheapest route across the tiers, each looser tier's route charged its
 * penalty. Taxiways too narrow for the aircraft are used only when no route
 * fits at all.
 */
export function search(graph: TaxiGraph, spec: SearchSpec): number[] | null {
  const size = spec.sizeCode;
  if (!size) return searchTiers(graph, spec);
  const sized = searchTiers(graph, {
    ...spec,
    blocked: (from, e) => !fits(e, size) || (spec.blocked?.(from, e) ?? false),
  });
  return sized ?? searchTiers(graph, spec);
}

function searchTiers(graph: TaxiGraph, spec: SearchSpec): number[] | null {
  let best: { nodeIds: number[]; total: number } | null = null;
  for (const tier of TIERS) {
    if (best && tier.penalty >= best.total) break;
    const found = searchTier(graph, spec, tier);
    if (found && (!best || found.cost + tier.penalty < best.total)) {
      best = { nodeIds: found.nodeIds, total: found.cost + tier.penalty };
    }
  }
  return best?.nodeIds ?? null;
}

/** The edge from `from` to `to`, or null when the two are not neighbours. */
export function edgeBetween(graph: TaxiGraph, from: number, to: number): GraphEdge | null {
  return graph.adjacency.get(from)?.find((e) => e.toNodeId === to) ?? null;
}

/** Real taxi distance and taxiway names along a resolved route. */
export function summarizePath(graph: TaxiGraph, nodeIds: number[]): PathResult {
  let totalDistance = 0;
  const taxiwayNames: string[] = [];
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const edge = edgeBetween(graph, nodeIds[i]!, nodeIds[i + 1]!);
    if (!edge) continue;
    totalDistance += edge.distance;
    taxiwayNames.push(edge.edge.name);
  }
  return { nodeIds, totalDistance, taxiwayNames };
}

/** Heading the route arrives at its last node on, or null when it never moved. */
export function arrivalBearing(graph: TaxiGraph, nodeIds: number[]): Degrees | null {
  for (let i = nodeIds.length - 1; i > 0; i--) {
    const edge = edgeBetween(graph, nodeIds[i - 1]!, nodeIds[i]!);
    if (edge && !Number.isNaN(edge.bearing)) return edge.bearing as Degrees;
  }
  return null;
}
