import { describe, expect, it } from 'vitest';
import { airSpeedFromMs, airSpeedToMs, isValidAirStartSpeed } from './airStartSpeed';

describe('air-start speed units', () => {
  it('converts 100 knots to metres per second', () => {
    expect(airSpeedToMs(100, 'kt')).toBeCloseTo(51.4444444444, 9);
  });

  it('keeps metres per second unchanged', () => {
    expect(airSpeedToMs(40, 'ms')).toBe(40);
    expect(airSpeedFromMs(40, 'ms')).toBe(40);
  });

  it('converts the successful DR401 test speed to knots and back', () => {
    const knots = airSpeedFromMs(40, 'kt');
    expect(knots).toBeCloseTo(77.7537797, 6);
    expect(airSpeedToMs(knots, 'kt')).toBeCloseTo(40, 12);
  });

  it.each([undefined, NaN, Infinity, -Infinity, 0, -10])('rejects invalid speed %s', (speed) => {
    expect(isValidAirStartSpeed(speed)).toBe(false);
  });
});
