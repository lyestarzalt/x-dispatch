import { describe, expect, it } from 'vitest';
import { timeAgo } from './timeAgo';

const NOW = Date.UTC(2026, 10, 23, 12);

describe('timeAgo', () => {
  it('reads in the largest whole unit', () => {
    expect(timeAgo(NOW - 12 * 60_000, NOW, 'en')).toBe('12 minutes ago');
    expect(timeAgo(NOW - 3 * 3_600_000, NOW, 'en')).toBe('3 hours ago');
    expect(timeAgo(NOW - 26 * 3_600_000, NOW, 'en')).toBe('yesterday');
  });

  it('reads as now under a minute, and for a clock that went backwards', () => {
    expect(timeAgo(NOW - 20_000, NOW, 'en')).toBe('now');
    expect(timeAgo(NOW + 5_000, NOW, 'en')).toBe('now');
  });

  it('follows the app language', () => {
    expect(timeAgo(NOW - 2 * 3_600_000, NOW, 'fr')).toBe('il y a 2 heures');
  });
});
