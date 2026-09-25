import { describe, expect, it } from 'vitest';
import { formatClock, resolveClock } from './clock';

// 2026-03-10T18:15:23Z
const NOW_MS = Date.UTC(2026, 2, 10, 18, 15, 23);

describe('resolveClock', () => {
  it('uses the system clock when following the sim is off', () => {
    expect(
      resolveClock({
        followSimTime: false,
        connected: true,
        simZuluTimeSec: 3600,
        simDayOfYear: 10,
        nowMs: NOW_MS,
      })
    ).toEqual({ timeMs: NOW_MS, source: 'system' });
  });

  it('uses the system clock when X-Plane is not connected', () => {
    expect(
      resolveClock({
        followSimTime: true,
        connected: false,
        simZuluTimeSec: 3600,
        simDayOfYear: 10,
        nowMs: NOW_MS,
      })
    ).toEqual({ timeMs: NOW_MS, source: 'system' });
  });

  it('uses the system clock when the sim has not sent a time yet', () => {
    expect(resolveClock({ followSimTime: true, connected: true, nowMs: NOW_MS })).toEqual({
      timeMs: NOW_MS,
      source: 'system',
    });
  });

  it('converts the sim day-of-year and zulu seconds into an instant of the current year', () => {
    // Day 68 (0-based) of 2026 = 10 March, 18:15:23Z = 65723 s
    expect(
      resolveClock({
        followSimTime: true,
        connected: true,
        simZuluTimeSec: 65723,
        simDayOfYear: 68,
        nowMs: NOW_MS,
      })
    ).toEqual({ timeMs: NOW_MS, source: 'sim' });
  });
});

describe('formatClock', () => {
  it('formats Zulu as HH:MM:SS in UTC', () => {
    expect(formatClock(NOW_MS, 'zulu')).toBe('18:15:23');
  });

  it('formats local time in the given zone', () => {
    expect(formatClock(NOW_MS, 'local', 'Asia/Kuala_Lumpur')).toBe('02:15:23');
  });

  it('zero-pads single-digit hours', () => {
    expect(formatClock(Date.UTC(2026, 2, 10, 5, 7, 9), 'zulu')).toBe('05:07:09');
  });
});
