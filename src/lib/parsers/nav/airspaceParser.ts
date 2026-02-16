/**
 * Parser for OpenAir format airspace files (airspace.txt)
 * Parses airspace boundaries with class, name, limits, and polygon coordinates
 */
import { z } from 'zod';
import type { Airspace } from '@/types/navigation';
import { lonLat } from '../schemas';
import type { ParseError, ParseResult } from '../types';

function parseDMS(dms: string): number {
  const parts = dms.trim().split(/\s+/);
  if (parts.length !== 2) return NaN;

  const coordParts = parts[0].split(':');
  if (coordParts.length !== 3) return NaN;

  const degrees = parseInt(coordParts[0], 10);
  const minutes = parseInt(coordParts[1], 10);
  const seconds = parseFloat(coordParts[2]);

  if (isNaN(degrees) || isNaN(minutes) || isNaN(seconds)) return NaN;

  let decimal = degrees + minutes / 60 + seconds / 3600;
  const direction = parts[1].toUpperCase();
  if (direction === 'S' || direction === 'W') decimal = -decimal;

  return decimal;
}

function parsePoint(line: string): [number, number] | null {
  const content = line.replace(/^DP\s+/i, '').trim();
  const match = content.match(/(\d+:\d+:\d+\s+[NS])\s+(\d+:\d+:\d+\s+[EW])/i);
  if (!match) return null;

  const lat = parseDMS(match[1]);
  const lon = parseDMS(match[2]);
  const result = lonLat.safeParse([lon, lat]);

  return result.success ? [result.data[0], result.data[1]] : null;
}

function normalizeAirspaceClass(classStr: string): string {
  const upperClass = classStr.toUpperCase().trim();
  const validClasses = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'CTR', 'TMA', 'R', 'P', 'Q', 'W', 'GP'];
  return validClasses.includes(upperClass) ? upperClass : 'OTHER';
}

export function parseAirspaces(content: string): ParseResult<Airspace[]> {
  const startTime = Date.now();
  const lines = content.split('\n');
  const airspaces: Airspace[] = [];
  const errors: ParseError[] = [];
  let skipped = 0;

  let current: Partial<Airspace> | null = null;
  let coords: [number, number][] = [];

  const finalize = () => {
    if (!current || coords.length < 3) {
      if (current) skipped++;
      return;
    }

    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push([...first]);
    }

    airspaces.push({
      class: current.class || 'OTHER',
      name: current.name || 'Unknown',
      upperLimit: current.upperLimit || 'UNL',
      lowerLimit: current.lowerLimit || 'GND',
      coordinates: coords,
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('*')) continue;

    const cmd = line.substring(0, 2).toUpperCase();

    switch (cmd) {
      case 'AC':
        finalize();
        current = { class: normalizeAirspaceClass(line.substring(2).trim()) };
        coords = [];
        break;
      case 'AN':
        if (current) current.name = line.substring(2).trim();
        break;
      case 'AH':
        if (current) current.upperLimit = line.substring(2).trim();
        break;
      case 'AL':
        if (current) current.lowerLimit = line.substring(2).trim();
        break;
      case 'DP': {
        const point = parsePoint(line);
        if (point) coords.push(point);
        break;
      }
    }
  }

  finalize();

  return {
    data: airspaces,
    errors,
    stats: {
      total: lines.length,
      parsed: airspaces.length,
      skipped,
      timeMs: Date.now() - startTime,
    },
  };
}
