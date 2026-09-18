import { describe, expect, it } from 'vitest';
import type { TrackPointTuple } from '@/types/flightRecorder';
import { sampleTrack, trackBounds, trailSegments, trailStep } from './trailGeometry';

function pt(t: number, lat: number, lon: number, alt = 1000, hdg = 90): TrackPointTuple {
  return [t, lat, lon, alt, 120, hdg, 0, alt];
}

describe('trailSegments', () => {
  it('makes one two-point line per consecutive pair with altitude and age', () => {
    const fc = trailSegments([pt(0, 0, 0, 100), pt(60_000, 0, 1, 200), pt(120_000, 0, 2, 300)], {
      nowMs: 180_000,
    });
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0]!.geometry.coordinates).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(fc.features[0]!.properties).toEqual({ alt: 200, age: 2 });
    expect(fc.features[1]!.properties).toEqual({ alt: 300, age: 1 });
  });

  it('decimates by step but always reaches the last point', () => {
    const points = Array.from({ length: 11 }, (_, i) => pt(i, 0, i));
    const fc = trailSegments(points, { step: 4 });
    const ends = fc.features.map((f) => f.geometry.coordinates[1]![0]);
    expect(ends).toEqual([4, 8, 10]);
  });

  it('unwraps longitude across the antimeridian', () => {
    const fc = trailSegments([pt(0, 0, 179.5), pt(1, 0, -179.5)]);
    expect(fc.features[0]!.geometry.coordinates).toEqual([
      [179.5, 0],
      [180.5, 0],
    ]);
  });

  it('returns nothing for fewer than two points', () => {
    expect(trailSegments([pt(0, 0, 0)]).features).toEqual([]);
  });
});

describe('trailStep', () => {
  it('grows with the point count', () => {
    expect(trailStep(100)).toBe(1);
    expect(trailStep(4000)).toBe(1);
    expect(trailStep(4001)).toBe(2);
    expect(trailStep(36_000)).toBe(9);
  });
});

describe('sampleTrack', () => {
  const track = [pt(0, 0, 0, 0, 350), pt(10_000, 1, 1, 1000, 10), pt(20_000, 2, 2, 2000, 20)];

  it('interpolates position, altitude and heading between points', () => {
    const s = sampleTrack(track, 5_000)!;
    expect(s.lat).toBeCloseTo(0.5);
    expect(s.lon).toBeCloseTo(0.5);
    expect(s.alt).toBe(500);
    expect(s.hdg).toBeCloseTo(0);
    expect(s.index).toBe(0);
  });

  it('clamps to the ends', () => {
    expect(sampleTrack(track, -5)!.lat).toBe(0);
    expect(sampleTrack(track, 99_000)!.lat).toBe(2);
    expect(sampleTrack([], 0)).toBeNull();
  });
});

describe('trackBounds', () => {
  it('returns west, south, east, north', () => {
    expect(trackBounds([pt(0, 10, -5), pt(1, -3, 7)])).toEqual([-5, -3, 7, 10]);
    expect(trackBounds([])).toBeNull();
  });
});
