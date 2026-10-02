import { describe, expect, it } from 'vitest';
import type { Coordinates } from '@/types/geo';
import type { Degrees, NauticalMiles } from './index';
import { crossTrackStatus, intersectRadials, lineCircleIntersection } from './intersections';

const point = (latitude: number, longitude: number): Coordinates => ({ latitude, longitude });

describe('intersectRadials', () => {
  it('finds where two radials from different stations cross, matching an independent brute-force check', () => {
    // Expected values cross-checked with a separate great-circle stepping script (not this
    // formula): station A at (40,-80) on radial 090, station B at (40.5,-78) on radial 200,
    // converge at approximately (39.9867, -78.2437), ~80.79 NM along A's radial.
    const a = point(40, -80);
    const b = point(40.5, -78);
    const result = intersectRadials(a, 90 as Degrees, b, 200 as Degrees);
    expect(result).not.toBeNull();
    expect(result!.latitude).toBeCloseTo(39.986744, 3);
    expect(result!.longitude).toBeCloseTo(-78.243691, 3);
  });

  it('returns null when both courses start from the same point', () => {
    const a = point(40, -80);
    const result = intersectRadials(a, 90 as Degrees, a, 180 as Degrees);
    expect(result).toBeNull();
  });
});

describe('lineCircleIntersection', () => {
  it('finds the first forward crossing of a straight course into a DME ring', () => {
    // Pure north-south line through the circle's center: start 15 NM south of center, heading
    // due north (000), circle radius 10 NM -> crosses 5 NM along the course (10 NM from start).
    const center = point(40, -80);
    const start = point(40 - 15 / 60, -80);
    const result = lineCircleIntersection(start, 0 as Degrees, center, 10 as NauticalMiles);
    expect(result).not.toBeNull();
    expect(result!.latitude).toBeCloseTo(40 - 10 / 60, 4);
    expect(result!.longitude).toBeCloseTo(-80, 4);
  });

  it('returns null when the course never reaches the circle', () => {
    const center = point(40, -80);
    const start = point(40 - 15 / 60, -80);
    // Heading away from the circle (south, 180) never reaches it.
    const result = lineCircleIntersection(start, 180 as Degrees, center, 10 as NauticalMiles);
    expect(result).toBeNull();
  });
});

describe('crossTrackStatus', () => {
  it('reports along-track and cross-track distance for a point left of an eastbound course', () => {
    const lineStart = point(40, -80);
    // ~10 NM east, ~5 NM north of the line start (1 deg lat ~= 60 NM near this latitude).
    const p = point(40 + 5 / 60, -80 + 10 / (60 * Math.cos((40 * Math.PI) / 180)));
    const status = crossTrackStatus(p, lineStart, 90 as Degrees);
    expect(status.alongTrackNm).toBeCloseTo(10, 0);
    // North of an eastbound course is to the left -> negative cross-track by convention.
    expect(status.crossTrackNm).toBeLessThan(0);
    expect(status.crossTrackNm).toBeCloseTo(-5, 0);
  });

  it('reports zero cross-track for a point on the course line', () => {
    const lineStart = point(40, -80);
    const onLine = point(40, -79.8);
    const status = crossTrackStatus(onLine, lineStart, 90 as Degrees);
    expect(status.crossTrackNm).toBeCloseTo(0, 2);
    expect(status.alongTrackNm).toBeGreaterThan(0);
  });
});
