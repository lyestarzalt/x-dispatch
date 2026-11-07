/**
 * The 2.9.0 startup freeze (a synchronous scan held the main process for a
 * minute on Windows) never reached Sentry: nothing threw. The watchdog samples
 * the event loop delay and reports a block once it is over.
 *
 * The watcher tests feed it a stub sampler and drive the clock with fake
 * timers. An earlier version busy-waited on real timers with a 100 ms
 * threshold; on a loaded CI runner a stray stall inside the grace window
 * re-armed the report until `stop()` cleared it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PauseSampler, blockToReport, watchEventLoop } from './eventLoopWatch';

describe('blockToReport', () => {
  it('ignores ordinary jitter', () => {
    expect(blockToReport({ maxMs: 180, thresholdMs: 5_000 })).toBeNull();
  });

  it('reports a block over the threshold, rounded to whole seconds', () => {
    expect(blockToReport({ maxMs: 63_400, thresholdMs: 5_000 })).toEqual({
      seconds: 63,
      message: 'Main process blocked for 63 s',
    });
  });

  it('treats the threshold itself as not yet a block', () => {
    expect(blockToReport({ maxMs: 5_000, thresholdMs: 5_000 })).toBeNull();
  });
});

const THRESHOLD_MS = 5_000;
const SAMPLE_MS = 2_000;

/** A sampler the test fills in; like the histogram, `reset()` empties it. */
function stubSampler(): PauseSampler & { pause: (ms: number) => void; enabled: boolean } {
  const sampler = {
    maxMs: 0,
    enabled: false,
    pause(ms: number) {
      sampler.maxMs = Math.max(sampler.maxMs, ms);
    },
    enable() {
      sampler.enabled = true;
    },
    disable() {
      sampler.enabled = false;
    },
    reset() {
      sampler.maxMs = 0;
    },
  };
  return sampler;
}

function start(extra: { idleMs?: () => number } = {}) {
  const sampler = stubSampler();
  const reports: number[] = [];
  const watch = watchEventLoop((block) => reports.push(block.seconds), {
    thresholdMs: THRESHOLD_MS,
    sampleIntervalMs: SAMPLE_MS,
    sampler,
    ...extra,
  });
  return { sampler, reports, watch };
}

describe('watchEventLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports a block one sample after the sample that saw it', () => {
    const { sampler, reports, watch } = start();
    sampler.pause(63_400);
    vi.advanceTimersByTime(SAMPLE_MS);
    expect(reports).toEqual([]);
    vi.advanceTimersByTime(SAMPLE_MS);
    expect(reports).toEqual([63]);
    watch.stop();
  });

  it('reports a stall inside another stall’s grace window as one block', () => {
    const { sampler, reports, watch } = start();
    sampler.pause(8_000);
    vi.advanceTimersByTime(SAMPLE_MS);
    sampler.pause(12_000);
    vi.advanceTimersByTime(SAMPLE_MS);
    expect(reports).toEqual([]);
    vi.advanceTimersByTime(SAMPLE_MS);
    expect(reports).toEqual([12]);
    watch.stop();
  });

  it('keeps a pause the user was away for to itself', () => {
    const { sampler, reports, watch } = start({ idleMs: () => 3_600_000 });
    sampler.pause(8_000);
    vi.advanceTimersByTime(SAMPLE_MS * 2);
    expect(reports).toEqual([]);
    watch.stop();
  });

  it('still reports a pause shorter than the time the user has been away', () => {
    const { sampler, reports, watch } = start({ idleMs: () => 3_000 });
    sampler.pause(8_000);
    vi.advanceTimersByTime(SAMPLE_MS * 2);
    expect(reports).toEqual([8]);
    watch.stop();
  });

  it('stop drops a report still in its grace window and disables the sampler', () => {
    const { sampler, reports, watch } = start();
    sampler.pause(8_000);
    vi.advanceTimersByTime(SAMPLE_MS);
    expect(sampler.enabled).toBe(true);
    watch.stop();
    vi.advanceTimersByTime(SAMPLE_MS * 2);
    expect(reports).toEqual([]);
    expect(sampler.enabled).toBe(false);
  });
});

describe('watchEventLoop after a system sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops the sample window that a sleep inflated', () => {
    const { sampler, reports, watch } = start();
    sampler.pause(8_000);
    watch.discardCurrentWindow();
    vi.advanceTimersByTime(SAMPLE_MS * 2);
    expect(reports).toEqual([]);
    watch.stop();
  });

  it('still drops it when the discard lands after the sample, as on wake', () => {
    const { sampler, reports, watch } = start();
    sampler.pause(8_000);
    vi.advanceTimersByTime(SAMPLE_MS);
    // The sample timer has run by now; Electron's `resume` arrives a beat later.
    watch.discardCurrentWindow();
    vi.advanceTimersByTime(SAMPLE_MS * 2);
    expect(reports).toEqual([]);
    watch.stop();
  });

  it('reports a block that happens after the discarded window', () => {
    const { sampler, reports, watch } = start();
    sampler.pause(8_000);
    watch.discardCurrentWindow();
    vi.advanceTimersByTime(SAMPLE_MS);
    sampler.pause(9_000);
    vi.advanceTimersByTime(SAMPLE_MS * 2);
    expect(reports).toEqual([9]);
    watch.stop();
  });
});
