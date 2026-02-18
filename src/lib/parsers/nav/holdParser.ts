/**
 * Parser for X-Plane earth_hold.dat file
 * Parses holding patterns with fix, course, timing, and altitude data
 */
import { z } from 'zod';
import type { HoldingPattern } from '@/types/navigation';
import { altitude, bearing, nonNegative } from '../schemas';
import type { ParseError, ParseResult } from '../types';

const HoldingPatternSchema = z.object({
  fixId: z.string().min(1),
  fixRegion: z.string(),
  airport: z.string(),
  fixType: z.number(),
  inboundCourse: bearing,
  legTime: nonNegative,
  legDistance: nonNegative,
  turnDirection: z.enum(['L', 'R']),
  minAlt: altitude,
  maxAlt: altitude,
  speedKts: nonNegative,
});

export function parseHoldingPatterns(content: string): ParseResult<HoldingPattern[]> {
  const startTime = Date.now();
  const lines = content.split('\n');
  const patterns: HoldingPattern[] = [];
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

    const result = HoldingPatternSchema.safeParse({
      fixId: parts[0],
      fixRegion: parts[1],
      airport: parts[2],
      fixType: parseInt(parts[3], 10),
      inboundCourse: parseFloat(parts[4]),
      legTime: parseFloat(parts[5]) || 1,
      legDistance: parseFloat(parts[6]) || 0,
      turnDirection: parts[7],
      minAlt: parseInt(parts[8], 10) || 0,
      maxAlt: parseInt(parts[9], 10) || 99999,
      speedKts: parts.length > 10 ? parseInt(parts[10], 10) || 0 : 0,
    });

    if (!result.success) {
      skipped++;
      continue;
    }

    patterns.push(result.data);
  }

  return {
    data: patterns,
    errors,
    stats: {
      total: lines.length,
      parsed: patterns.length,
      skipped,
      timeMs: Date.now() - startTime,
    },
  };
}
