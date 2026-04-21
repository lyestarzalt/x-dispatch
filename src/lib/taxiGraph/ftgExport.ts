import { useAppStore } from '@/stores/appStore';
import { useLaunchStore } from '@/stores/launchStore';
import { useTaxiRouteStore } from '@/stores/taxiRouteStore';
import { version } from '../../../package.json';

export interface FtgRoutePayload {
  apt: string;
  mode: 'departure' | 'arrival';
  start: string;
  dest: string;
  route: number[];
  /** Freehand route as lat/lon pairs (only present in freehand mode) */
  route_free?: [number, number][];
  taxiway_names: string[];
  gate_heading: number;
  aircraft_icao: string;
  timestamp: string;
  'apt.dat': string;
  'x-dispatch-version': string;
}

export function buildFtgPayload(opts: {
  icao: string;
  mode: 'departure' | 'arrival';
  startName: string;
  destName: string;
  nodeIds: number[];
  taxiwayNames: string[];
  gateHeading: number;
  aircraftIcao: string;
  aptDatPath: string;
}): FtgRoutePayload {
  // Deduplicate consecutive taxiway names
  const names: string[] = [];
  for (const n of opts.taxiwayNames) {
    if (n && n !== names[names.length - 1]) names.push(n);
  }

  return {
    apt: opts.icao,
    mode: opts.mode,
    start: opts.startName,
    dest: opts.destName,
    route: opts.nodeIds,
    taxiway_names: names,
    gate_heading: Math.round(opts.gateHeading),
    aircraft_icao: opts.aircraftIcao,
    timestamp: new Date().toISOString(),
    'apt.dat': opts.aptDatPath,
    'x-dispatch-version': version,
  };
}

/**
 * Write the current taxi route to the FTG route file.
 * Reads from taxiRouteStore and appStore. Returns the write result,
 * or null if no valid route exists.
 */
export async function writeFtgRoute(): Promise<{
  success: boolean;
  path?: string;
  error?: string;
} | null> {
  const taxi = useTaxiRouteStore.getState();
  const hasNetworkRoute = taxi.mode === 'network' && taxi.networkNodeIds.length >= 2;
  const hasFreehandRoute = taxi.mode === 'freehand' && taxi.waypoints.length >= 2;
  if (!hasNetworkRoute && !hasFreehandRoute) return null;

  const app = useAppStore.getState();
  const icao = app.selectedICAO ?? '';
  const airport = app.selectedAirportData;
  const startPos = app.startPosition;
  const aircraft = useLaunchStore.getState().selectedAircraft;

  // Compute taxiway names and distance from the graph edges
  const nodeIds = hasNetworkRoute ? taxi.networkNodeIds : [];
  const taxiwayNames: string[] = [];

  if (hasNetworkRoute && taxi.graph) {
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const neighbors = taxi.graph.adjacency.get(nodeIds[i]!);
      const edge = neighbors?.find((e) => e.toNodeId === nodeIds[i + 1]!);
      if (edge) {
        taxiwayNames.push(edge.edge.name);
      }
    }
  }

  const payload = buildFtgPayload({
    icao,
    mode: 'departure',
    startName: startPos?.name ?? (hasNetworkRoute ? String(nodeIds[0]) : ''),
    destName: taxi.selectedRunway ?? '',
    nodeIds,
    taxiwayNames,
    gateHeading: startPos?.heading ?? 0,
    aircraftIcao: aircraft?.icao ?? '',
    aptDatPath: airport?.sourceFile ?? '',
  });

  // Add freehand route as lat/lon pairs
  if (hasFreehandRoute) {
    payload.route_free = taxi.waypoints.map((wp) => [wp.latitude, wp.longitude]);
  }

  return window.xplaneAPI.writeTaxiRoute(JSON.stringify(payload, null, 2));
}
