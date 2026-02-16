/**
 * Airport Scanner
 * Quick scanner for apt.dat files that extracts airport headers and metadata.
 * Uses Zod for validation at parsing boundary.
 *
 * apt.dat format reference:
 * - Row code 1: Land airport header
 * - Row code 16: Seaplane base header
 * - Row code 17: Heliport header
 * - Row code 100: Runway (used for fallback coordinates)
 * - Row code 102: Helipad (used for fallback coordinates)
 * - Row code 1302: Airport metadata
 * - Row code 99: End of file
 */
import { z } from 'zod';
import { latitude, longitude } from '@/lib/parsers/schemas';
import type { ParsedAirportEntry } from '../types';
import { FastFileReader } from '../utils';

// ============================================================================
// Zod Schemas for Airport Header Validation
// ============================================================================

const AirportTypeSchema = z.enum(['land', 'seaplane', 'heliport']);

const AirportHeaderSchema = z.object({
  icao: z.string().min(2).max(7),
  name: z.string().min(1),
  elevation: z.number().int(),
  type: AirportTypeSchema,
});

const AirportCoordsSchema = z.object({
  lat: latitude,
  lon: longitude,
});

const AirportMetadataSchema = z.object({
  city: z.string().optional(),
  country: z.string().optional(),
  iataCode: z.string().length(3).optional(),
  faaCode: z.string().optional(),
  regionCode: z.string().optional(),
  state: z.string().optional(),
  transitionAlt: z.number().int().positive().optional(),
  transitionLevel: z.string().optional(),
  towerServiceType: z.string().optional(),
  driveOnLeft: z.boolean().optional(),
  guiLabel: z.string().optional(),
});

// ============================================================================
// Scanner Types
// ============================================================================

interface ScanningAirport {
  icao: string;
  name: string;
  elevation: number;
  type: 'land' | 'seaplane' | 'heliport';
  datumLat: number;
  datumLon: number;
  runwayLat: number;
  runwayLon: number;
  data: string[];
  // Metadata
  city?: string;
  country?: string;
  iataCode?: string;
  faaCode?: string;
  regionCode?: string;
  state?: string;
  transitionAlt?: number;
  transitionLevel?: string;
  towerServiceType?: string;
  driveOnLeft?: boolean;
  guiLabel?: string;
}

export interface ScanResult {
  airports: Map<string, ParsedAirportEntry>;
  errors: Array<{ icao?: string; message: string }>;
  stats: {
    total: number;
    valid: number;
    invalid: number;
  };
}

// ============================================================================
// Scanner Implementation
// ============================================================================

/**
 * Parse airport header line (row codes 1, 16, 17)
 */
function parseAirportHeader(line: string): ScanningAirport | null {
  const parts = line.split(/\s+/);
  if (parts.length < 5) return null;

  const rowCode = parts[0];
  const type = rowCode === '1' ? 'land' : rowCode === '16' ? 'seaplane' : 'heliport';

  const result = AirportHeaderSchema.safeParse({
    icao: parts[4],
    name: parts.slice(5).join(' '),
    elevation: parseInt(parts[1], 10),
    type,
  });

  if (!result.success) return null;

  return {
    ...result.data,
    datumLat: 0,
    datumLon: 0,
    runwayLat: 0,
    runwayLon: 0,
    data: [line],
  };
}

/**
 * Parse runway line (row code 100) for fallback coordinates
 */
function parseRunwayCoords(line: string): { lat: number; lon: number } | null {
  const parts = line.split(/\s+/);
  if (parts.length < 11) return null;

  const result = AirportCoordsSchema.safeParse({
    lat: parseFloat(parts[9]),
    lon: parseFloat(parts[10]),
  });

  return result.success ? result.data : null;
}

/**
 * Parse helipad line (row code 102) for fallback coordinates
 */
function parseHelipadCoords(line: string): { lat: number; lon: number } | null {
  const parts = line.split(/\s+/);
  if (parts.length < 4) return null;

  const result = AirportCoordsSchema.safeParse({
    lat: parseFloat(parts[2]),
    lon: parseFloat(parts[3]),
  });

  return result.success ? result.data : null;
}

/**
 * Parse metadata line (row code 1302)
 */
