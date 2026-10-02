import { describe, expect, it } from 'vitest';
import { roundForDisplay } from './precision';

describe('roundForDisplay', () => {
  it('adds one extra decimal below the threshold so small values do not round to zero', () => {
    expect(roundForDisplay(0.4, 0, 1)).toBe(0.4);
  });

  it('uses the base precision at or above the threshold', () => {
    expect(roundForDisplay(5.2, 0, 1)).toBe(5);
  });

  it('uses the base precision when no threshold is given', () => {
    expect(roundForDisplay(12.345, 1)).toBeCloseTo(12.3, 5);
  });

  it('rounds to 0 decimals by default', () => {
    expect(roundForDisplay(5.6)).toBe(6);
  });

  it('treats the threshold boundary as "at or above" (base precision)', () => {
    expect(roundForDisplay(1, 0, 1)).toBe(1);
  });
});
