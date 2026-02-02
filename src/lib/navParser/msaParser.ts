/**
 * MSA (Minimum Sector Altitude) Parser
 * Parses X-Plane earth_msa.dat file containing minimum sector altitude data
 *
 * File format (X-Plane 1100 version):
 * Fix_ID Region SectorBearing1 SectorBearing2 Radius Altitude
 *
 * Example:
 * JFK  K1  000 090 25 3000
 * JFK  K1  090 180 25 2500
 *
 * Each sector is defined by:
 * - Fix ID: The navaid/fix at the center of the MSA circle
 * - Region: ICAO region code
 * - SectorBearing1: Start bearing of the sector (degrees)
 * - SectorBearing2: End bearing of the sector (degrees)
 * - Radius: Radius of the MSA circle in nautical miles
 * - Altitude: Minimum safe altitude in feet MSL
 */
import { MSASector } from './types';

/**
 * Parse earth_msa.dat content into MSASector array
 */
export function parseMSA(content: string): MSASector[] {
  const sectors: MSASector[] = [];
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

    // Parse MSA sector line
    const parts = line.split(/\s+/);
    if (parts.length < 6) {
      continue;
    }

    try {
      const fixId = parts[0];
      const fixRegion = parts[1];
      const sectorBearing1 = parseFloat(parts[2]);
      const sectorBearing2 = parseFloat(parts[3]);
      const radius = parseFloat(parts[4]);
      const altitude = parseInt(parts[5], 10);

      // Validate required fields
      if (
        !fixId ||
        isNaN(sectorBearing1) ||
        isNaN(sectorBearing2) ||
        isNaN(radius) ||
        isNaN(altitude)
      ) {
        continue;
      }

      sectors.push({
        fixId,
        fixRegion,
        sectorBearing1,
        sectorBearing2,
        radius,
        altitude,
      });
    } catch {
      // Skip malformed lines
      continue;
    }
  }

  return sectors;
}

/**
 * Get MSA sectors for a specific fix/navaid
 */
export function getMSAForFix(sectors: MSASector[], fixId: string): MSASector[] {
  const upperFixId = fixId.toUpperCase();
  return sectors.filter((s) => s.fixId.toUpperCase() === upperFixId);
}

/**
 * Get MSA sectors for a specific fix and region
 */
function getMSAForFixAndRegion(sectors: MSASector[], fixId: string, region: string): MSASector[] {
  const upperFixId = fixId.toUpperCase();
  const upperRegion = region.toUpperCase();
  return sectors.filter(
    (s) => s.fixId.toUpperCase() === upperFixId && s.fixRegion.toUpperCase() === upperRegion
  );
}

/**
 * Get the MSA for a specific bearing from a fix
 */
function getMSAAtBearing(sectors: MSASector[], fixId: string, bearing: number): MSASector | null {
  const fixSectors = getMSAForFix(sectors, fixId);

  // Normalize bearing to 0-360
  const normalizedBearing = ((bearing % 360) + 360) % 360;

  for (const sector of fixSectors) {
    if (isBearingInSector(normalizedBearing, sector.sectorBearing1, sector.sectorBearing2)) {
      return sector;
    }
  }

  return null;
}

/**
 * Check if a bearing falls within a sector
 * Handles wrap-around at 360/0 degrees
 */
function isBearingInSector(bearing: number, start: number, end: number): boolean {
  // Handle wrap-around case (e.g., 350 to 010)
  if (start > end) {
    return bearing >= start || bearing < end;
  }
  return bearing >= start && bearing < end;
}

/**
 * Get the highest MSA altitude for a fix (across all sectors)
 */
function getMaxMSAForFix(sectors: MSASector[], fixId: string): number | null {
  const fixSectors = getMSAForFix(sectors, fixId);
  if (fixSectors.length === 0) return null;

  return Math.max(...fixSectors.map((s) => s.altitude));
}

/**
 * Get all unique fix IDs that have MSA data
 */
function getMSAFixIds(sectors: MSASector[]): string[] {
  const fixIds = new Set<string>();
  for (const sector of sectors) {
    fixIds.add(sector.fixId.toUpperCase());
  }
  return Array.from(fixIds).sort();
}

/**
 * Build a lookup index for faster MSA queries
 */
function buildMSAIndex(sectors: MSASector[]): Map<string, MSASector[]> {
  const index = new Map<string, MSASector[]>();

  for (const sector of sectors) {
    const key = `${sector.fixId.toUpperCase()}:${sector.fixRegion.toUpperCase()}`;
    const existing = index.get(key) || [];
    existing.push(sector);
    index.set(key, existing);
  }

  return index;
}

/**
 * Fast MSA lookup using index
 */
function getMSAFromIndex(
  index: Map<string, MSASector[]>,
  fixId: string,
  region: string
): MSASector[] {
  const key = `${fixId.toUpperCase()}:${region.toUpperCase()}`;
  return index.get(key) || [];
}
