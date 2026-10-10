import { readFileSync } from 'fs';
import { resolve } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ParsedAirport } from '@/types/apt';
import type { LonLat } from '@/types/geo';
import { DEFAULT_CHORD_TOLERANCE_M, setBezierChordTolerance } from './bezier';
import { AirportParser } from './index';

/**
 * Shape-identity guard for adaptive bezier flattening.
 *
 * Parses every fixture airport twice: once at a near-exact tolerance (the
 * dense reference) and once at the shipped default. Every pavement ring,
 * hole and painted line must then lie within the default tolerance of its
 * dense counterpart. Only sampling density may differ; feature counts,
 * ring order and endpoints must be identical.
 */

const FIXTURE_PATH = resolve(__dirname, '../../../../tests/fixtures/apt-sample.dat');
/** Reference tolerance: far below anything the renderer can show. */
const DENSE_TOLERANCE_M = 0.002;
/** Allowance for the reference curve's own chord error. */
const SLACK_M = DENSE_TOLERANCE_M * 2;
/** Segments to look at around the running match when walking two samplings of one path. */
const SEARCH_WINDOW = 24;

function splitAptDat(content: string): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '99') break;
    if (/^(1|16|17)\s/.test(trimmed)) {
      if (current.length > 0) chunks.push(current.join('\n'));
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) chunks.push(current.join('\n'));
  return chunks;
}

function parseAll(tolerance: number, chunks: string[]): ParsedAirport[] {
  setBezierChordTolerance(tolerance);
  try {
    return chunks.map((c) => new AirportParser(c).parse().data);
  } finally {
    setBezierChordTolerance(DEFAULT_CHORD_TOLERANCE_M);
  }
}

function metresScale(lat: number): [number, number] {
  const mLat = 111320;
  return [mLat * Math.cos((lat * Math.PI) / 180), mLat];
}

function pointToSegmentM(p: LonLat, a: LonLat, b: LonLat, [mx, my]: [number, number]): number {
  const dx = (b[0] - a[0]) * mx;
  const dy = (b[1] - a[1]) * my;
  const px = (p[0] - a[0]) * mx;
  const py = (p[1] - a[1]) * my;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
  return Math.hypot(px - t * dx, py - t * dy);
}

/**
 * Largest distance from any dense point to the coarse polyline. Both are
 * samplings of the same node sequence, so the nearest segment advances
 * monotonically; a window around the running index keeps this linear. A
 * window miss only ever over-reports the distance, never hides one.
 */
function maxDeviationM(dense: LonLat[], coarse: LonLat[]): number {
  if (coarse.length < 2) return dense.length <= 1 ? 0 : Infinity;
  const scale = metresScale(dense[0]![1]);
  let worst = 0;
  let cursor = 0;
  for (const p of dense) {
    let best = Infinity;
    let bestIdx = cursor;
    const from = Math.max(0, cursor - 2);
    const to = Math.min(coarse.length - 2, cursor + SEARCH_WINDOW);
    for (let i = from; i <= to; i++) {
      const d = pointToSegmentM(p, coarse[i]!, coarse[i + 1]!, scale);
      if (d < best) {
        best = d;
        bestIdx = i;
      }
    }
    cursor = bestIdx;
    worst = Math.max(worst, best);
  }
  return worst;
}

interface NamedPath {
  label: string;
  coordinates: LonLat[];
}

function pathsOf(airport: ParsedAirport): NamedPath[] {
  const out: NamedPath[] = [];
  airport.pavements.forEach((p, i) => {
    out.push({ label: `${airport.id} pavement ${i} outer`, coordinates: p.coordinates });
    p.holes?.forEach((h, j) =>
      out.push({ label: `${airport.id} pavement ${i} hole ${j}`, coordinates: h })
    );
  });
  airport.boundaries.forEach((b, i) =>
    b.paths.forEach((path, j) =>
      out.push({ label: `${airport.id} boundary ${i} ring ${j}`, coordinates: path.coordinates })
    )
  );
  airport.linearFeatures.forEach((f, i) =>
    out.push({ label: `${airport.id} line ${i} (${f.name})`, coordinates: f.coordinates })
  );
  return out;
}

let dense: ParsedAirport[];
let coarse: ParsedAirport[];

beforeAll(() => {
  const chunks = splitAptDat(readFileSync(FIXTURE_PATH, 'utf-8'));
  dense = parseAll(DENSE_TOLERANCE_M, chunks);
  coarse = parseAll(DEFAULT_CHORD_TOLERANCE_M, chunks);
});

afterAll(() => {
  setBezierChordTolerance(DEFAULT_CHORD_TOLERANCE_M);
});

describe('adaptive flattening keeps airport shapes', () => {
  it('parses the same features regardless of tolerance', () => {
    expect(coarse.length).toBe(dense.length);
    for (let i = 0; i < dense.length; i++) {
      const d = pathsOf(dense[i]!);
      const c = pathsOf(coarse[i]!);
      expect(c.map((p) => p.label)).toEqual(d.map((p) => p.label));
    }
  });

  it('keeps every path start and end point exactly', () => {
    for (let i = 0; i < dense.length; i++) {
      const d = pathsOf(dense[i]!);
      const c = pathsOf(coarse[i]!);
      for (let j = 0; j < d.length; j++) {
        const dc = d[j]!.coordinates;
        const cc = c[j]!.coordinates;
        expect(cc[0], `${d[j]!.label} start`).toEqual(dc[0]);
        expect(cc[cc.length - 1], `${d[j]!.label} end`).toEqual(dc[dc.length - 1]);
      }
    }
  });

  it('keeps every ring and line within the chord tolerance of the dense reference', () => {
    const limit = DEFAULT_CHORD_TOLERANCE_M + SLACK_M;
    let paths = 0;
    let worst = 0;
    for (let i = 0; i < dense.length; i++) {
      const d = pathsOf(dense[i]!);
      const c = pathsOf(coarse[i]!);
      for (let j = 0; j < d.length; j++) {
        const dev = maxDeviationM(d[j]!.coordinates, c[j]!.coordinates);
        worst = Math.max(worst, dev);
        expect(dev, d[j]!.label).toBeLessThanOrEqual(limit);
        paths++;
      }
    }
    expect(paths).toBeGreaterThan(1000);
    expect(worst).toBeLessThanOrEqual(limit);
  });

  it('emits far fewer vertices than the dense reference', () => {
    const count = (airports: ParsedAirport[]) =>
      airports.reduce(
        (sum, a) => sum + pathsOf(a).reduce((s, p) => s + p.coordinates.length, 0),
        0
      );
    const denseCount = count(dense);
    const coarseCount = count(coarse);
    expect(coarseCount).toBeLessThan(denseCount / 3);
  });
});
