/**
 * Parser for OpenAir airspace format
 * Used by X-Plane's airspace.txt file
 *
 * OpenAir format commands:
 * AC = Airspace Class (A, B, C, D, CTR, TMA, R, P, etc.)
 * AN = Airspace Name
 * AH = Altitude High (upper limit)
 * AL = Altitude Low (lower limit)
 * DP = Define Point (DMS format: dd:mm:ss N/S ddd:mm:ss E/W)
 * DC = Define Circle (radius in NM)
 * DA = Define Arc (radius, start angle, end angle)
 * DB = Define Arc by points
 * V = Variable definition (X=center, D=direction)
 */
import { Airspace } from './types';

/**
 * Parse DMS (degrees:minutes:seconds) coordinate to decimal degrees
 * Format: "dd:mm:ss N" or "ddd:mm:ss W"
 */
function parseDMS(dms: string): number {
  const parts = dms.trim().split(/\s+/);
  if (parts.length !== 2) return NaN;

  const coordStr = parts[0];
  const direction = parts[1].toUpperCase();

  const coordParts = coordStr.split(':');
  if (coordParts.length !== 3) return NaN;

  const degrees = parseInt(coordParts[0], 10);
  const minutes = parseInt(coordParts[1], 10);
  const seconds = parseInt(coordParts[2], 10);

  if (isNaN(degrees) || isNaN(minutes) || isNaN(seconds)) return NaN;

  let decimal = degrees + minutes / 60 + seconds / 3600;

  // Apply direction (S and W are negative)
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }

  return decimal;
}

/**
 * Parse a DP (Define Point) line
 * Format: DP dd:mm:ss N ddd:mm:ss W
 * Returns [longitude, latitude] for GeoJSON compatibility
 */
function parsePoint(line: string): [number, number] | null {
  // Remove "DP" prefix and trim
  const content = line.replace(/^DP\s+/i, '').trim();

  // Split into lat and lon parts
  // Format: "dd:mm:ss N ddd:mm:ss W" or similar
  const match = content.match(/(\d+:\d+:\d+\s+[NS])\s+(\d+:\d+:\d+\s+[EW])/i);
  if (!match) return null;

  const lat = parseDMS(match[1]);
  const lon = parseDMS(match[2]);

  if (isNaN(lat) || isNaN(lon)) return null;

  return [lon, lat]; // GeoJSON uses [lon, lat] order
}

/**
 * Normalize airspace class to our enum
 */
function normalizeAirspaceClass(classStr: string): string {
  const upperClass = classStr.toUpperCase().trim();

  switch (upperClass) {
    case 'A':
      return 'A';
    case 'B':
      return 'B';
    case 'C':
      return 'C';
    case 'D':
      return 'D';
    case 'E':
      return 'E';
    case 'F':
      return 'F';
    case 'G':
      return 'G';
    case 'CTR':
      return 'CTR';
    case 'TMA':
      return 'TMA';
    case 'R':
      return 'R';
    case 'P':
      return 'P';
    case 'Q':
      return 'Q';
    case 'W':
      return 'W';
    case 'GP':
      return 'GP';
    default:
      return 'OTHER';
  }
}

/**
 * Parse OpenAir airspace file content
 * @param content Raw file content
 * @returns Array of parsed airspaces
 */
export function parseAirspaces(content: string): Airspace[] {
  const lines = content.split('\n');
  const airspaces: Airspace[] = [];

  let currentAirspace: Partial<Airspace> | null = null;
  let currentCoordinates: [number, number][] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('*')) continue;

    // Get the command
    const command = line.substring(0, 2).toUpperCase();

    switch (command) {
      case 'AC':
        // New airspace class - save previous if exists
        if (currentAirspace && currentCoordinates.length >= 3) {
          // Close the polygon if needed
          if (currentCoordinates.length > 0) {
            const first = currentCoordinates[0];
            const last = currentCoordinates[currentCoordinates.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
              currentCoordinates.push([...first]);
            }
          }

          airspaces.push({
            class: currentAirspace.class || 'OTHER',
            name: currentAirspace.name || 'Unknown',
            upperLimit: currentAirspace.upperLimit || 'UNL',
            lowerLimit: currentAirspace.lowerLimit || 'GND',
            coordinates: currentCoordinates,
          });
        }

        // Start new airspace
        currentAirspace = {
          class: normalizeAirspaceClass(line.substring(2).trim()),
        };
        currentCoordinates = [];
        break;

      case 'AN':
        if (currentAirspace) {
          currentAirspace.name = line.substring(2).trim();
        }
        break;

      case 'AH':
        if (currentAirspace) {
          currentAirspace.upperLimit = line.substring(2).trim();
        }
        break;

      case 'AL':
        if (currentAirspace) {
          currentAirspace.lowerLimit = line.substring(2).trim();
        }
        break;

      case 'DP': {
        const point = parsePoint(line);
        if (point) {
          currentCoordinates.push(point);
        }
        break;
      }

      // Skip circle and arc definitions for now
      // TODO require more complex geometry calculations
      case 'DC':
      case 'DA':
      case 'DB':
      case 'V ':
        // TODO: Implement circle and arc support
        break;
    }
  }

  // TODO Don't forget the last airspace
  if (currentAirspace && currentCoordinates.length >= 3) {
    // Close the polygon if needed
    const first = currentCoordinates[0];
    const last = currentCoordinates[currentCoordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      currentCoordinates.push([...first]);
    }

    airspaces.push({
      class: currentAirspace.class || 'OTHER',
      name: currentAirspace.name || 'Unknown',
      upperLimit: currentAirspace.upperLimit || 'UNL',
      lowerLimit: currentAirspace.lowerLimit || 'GND',
      coordinates: currentCoordinates,
    });
  }

  return airspaces;
}

/**
 * Filter airspaces by class
 */
function filterAirspacesByClass(airspaces: Airspace[], classes: string[]): Airspace[] {
  return airspaces.filter((a) => classes.includes(a.class));
}

/**
 * Get controlled airspaces (A, B, C, D, CTR, TMA)
 */
function getControlledAirspaces(airspaces: Airspace[]): Airspace[] {
  return filterAirspacesByClass(airspaces, ['A', 'B', 'C', 'D', 'CTR', 'TMA']);
}

/**
 * Get restricted/prohibited airspaces (R, P)
 */
function getRestrictedAirspaces(airspaces: Airspace[]): Airspace[] {
  return filterAirspacesByClass(airspaces, ['R', 'P']);
}
