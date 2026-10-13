import type { TaxiGraph } from '@/lib/taxiGraph';
import type { TaxiEdge } from '@/types/apt';
import type {
  GuidanceDirection,
  GuidanceLeg,
  GuidancePoint,
  GuidanceRoute,
  GuidanceSource,
} from './types';

/** Two route nodes closer than this (degrees, ~5 cm) are the same junction under different IDs. */
const COINCIDENT_DEG = 5e-7;

/** The other end of a numbered runway (`05` → `23`, `14L` → `32R`), or null for any other name. */
function oppositeEnd(end: string): string | null {
  const match = /^(\d{1,2})([LCR]?)$/.exec(end);
  if (!match) return null;
  const number = Number(match[1]);
  if (number < 1 || number > 36) return null;
  const opposite = number > 18 ? number - 18 : number + 18;
  const side = ({ L: 'R', R: 'L', C: 'C', '': '' } as const)[match[2] as 'L' | 'R' | 'C' | ''];
  return String(opposite).padStart(2, '0') + side;
}

/** One key per physical runway, whichever end a zone names: both ends sorted and joined. */
function runwayKey(end: string): string {
  const opposite = oppositeEnd(end);
  return opposite ? [end, opposite].sort().join('/') : end;
}

/**
 * Runways whose zones the edge sits in. A zone may name one end or both, so
 * each end is filed under its runway. ILS critical areas only matter in low
 * visibility, so they are left out.
 */
function legRunways(edge: TaxiEdge): string[] {
  const keys = new Set<string>();
  for (const zone of edge.activeZones ?? []) {
    if (zone.type === 'ils') continue;
    for (const end of zone.runways) keys.add(runwayKey(end));
  }
  if (edge.widthClass === 'runway' && edge.name) {
    for (const end of edge.name.split('/')) keys.add(runwayKey(end));
  }
  return [...keys];
}

function findEdge(graph: TaxiGraph, from: number, to: number): TaxiEdge | null {
  return graph.adjacency.get(from)?.find((e) => e.toNodeId === to)?.edge ?? null;
}

/**
 * Snapshot of a planned network route with the metadata guidance needs, so the
 * route can be followed without the taxi graph (in the detached strip window).
 */
export function buildGuidanceRoute(
  graph: TaxiGraph,
  nodeIds: number[],
  meta: {
    icao: string;
    direction: GuidanceDirection;
    runway: string | null;
    gateName: string | null;
    source: GuidanceSource;
    anchorNodeIds: number[];
  }
): GuidanceRoute | null {
  const points: GuidancePoint[] = [];
  const legs: GuidanceLeg[] = [];
  let prevId: number | null = null;

  for (const id of nodeIds) {
    const node = graph.nodes.get(id);
    if (!node) continue;
    const last = points[points.length - 1];
    if (
      last &&
      Math.abs(last.lat - node.lat) < COINCIDENT_DEG &&
      Math.abs(last.lon - node.lon) < COINCIDENT_DEG
    ) {
      prevId = id;
      continue;
    }
    if (prevId !== null) {
      // A* only steps along real edges; a gap the planner bridged directly has none.
      const edge = findEdge(graph, prevId, id);
      legs.push(
        edge
          ? { name: edge.name, isRunway: edge.widthClass === 'runway', runways: legRunways(edge) }
          : { name: '', isRunway: false, runways: [] }
      );
    }
    points.push({ lat: node.lat, lon: node.lon });
    prevId = id;
  }

  if (points.length < 2) return null;
  return { ...meta, points, legs, nodeIds: [...nodeIds] };
}
