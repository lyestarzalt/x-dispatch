import { describe, expect, it } from 'vitest';
import { convertWeight, formatWeight, parseWeightInput } from './weight';

describe('convertWeight', () => {
  it('returns the value unchanged for lbs', () => {
    expect(convertWeight(1000, 'lbs')).toBe(1000);
  });

  it('converts lbs to kg', () => {
    expect(convertWeight(1000, 'kg')).toBeCloseTo(453.6, 0);
  });
});

describe('parseWeightInput', () => {
  it('round-trips a kg input back to canonical lbs', () => {
    expect(parseWeightInput(453.6, 'kg')).toBeCloseTo(1000, 0);
  });

  it('returns lbs input unchanged', () => {
    expect(parseWeightInput(1000, 'lbs')).toBe(1000);
  });
});

describe('formatWeight (re-export)', () => {
  it('re-exports the existing format/index formatter unchanged', () => {
    expect(formatWeight(1000, 'lbs')).toBe('1.0k lbs');
  });
});
