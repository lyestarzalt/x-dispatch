import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StartPosition } from '@/types/position';
import { resolveLaunchTime } from './time';

const position: StartPosition = {
  type: 'ramp',
  airport: 'EGNO',
  name: 'Gate',
  latitude: 53.74,
  longitude: -2.88,
  heading: 90,
  index: 0,
};

afterEach(() => vi.useRealTimers());

describe('documented zero-based flight date', () => {
  it('uses zero for January 1 and preserves fractional manual time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12));
    expect(resolveLaunchTime(position, false, 12.5)).toEqual({ dayOfYear: 0, timeInHours: 12.5 });
  });

  it('uses 365 for December 31 of a leap year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 11, 31, 12));
    expect(resolveLaunchTime(position, false, 7.25).dayOfYear).toBe(365);
  });

  it('formats airport midnight as hour zero, not 24', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    expect(resolveLaunchTime(position, true, 12)).toEqual({ dayOfYear: 0, timeInHours: 0 });
  });
});
