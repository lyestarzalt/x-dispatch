import { describe, expect, it } from 'vitest';
import { bearingDeg, greatCircleNm } from './geometry';
import { routeLinePoints, routeLineSegments } from './routeLine';

const RWY_09 = { name: '09', latitude: 52, longitude: 4, headingDeg: 90, lengthNm: 2 };
const RWY_27 = { name: '27', latitude: 50, longitude: 8.05, headingDeg: 270, lengthNm: 2 };

describe('routeLinePoints across the antimeridian', () => {
  it('keeps longitudes continuous so the line crosses 180 the short way', () => {
    const wps = [
      { via: 'ADEP', latitude: 61, longitude: -150 },
      { via: 'FIX', latitude: 57, longitude: -170 },
      { via: 'FIX', latitude: 50, longitude: 170 },
      { via: 'ADES', latitude: 36, longitude: 140 },
    ];
    expect(routeLinePoints(wps).map((p) => p.longitude)).toEqual([-150, -170, -190, -220]);
    // The other way round unwraps upwards past 180.
    const back = [...wps].reverse();
    expect(routeLinePoints(back).map((p) => p.longitude)).toEqual([140, 170, 190, 210]);
  });

  it('carries the unwrapped longitude across segment boundaries', () => {
    const wps = [
      { via: 'ADEP', latitude: 57, longitude: 175 },
      { via: 'NATA', latitude: 57, longitude: -175 },
      { via: 'FIX', latitude: 57, longitude: -160 },
    ];
    const segments = routeLineSegments(wps);
    expect(segments.map((s) => s.kind)).toEqual(['track', 'enroute']);
    expect(segments[0]!.points.map((p) => p.longitude)).toEqual([175, 185]);
    expect(segments[1]!.points.map((p) => p.longitude)).toEqual([185, 200]);
  });
});

