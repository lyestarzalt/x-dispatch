import { summarizePath } from './search';
import type { TaxiGraph } from './types';

export interface RouteSummary {
  /** Each taxiway once, in the order the route takes them. */
  taxiways: string[];
  meters: number;
}

/**
 * The "via C, Z" line for the route as it stands. Read from the path itself
 * rather than kept beside it, so a drag, a via-point or an undo is reflected
 * at once (a kept copy was cleared by every edit and only rebuilt on remount).
 */
export function routeSummary(graph: TaxiGraph | null, nodeIds: number[]): RouteSummary | null {
  if (!graph || nodeIds.length < 2) return null;
  const path = summarizePath(graph, nodeIds);
  const taxiways: string[] = [];
  for (const name of path.taxiwayNames) {
    if (name && !taxiways.includes(name)) taxiways.push(name);
  }
  return { taxiways, meters: path.totalDistance };
}
