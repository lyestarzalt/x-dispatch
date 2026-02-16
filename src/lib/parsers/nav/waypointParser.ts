/**
 * Parser for X-Plane earth_fix.dat file
 * Parses waypoints/fixes with coordinates, region, and area codes
 */
import { z } from 'zod';
import type { Waypoint } from '@/types/navigation';
import { latitude, longitude } from '../schemas';
import type { ParseError, ParseResult } from '../types';

const WaypointLineSchema = z.object({
  latitude,
  longitude,
  id: z.string().min(1),
  region: z.string(),
  areaCode: z.string(),
});

export function parseWaypoints(content: string): ParseResult<Waypoint[]> {
  const startTime = Date.now();
  const lines = content.split('\n');
  const waypoints: Waypoint[] = [];
  const errors: ParseError[] = [];
  let skipped = 0;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '99') continue;

    const parts = line.split(/\s+/);
    if (parts.length < 5) {
      skipped++;
      continue;
    }

    const result = WaypointLineSchema.safeParse({
      latitude: parseFloat(parts[0]),
      longitude: parseFloat(parts[1]),
      id: parts[2],
      region: parts[3],
      areaCode: parts[4],
    });

    if (!result.success) {
      skipped++;
      continue;
    }

    waypoints.push({
      ...result.data,
      description: parts.slice(5).join(' '),
    });
  }

  return {
    data: waypoints,
    errors,
    stats: {
      total: lines.length - 2,
      parsed: waypoints.length,
      skipped,
      timeMs: Date.now() - startTime,
    },
  };
}
