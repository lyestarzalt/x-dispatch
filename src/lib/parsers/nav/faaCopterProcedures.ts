import { isRecord } from '@/lib/utils/typeGuards';
import type {
  CoordResolver,
  ResolvedAirportProcedures,
  ResolvedProcedure,
} from '@/types/navigation';
import type { Degrees } from '@/types/units';
import { parseCIFP } from './cifpParser';
import { enrichProceduresWithCoordinates } from './procedureCoordResolver';

/**
 * Helicopter procedures out of the FAA's coded procedure file (FAACIFP18, downloaded per cycle
 * by `faaCopterDownload.ts`). X-Plane's CIFP, Laminar's and Navigraph's alike, carries none:
 * neither the procedures of a heliport nor the COPTER approaches of an airport (GitHub #432).
 * The FAA codes few of the ones it charts (cycle 2611: one departure shared by three New York
 * heliports and four approaches), and those are what this keeps. US only.
 *
 * The file is ARINC 424-18, one 132-column record per line. A procedure leg holds the same
 * fields as a line of X-Plane's CIFP, which is that record re-laid with commas, so each leg is
 * rewritten into that form and read by `parseCIFP` like any other. The positions of the fixes
 * come along, because X-Plane's stock data lacks some of them.
 */

/** A fix a helicopter procedure uses, where the FAA puts it. */
export interface FaaFix {
  id: string;
  /** ICAO region code (`K6`). */
  region: string;
  /** [-90, 90] */
  latitude: Degrees;
  /** [-180, 180] */
  longitude: Degrees;
}

export interface FaaCopterAirport {
  /** The procedure legs as X-Plane CIFP lines, in the FAA's order. */
  lines: string[];
  fixes: FaaFix[];
}

export interface FaaCopterProcedures {
  /** The AIRAC cycle of the file ("2611"), from its header; null when it has none. */
  cycle: string | null;
  /** Per airport or heliport identifier as the FAA writes it (`KJRA`, `87N`). */
  airports: ReadonlyMap<string, FaaCopterAirport>;
}

const LINE_TYPE: Readonly<Record<string, string>> = { D: 'SID', E: 'STAR', F: 'APPCH' };

/** Route qualifier 2 of an approach leg: `H` marks a helicopter procedure. */
const QUALIFIER_2 = 119;

/** `N40472773` or `W073590794`: hemisphere, degrees, minutes, seconds to the hundredth. */
function parseAngle(field: string): number | null {
  const match = /^([NSEW])(\d{2,3})(\d{2})(\d{2})(\d{2})$/.exec(field);
  if (!match) return null;
  const [, hemisphere, deg, min, sec, hundredths] = match;
  const value = Number(deg) + Number(min) / 60 + (Number(sec) + Number(hundredths) / 100) / 3600;
  return hemisphere === 'S' || hemisphere === 'W' ? -value : value;
}

function parsePosition(line: string, at: number): { latitude: number; longitude: number } | null {
  const latitude = parseAngle(line.slice(at, at + 9));
  const longitude = parseAngle(line.slice(at + 9, at + 19));
  return latitude === null || longitude === null ? null : { latitude, longitude };
}

/** One primary procedure record as the X-Plane CIFP line with the same fields. */
function toCifpLine(line: string): string {
  const cut = (from: number, to: number) => line.slice(from, to);
  const fields = [
    cut(26, 29), // sequence
    cut(19, 20), // route type
    cut(13, 19).trim(), // procedure identifier
    cut(20, 25).trim(), // transition
    cut(29, 34).trim(), // fix
    cut(34, 36), // fix region
    cut(36, 37), // fix section
    cut(37, 38), // fix subsection
    cut(39, 43), // waypoint description
    cut(43, 44), // turn direction
    cut(44, 47), // RNP
    cut(47, 49), // path terminator
    cut(49, 50), // turn direction valid
    cut(50, 54).trim(), // recommended navaid
    cut(54, 56), // its region
    cut(78, 79), // its section
    cut(79, 80), // its subsection
    cut(56, 62), // arc radius
    cut(62, 66), // theta
    cut(66, 70), // rho
    cut(70, 74), // magnetic course
    cut(74, 78), // distance or hold time
    cut(82, 83), // altitude description
    cut(84, 89), // altitude 1
    cut(89, 94), // altitude 2
    cut(94, 99), // transition altitude
    cut(117, 118), // speed limit description
    cut(99, 102), // speed limit
    cut(102, 106), // vertical angle
    '   ',
    cut(106, 111).trim(), // centre fix
    cut(112, 114), // its region
    cut(114, 115), // its section
    cut(115, 116), // its subsection
    cut(111, 112), // multiple code
    cut(116, 117), // GNSS/FMS indicator
    cut(118, 119), // route qualifier 1
    cut(119, 120), // route qualifier 2
  ];
  return `${LINE_TYPE[line.charAt(12)]}:${fields.join(',')};`;
}

