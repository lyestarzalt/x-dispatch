import { describe, expect, it } from 'vitest';
import { dialogTimeBucket, scaleBucket, startupBucket, widthBucket } from './buckets';
import { sanitizeEvent } from './events';

describe('analytics buckets', () => {
  it('buckets startup time', () => {
    expect(startupBucket(1_200)).toBe('under_2s');
    expect(startupBucket(2_000)).toBe('2_5s');
    expect(startupBucket(7_500)).toBe('5_10s');
    expect(startupBucket(42_000)).toBe('over_10s');
  });

  it('buckets window width', () => {
    expect(widthBucket(1024)).toBe('under_1280');
    expect(widthBucket(1440)).toBe('1280_1599');
    expect(widthBucket(1680)).toBe('1600_1919');
    expect(widthBucket(1920)).toBe('1920_2559');
    expect(widthBucket(3840)).toBe('2560_plus');
  });

  it('snaps display scaling to the common Windows and macOS steps', () => {
    expect(scaleBucket(1)).toBe('1');
    expect(scaleBucket(1.25)).toBe('1.25');
    expect(scaleBucket(1.5)).toBe('1.5');
    expect(scaleBucket(2)).toBe('2');
    expect(scaleBucket(1.1)).toBe('other');
  });

  it('buckets how long a dialog stayed open', () => {
    expect(dialogTimeBucket(4_000)).toBe('under_10s');
    expect(dialogTimeBucket(10_000)).toBe('10_60s');
    expect(dialogTimeBucket(90_000)).toBe('1_5m');
    expect(dialogTimeBucket(600_000)).toBe('over_5m');
  });

  it('produces values the event allowlist accepts', () => {
    expect(
      sanitizeEvent('app_ready', { startup: startupBucket(3_000), from_cache: true })
    ).not.toBeNull();
    expect(
      sanitizeEvent('display', {
        window_width: widthBucket(1920),
        scale: scaleBucket(1.5),
        maximized: true,
        fullscreen: false,
      })
    ).not.toBeNull();
    expect(sanitizeEvent('shortcut_used', { shortcut: 'focus_search' })).not.toBeNull();
    expect(sanitizeEvent('error_shown', { area: 'fms_export' })).not.toBeNull();
    expect(sanitizeEvent('error_shown', { area: 'Could not save file' })).toBeNull();
    expect(
      sanitizeEvent('launch_abandoned', {
        aircraft_selected: true,
        launch_failed: false,
        time_open: dialogTimeBucket(45_000),
      })
    ).not.toBeNull();
  });
});
