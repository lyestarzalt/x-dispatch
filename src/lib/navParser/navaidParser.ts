/**
 * Parser for X-Plane earth_nav.dat file (NAV1200 format)
 * Parses all navaid types: VOR, NDB, DME, ILS, markers, FPAP, GLS, LTP/FTP
 */
import { Navaid, NavaidRowCode, NavaidType } from './types';

/**
 * Determine navaid type from row code and name
 */
function determineNavaidType(rowCode: number, name: string): NavaidType | null {
  switch (rowCode) {
    case NavaidRowCode.NDB:
      return 'NDB';
    case NavaidRowCode.VOR:
      // Check name for specific type
      if (name.includes('VORTAC') || name.includes('TACAN')) {
        return 'VORTAC';
      }
      if (name.includes('VOR/DME') || name.includes('VOR-DME')) {
        return 'VOR-DME';
      }
      return 'VOR';
    case NavaidRowCode.LOC:
      return 'ILS'; // ILS localizer
    case NavaidRowCode.LOC_STANDALONE:
      return 'LOC'; // Standalone localizer (LOC, LDA, SDF)
    case NavaidRowCode.GS:
      return 'GS';
    case NavaidRowCode.OM:
      return 'OM';
    case NavaidRowCode.MM:
      return 'MM';
    case NavaidRowCode.IM:
      return 'IM';
    case NavaidRowCode.DME_STANDALONE:
    case NavaidRowCode.DME_NDB:
      if (name.includes('TACAN')) {
        return 'TACAN';
      }
      return 'DME';
    case NavaidRowCode.FPAP:
      return 'FPAP';
    case NavaidRowCode.GLS:
      return 'GLS';
    case NavaidRowCode.LTP_FTP:
      // Determine if LTP or FTP based on name (FTP = fictitious threshold)
      return name.includes('FTP') ? 'FTP' : 'LTP';
    default:
      return null;
  }
}

/**
 * Extract bearing from encoded value (for ILS localizers)
 * Format: magnetic_front_course * 360 + true_bearing
 * Example: 59220.343 = 164 * 360 + 180.343
 */
function extractBearing(encoded: number): number {
  return encoded % 360;
}

/**
 * Extract magnetic front course from encoded bearing (for ILS localizers)
 */
function extractMagneticCourse(encoded: number): number {
  return Math.floor(encoded / 360);
}

/**
 * Extract glidepath angle from encoded value (for GS/GLS/LTP)
 * Format: glidepath_angle * 100000 + true_bearing
 * Example: 300180.343 = 3.0 * 100000 + 180.343
 */
function extractGlidepathAngle(encoded: number): number {
  return Math.floor(encoded / 100000) / 100;
}

/**
 * Extract course from encoded glidepath value
 */
function extractCourseFromGlidepath(encoded: number): number {
  return encoded % 100000;
}

/**
 * Parse a single line from earth_nav.dat
 * Handles all NAV1200 row codes (2-16)
 */