describe('routeLinePoints', () => {
  it('uses the airport datum when no runway is chosen', () => {
    const wps = [
      { via: 'ADEP', latitude: 52, longitude: 4 },
      { via: 'ADES', latitude: 50, longitude: 8 },
    ];
    expect(routeLinePoints(wps)).toEqual([
      { latitude: 52, longitude: 4 },
      { latitude: 50, longitude: 8 },
    ]);
  });

  it('rolls down the runway, runs 3 NM straight out, then goes direct to the first fix (LNM custom departure)', () => {
    // LNM's createCustomDeparture: runway threshold -> runway end -> a point `distance` NM
    // out on the runway heading, then a straight line to the first fix. No turn arc.
    const wps = [
      { via: 'ADEP', latitude: 52.01, longitude: 4.01 },
      { via: 'FIX', latitude: 51.7, longitude: 3.5 },
      { via: 'FIX', latitude: 51.5, longitude: 3.5 },
    ];
    const line = routeLinePoints(wps, { departure: RWY_09 });
    expect(line).toHaveLength(5);
    expect(line[0]).toEqual({ latitude: 52, longitude: 4 });
    expect(bearingDeg(line[0]!, line[1]!)).toBeCloseTo(90, 0);
    expect(greatCircleNm(line[0]!, line[1]!)).toBeCloseTo(2, 1);
    expect(greatCircleNm(line[1]!, line[2]!)).toBeCloseTo(3, 1);
    expect(bearingDeg(line[1]!, line[2]!)).toBeCloseTo(90, 0);
    expect(line[3]).toEqual({ latitude: 51.7, longitude: 3.5 });
    expect(line[4]).toEqual({ latitude: 51.5, longitude: 3.5 });
  });

  it('draws enroute fixes as plain straight legs with no fly-by smoothing', () => {
    const wps = [
      { via: 'ADEP', latitude: 52, longitude: 4 },
      { via: 'FIX', latitude: 52, longitude: 5 },
      { via: 'FIX', latitude: 51, longitude: 5 },
      { via: 'ADES', latitude: 51, longitude: 6 },
    ];
    expect(routeLinePoints(wps)).toEqual(
      wps.map(({ latitude, longitude }) => ({ latitude, longitude }))
    );
  });

  it('draws pre-built procedure geometry in place of its fixes', () => {
    const sidPath = [
      { latitude: 52.005, longitude: 4.03 },
      { latitude: 52.01, longitude: 4.1 },
      { latitude: 52.05, longitude: 4.2 },
    ];
    const wps = [
      { via: 'ADEP', latitude: 52.01, longitude: 4.01 },
      { via: 'WOOD1S', latitude: 52.01, longitude: 4.1 },
      { via: 'WOOD1S', latitude: 52.05, longitude: 4.2 },
      { via: 'UL620', latitude: 52.2, longitude: 4.8 },
    ];
    const line = routeLinePoints(wps, { departure: RWY_09 }, undefined, [
      { via: 'WOOD1S', path: sidPath, kind: 'sid' },
    ]);
    // Threshold, then the path verbatim, then the enroute fix.
    expect(line[0]).toEqual({ latitude: 52, longitude: 4 });
    expect(line.slice(1, 4)).toEqual(sidPath);
    expect(line[line.length - 1]).toEqual({ latitude: 52.2, longitude: 4.8 });
  });

  it('joins a 3 NM straight final onto the arrival threshold (LNM custom approach)', () => {
    const wps = [
      { via: 'FIX', latitude: 50.5, longitude: 7 },
      { via: 'ADES', latitude: 50.01, longitude: 8 },
    ];
    const line = routeLinePoints(wps, { arrival: RWY_27 });
    expect(line).toHaveLength(3);
    const last = line[line.length - 1]!;
    const before = line[line.length - 2]!;
    expect(last).toEqual({ latitude: 50, longitude: 8.05 });
    expect(bearingDeg(before, last)).toBeCloseTo(270, 0);
    expect(greatCircleNm(before, last)).toBeCloseTo(3, 1);
  });

  it('splits the line into segments tagged by what they are: departure, SID, enroute, STAR, approach', () => {
    const sidPath = [
      { latitude: 52.005, longitude: 4.03 },
      { latitude: 52.05, longitude: 4.2 },
    ];
    const starPath = [
      { latitude: 50.4, longitude: 7.4 },
      { latitude: 50.3, longitude: 7.6 },
    ];
    const wps = [
      { via: 'ADEP', latitude: 52.01, longitude: 4.01 },
      { via: 'WOOD1S', latitude: 52.05, longitude: 4.2 },
      { via: 'UL620', latitude: 52.2, longitude: 4.8 },
      { via: 'MOLI2A', latitude: 50.3, longitude: 7.6 },
      { via: 'ADES', latitude: 50.01, longitude: 8 },
    ];
    const segments = routeLineSegments(wps, { departure: RWY_09, arrival: RWY_27 }, undefined, [
      { via: 'WOOD1S', path: sidPath, kind: 'sid' },
      { via: 'MOLI2A', path: starPath, kind: 'star' },
    ]);
    expect(segments.map((s) => s.kind)).toEqual(['sid', 'enroute', 'star', 'enroute']);
    expect(segments[0]!.via).toBe('WOOD1S');
    // The runway roll is part of the SID segment; the final onto the runway is plain enroute.
    expect(segments[0]!.points[0]).toEqual({ latitude: 52, longitude: 4 });
    expect(segments[3]!.points[segments[3]!.points.length - 1]).toEqual({
      latitude: 50,
      longitude: 8.05,
    });
    // Segments chain: each starts where the previous one ended.
    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1]!.points;
      expect(segments[i]!.points[0]).toEqual(prev[prev.length - 1]);
    }
  });

  it('ends at the approach geometry and never draws from the runway back to the airport', () => {
    // LNM: "Do not draw a line from runway end to airport center" when an approach is
    // flown. The approach path already ends on the threshold; the destination airport
    // point after it must add nothing (otherwise a turn-back loop forms at the runway).
    const approachPath = [
      { latitude: 49.9, longitude: 8.05 },
      { latitude: 49.95, longitude: 8.05 },
      { latitude: 50, longitude: 8.05 },
    ];
    const wps = [
      { via: 'FIX', latitude: 49.5, longitude: 7 },
      { via: 'I36', latitude: 49.9, longitude: 8.05 },
      { via: 'I36', latitude: 50, longitude: 8.05 },
      { via: 'ADES', latitude: 50.01, longitude: 8.1 },
    ];
    const rwy36 = { name: '36', latitude: 50, longitude: 8.05, headingDeg: 0, lengthNm: 2 };
    const line = routeLinePoints(wps, { arrival: rwy36 }, undefined, [
      { via: 'I36', path: approachPath, kind: 'approach' },
    ]);
    expect(line[line.length - 1]).toEqual({ latitude: 50, longitude: 8.05 });
    expect(line.slice(-3)).toEqual(approachPath);
  });

  it('still joins a STAR without an approach onto the arrival threshold', () => {
    const starPath = [
      { latitude: 50.4, longitude: 7.4 },
      { latitude: 50.3, longitude: 7.6 },
    ];
    const wps = [
      { via: 'FIX', latitude: 50.5, longitude: 7 },
      { via: 'MOLI2A', latitude: 50.4, longitude: 7.4 },
      { via: 'MOLI2A', latitude: 50.3, longitude: 7.6 },
      { via: 'ADES', latitude: 50.01, longitude: 8 },
    ];
    const line = routeLinePoints(wps, { arrival: RWY_27 }, undefined, [
      { via: 'MOLI2A', path: starPath, kind: 'star' },
    ]);
    expect(line[line.length - 1]).toEqual({ latitude: 50, longitude: 8.05 });
  });
});

describe('routeLineSegments with a NAT track', () => {
  it('tags the legs flown on a track so the map can draw them apart from plain enroute', () => {
    const wps = [
      { via: 'ADEP', latitude: 53.4, longitude: -6.3 },
      { via: 'DRCT', latitude: 54, longitude: -15 }, // entry fix
      { via: 'NATA', latitude: 54, longitude: -20 },
      { via: 'NATA', latitude: 55, longitude: -30 },
      { via: 'NATA', latitude: 54, longitude: -40 }, // exit fix
      { via: 'DRCT', latitude: 50, longitude: -60 },
      { via: 'ADES', latitude: 40.6, longitude: -73.8 },
    ];
    const segments = routeLineSegments(wps);
    expect(segments.map((s) => s.kind)).toEqual(['enroute', 'track', 'enroute']);
    expect(segments[1]!.via).toBe('NATA');
    // The track segment runs from the entry fix to the exit fix.
    expect(segments[1]!.points[0]).toEqual({ latitude: 54, longitude: -15 });
    expect(segments[1]!.points[segments[1]!.points.length - 1]).toEqual({
      latitude: 54,
      longitude: -40,
    });
  });
});
