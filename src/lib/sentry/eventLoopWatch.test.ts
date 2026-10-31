/**
 * The 2.9.0 startup freeze (a synchronous scan held the main process for a
 * minute on Windows) never reached Sentry: nothing threw. The watchdog samples
 * Node's event loop delay histogram and reports a block once it is over.
 */
import { describe, expect, it } from 'vitest';
import { blockToReport } from './eventLoopWatch';

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

describe('watchEventLoop', () => {
  it('reports a real block of the event loop once it is over', async () => {
    const { watchEventLoop } = await import('./eventLoopWatch');
    const reports: number[] = [];
    const { stop } = watchEventLoop((block) => reports.push(block.seconds), 100);
    // The histogram measures from its first loop turn, so let one pass first.
    await new Promise((r) => setTimeout(r, 120));
    // Hold the loop for ~300 ms.
    const until = Date.now() + 300;
    while (Date.now() < until) {
      /* busy */
    }
    await new Promise((r) => setTimeout(r, 2_300));
    stop();
    expect(reports).toEqual([0]);
  });
});

describe('watchEventLoop after a system sleep', () => {
  it('drops the sample window that a sleep inflated', async () => {
    const { watchEventLoop } = await import('./eventLoopWatch');
    const reports: number[] = [];
    const watch = watchEventLoop((block) => reports.push(block.seconds), 100);
    await new Promise((r) => setTimeout(r, 120));
    const until = Date.now() + 300;
    while (Date.now() < until) {
      /* a pause that, in the app, would be the machine waking up */
    }
    watch.discardCurrentWindow();
    await new Promise((r) => setTimeout(r, 2_300));
    watch.stop();
    expect(reports).toEqual([]);
  });
});