const isProcedureRecord = (line: string): boolean =>
  (line.charAt(4) === 'P' || line.charAt(4) === 'H') &&
  line.charAt(12) in LINE_TYPE &&
  // Continuation records repeat a leg with extra data; the leg itself is number 0 or 1.
  (line.charAt(38) === '0' || line.charAt(38) === '1');

const procedureKey = (line: string): string => line.slice(4, 20);

/** The helicopter procedures of the file, with the positions of the fixes they use. */
export function parseFaaCopterProcedures(text: string): FaaCopterProcedures {
  const lines = text.split(/\r?\n/);
  const header = lines[0] ?? '';
  const cycle =
    header.startsWith('HDR01') && /^\d{4}$/.test(header.slice(35, 39))
      ? header.slice(35, 39)
      : null;

  // Every procedure of a heliport counts; an airport's only when the FAA marks it helicopter.
  const copter = new Set<string>();
  for (const line of lines) {
    if (!isProcedureRecord(line)) continue;
    if (line.charAt(4) === 'H' || (line.charAt(12) === 'F' && line.charAt(QUALIFIER_2) === 'H')) {
      copter.add(procedureKey(line));
    }
  }

  const legs = new Map<string, string[]>();
  const wanted = new Map<string, Set<string>>();
  for (const line of lines) {
    if (!isProcedureRecord(line) || !copter.has(procedureKey(line))) continue;
    const airport = line.slice(6, 10).trim();
    if (!legs.has(airport)) {
      legs.set(airport, []);
      wanted.set(airport, new Set());
    }
    legs.get(airport)!.push(line);
    const fix = line.slice(29, 34).trim();
    if (fix) wanted.get(airport)!.add(`${fix}/${line.slice(34, 36)}`);
    const navaid = line.slice(50, 54).trim();
    if (navaid) wanted.get(airport)!.add(`${navaid}/${line.slice(54, 56)}`);
  }

  // Positions: a terminal waypoint belongs to its airport and wins over an enroute fix or a
  // navaid of the same name.
  const terminal = new Map<string, { latitude: number; longitude: number }>();
  const anywhere = new Map<string, { latitude: number; longitude: number }>();
  if (legs.size > 0) {
    for (const line of lines) {
      const section = line.charAt(4);
      if (section === 'E' && line.charAt(5) === 'A') {
        const position = parsePosition(line, 32);
        if (position) anywhere.set(`${line.slice(13, 18).trim()}/${line.slice(19, 21)}`, position);
      } else if ((section === 'P' || section === 'H') && 'CN'.includes(line.charAt(12))) {
        const airport = line.slice(6, 10).trim();
        if (!legs.has(airport)) continue;
        const position = parsePosition(line, 32);
        if (position) {
          terminal.set(`${airport}/${line.slice(13, 18).trim()}/${line.slice(19, 21)}`, position);
        }
      } else if (section === 'D') {
        // A VOR has its own position; a DME or TACAN alone has only the DME's.
        const position = parsePosition(line, 32) ?? parsePosition(line, 55);
        const key = `${line.slice(13, 17).trim()}/${line.slice(19, 21)}`;
        if (position && !anywhere.has(key)) anywhere.set(key, position);
      }
    }
  }

  const airports = new Map<string, FaaCopterAirport>();
  for (const [airport, records] of legs) {
    const fixes: FaaFix[] = [];
    for (const key of [...wanted.get(airport)!].sort()) {
      const position = terminal.get(`${airport}/${key}`) ?? anywhere.get(key);
      if (!position) continue;
      const [id = '', region = ''] = key.split('/');
      fixes.push({ id, region, ...position });
    }
    airports.set(airport, { lines: records.map(toCifpLine), fixes });
  }
  return { cycle, airports };
}

