/**
 * Parser for X-Plane earth_fix.dat file (FIX1200 format)
 * Parses waypoints/fixes used in navigation
 */
import { Waypoint } from './types';

/**
 * Parse a single line from earth_fix.dat
 * Format: lat lon id region areaCode description
 * Example: -1.000000000  -10.000000000  0110W ENRT GO 2115159 01S010W
 */
function parseWaypointLine(line: string): Waypoint | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 5) return null;

  const latitude = parseFloat(parts[0]);
  const longitude = parseFloat(parts[1]);
  const id = parts[2];
  const region = parts[3]; // e.g., "ENRT" for en-route
  const areaCode = parts[4]; // ICAO region code (2 letters)

  // Remaining parts are description (may include spaces)
  const description = parts.slice(5).join(' ');

  // Validate coordinates
  if (isNaN(latitude) || isNaN(longitude)) {
    return null;
  }

  return {
    id,
    latitude,
    longitude,
    region,
    areaCode,
    description,
  };
}

/**
 * Parse earth_fix.dat file content into waypoints array
 * @param content Raw file content
 * @returns Array of parsed waypoints
 */
export function parseWaypoints(content: string): Waypoint[] {
  const lines = content.split('\n');
  const waypoints: Waypoint[] = [];

  // Skip header lines (first 2 lines are version info)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '99') continue; // Skip empty lines and file end marker

    const waypoint = parseWaypointLine(line);
    if (waypoint) {
      waypoints.push(waypoint);
    }
  }

  return waypoints;
}

/**
 * Filter waypoints by region code
 */
export function filterWaypointsByRegion(waypoints: Waypoint[], regionCode: string): Waypoint[] {
  return waypoints.filter((w) => w.areaCode === regionCode);
}

/**
 * Search waypoints by ID (case-insensitive partial match)
 */
export function searchWaypointsById(waypoints: Waypoint[], searchTerm: string): Waypoint[] {
  const term = searchTerm.toUpperCase();
  return waypoints.filter((w) => w.id.toUpperCase().includes(term));
}
