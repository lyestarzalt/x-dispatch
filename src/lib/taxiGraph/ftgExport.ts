import { version } from '../../../package.json';

export interface FtgRoutePayload {
  apt: string;
  mode: 'departure' | 'arrival';
  start: string;
  dest: string;
  route: number[];
  taxiway_names: string[];
  distance_m: number;
  gate_heading: number;
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
  distanceM: number;
  gateHeading: number;
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
    distance_m: Math.round(opts.distanceM),
    gate_heading: Math.round(opts.gateHeading),
    'apt.dat': opts.aptDatPath,
    'x-dispatch-version': version,
  };
}
