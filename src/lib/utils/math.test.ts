import { describe, expect, it } from 'vitest';
import {
  clamp,
  lerpHeading,
  normalize180,
  normalize360,
  signedAngleDelta,
  smoothstep,
} from './math';

describe('clamp', () => {
  it('returns the value when it is inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('holds the value at either bound', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe('normalize360', () => {
  it('wraps negative and large angles into 0 to 360', () => {
    expect(normalize360(-10)).toBe(350);
    expect(normalize360(370)).toBe(10);
    expect(normalize360(360)).toBe(0);
    expect(normalize360(-725)).toBe(355);
  });
});

describe('normalize180', () => {
  it('wraps into -180 to 180, with 180 itself mapping to -180', () => {
    expect(normalize180(190)).toBe(-170);
    expect(normalize180(-190)).toBe(170);
    expect(normalize180(180)).toBe(-180);
    expect(normalize180(540)).toBe(-180);
    expect(normalize180(0)).toBe(0);
  });
});

describe('signedAngleDelta', () => {
  it('turns the short way in either direction', () => {
    expect(signedAngleDelta(350, 10)).toBe(20);
    expect(signedAngleDelta(10, 350)).toBe(-20);
  });

  it('crosses the antimeridian the short way', () => {
    expect(signedAngleDelta(179, -179)).toBe(2);
    expect(signedAngleDelta(-179, 179)).toBe(-2);
  });

  it('matches the unguarded form the call sites used, bit for bit', () => {
    const pairs: [number, number][] = [
      [0, 0],
      [12.345678, 301.987654],
      [-73.778925, 151.177222],
      [359.999, 0.001],
      [45, 225],
    ];
    for (const [from, to] of pairs) {
      expect(signedAngleDelta(from, to)).toBe(((to - from + 540) % 360) - 180);
    }
  });

  it('stays in range for differences beyond a full turn', () => {
    expect(signedAngleDelta(0, 730)).toBe(10);
    expect(signedAngleDelta(730, 0)).toBe(-10);
  });
});

describe('lerpHeading', () => {
  it('interpolates through north', () => {
    expect(lerpHeading(350, 10, 0.5)).toBe(0);
    expect(lerpHeading(10, 350, 0.5)).toBe(0);
  });

  it('returns the ends at 0 and 1', () => {
    expect(lerpHeading(90, 180, 0)).toBe(90);
    expect(lerpHeading(90, 180, 1)).toBe(180);
  });
});

describe('smoothstep', () => {
  it('eases a 0 to 1 fraction and is flat outside it', () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(2)).toBe(1);
  });

  it('ramps between two edges', () => {
    expect(smoothstep(5, 4, 6)).toBe(0.5);
    expect(smoothstep(3, 4, 6)).toBe(0);
    expect(smoothstep(7, 4, 6)).toBe(1);
  });
});
