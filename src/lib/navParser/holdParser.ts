/**
 * Holding Pattern Parser
 * Parses X-Plane earth_hold.dat file containing holding pattern information
 *
 * File format (X-Plane 1100 version):
 * Fix_ID Region Airport Fix_Type Inbound_Course Leg_Time Leg_Distance Turn_Dir Min_Alt Max_Alt Speed
 *
 * Example:
 * AFNAN OT ENRT 11    268.0      1.5      0.0 R    15000    24000      240
 *
 * Fix types:
 * 11 = Waypoint/Fix
 * 3 = VOR
 * 2 = NDB
 */
import { HoldingPattern } from './types';

/**
 * Parse earth_hold.dat content into HoldingPattern array
 */
export function parseHoldingPatterns(content: string): HoldingPattern[] {
  const patterns: HoldingPattern[] = [];
  const lines = content.split('\n');

  let lineNumber = 0;
  let headerSkipped = false;

  for (const rawLine of lines) {
    lineNumber++;
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Skip header lines (format version, copyright, etc.)
    // Header lines typically start with 'I' or contain 'X-Plane' or are version numbers
    if (!headerSkipped) {
      if (
        line.startsWith('I') ||
        line.startsWith('A') ||
        /^\d+$/.test(line) ||
        line.includes('Copyright')
      ) {
        continue;
      }
      // If we get here, we're past the header
      headerSkipped = true;
    }

    // Skip end-of-file marker
    if (line === '99') {
      break;
    }

    // Parse holding pattern line
    const parts = line.split(/\s+/);
    if (parts.length < 10) {
      continue;
    }

    try {
      const fixId = parts[0];
      const fixRegion = parts[1];
      const airport = parts[2]; // ICAO or "ENRT" for enroute
      const fixType = parseInt(parts[3], 10);
      const inboundCourse = parseFloat(parts[4]);
      const legTime = parseFloat(parts[5]);
      const legDistance = parseFloat(parts[6]);
      const turnDirection = parts[7] as 'L' | 'R';
      const minAlt = parseInt(parts[8], 10);
      const maxAlt = parseInt(parts[9], 10);
      const speedKts = parts.length > 10 ? parseInt(parts[10], 10) : 0;

      // Validate required fields
      if (!fixId || isNaN(inboundCourse)) {
        continue;
      }

      // Validate turn direction
      if (turnDirection !== 'L' && turnDirection !== 'R') {
        continue;
      }

      patterns.push({
        fixId,
        fixRegion,
        airport,
        fixType,
        inboundCourse,
        legTime: isNaN(legTime) ? 1 : legTime,
        legDistance: isNaN(legDistance) ? 0 : legDistance,
        turnDirection,
        minAlt: isNaN(minAlt) ? 0 : minAlt,
        maxAlt: isNaN(maxAlt) ? 99999 : maxAlt,
        speedKts: isNaN(speedKts) ? 0 : speedKts,
      });
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  return patterns;
}

/**
 * Get holding patterns for a specific fix
 */
function getHoldingPatternsForFix(patterns: HoldingPattern[], fixId: string): HoldingPattern[] {
  const upperFixId = fixId.toUpperCase();
  return patterns.filter((p) => p.fixId.toUpperCase() === upperFixId);
}

/**
 * Get holding patterns for a specific airport
 */
function getHoldingPatternsForAirport(patterns: HoldingPattern[], icao: string): HoldingPattern[] {
  const upperIcao = icao.toUpperCase();
  return patterns.filter((p) => p.airport.toUpperCase() === upperIcao);
}

/**
 * Get enroute holding patterns only
 */
function getEnrouteHoldingPatterns(patterns: HoldingPattern[]): HoldingPattern[] {
  return patterns.filter((p) => p.airport.toUpperCase() === 'ENRT');
}

/**
 * Get holding patterns within an altitude range
 */
function getHoldingPatternsByAltitude(
  patterns: HoldingPattern[],
  minAlt: number,
  maxAlt: number
): HoldingPattern[] {
  return patterns.filter((p) => p.minAlt <= maxAlt && p.maxAlt >= minAlt);
}
