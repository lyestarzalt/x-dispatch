import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ParsedAirport } from '@/types/apt';
import { AirportParser } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split a raw apt.dat string into per-airport chunks.
 * Each chunk starts at a row-1/16/17 header and ends just before the next one
 * (or before the end-of-file sentinel "99").
 */
function splitAptDat(content: string): string[] {
  const lines = content.split('\n');
  const chunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // End-of-file marker
    if (trimmed === '99') {
      if (current.length > 0) {
        chunks.push(current.join('\n'));
        current = [];
      }
      break;
    }

    // Airport / Seaplane / Heliport header starts a new chunk
    if (/^(1|16|17)\s/.test(trimmed)) {
      if (current.length > 0) {
        chunks.push(current.join('\n'));
      }
      current = [line];
      continue;
    }

    if (current.length > 0) {
      current.push(line);
    }
  }

  // Flush any remaining lines (no trailing 99)
  if (current.length > 0) {
    chunks.push(current.join('\n'));
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Fixture setup
// ---------------------------------------------------------------------------

const FIXTURE_PATH = resolve(__dirname, '../../../../tests/fixtures/apt-sample.dat');

let chunks: string[];

beforeAll(() => {
  const raw = readFileSync(FIXTURE_PATH, 'utf-8');
  chunks = splitAptDat(raw);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseChunk(icao: string): ReturnType<AirportParser['parse']> {
  const chunk = chunks.find((c) => {
    const match = c.match(/^(1|16|17)\s+\S+\s+\S+\s+\S+\s+(\S+)/m);
    return match?.[2] === icao;
  });
  if (!chunk) throw new Error(`No chunk found for ICAO: ${icao}`);
  return new AirportParser(chunk).parse();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('apt-sample.dat fixture', () => {
  it('splits into 5 airport chunks', () => {
    expect(chunks).toHaveLength(5);
  });

  it('all 5 airports are present', () => {
    const icaos = chunks.map((c) => {
      const match = c.match(/^(1|16|17)\s+\S+\s+\S+\s+\S+\s+(\S+)/m);
      return match?.[2];
    });
    expect(icaos).toContain('KJFK');
    expect(icaos).toContain('EGLL');
    expect(icaos).toContain('LFPG');
    expect(icaos).toContain('KLAX');
    expect(icaos).toContain('OTHH');
  });
});

describe('ParseResult shape', () => {
  it('has data, errors, and stats fields', () => {
    const result = parseChunk('KJFK');

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('stats');
    expect(result.stats).toHaveProperty('total');
    expect(result.stats).toHaveProperty('parsed');
    expect(result.stats).toHaveProperty('skipped');
  });
});

describe('KJFK – John F Kennedy Intl', () => {
  let airport: ParsedAirport;

  beforeAll(() => {
    const result = parseChunk('KJFK');
    airport = result.data;
  });

  it('has correct ICAO id', () => {
    expect(airport.id).toBe('KJFK');
  });

  it('has correct name', () => {
    expect(airport.name).toBe('John F Kennedy Intl');
  });

  it('stores datum coordinates in metadata', () => {
    expect(parseFloat(airport.metadata['datum_lat'] ?? '')).toBeCloseTo(40.64, 1);
    expect(parseFloat(airport.metadata['datum_lon'] ?? '')).toBeCloseTo(-73.78, 1);
  });

  it('has runways', () => {
    expect(airport.runways.length).toBeGreaterThan(0);
  });

  it('has startup locations', () => {
    expect(airport.startupLocations.length).toBeGreaterThan(0);
  });

  it('stats.parsed matches sum of parsed features', () => {
    const result = parseChunk('KJFK');
    // stats.parsed is computed from runways + taxiways + startupLocations + etc.
    expect(result.stats.parsed).toBe(
      result.data.runways.length +
        result.data.taxiways.length +
        result.data.startupLocations.length +
        result.data.windsocks.length +
        result.data.signs.length +
        result.data.helipads.length +
        result.data.frequencies.length +
        (result.data.towerLocation ? 1 : 0) +
        (result.data.beacon ? 1 : 0)
    );
  });

  it('has no parse errors', () => {
    const result = parseChunk('KJFK');
    expect(result.errors).toHaveLength(0);
  });
});

describe('EGLL – London Heathrow', () => {
  let airport: ParsedAirport;

  beforeAll(() => {
    const result = parseChunk('EGLL');
    airport = result.data;
  });

  it('has correct ICAO id', () => {
    expect(airport.id).toBe('EGLL');
  });

  it('has correct name', () => {
    expect(airport.name).toBe('London Heathrow');
  });

  it('has runways', () => {
    expect(airport.runways.length).toBeGreaterThan(0);
  });

  it('has no parse errors', () => {
    const result = parseChunk('EGLL');
    expect(result.errors).toHaveLength(0);
  });
});

describe('LFPG – Paris Charles De Gaulle', () => {
  let airport: ParsedAirport;

  beforeAll(() => {
    const result = parseChunk('LFPG');
    airport = result.data;
  });

  it('has correct ICAO id', () => {
    expect(airport.id).toBe('LFPG');
  });

  it('has runways', () => {
    expect(airport.runways.length).toBeGreaterThan(0);
  });

  it('has no parse errors', () => {
    const result = parseChunk('LFPG');
    expect(result.errors).toHaveLength(0);
  });
});

describe('KLAX – Los Angeles Intl', () => {
  let airport: ParsedAirport;

  beforeAll(() => {
    const result = parseChunk('KLAX');
    airport = result.data;
  });

  it('has correct ICAO id', () => {
    expect(airport.id).toBe('KLAX');
  });

  it('has runways', () => {
    expect(airport.runways.length).toBeGreaterThan(0);
  });

  it('has no parse errors', () => {
    const result = parseChunk('KLAX');
    expect(result.errors).toHaveLength(0);
  });
});

describe('OTHH – Doha Hamad Intl', () => {
  let airport: ParsedAirport;

  beforeAll(() => {
    const result = parseChunk('OTHH');
    airport = result.data;
  });

  it('has correct ICAO id', () => {
    expect(airport.id).toBe('OTHH');
  });

  it('has correct name', () => {
    expect(airport.name).toBe('Doha Hamad Intl');
  });

  it('stores datum coordinates in metadata', () => {
    expect(parseFloat(airport.metadata['datum_lat'] ?? '')).toBeCloseTo(25.27, 1);
    expect(parseFloat(airport.metadata['datum_lon'] ?? '')).toBeCloseTo(51.61, 1);
  });

  it('has runways', () => {
    expect(airport.runways.length).toBeGreaterThan(0);
  });

  it('has no parse errors', () => {
    const result = parseChunk('OTHH');
    expect(result.errors).toHaveLength(0);
  });
});
