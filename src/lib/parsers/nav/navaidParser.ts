/**
 * Parser for X-Plane earth_nav.dat file (NAV1200 format)
 * Parses all navaid types: VOR, NDB, DME, ILS, markers, FPAP, GLS, LTP/FTP
 */
import { z } from 'zod';
import type { Navaid, NavaidType } from '@/types/navigation';
import { NavaidRowCode } from '@/types/navigation';
import { latitude, longitude } from '../schemas';
import type { ParseError, ParseResult } from '../types';

const NavaidLineSchema = z.object({
  latitude,
  longitude,
  elevation: z.number(),
  frequency: z.number(),
  range: z.number(),
});

function determineNavaidType(rowCode: number, name: string): NavaidType | null {
  switch (rowCode) {
    case NavaidRowCode.NDB:
      return 'NDB';
    case NavaidRowCode.VOR:
      if (name.includes('VORTAC') || name.includes('TACAN')) return 'VORTAC';
      if (name.includes('VOR/DME') || name.includes('VOR-DME')) return 'VOR-DME';
      return 'VOR';
    case NavaidRowCode.LOC:
      return 'ILS';
    case NavaidRowCode.LOC_STANDALONE:
      return 'LOC';
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
      return name.includes('TACAN') ? 'TACAN' : 'DME';
    case NavaidRowCode.FPAP:
      return 'FPAP';
    case NavaidRowCode.GLS:
      return 'GLS';
    case NavaidRowCode.LTP_FTP:
      return name.includes('FTP') ? 'FTP' : 'LTP';
    default:
      return null;
  }
}

function extractBearing(encoded: number): number {
  return encoded % 360;
}

function extractMagneticCourse(encoded: number): number {
  return Math.floor(encoded / 360);
}

function extractGlidepathAngle(encoded: number): number {
  return Math.floor(encoded / 100000) / 100;
}

function extractCourseFromGlidepath(encoded: number): number {
  return encoded % 100000;
}

function parseNavaidLine(parts: string[], rowCode: number): Omit<Navaid, 'type'> | null {
  const base = NavaidLineSchema.safeParse({
    latitude: parseFloat(parts[1]),
    longitude: parseFloat(parts[2]),
    elevation: parseInt(parts[3], 10),
    frequency: parseInt(parts[4], 10),
    range: parseInt(parts[5], 10),
  });

  if (!base.success) return null;

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

  switch (rowCode) {
    case 2:
    case 3:
    case 12:
    case 13:
      magneticVariation = parseFloat(parts[6]);
      id = parts[7];
      region = parts[8];
      country = parts[9];
      name = parts.slice(10).join(' ');
      break;

    case 4:
    case 5: {
      const encodedLocBearing = parseFloat(parts[6]);
      bearing = extractBearing(encodedLocBearing);
      magneticVariation = extractMagneticCourse(encodedLocBearing);
      id = parts[7];
      associatedAirport = parts[8];
      region = parts[9];
      associatedRunway = parts[10];
      name = parts.slice(11).join(' ');
      country = region;
      break;
    }

    case 6: {
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

    case 7:
    case 8:
    case 9:
      bearing = parseFloat(parts[6]);
      id = parts[7];
      associatedAirport = parts[8];
      region = parts[9];
      associatedRunway = parts[10];
      name = parts.slice(11).join(' ');
      country = region;
      break;

    case 14:
      lengthOffset = parseFloat(parts[5]);
      course = parseFloat(parts[6]);
      id = parts[7];
      associatedAirport = parts[8];
      region = parts[9];
      associatedRunway = parts[10];
      name = parts.slice(11).join(' ');
      country = region;
      if (name.includes('LPV')) approachPerformance = 'LPV';
      else if (name.includes('APV-II')) approachPerformance = 'APV-II';
      else if (name.includes('GLS')) approachPerformance = 'GLS';
      else if (name.includes('LP')) approachPerformance = 'LP';
      break;

    case 15: {
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
      thresholdCrossingHeight = parseFloat(parts[5]);
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

  return {
    id,
    name,
    ...base.data,
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

export function parseNavaids(content: string): ParseResult<Navaid[]> {
  const startTime = Date.now();
  const lines = content.split('\n');
  const navaids: Navaid[] = [];
  const errors: ParseError[] = [];
  let skipped = 0;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '99') continue;

    const parts = line.split(/\s+/);
    if (parts.length < 10) {
      skipped++;
      continue;
    }

    const rowCode = parseInt(parts[0], 10);
    if (![2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16].includes(rowCode)) continue;

    const parsed = parseNavaidLine(parts, rowCode);
    if (!parsed) {
      skipped++;
      continue;
    }

    const type = determineNavaidType(rowCode, parsed.name);
    if (!type) {
      skipped++;
      continue;
    }

    navaids.push({ type, ...parsed });
  }

  return {
    data: navaids,
    errors,
    stats: {
      total: lines.length - 2,
      parsed: navaids.length,
      skipped,
      timeMs: Date.now() - startTime,
    },
  };
}
