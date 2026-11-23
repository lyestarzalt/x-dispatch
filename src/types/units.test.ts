import { describe, expect, it } from 'vitest';
import type {
  Degrees,
  Feet,
  MagneticDegrees,
  Meters,
  NauticalMiles,
  Radians,
  TrueDegrees,
} from './units';

/*
 * The compiler is what is under test here: `npm run typecheck` fails if a line marked
 * `@ts-expect-error` stops being an error, or if an unmarked line becomes one.
 */
function wantsFeet(x: Feet): Feet {
  return x;
}

describe('unit types', () => {
  it('accept plain numbers and the results of arithmetic', () => {
    const literal: Feet = 3000;
    const metres = 914.4 as Meters;
    const converted: Feet = metres * 3.28084;
    expect(wantsFeet(1200)).toBe(1200);
    expect(literal).toBe(3000);
    expect(converted).toBeCloseTo(3000, 0);
  });

  it('reject a value that carries a different unit', () => {
    const metres = 914.4 as Meters;
    const miles = 5 as NauticalMiles;
    const angle = 1 as Radians;
    // @ts-expect-error metres are not feet
    wantsFeet(metres);
    // @ts-expect-error nautical miles are not feet
    const wrong: Feet = miles;
    // @ts-expect-error radians are not degrees
    const alsoWrong: Degrees = angle;
    expect([wrong, alsoWrong]).toEqual([5, 1]);
  });

  it('tell true directions from magnetic ones, and treat both as degrees', () => {
    const wantsTrue = (x: TrueDegrees): TrueDegrees => x;
    const wantsDegrees = (x: Degrees): Degrees => x;
    const magnetic = 262 as MagneticDegrees;
    const trueCourse = 270 as TrueDegrees;
    const unlabelled = 90 as Degrees;
    // @ts-expect-error a magnetic course is not a true one
    wantsTrue(magnetic);
    // @ts-expect-error nor the reverse
    const wrong: MagneticDegrees = trueCourse;
    expect(wantsTrue(trueCourse)).toBe(270);
    expect(wantsTrue(unlabelled)).toBe(90);
    expect(wantsTrue(45)).toBe(45);
    expect(wantsDegrees(magnetic)).toBe(262);
    expect(wantsDegrees(trueCourse)).toBe(270);
    expect(wrong).toBe(270);
  });
});
