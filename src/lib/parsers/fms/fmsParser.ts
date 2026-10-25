/**
 * X-Plane FMS Flight Plan Parser
 *
 * Reads the X-Plane 11/12 "1100 Version" format, with its ADEP/ADES header lines and
 * six-column rows, and the X-Plane 10 "3 version" format that some aircraft FMCs (the
 * Zibo 737 among them) still write: five-column rows and nothing else.
 */
import type { FMSFlightPlan, FMSParseResult, FMSWaypoint, FMSWaypointType } from '@/types/fms';

const VALID_WAYPOINT_TYPES: FMSWaypointType[] = [1, 2, 3, 11, 28];

/** Below this the file has no header lines and its rows carry no airway column. */
const FIRST_VERSION_WITH_VIA = 1100;

/** A runway written as a fix, as the old format has no runway line: RW04, RW36L. */
const RUNWAY_FIX = /^RW(\d{2}[LRC]?)$/;

export function parseFMSFile(content: string): FMSParseResult {
  try {
    const lines = content.split(/\r?\n/).map((l) => l.trim());

    // Must start with "I" (Intel byte order)
    if (lines[0] !== 'I') {
      return { success: false, data: null, error: 'Invalid FMS file: missing header' };
    }

    // Parse version. X-Plane writes "1100 Version", the Zibo FMC "3 version".
    const versionMatch = lines[1]?.match(/^(\d+)\s+version/i);
    if (!versionMatch) {
      return { success: false, data: null, error: 'Invalid FMS file: missing version' };
    }
    const versionStr = versionMatch[1];
    if (!versionStr) {
      return { success: false, data: null, error: 'Invalid FMS file: missing version number' };
    }
    const version = parseInt(versionStr, 10);

    const plan: FMSFlightPlan = {
      version,
      departure: { icao: '' },
      arrival: { icao: '' },
      waypoints: [],
    };

    if (version < FIRST_VERSION_WITH_VIA) {
      parseLegacyRows(lines.slice(2), plan);
      return { success: true, data: plan };
    }

    // Header lines and waypoint rows are told apart by their first word, wherever they sit:
    // some planners write the SID and STAR after NUMENR, and NUMENR itself is not trusted
    // (one planner counts the procedure legs it never writes). A key only matches whole,
    // so SIDTRANS never overwrites SID.
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const [key, value = ''] = line.split(/\s+/);
      switch (key) {
        case 'CYCLE':
          plan.cycle = value;
          break;
        case 'ADEP':
          plan.departure.icao = value;
          break;
        case 'DEPRWY':
          plan.departure.runway = value.replace(/^RW/, '');
          break;
        case 'SID':
          plan.departure.sid = value;
          break;
        case 'SIDTRANS':
          plan.departure.sidTransition = value;
          break;
        case 'ADES':
          plan.arrival.icao = value;
          break;
        case 'DESRWY':
          plan.arrival.runway = value.replace(/^RW/, '');
          break;
        case 'STAR':
          plan.arrival.star = value;
          break;
        case 'STARTRANS':
          plan.arrival.starTransition = value;
          break;
        case 'APP':
          plan.arrival.approach = value;
          break;
        case 'APPTRANS':
          plan.arrival.approachTransition = value;
          break;
        case 'NUMENR':
          break;
        default: {
          const waypoint = parseWaypointLine(line);
          if (waypoint) plan.waypoints.push(waypoint);
        }
      }
    }

    return { success: true, data: plan };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * The old format lists rows only: TYPE ID ALTITUDE LATITUDE LONGITUDE. The first and last
 * airport rows are the departure and arrival, every other row is flown direct. A runway
 * row right after the departure names its runway; one anywhere later names the arrival
 * runway, and the rows between it and the arrival are the missed approach, not the route.
 */
function parseLegacyRows(lines: string[], plan: FMSFlightPlan): void {
  const rows: FMSWaypoint[] = [];
  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 5) continue;
    const [typeStr, id, altStr, latStr, lonStr] = parts;
    if (!typeStr || !id || !altStr || !latStr || !lonStr) continue;
    const type = parseInt(typeStr, 10) as FMSWaypointType;
    if (!VALID_WAYPOINT_TYPES.includes(type)) continue;
    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lonStr);
    if (isNaN(latitude) || isNaN(longitude)) continue;
    rows.push({ type, id, via: 'DRCT', altitude: parseFloat(altStr), latitude, longitude });
  }

  const first = rows.findIndex((wp) => wp.type === 1);
  const last = rows.findLastIndex((wp) => wp.type === 1);
  if (first === -1 || last === first) {
    plan.waypoints = rows;
    return;
  }
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

function parseWaypointLine(line: string): FMSWaypoint | null {
  // Format: TYPE ID VIA ALTITUDE LATITUDE LONGITUDE
  // Example: 3 CSO UA31 37000.000000 36.293264 6.608322
  const parts = line.split(/\s+/);
  if (parts.length < 6) return null;

  const [typeStr, id, via, altStr, latStr, lonStr] = parts;
  if (!typeStr || !id || !via || !altStr || !latStr || !lonStr) return null;

  const type = parseInt(typeStr, 10) as FMSWaypointType;
  if (!VALID_WAYPOINT_TYPES.includes(type)) return null;

  const altitude = parseFloat(altStr);
  const latitude = parseFloat(latStr);
  const longitude = parseFloat(lonStr);

  if (isNaN(latitude) || isNaN(longitude)) return null;

  return { type, id, via, altitude, latitude, longitude };
}

/**
 * Get human-readable waypoint type name
 */
export function getWaypointTypeName(type: FMSWaypointType): string {
  switch (type) {
    case 1:
      return 'airport';
    case 2:
      return 'ndb';
    case 3:
      return 'vor';
    case 11:
      return 'fix';
    case 28:
      return 'latlon';
    default:
      return 'unknown';
  }
}
