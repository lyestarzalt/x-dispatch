import SunCalc from 'suncalc';
import { describe, expect, it } from 'vitest';
import {
  nightFactor,
  normalizeLongitude,
  simTimeToEpochMs,
  subsolarPoint,
  sunAltitudeEvaluator,
  sunPosition,
} from './solarPosition';

const DEG = 180 / Math.PI;

const SAMPLE_TIMES = [
  Date.UTC(2026, 2, 20, 14, 46), // March equinox
  Date.UTC(2026, 5, 21, 8, 24), // June solstice
  Date.UTC(2026, 11, 21, 20, 50), // December solstice
  Date.UTC(2026, 8, 19, 3, 0),
];

describe('sunPosition', () => {
  it('matches suncalc altitude and azimuth for a spread of places and dates', () => {
    const observers: [number, number][] = [
      [51.5, -0.12],
      [-33.9, 151.2],
      [3.14, 101.69],
      [64.1, -21.9],
      [-54.8, -68.3],
    ];
    for (const time of SAMPLE_TIMES) {
      for (const [lat, lon] of observers) {
        const ours = sunPosition(time, lat, lon);
        const ref = SunCalc.getPosition(new Date(time), lat, lon);
        expect(ours.altitude).toBeCloseTo(ref.altitude * DEG, 6);
        const refBearing = (ref.azimuth * DEG + 180 + 360) % 360;
        const diff = Math.abs(((ours.azimuth - refBearing + 540) % 360) - 180);
        expect(diff).toBeLessThan(1e-6);
      }
    }
  });

  it('puts the sun due south at local solar noon in the northern hemisphere', () => {
    // Greenwich, near the equinox: transit within a few minutes of 12:07 UTC.
    const pos = sunPosition(Date.UTC(2026, 2, 20, 12, 7, 30), 51.5, 0);
    expect(Math.abs(pos.azimuth - 180)).toBeLessThan(1.5);
    expect(pos.altitude).toBeGreaterThan(37);
  });
});

describe('subsolarPoint', () => {
  it('is where the sun is at the zenith', () => {
    for (const time of SAMPLE_TIMES) {
      const point = subsolarPoint(time);
      const { altitude } = sunPosition(time, point.lat, point.lon);
      expect(altitude).toBeGreaterThan(89.99);
    }
  });

  it('follows the seasons in latitude', () => {
    expect(Math.abs(subsolarPoint(SAMPLE_TIMES[0]!).lat)).toBeLessThan(0.5);
    expect(subsolarPoint(SAMPLE_TIMES[1]!).lat).toBeGreaterThan(23.3);
    expect(subsolarPoint(SAMPLE_TIMES[2]!).lat).toBeLessThan(-23.3);
  });

  it('sits near the Greenwich meridian at 12:00 UTC', () => {
    const point = subsolarPoint(Date.UTC(2026, 8, 19, 12, 0));
    // The equation of time keeps it within a couple of degrees of 0.
    expect(Math.abs(point.lon)).toBeLessThan(3);
  });
});

describe('sunAltitudeEvaluator', () => {
  it('agrees with sunPosition', () => {
    const time = SAMPLE_TIMES[3]!;
    const evaluator = sunAltitudeEvaluator(time);
    const samples: [number, number][] = [
      [0, 0],
      [45, 90],
      [-60, -120],
      [80, 179],
    ];
    for (const [lat, lon] of samples) {
      expect(evaluator.altitudeAt(lat, lon)).toBeCloseTo(sunPosition(time, lat, lon).altitude, 9);
    }
  });
});

describe('nightFactor', () => {
  it('is off during the day, on after civil dusk, and monotonic between', () => {
    expect(nightFactor(30)).toBe(0);
    expect(nightFactor(0)).toBe(0);
    expect(nightFactor(-6)).toBe(1);
    expect(nightFactor(-40)).toBe(1);
    let previous = 0;
    for (let alt = 0; alt >= -6; alt -= 0.5) {
      const value = nightFactor(alt);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    expect(nightFactor(-3)).toBeCloseTo(0.5, 6);
  });
});

describe('normalizeLongitude', () => {
  it('wraps into (-180, 180]', () => {
    expect(normalizeLongitude(190)).toBe(-170);
    expect(normalizeLongitude(-190)).toBe(170);
    expect(normalizeLongitude(540)).toBe(180);
    expect(normalizeLongitude(-180)).toBe(180);
    expect(normalizeLongitude(0)).toBe(0);
  });
});

describe('simTimeToEpochMs', () => {
  it('turns X-Plane day-of-year and zulu seconds into an instant', () => {
    // Day 0 is 1 January; 45000 s is 12:30:00 UTC.
    expect(simTimeToEpochMs(0, 45_000, 2026)).toBe(Date.UTC(2026, 0, 1, 12, 30));
    expect(simTimeToEpochMs(59, 0, 2024)).toBe(Date.UTC(2024, 1, 29));
  });
});
