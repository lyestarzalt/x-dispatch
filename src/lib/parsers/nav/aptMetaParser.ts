/**
 * Airport Metadata Parser
 * Parses X-Plane earth_aptmeta.dat file containing airport metadata
 *
 * File format (X-Plane 1100 version):
 * ICAO Region Latitude Longitude Elevation Class LongestRWY IFR TransitionAlt TransitionLevel
 *
 * Example:
 * OTHH OT  25.274563889   51.608377778    13 C 15900 I 13000 FL150
 */
import { z } from 'zod';
import type { AirportMetadata } from '@/types/navigation';
import { altitude, latitude, longitude, nonNegative } from '../schemas';
import type { ParseError, ParseResult } from '../types';

const AirportMetaSchema = z.object({
  icao: z.string().min(3).max(4),
  region: z.string(),
  latitude,
  longitude,
  elevation: z.number(),
  airportClass: z.enum(['C', 'P']),
  longestRunway: nonNegative,
  ifrCapable: z.boolean(),
  transitionAlt: altitude,
  transitionLevel: z.string(),
});

export function parseAirportMetadata(content: string): ParseResult<Map<string, AirportMetadata>> {
  const startTime = Date.now();
  const metadata = new Map<string, AirportMetadata>();
  const lines = content.split('\n');
  const errors: ParseError[] = [];
  let skipped = 0;
  let headerSkipped = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

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

    if (line === '99') break;

    const parts = line.split(/\s+/);
    if (parts.length < 10) {
      skipped++;
      continue;
    }

    const rawClass = parts[5].toUpperCase();
    const result = AirportMetaSchema.safeParse({
      icao: parts[0].toUpperCase(),
      region: parts[1],
      latitude: parseFloat(parts[2]),
      longitude: parseFloat(parts[3]),
      elevation: parseInt(parts[4], 10) || 0,
      airportClass: rawClass === 'C' || rawClass === 'P' ? rawClass : 'C',
      longestRunway: parseInt(parts[6], 10) || 0,
      ifrCapable: parts[7] === 'I',
      transitionAlt: parseInt(parts[8], 10) || 18000,
      transitionLevel: parts[9] || 'FL180',
    });

    if (!result.success) {
      skipped++;
      continue;
    }

    metadata.set(result.data.icao, result.data);
  }

  return {
    data: metadata,
    errors,
    stats: {
      total: lines.length,
      parsed: metadata.size,
      skipped,
      timeMs: Date.now() - startTime,
    },
  };
}
