/**
 * MORA (Minimum Off-Route Altitude) Parser
 * Parses X-Plane earth_mora.dat file containing grid-based minimum altitude data
 *
 * File format (X-Plane 1100 version):
 * The file contains a grid of altitude values. Each line represents a row of the grid,
 * and each value represents the minimum off-route altitude for that grid cell.
 *
 * Grid cells are typically 1 degree by 1 degree.
 * Format varies - may be fixed-width or space-separated values.
 *
 * Example formats:
 * 1. Grid format: LatMin LatMax LonMin LonMax Altitude
 * 2. Row format: <latitude> <altitude1> <altitude2> ... <altitudeN>
 */
import { MORACell } from './types';

/**
 * Parse earth_mora.dat content into MORACell array
 * Handles both grid format and row-based formats
 */
export function parseMORA(content: string): MORACell[] {
  const cells: MORACell[] = [];
  const lines = content.split('\n');

  let headerSkipped = false;
  let lineNumber = 0;

  // Try to detect the format
  for (const rawLine of lines) {
    lineNumber++;
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

    // Try to parse as grid cell format: LatMin LonMin LatMax LonMax Altitude
    // or: LatMin LatMax LonMin LonMax Altitude
    const parts = line.split(/\s+/);

    if (parts.length >= 5) {
      // Try format: LatMin LonMin LatMax LonMax Altitude
      const latMin = parseFloat(parts[0]);
      const lonMin = parseFloat(parts[1]);
      const latMax = parseFloat(parts[2]);
      const lonMax = parseFloat(parts[3]);
      const altitude = parseInt(parts[4], 10);

      if (
        !isNaN(latMin) &&
        !isNaN(lonMin) &&
        !isNaN(latMax) &&
        !isNaN(lonMax) &&
        !isNaN(altitude)
      ) {
        cells.push({
          latMin,
          latMax,
          lonMin,
          lonMax,
          altitude,
        });
        continue;
      }
    }

    // Try row-based format: <latitude> <alt1> <alt2> ...
    // Where each altitude is for consecutive longitude cells
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      if (!isNaN(lat)) {
        // Each subsequent value is an altitude for longitude starting at -180
        for (let i = 1; i < parts.length; i++) {
          const altitude = parseInt(parts[i], 10);
          if (!isNaN(altitude) && altitude > 0) {
            const lonMin = -180 + (i - 1);
            cells.push({
              latMin: lat,
              latMax: lat + 1,
              lonMin,
              lonMax: lonMin + 1,
              altitude: altitude * 100, // Often stored in hundreds of feet
            });
          }
        }
      }
    }
  }

  return cells;
}

/**
 * Get MORA at a specific point
 * Returns the minimum off-route altitude for the given coordinates
 */
export function getMORAAtPoint(cells: MORACell[], lat: number, lon: number): number | null {
  for (const cell of cells) {
    if (lat >= cell.latMin && lat < cell.latMax && lon >= cell.lonMin && lon < cell.lonMax) {
      return cell.altitude;
    }
  }
  return null;
}

/**
 * Get MORA cells within a bounding box
 */
function getMORACellsInBounds(
  cells: MORACell[],
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number
): MORACell[] {
  return cells.filter(
    (cell) =>
      cell.latMax >= minLat &&
      cell.latMin <= maxLat &&
      cell.lonMax >= minLon &&
      cell.lonMin <= maxLon
  );
}

/**
 * Get the maximum MORA along a route (simplified great circle approximation)
 */
function getMaxMORAAlongRoute(
  cells: MORACell[],
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  samplePoints: number = 10
): number | null {
  let maxAlt: number | null = null;

  for (let i = 0; i <= samplePoints; i++) {
    const t = i / samplePoints;
    const lat = fromLat + (toLat - fromLat) * t;
    const lon = fromLon + (toLon - fromLon) * t;

    const alt = getMORAAtPoint(cells, lat, lon);
    if (alt !== null) {
      if (maxAlt === null || alt > maxAlt) {
        maxAlt = alt;
      }
    }
  }

  return maxAlt;
}

/**
 * Build a spatial index for faster MORA lookups
 * Returns a Map keyed by lat,lon grid coordinates
 */
function buildMORAIndex(cells: MORACell[]): Map<string, MORACell> {
  const index = new Map<string, MORACell>();

  for (const cell of cells) {
    // Use floor of latMin,lonMin as the key
    const key = `${Math.floor(cell.latMin)},${Math.floor(cell.lonMin)}`;
    index.set(key, cell);
  }

  return index;
}

/**
 * Fast MORA lookup using spatial index
 */
function getMORAAtPointIndexed(
  index: Map<string, MORACell>,
  lat: number,
  lon: number
): number | null {
  const key = `${Math.floor(lat)},${Math.floor(lon)}`;
  const cell = index.get(key);
  return cell?.altitude ?? null;
}
