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
  it('splits into 15 airport chunks', () => {
    expect(chunks).toHaveLength(15);
  });

  it('all 15 airports are present', () => {
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

  it('preserves multi-word values for every 1302 metadata key', () => {
    // 1302 values can be 1..N whitespace-separated tokens. Any field with a
    // multi-word value used to be silently truncated to its first token
    // (e.g. KLAX showed "Los, California" instead of "Los Angeles, California").
    expect(airport.metadata['city']).toBe('New York');
    expect(airport.metadata['state']).toBe('New York');
    expect(airport.metadata['country']).toBe('USA United States');
    // gw_credits is the extreme case: many tokens, embedded commas.
    expect(airport.metadata['gw_credits']).toBe(
      'crisk73, HawkEagle, jazzy1, Julian Lockwood, Julien Coquel, Michael Minnhaar, morkunas, netoron, Raligard, X_Codr'
    );
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

  it('preserves Unicode characters in multi-word metadata values', () => {
    expect(airport.metadata['city']).toBe('Paris');
    expect(airport.metadata['state']).toBe('Île-de-France');
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

  it('parses two-word city without truncating', () => {
    expect(airport.metadata['city']).toBe('Los Angeles');
    expect(airport.metadata['state']).toBe('California');
  });
});

describe('ENQA – Troll A Platform (heliport with (unassigned) state)', () => {
  let airport: ParsedAirport;

  beforeAll(() => {
    const result = parseChunk('ENQA');
    airport = result.data;
  });

  it('drops "(unassigned)" placeholder values from metadata', () => {
    // The fixture has `1302 state (unassigned)` for ENQA (a North Sea oilrig
    // heliport). The parser should skip it so the display falls back to country
    // instead of showing the literal placeholder.
    expect(airport.metadata['state']).toBeUndefined();
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

// ---------------------------------------------------------------------------
// Water runways (row 101)
// ---------------------------------------------------------------------------

describe('water runways', () => {
  const chunk = [
    '16 0 0 0 PAFK Farewell Lake SPB',
    '101 50.00 1 09W  62.5100000 -153.8900000 27W  62.5080000 -153.8700000',
    '101 30.00 0 18  62.5120000 -153.8800000 36  62.5050000 -153.8810000',
  ].join('\n');

  it('parses each 101 row into a water runway with width, buoys and both ends', () => {
    const airport = new AirportParser(chunk).parse().data;
    expect(airport.waterRunways).toHaveLength(2);
    const first = airport.waterRunways[0]!;
    expect(first.width).toBe(50);
    expect(first.perimeter_buoys).toBe(true);
    expect(first.ends[0]).toMatchObject({ name: '09W', latitude: 62.51, longitude: -153.89 });
    expect(first.ends[1]).toMatchObject({ name: '27W', latitude: 62.508, longitude: -153.87 });
    expect(airport.waterRunways[1]!.perimeter_buoys).toBe(false);
  });

  it('keeps water runways out of the land runway list', () => {
    const airport = new AirportParser(chunk).parse().data;
    expect(airport.runways).toHaveLength(0);
  });

  it('counts water runways in the parse stats', () => {
    const { stats } = new AirportParser(chunk).parse();
    expect(stats.parsed).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Start rows — X-Plane numbers runway-type starts in apt.dat file order
// ---------------------------------------------------------------------------

describe('start rows', () => {
  const chunk = [
    '1 10 0 0 XTST Mixed Test',
    '100 45.00 1 0 0.25 0 0 0 09  49.0000000 2.5000000 0 0 3 0 0 0 27  49.0000000 2.5500000 0 0 3 0 0 0',
    '101 50.00 0 09W  49.0100000 2.5000000 27W  49.0100000 2.5500000',
    '102 H1 49.0200000 2.5200000 90.00 20.00 20.00 1 0 0 0.25 0',
    '100 45.00 1 0 0.25 0 0 0 18  49.0300000 2.5200000 0 0 3 0 0 0 36  49.0000000 2.5200000 0 0 3 0 0 0',
  ].join('\n');

  it('numbers land runways, water runways and helipads by their order in the file', () => {
    const airport = new AirportParser(chunk).parse().data;
    expect(airport.runways.map((r) => r.startRow)).toEqual([0, 3]);
    expect(airport.waterRunways.map((r) => r.startRow)).toEqual([1]);
    expect(airport.helipads.map((h) => h.startRow)).toEqual([2]);
  });
});
