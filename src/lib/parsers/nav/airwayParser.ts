/**
 * Parser for X-Plane earth_awy.dat file
 * Parses airway segments connecting waypoints with altitude restrictions
 */
import { z } from 'zod';
import type { AirwaySegment } from '@/types/navigation';
import { flightLevel } from '../schemas';
import type { ParseError, ParseResult } from '../types';

const AirwayLineSchema = z.object({
  fromFix: z.string(),
  fromRegion: z.string(),
  fromNavaidType: z.number(),
  toFix: z.string(),
  toRegion: z.string(),
  toNavaidType: z.number(),
  isHigh: z.boolean(),
  direction: z.number(),
  baseFl: flightLevel,
  topFl: flightLevel,
  name: z.string(),
});

export function parseAirways(content: string): ParseResult<AirwaySegment[]> {
  const startTime = Date.now();
  const lines = content.split('\n');
  const segments: AirwaySegment[] = [];
  const errors: ParseError[] = [];
  let skipped = 0;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '99') continue;

    const parts = line.split(/\s+/);
    if (parts.length < 11) {
      skipped++;
      continue;
    }

    const result = AirwayLineSchema.safeParse({
      fromFix: parts[0],
      fromRegion: parts[1],
      fromNavaidType: parseInt(parts[2], 10),
      toFix: parts[3],
      toRegion: parts[4],
      toNavaidType: parseInt(parts[5], 10),
      isHigh: parts[6] === 'F',
      direction: parseInt(parts[7], 10),
      baseFl: parseInt(parts[8], 10),
      topFl: parseInt(parts[9], 10),
      name: parts[10],
    });

    if (!result.success) {
      skipped++;
      continue;
    }

    segments.push(result.data);
  }

  return {
    data: segments,
    errors,
    stats: {
      total: lines.length - 2,
      parsed: segments.length,
      skipped,
      timeMs: Date.now() - startTime,
    },
  };
}