export interface FaaCopterJson {
  cycle: string | null;
  airports: Record<string, { lines: string[]; fixes: [string, string, number, number][] }>;
}

export function faaCopterToJson(data: FaaCopterProcedures): FaaCopterJson {
  return {
    cycle: data.cycle,
    airports: Object.fromEntries(
      [...data.airports].map(([airport, { lines, fixes }]) => [
        airport,
        { lines, fixes: fixes.map((f) => [f.id, f.region, f.latitude, f.longitude]) },
      ])
    ),
  };
}

/** The procedures back from the download cache, or null when the cache is not one. */
export function faaCopterFromJson(json: unknown): FaaCopterProcedures | null {
  if (!isRecord(json) || !isRecord(json.airports)) return null;
  const { cycle } = json;
  if (cycle !== null && (typeof cycle !== 'string' || !/^\d{4}$/.test(cycle))) return null;
  const airports = new Map<string, FaaCopterAirport>();
  for (const [airport, entry] of Object.entries(json.airports)) {
    if (!isRecord(entry) || !Array.isArray(entry.lines) || !Array.isArray(entry.fixes)) return null;
    if (!entry.lines.every((line): line is string => typeof line === 'string')) return null;
    const fixes: FaaFix[] = [];
    for (const fix of entry.fixes as unknown[]) {
      if (!Array.isArray(fix)) return null;
      const [id, region, latitude, longitude] = fix as unknown[];
      if (
        typeof id !== 'string' ||
        typeof region !== 'string' ||
        typeof latitude !== 'number' ||
        typeof longitude !== 'number'
      ) {
        return null;
      }
      fixes.push({ id, region, latitude, longitude });
    }
    airports.set(airport, { lines: entry.lines, fixes });
  }
  return { cycle, airports };
}

/**
 * An airport's FAA helicopter procedures with their fixes placed: from the FAA file first, which
 * is where the procedure and its fixes were coded together, then from `fallback` (the nav
 * database) for what the file leaves out, a runway end. Each is marked helicopter and FAA-only.
 */
export function resolveFaaCopterProcedures(
  icao: string,
  airport: FaaCopterAirport,
  fallback: CoordResolver
): ResolvedAirportProcedures {
  const placed = new Map(airport.fixes.map((f) => [`${f.id}/${f.region}`, f]));
  const resolver: CoordResolver = (fixId, region, type) => {
    const fix = placed.get(`${fixId}/${region}`);
    return fix
      ? { latitude: fix.latitude, longitude: fix.longitude }
      : fallback(fixId, region, type);
  };
  const resolved = enrichProceduresWithCoordinates(
    parseCIFP(airport.lines.join('\n'), icao),
    resolver
  );
  const mark = (p: ResolvedProcedure): ResolvedProcedure => ({
    ...p,
    helicopter: true,
    faaOnly: true,
  });
  return {
    icao: resolved.icao,
    sids: resolved.sids.map(mark),
    stars: resolved.stars.map(mark),
    approaches: resolved.approaches.map(mark),
  };
}

/**
 * The airport's own procedures with the FAA's helicopter procedures after them. One X-Plane's
 * data already has under the same name and transition is not added twice.
 */
export function mergeAirportProcedures(
  own: ResolvedAirportProcedures | null,
  copter: ResolvedAirportProcedures
): ResolvedAirportProcedures {
  if (!own) return copter;
  const join = (mine: ResolvedProcedure[], theirs: ResolvedProcedure[]) => {
    const have = new Set(mine.map((p) => `${p.name}/${p.transition ?? ''}`));
    return [...mine, ...theirs.filter((p) => !have.has(`${p.name}/${p.transition ?? ''}`))];
  };
  return {
    icao: own.icao,
    sids: join(own.sids, copter.sids),
    stars: join(own.stars, copter.stars),
    approaches: join(own.approaches, copter.approaches),
  };
}
