/**
 * X-Plane FMS v1100 Flight Plan Parser
 */
import type { FMSFlightPlan, FMSParseResult, FMSWaypoint, FMSWaypointType } from '@/types/fms';

const VALID_WAYPOINT_TYPES: FMSWaypointType[] = [1, 2, 3, 11, 28];

export function parseFMSFile(content: string): FMSParseResult {
  try {
    const lines = content.split(/\r?\n/).map((l) => l.trim());

    // Must start with "I" (Intel byte order)
    if (lines[0] !== 'I') {
      return { success: false, data: null, error: 'Invalid FMS file: missing header' };
    }

    // Parse version
    const versionMatch = lines[1]?.match(/^(\d+)\s+Version/);
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

    let numEnroute = 0;
    let waypointStartIndex = -1;

    // Parse header lines
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      if (line.startsWith('CYCLE')) {
        plan.cycle = line.split(/\s+/)[1];
      } else if (line.startsWith('ADEP')) {
        plan.departure.icao = line.split(/\s+/)[1] || '';
      } else if (line.startsWith('DEPRWY')) {
        const rwy = line.split(/\s+/)[1];
        plan.departure.runway = rwy?.replace(/^RW/, '');
      } else if (line.startsWith('SID')) {
        plan.departure.sid = line.split(/\s+/)[1];
      } else if (line.startsWith('SIDTRANS')) {
        plan.departure.sidTransition = line.split(/\s+/)[1];
      } else if (line.startsWith('ADES')) {
        plan.arrival.icao = line.split(/\s+/)[1] || '';
      } else if (line.startsWith('DESRWY')) {
        const rwy = line.split(/\s+/)[1];
        plan.arrival.runway = rwy?.replace(/^RW/, '');
      } else if (line.startsWith('STAR')) {
        plan.arrival.star = line.split(/\s+/)[1];
      } else if (line.startsWith('STARTRANS')) {
        plan.arrival.starTransition = line.split(/\s+/)[1];
      } else if (line.startsWith('APP')) {
        plan.arrival.approach = line.split(/\s+/)[1];
      } else if (line.startsWith('APPTRANS')) {
        plan.arrival.approachTransition = line.split(/\s+/)[1];
      } else if (line.startsWith('NUMENR')) {
        numEnroute = parseInt(line.split(/\s+/)[1] || '0', 10);
        waypointStartIndex = i + 1;
        break;
      }
    }

    // Parse waypoints
    if (waypointStartIndex > 0 && numEnroute > 0) {
      for (
        let i = waypointStartIndex;
        i < lines.length && plan.waypoints.length < numEnroute;
        i++
      ) {
        const line = lines[i];
        if (!line) continue;

        const waypoint = parseWaypointLine(line);
        if (waypoint) {
          plan.waypoints.push(waypoint);
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
