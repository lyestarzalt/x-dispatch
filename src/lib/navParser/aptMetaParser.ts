/**
 * Airport Metadata Parser
 * Parses X-Plane earth_aptmeta.dat file containing airport metadata
 *
 * File format (X-Plane 1100 version):
 * ICAO Region Latitude Longitude Elevation Class LongestRWY IFR TransitionAlt TransitionLevel
 *
 * Example:
 * OTHH OT  25.274563889   51.608377778    13 C 15900 I 13000 FL150
 *
 * Fields:
 * - ICAO: Airport ICAO code
 * - Region: ICAO region code
 * - Latitude: Airport latitude
 * - Longitude: Airport longitude
 * - Elevation: Airport elevation in feet
 * - Class: C = Controlled, P = Private
 * - LongestRWY: Longest runway in feet
 * - IFR: I = IFR capable, V = VFR only
 * - TransitionAlt: Transition altitude in feet
 * - TransitionLevel: Transition level (FL or feet)
 */
import { AirportMetadata } from './types';

/**
 * Parse earth_aptmeta.dat content into AirportMetadata map
 */
export function parseAirportMetadata(content: string): Map<string, AirportMetadata> {
  const metadata = new Map<string, AirportMetadata>();
  const lines = content.split('\n');

  let headerSkipped = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Skip header lines
    if (!headerSkipped) {
      if (
        line.startsWith('I') ||
        line.startsWith('A') ||
        /^\d+$/.test(line) ||
        line.includes('Copyright')
      ) {
        continue;
      }
      headerSkipped = true;
    }

    // Skip end-of-file marker
    if (line === '99') {
      break;
    }

    // Parse airport metadata line
    const parts = line.split(/\s+/);
    if (parts.length < 10) {
      continue;
    }

    try {
      const icao = parts[0].toUpperCase();
      const region = parts[1];
      const latitude = parseFloat(parts[2]);
      const longitude = parseFloat(parts[3]);
      const elevation = parseInt(parts[4], 10);
      const airportClass = parts[5] as 'C' | 'P';
      const longestRunway = parseInt(parts[6], 10);
      const ifrFlag = parts[7];
      const transitionAlt = parseInt(parts[8], 10);
      const transitionLevel = parts[9];

      // Validate required fields
      if (!icao || isNaN(latitude) || isNaN(longitude)) {
        continue;
      }

      // Validate airport class
      if (airportClass !== 'C' && airportClass !== 'P') {
        continue;
      }

      metadata.set(icao, {
        icao,
        region,
        latitude,
        longitude,
        elevation: isNaN(elevation) ? 0 : elevation,
        airportClass,
        longestRunway: isNaN(longestRunway) ? 0 : longestRunway,
        ifrCapable: ifrFlag === 'I',
        transitionAlt: isNaN(transitionAlt) ? 18000 : transitionAlt,
        transitionLevel: transitionLevel || 'FL180',
      });
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  return metadata;
}
