import { describe, expect, it } from 'vitest';
import { type ActiveRunway, activeEndUse } from './ActiveRunwayLine';

const atis = (split: boolean, arrivals: string[], departures: string[]): ActiveRunway => ({
  source: 'atis',
  ends: [...new Set([...arrivals, ...departures])],
  split,
  arrivals,
  departures,
  arrivalLetter: null,
  departureLetter: null,
});

describe('activeEndUse', () => {
  it('tells arrival ends from departure ends when the ATIS splits them', () => {
    const use = activeEndUse(atis(true, ['04L', '04R'], ['04L', '31L']));
    expect(Object.fromEntries(use)).toEqual({
      '04L': 'both',
      '04R': 'arrival',
      '31L': 'departure',
    });
  });

  it('does not name a use when the ATIS does not split them', () => {
    expect(Object.fromEntries(activeEndUse(atis(false, ['27'], ['27'])))).toEqual({ '27': 'any' });
  });

  it('is empty with no active runway', () => {
    expect(activeEndUse(null).size).toBe(0);
  });
});
