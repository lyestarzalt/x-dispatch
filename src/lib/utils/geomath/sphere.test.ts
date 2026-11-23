import { describe, expect, it } from 'vitest';
import { bearingDeg, destinationPoint as destinationNm } from '@/lib/flightplan/builder/geometry';
import { calculateBearing, destinationPoint as destinationMeters } from './index';
import {
  EARTH_RADIUS_M,
  EARTH_RADIUS_NM,
  destinationRad,
  initialBearing,
  toDegrees,
  toRadians,
} from './sphere';

// KSFO and KJFK reference points.
const KSFO = { latitude: 37.6189, longitude: -122.375 };
const KJFK = { latitude: 40.6398, longitude: -73.7789 };

describe('sphere core', () => {
  it('converts between degrees and radians', () => {
    expect(toRadians(180)).toBe(Math.PI);
    expect(toDegrees(Math.PI / 2)).toBe(90);
  });

  it('gives the initial bearing KSFO to KJFK, about 070 true', () => {
    const brg = initialBearing(KSFO.latitude, KSFO.longitude, KJFK.latitude, KJFK.longitude);
    expect(brg).toBeGreaterThan(69);
    expect(brg).toBeLessThan(71);
  });

  it('points due north and due east along a meridian and the equator', () => {
    expect(initialBearing(10, 20, 30, 20)).toBe(0);
    expect(initialBearing(0, 20, 0, 30)).toBe(90);
  });

  it('moves one degree of latitude for one degree of arc due north', () => {
    const [φ2, λ2] = destinationRad(toRadians(10), toRadians(20), 0, toRadians(1));
    expect(toDegrees(φ2)).toBeCloseTo(11, 10);
    expect(toDegrees(λ2)).toBeCloseTo(20, 10);
  });

  it('is the one formula behind every wrapper', () => {
    const brg = initialBearing(KSFO.latitude, KSFO.longitude, KJFK.latitude, KJFK.longitude);
    expect(calculateBearing(KSFO.latitude, KSFO.longitude, KJFK.latitude, KJFK.longitude)).toBe(
      brg
    );
    expect(bearingDeg(KSFO, KJFK)).toBe(brg);

    const [φ2, λ2] = destinationRad(
      toRadians(KSFO.latitude),
      toRadians(KSFO.longitude),
      toRadians(70),
      25 / EARTH_RADIUS_NM
    );
    const nm = destinationNm(KSFO, 70, 25);
    expect(nm.latitude).toBe(toDegrees(φ2));
    expect(nm.longitude).toBe(((toDegrees(λ2) + 540) % 360) - 180);

    const [lon, lat] = destinationMeters(KSFO.latitude, KSFO.longitude, 5000, 70);
    const [φ3, λ3] = destinationRad(
      toRadians(KSFO.latitude),
      toRadians(KSFO.longitude),
      toRadians(70),
      5000 / EARTH_RADIUS_M
    );
    expect(lat).toBe(toDegrees(φ3));
    expect(lon).toBe(toDegrees(λ3));
  });
});
