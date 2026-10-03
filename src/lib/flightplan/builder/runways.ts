/**
 * Runway ends straight from an airport's apt.dat block, without a full parse.
 * Row 100 is a land runway: both ends sit at fixed token offsets, name then
 * latitude then longitude.
 *
 * Runway names are canonical two-digit form ("04L"), the spelling CIFP,
 * SimBrief and X-Plane FMS files all use. US scenery on the gateway often
 * writes single digits ("4L"), so every name read here is normalised first.
 */
import type { RunwayEnd } from '@/types/fms';
import type { AirportProcedures } from '@/types/navigation';
import { bearingDeg, greatCircleNm } from './geometry';
import { approachRunway } from './procedures';

const AIRPORT_HEADER_ROW = '1';
const LAND_RUNWAY_ROW = '100';
const END_ONE_INDEX = 8;
const END_TWO_INDEX = 17;
/** One or two digits, then the apt.dat suffixes: L/C/R, S (ski/gravel), T (true heading), W (water). */
const RUNWAY_NAME_RE = /^(\d{1,2})([LCRSTW]?)$/;
/** CIFP "RW25B" names both 25L and 25R. */
const BOTH_SIDES_RE = /^RW(\d{2})B$/;

/**
 * Canonical runway-end name: two-digit number plus optional suffix, with any
 * CIFP "RW" prefix removed. Undefined for anything that is not one runway end
 * ("ALL", "RW04B", fix names, helipads).
 */
export function normalizeRunwayName(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const bare = raw.trim().toUpperCase().replace(/^RW/, '');
  const match = RUNWAY_NAME_RE.exec(bare);
  if (!match) return undefined;
  const number = Number(match[1]);
  if (number < 1 || number > 36) return undefined;
  return `${String(number).padStart(2, '0')}${match[2]}`;
}

/**
 * Runways named by any SID, STAR or approach at the airport. Fills the list in
 * when apt.dat is missing, and names runways the scenery left out.
 */
export function runwaysFromProcedures(procedures: AirportProcedures | null | undefined): string[] {
  if (!procedures) return [];
  const names = new Set<string>();
  for (const p of [...procedures.sids, ...procedures.stars]) {
    if (!p.runway) continue;
    const both = BOTH_SIDES_RE.exec(p.runway.toUpperCase());
    if (both) {
      names.add(`${both[1]}L`);
      names.add(`${both[1]}R`);
      continue;
    }
    const name = normalizeRunwayName(p.runway);
    if (name) names.add(name);
  }
  for (const a of procedures.approaches) {
    const name = normalizeRunwayName(a.runway ?? approachRunway(a.name));
    if (name) names.add(name);
  }
  return [...names];
}

function readEnd(
  tokens: string[],
  index: number
): { name: string; lat: number; lon: number } | null {
  const name = normalizeRunwayName(tokens[index]);
  const lat = Number(tokens[index + 1]);
  const lon = Number(tokens[index + 2]);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return { name, lat, lon };
}

export function runwayEndsFromApt(aptText: string): RunwayEnd[] {
  const ends = new Map<string, RunwayEnd>();
  let elevationFt: number | undefined;
  for (const rawLine of aptText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith(`${AIRPORT_HEADER_ROW} `)) {
      const elevation = Number(line.split(/\s+/)[1]);
      if (Number.isFinite(elevation)) elevationFt = elevation;
      continue;
    }
    if (!line.startsWith(`${LAND_RUNWAY_ROW} `)) continue;
    const tokens = line.split(/\s+/);
    const one = readEnd(tokens, END_ONE_INDEX);
    const two = readEnd(tokens, END_TWO_INDEX);
    if (!one || !two) continue;
    const a = { latitude: one.lat, longitude: one.lon };
    const b = { latitude: two.lat, longitude: two.lon };
    const lengthNm = greatCircleNm(a, b);
    ends.set(one.name, {
      name: one.name,
      ...a,
      headingDeg: bearingDeg(a, b),
      lengthNm,
      elevationFt,
    });
    ends.set(two.name, {
      name: two.name,
      ...b,
      headingDeg: bearingDeg(b, a),
      lengthNm,
      elevationFt,
    });
  }
  return [...ends.values()].sort(
    (x, y) => parseInt(x.name, 10) - parseInt(y.name, 10) || x.name.localeCompare(y.name)
  );
}
