/**
 * Runway ends straight from an airport's apt.dat block, without a full parse.
 * Row 100 is a land runway: both ends sit at fixed token offsets, name then
 * latitude then longitude.
 */
import type { RunwayEnd } from '@/types/fms';
import { bearingDeg, greatCircleNm } from './geometry';

const LAND_RUNWAY_ROW = '100';
const END_ONE_INDEX = 8;
const END_TWO_INDEX = 17;
const RUNWAY_NAME_RE = /^\d{2}[LCRTW]?$/;

function readEnd(
  tokens: string[],
  index: number
): { name: string; lat: number; lon: number } | null {
  const name = tokens[index];
  const lat = Number(tokens[index + 1]);
  const lon = Number(tokens[index + 2]);
  if (!name || !RUNWAY_NAME_RE.test(name) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return { name, lat, lon };
}

export function runwayEndsFromApt(aptText: string): RunwayEnd[] {
  const ends = new Map<string, RunwayEnd>();
  for (const rawLine of aptText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith(`${LAND_RUNWAY_ROW} `)) continue;
    const tokens = line.split(/\s+/);
    const one = readEnd(tokens, END_ONE_INDEX);
    const two = readEnd(tokens, END_TWO_INDEX);
    if (!one || !two) continue;
    const a = { latitude: one.lat, longitude: one.lon };
    const b = { latitude: two.lat, longitude: two.lon };
    const lengthNm = greatCircleNm(a, b);
    ends.set(one.name, { name: one.name, ...a, headingDeg: bearingDeg(a, b), lengthNm });
    ends.set(two.name, { name: two.name, ...b, headingDeg: bearingDeg(b, a), lengthNm });
  }
  return [...ends.values()].sort(
    (x, y) => parseInt(x.name, 10) - parseInt(y.name, 10) || x.name.localeCompare(y.name)
  );
}
