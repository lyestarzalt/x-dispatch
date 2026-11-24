import { describe, expect, it } from 'vitest';
import { recordWindowShown, withStartupTiming } from './startupTiming';

describe('withStartupTiming', () => {
  it('adds the main-process time to the window on app_ready, as a bucket', () => {
    recordWindowShown(12_500);
    expect(withStartupTiming('app_ready', { startup: 'over_60s', from_cache: true })).toEqual({
      startup: 'over_60s',
      from_cache: true,
      window: '10_30s',
    });
  });

  it('leaves other events and malformed input alone', () => {
    recordWindowShown(12_500);
    expect(withStartupTiming('display', { scale: '1' })).toEqual({ scale: '1' });
    expect(withStartupTiming('app_ready', 'nope')).toBe('nope');
  });

  it('adds nothing before the window has shown', () => {
    recordWindowShown(null);
    expect(withStartupTiming('app_ready', { startup: '2_5s', from_cache: true })).toEqual({
      startup: '2_5s',
      from_cache: true,
    });
  });
});
