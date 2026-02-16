/**
 * Parser for Navigraph atc.dat file
 * Parses ATC controller data with frequencies and airspace polygons
 */
import { z } from 'zod';
import { LonLatPath } from '@/types/geo';
import type { ATCController, ATCRole } from '@/types/navigation';
import { lonLat, vhfFrequency } from '../schemas';
import type { ParseError, ParseResult } from '../types';

const ATCRoleSchema = z.enum(['ctr', 'app', 'twr', 'gnd', 'del']);

interface ParsedAirspace {
  minAlt: number;
  maxAlt: number;
  polygon: LonLatPath;
}

export function parseATCData(content: string): ParseResult<ATCController[]> {
  const startTime = Date.now();
  const controllers: ATCController[] = [];
  const lines = content.split('\n');
  const errors: ParseError[] = [];
  let skipped = 0;

  let current: Partial<ATCController> | null = null;
  let airspace: ParsedAirspace | null = null;
  let inPolygon = false;

  const finalize = () => {
    if (!current?.name || !current?.facilityId || !current?.role) {
      if (current) skipped++;
      return;
    }

    controllers.push({
      name: current.name,
      facilityId: current.facilityId,
      role: current.role,
      frequencies: current.frequencies || [],
      airspace: airspace || undefined,
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line === 'CONTROLLER') {
      finalize();
      current = { frequencies: [] };
      airspace = null;
      inPolygon = false;
      continue;
    }

    if (!current) continue;

    if (line.startsWith('NAME ')) {
      current.name = line.substring(5).trim();
    } else if (line.startsWith('FACILITY_ID ')) {
      current.facilityId = line.substring(12).trim();
    } else if (line.startsWith('ROLE ')) {
      const role = line.substring(5).trim().toLowerCase();
      const result = ATCRoleSchema.safeParse(role);
      if (result.success) current.role = result.data;
    } else if (line.startsWith('FREQ ')) {
      const freq = parseInt(line.substring(5).trim(), 10);
      if (!isNaN(freq)) {
        const freqMHz = freq / 100;
        if (vhfFrequency.safeParse(freqMHz).success) {
          current.frequencies = current.frequencies || [];
          current.frequencies.push(freqMHz);
        }
      }
    } else if (line.startsWith('AIRSPACE_POLYGON_BEGIN')) {
      const parts = line.split(/\s+/);
      airspace = {
        minAlt: parseInt(parts[1], 10) || 0,
        maxAlt: parseInt(parts[2], 10) || 99999,
        polygon: [],
      };
      inPolygon = true;
    } else if (line === 'AIRSPACE_POLYGON_END') {
      inPolygon = false;
    } else if (inPolygon && line.startsWith('POINT ') && airspace) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const lat = parseFloat(parts[1]);
        const lon = parseFloat(parts[2]);
        const result = lonLat.safeParse([lon, lat]);
        if (result.success) airspace.polygon.push([result.data[0], result.data[1]]);
      }
    }
  }

  finalize();

  return {
    data: controllers,
    errors,
    stats: {
      total: lines.length,
      parsed: controllers.length,
      skipped,
      timeMs: Date.now() - startTime,
    },
  };
}