function parseMetadata(line: string, airport: ScanningAirport): void {
  const parts = line.split(/\s+/);
  if (parts.length < 3) return;

  const key = parts[1];
  const value = parts.slice(2).join(' ').trim();
  if (!value) return;

  switch (key) {
    case 'city':
      airport.city = value;
      break;
    case 'country':
      airport.country = value;
      break;
    case 'iata_code':
      airport.iataCode = value;
      break;
    case 'faa_code':
      airport.faaCode = value;
      break;
    case 'region_code':
      airport.regionCode = value;
      break;
    case 'state':
      airport.state = value;
      break;
    case 'transition_alt': {
      const alt = parseInt(value, 10);
      if (!isNaN(alt) && alt > 0) airport.transitionAlt = alt;
      break;
    }
    case 'transition_level':
      airport.transitionLevel = value;
      break;
    case 'tower_service_type':
      airport.towerServiceType = value;
      break;
    case 'drive_on_left':
      airport.driveOnLeft = value === '1';
      break;
    case 'gui_label':
      airport.guiLabel = value;
      break;
    case 'datum_lat': {
      const lat = parseFloat(value);
      if (!isNaN(lat)) airport.datumLat = lat;
      break;
    }
    case 'datum_lon': {
      const lon = parseFloat(value);
      if (!isNaN(lon)) airport.datumLon = lon;
      break;
    }
  }
}

/**
 * Finalize a scanned airport into a ParsedAirportEntry
 */
function finalizeAirport(
  airport: ScanningAirport,
  sourceFile: string,
  errors: Array<{ icao?: string; message: string }>
): ParsedAirportEntry | null {
  // Prefer datum coordinates, fallback to runway/helipad coordinates
  const lat = airport.datumLat || airport.runwayLat;
  const lon = airport.datumLon || airport.runwayLon;

  // Validate final coordinates
  const coordsResult = AirportCoordsSchema.safeParse({ lat, lon });
  if (!coordsResult.success) {
    errors.push({
      icao: airport.icao,
      message: `Invalid coordinates for ${airport.icao}: lat=${lat}, lon=${lon}`,
    });
    return null;
  }

  // Validate metadata if present
  const metaResult = AirportMetadataSchema.safeParse({
    city: airport.city,
    country: airport.country,
    iataCode: airport.iataCode,
    faaCode: airport.faaCode,
    regionCode: airport.regionCode,
    state: airport.state,
    transitionAlt: airport.transitionAlt,
    transitionLevel: airport.transitionLevel,
    towerServiceType: airport.towerServiceType,
    driveOnLeft: airport.driveOnLeft,
    guiLabel: airport.guiLabel,
  });

  const metadata = metaResult.success ? metaResult.data : {};

  return {
    icao: airport.icao,
    name: airport.name,
    lat: coordsResult.data.lat,
    lon: coordsResult.data.lon,
    type: airport.type,
    elevation: airport.elevation || undefined,
    data: airport.data.join('\n'),
    sourceFile,
    ...metadata,
  };
}

/**
 * Scan an apt.dat file and extract airport entries
 * Uses streaming to handle large files efficiently
 */
export async function scanAptFile(aptPath: string): Promise<ScanResult> {
  const airports = new Map<string, ParsedAirportEntry>();
  const errors: Array<{ icao?: string; message: string }> = [];
  let total = 0;
  let valid = 0;

  const reader = new FastFileReader(aptPath);
  let currentAirport: ScanningAirport | null = null;

  const finalizeCurrent = () => {
    if (!currentAirport) return;
    total++;

    const entry = finalizeAirport(currentAirport, aptPath, errors);
    if (entry) {
      airports.set(entry.icao, entry);
      valid++;
    }
  };

  for await (const { line } of reader.readLines()) {
    const trimmed = line.trim();

    // End of file
    if (trimmed === '99') {
      finalizeCurrent();
      break;
    }

    // Airport/Seaplane/Heliport header (row codes 1, 16, 17)
    if (/^(1|16|17)\s/.test(line)) {
      finalizeCurrent();
      currentAirport = parseAirportHeader(line);
      continue;
    }

    if (!currentAirport) continue;

    // Metadata (row code 1302)
    if (line.startsWith('1302 ')) {
      parseMetadata(line, currentAirport);
    }

    // Runway (row code 100) - extract first runway coordinates as fallback
    if (line.startsWith('100 ') && !currentAirport.runwayLat) {
      const coords = parseRunwayCoords(line);
      if (coords) {
        currentAirport.runwayLat = coords.lat;
        currentAirport.runwayLon = coords.lon;
      }
    }

    // Helipad (row code 102) - extract coordinates as fallback
    if (line.startsWith('102 ') && !currentAirport.runwayLat) {
      const coords = parseHelipadCoords(line);
      if (coords) {
        currentAirport.runwayLat = coords.lat;
        currentAirport.runwayLon = coords.lon;
      }
    }

    // Store all lines for later full parsing
    currentAirport.data.push(line);
  }

  return {
    airports,
    errors,
    stats: {
      total,
      valid,
      invalid: total - valid,
    },
  };
}
