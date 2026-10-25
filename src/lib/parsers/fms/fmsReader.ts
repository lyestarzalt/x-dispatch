/**
 * X-Plane .fms flight plan reader.
 *
 * Two generations of the file exist and both are still written today. Each is
 * one class here; the reader picks the one the version line names and feeds it
 * the rest of the file. Both produce the same `FMSFlightPlan`, with the
 * departure and arrival rows marked `ADEP` / `ADES`, so nothing downstream
 * needs to know which file it came from.
 */
import { errorMessage } from '@/lib/utils/errors';
import type { FMSFlightPlan, FMSParseResult, FMSWaypoint, FMSWaypointType } from '@/types/fms';

const WAYPOINT_TYPES: readonly number[] = [1, 2, 3, 11, 28];

/** The first version whose rows carry an airway column and whose header names the airports. */
const FIRST_HEADERED_VERSION = 1100;

/** A runway written as a fix, as the old format has no runway line: RW04, RW36L. */
const RUNWAY_FIX = /^RW(\d{2}[LRC]?)$/;

/** How one generation of the file lays out everything after the two header lines. */
export interface FmsFormat {
  readonly name: string;
  /** Consume one non-empty line; the plan accumulates. */
  readLine(line: string, plan: FMSFlightPlan): void;
  /** Settle what only the whole file can tell: endpoints, runways. */
  finish(plan: FMSFlightPlan): void;
}

function emptyPlan(version: number): FMSFlightPlan {
  return { version, departure: { icao: '' }, arrival: { icao: '' }, waypoints: [] };
}

/** TYPE ID [VIA] ALTITUDE LATITUDE LONGITUDE, or null for a line that is not a row. */
function parseRow(line: string, hasVia: boolean): FMSWaypoint | null {
  const parts = line.split(/\s+/);
  const width = hasVia ? 6 : 5;
  if (parts.length < width) return null;
  const [typeStr, id] = parts;
  const [altStr, latStr, lonStr] = parts.slice(hasVia ? 3 : 2, width);
  if (!typeStr || !id || !altStr || !latStr || !lonStr) return null;
  const type = parseInt(typeStr, 10);
  if (!WAYPOINT_TYPES.includes(type)) return null;
  const latitude = parseFloat(latStr);
  const longitude = parseFloat(lonStr);
  if (isNaN(latitude) || isNaN(longitude)) return null;
  return {
    type: type as FMSWaypointType,
    id,
    via: hasVia ? parts[2]! : 'DRCT',
    altitude: parseFloat(altStr),
    latitude,
    longitude,
  };
}

/**
 * "1100 Version", written by X-Plane 11 and 12 and by every planner: KEY VALUE
 * header lines, then six-column rows. Header lines and rows are told apart by
 * their first word wherever they sit, because planners differ: FlyCharts
 * writes SID and STAR after NUMENR, and NUMENR itself is not trusted (one
 * planner counts the procedure legs it never writes). A key only matches
 * whole, so SIDTRANS never overwrites SID.
 */
export class HeaderedFormat implements FmsFormat {
  readonly name = 'X-Plane 11/12 (1100)';

  readLine(line: string, plan: FMSFlightPlan): void {
    const [key, value = ''] = line.split(/\s+/);
    switch (key) {
      case 'CYCLE':
        plan.cycle = value;
        return;
      case 'ADEP':
        plan.departure.icao = value;
        return;
      case 'DEPRWY':
        plan.departure.runway = value.replace(/^RW/, '');
        return;
      case 'SID':
        plan.departure.sid = value;
        return;
      case 'SIDTRANS':
        plan.departure.sidTransition = value;
        return;
      case 'ADES':
        plan.arrival.icao = value;
        return;
      case 'DESRWY':
        plan.arrival.runway = value.replace(/^RW/, '');
        return;
      case 'STAR':
        plan.arrival.star = value;
        return;
      case 'STARTRANS':
        plan.arrival.starTransition = value;
        return;
      case 'APP':
        plan.arrival.approach = value;
        return;
      case 'APPTRANS':
        plan.arrival.approachTransition = value;
        return;
      case 'NUMENR':
        return;
      default: {
        const row = parseRow(line, true);
        if (row) plan.waypoints.push(row);
      }
    }
  }

  finish(): void {
    // The header named the airports; the rows already say ADEP and ADES.
  }
}

/**
 * "3 version", the X-Plane 10 layout that aircraft FMCs (the Zibo 737 among
 * them) still write: two flag lines, then five-column rows and nothing else.
 * The first and last airport rows are the departure and arrival, every other
 * row is flown direct. A runway row right after the departure names its
 * runway; one anywhere later names the arrival runway, and the rows between
 * it and the arrival are the missed approach, not the route.
 */
export class RowsOnlyFormat implements FmsFormat {
  readonly name = 'X-Plane 10 (3)';

  readLine(line: string, plan: FMSFlightPlan): void {
    const row = parseRow(line, false);
    if (row) plan.waypoints.push(row);
  }

  finish(plan: FMSFlightPlan): void {
    const rows = plan.waypoints;
    const first = rows.findIndex((wp) => wp.type === 1);
    const last = rows.findLastIndex((wp) => wp.type === 1);
    if (first === -1 || last === first) return;

    const departure = rows[first]!;
    const arrival = rows[last]!;
    departure.via = 'ADEP';
    arrival.via = 'ADES';
    plan.departure.icao = departure.id;
    plan.arrival.icao = arrival.id;

    let enroute = rows.slice(first + 1, last);
    const depRunway = enroute[0] ? RUNWAY_FIX.exec(enroute[0].id) : null;
    if (depRunway) {
      plan.departure.runway = depRunway[1];
      enroute = enroute.slice(1);
    }
    const arrRunwayAt = enroute.findIndex((wp) => RUNWAY_FIX.test(wp.id));
    if (arrRunwayAt !== -1) {
      plan.arrival.runway = RUNWAY_FIX.exec(enroute[arrRunwayAt]!.id)![1];
      enroute = enroute.slice(0, arrRunwayAt);
    }
    plan.waypoints = [departure, ...enroute, arrival];
  }
}

export class FmsReader {
  /** The layout a version line announces. */
  static formatFor(version: number): FmsFormat {
    return version >= FIRST_HEADERED_VERSION ? new HeaderedFormat() : new RowsOnlyFormat();
  }

  read(content: string): FMSParseResult {
    try {
      const lines = content.split(/\r?\n/).map((l) => l.trim());

      // Byte-order mark: "I" for Intel, "A" for Apple; X-Plane has written "I" for years.
      if (lines[0] !== 'I' && lines[0] !== 'A') {
        return { success: false, data: null, error: 'Invalid FMS file: missing header' };
      }

      // X-Plane writes "1100 Version", the Zibo FMC "3 version".
      const versionMatch = lines[1]?.match(/^(\d+)\s+version/i);
      if (!versionMatch?.[1]) {
        return { success: false, data: null, error: 'Invalid FMS file: missing version' };
      }
      const version = parseInt(versionMatch[1], 10);
      const format = FmsReader.formatFor(version);
      const plan = emptyPlan(version);

      for (const line of lines.slice(2)) {
        if (line) format.readLine(line, plan);
      }
      format.finish(plan);
      return { success: true, data: plan };
    } catch (err) {
      return { success: false, data: null, error: `Parse error: ${errorMessage(err)}` };
    }
  }
}

const reader = new FmsReader();

export function parseFMSFile(content: string): FMSParseResult {
  return reader.read(content);
}
