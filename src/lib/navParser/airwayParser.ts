import { AirwaySegment } from './types';

/**
 * Parse a single line from earth_awy.dat
 * Format: from_fix from_region from_type to_fix to_region to_type high_low direction base_fl top_fl airway_name
 * Example: AADCO K2 11 LOLIC K2 11 N 1 115 179 V257
 */
function parseAirwayLine(line: string): AirwaySegment | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 11) return null;

  const fromFix = parts[0];
  const fromRegion = parts[1];
  const fromNavaidType = parseInt(parts[2], 10);
  const toFix = parts[3];
  const toRegion = parts[4];
  const toNavaidType = parseInt(parts[5], 10);
  const highLow = parts[6]; // N = low altitude, F = high altitude
  const direction = parseInt(parts[7], 10); // 1 = forward, 2 = backward, 3 = both (unused typically)
  const baseFl = parseInt(parts[8], 10);
  const topFl = parseInt(parts[9], 10);
  const name = parts[10];

  // Validate numeric fields
  if (
    isNaN(fromNavaidType) ||
    isNaN(toNavaidType) ||
    isNaN(direction) ||
    isNaN(baseFl) ||
    isNaN(topFl)
  ) {
    return null;
  }

  return {
    name,
    fromFix,
    fromRegion,
    fromNavaidType,
    toFix,
    toRegion,
    toNavaidType,
    isHigh: highLow === 'F',
    direction,
    baseFl,
    topFl,
  };
}

/**
 * Parse earth_awy.dat file content into airway segments
 * @param content Raw file content
 * @returns Array of parsed airway segments
 */
export function parseAirways(content: string): AirwaySegment[] {
  const lines = content.split('\n');
  const segments: AirwaySegment[] = [];

  // Skip header lines (first 2 lines are version info)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '99') continue; // Skip empty lines and file end marker

    const segment = parseAirwayLine(line);
    if (segment) {
      segments.push(segment);
    }
  }

  return segments;
}

/**
 * Group airway segments by airway name
 */
function groupByAirway(segments: AirwaySegment[]): Map<string, AirwaySegment[]> {
  const grouped = new Map<string, AirwaySegment[]>();

  for (const segment of segments) {
    const existing = grouped.get(segment.name);
    if (existing) {
      existing.push(segment);
    } else {
      grouped.set(segment.name, [segment]);
    }
  }

  return grouped;
}

/**
 * Get high altitude airways (jet routes)
 */
function getHighAirways(segments: AirwaySegment[]): AirwaySegment[] {
  return segments.filter((s) => s.isHigh);
}

/**
 * Get low altitude airways (victor routes)
 */
function getLowAirways(segments: AirwaySegment[]): AirwaySegment[] {
  return segments.filter((s) => !s.isHigh);
}

/**
 * Find all airways that pass through a specific fix
 */
function findAirwaysByFix(segments: AirwaySegment[], fixId: string): AirwaySegment[] {
  const upperFix = fixId.toUpperCase();
  return segments.filter(
    (s) => s.fromFix.toUpperCase() === upperFix || s.toFix.toUpperCase() === upperFix
  );
}
