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
import { issueSummary, recordSkip } from '../types';
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
    const rawLine = lines[i];
    if (!rawLine) continue;
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (!headerSkipped) {
      // The header is a lone byte-order letter and a "1140 Version ..." line.
      if (line === 'I' || line === 'A' || /^\d+\s+Version/i.test(line)) continue;
      headerSkipped = true;
    }

    if (line === '99') break;

    const parts = line.split(/\s+/);
    if (parts.length < 10) {
      skipped++;
      recordSkip(errors, i + 1, 'expected 10 fields');
      continue;
    }

    const [icao, region, latStr, lonStr, elevStr, classStr, rwyStr, ifrStr, transAltStr, transLvl] =
      parts;
    if (
      !icao ||
      !region ||
      !latStr ||
      !lonStr ||
      !elevStr ||
      !classStr ||
      !rwyStr ||
      !ifrStr ||
      !transAltStr ||
      !transLvl
    ) {
      skipped++;
      recordSkip(errors, i + 1, 'empty field');
      continue;
    }

    const rawClass = classStr.toUpperCase();
    const result = AirportMetaSchema.safeParse({
      icao: icao.toUpperCase(),
      region,
      latitude: parseFloat(latStr),
      longitude: parseFloat(lonStr),
      elevation: parseInt(elevStr, 10) || 0,
      airportClass: rawClass === 'C' || rawClass === 'P' ? rawClass : 'C',
      longestRunway: parseInt(rwyStr, 10) || 0,
      ifrCapable: ifrStr === 'I',
      transitionAlt: parseInt(transAltStr, 10) || 18000,
      transitionLevel: transLvl,
    });

    if (!result.success) {
      skipped++;
      recordSkip(errors, i + 1, issueSummary(result.error));
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
