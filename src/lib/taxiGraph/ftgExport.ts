import { version } from '../../../package.json';

export interface FtgRoutePayload {
  apt: string;
  mode: 'departure' | 'arrival';
  start: string;
  dest: string;
  route: number[];
  'apt.dat': string;
  'x-dispatch-version': string;
}

export function buildFtgPayload(
  icao: string,
  mode: 'departure' | 'arrival',
  startName: string,
  destName: string,
  nodeIds: number[],
  aptDatPath: string
): FtgRoutePayload {
  return {
    apt: icao,
    mode,
    start: startName,
    dest: destName,
    route: nodeIds,
    'apt.dat': aptDatPath,
    'x-dispatch-version': version,
  };
}
