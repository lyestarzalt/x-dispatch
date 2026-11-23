import { describe, expect, it } from 'vitest';
import type { Degrees, Feet, Meters, NauticalMiles, Radians } from './units';

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
});