function parseNavaidLine(line: string): Navaid | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 10) return null;

  const rowCode = parseInt(parts[0], 10);

  // Validate row code is one we handle
  if (![2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16].includes(rowCode)) {
    return null;
  }

  const latitude = parseFloat(parts[1]);
  const longitude = parseFloat(parts[2]);
  const elevation = parseInt(parts[3], 10);
  const frequency = parseInt(parts[4], 10);
  const range = parseInt(parts[5], 10);

  // Initialize common fields
  let magneticVariation = 0;
  let bearing: number | undefined;
  let glidepathAngle: number | undefined;
  let course: number | undefined;
  let id: string;
  let region: string;
  let country: string;
  let name: string;
  let associatedAirport: string | undefined;
  let associatedRunway: string | undefined;
  let lengthOffset: number | undefined;
  let thresholdCrossingHeight: number | undefined;
  let refPathIdentifier: string | undefined;
  let approachPerformance: 'LP' | 'LPV' | 'APV-II' | 'GLS' | undefined;

  // Parse based on row code format
  switch (rowCode) {
    case 2: // NDB
    case 3: // VOR/VORTAC/VOR-DME
    case 12: // DME (paired)
    case 13: // DME (standalone)
      // Standard format: code lat lon elev freq range mag_var id region country name...
      magneticVariation = parseFloat(parts[6]);
      id = parts[7];
      region = parts[8];
      country = parts[9];
      name = parts.slice(10).join(' ');
      break;

    case 4: // ILS Localizer
    case 5: {
      // LOC-only (LDA, SDF)
      // Format: code lat lon elev freq range encoded_bearing id airport region runway name...
      // encoded_bearing = mag_course * 360 + true_bearing
      const encodedLocBearing = parseFloat(parts[6]);
      bearing = extractBearing(encodedLocBearing);
      magneticVariation = extractMagneticCourse(encodedLocBearing); // Store mag course
      id = parts[7];
      associatedAirport = parts[8];
      region = parts[9];
      associatedRunway = parts[10];
      name = parts.slice(11).join(' ');
      country = region;
      break;
    }

    case 6: {
      // Glideslope
      // Format: code lat lon elev freq range encoded_gs id airport region runway name
      // encoded_gs = glidepath_angle * 100000 + true_bearing
      const encodedGs = parseFloat(parts[6]);
      glidepathAngle = extractGlidepathAngle(encodedGs);
      bearing = extractCourseFromGlidepath(encodedGs);
      id = parts[7];
      associatedAirport = parts[8];
      region = parts[9];
      associatedRunway = parts[10];
      name = parts.slice(11).join(' ');
      country = region;
      break;
    }

    case 7: // Outer Marker
    case 8: // Middle Marker
    case 9: // Inner Marker
      // Format: code lat lon elev 0 0 bearing id airport region runway name
      bearing = parseFloat(parts[6]);
      id = parts[7];
      associatedAirport = parts[8];
      region = parts[9];
      associatedRunway = parts[10];
      name = parts.slice(11).join(' ');
      country = region;
      break;

    case 14: // FPAP (Final Approach Path Alignment Point)
      // Format: code lat lon height channel length_offset course id airport region runway performance
      lengthOffset = parseFloat(parts[5]); // Uses range field position
      course = parseFloat(parts[6]);
      id = parts[7];
      associatedAirport = parts[8];
      region = parts[9];
      associatedRunway = parts[10];
      name = parts.slice(11).join(' ');
      country = region;
      // Parse approach performance from name
      if (name.includes('LPV')) approachPerformance = 'LPV';
      else if (name.includes('APV-II')) approachPerformance = 'APV-II';
      else if (name.includes('GLS')) approachPerformance = 'GLS';
      else if (name.includes('LP')) approachPerformance = 'LP';
      break;

    case 15: {
      // GLS (GBAS ground station)
      // Format: code lat lon elev channel 0 encoded_gs id airport region runway name
      const encodedGls = parseFloat(parts[6]);
      glidepathAngle = extractGlidepathAngle(encodedGls);
      course = extractCourseFromGlidepath(encodedGls);
      id = parts[7];
      associatedAirport = parts[8];
      region = parts[9];
      associatedRunway = parts[10];
      name = parts.slice(11).join(' ');
      country = region;
      break;
    }

    case 16: {
      // LTP/FTP (Landing/Fictitious Threshold Point)
      // Format: code lat lon height channel tch encoded_gs id airport region runway ref_path_id
      thresholdCrossingHeight = parseFloat(parts[5]); // Uses range field position
      const encodedLtp = parseFloat(parts[6]);
      glidepathAngle = extractGlidepathAngle(encodedLtp);
      course = extractCourseFromGlidepath(encodedLtp);
      id = parts[7];
      associatedAirport = parts[8];
      region = parts[9];
      associatedRunway = parts[10];
      refPathIdentifier = parts[11] || undefined;
      name = refPathIdentifier || 'LTP';
      country = region;
      break;
    }

    default:
      return null;
  }

  const type = determineNavaidType(rowCode, name);
  if (!type) return null;

  return {
    type,
    id,
    name,
    latitude,
    longitude,
    elevation,
    frequency,
    range,
    magneticVariation,
    region,
    country,
    bearing,
    associatedAirport,
    associatedRunway,
    glidepathAngle,
    course,
    lengthOffset,
    thresholdCrossingHeight,
    refPathIdentifier,
    approachPerformance,
  };
}

/**
 * Parse earth_nav.dat file content into navaids array
 * @param content Raw file content
 * @returns Array of parsed navaids
 */
export function parseNavaids(content: string): Navaid[] {
  const lines = content.split('\n');
  const navaids: Navaid[] = [];

  // Skip header lines (first 2 lines are version info)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '99') continue; // Skip empty lines and file end marker

    const navaid = parseNavaidLine(line);
    if (navaid) {
      navaids.push(navaid);
    }
  }

  return navaids;
}
