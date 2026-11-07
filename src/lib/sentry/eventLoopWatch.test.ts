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

const FAST = { thresholdMs: 100, sampleIntervalMs: 200 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function holdLoop(ms: number): void {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    /* busy */
  }
}

describe('watchEventLoop', () => {
  it('reports a real block of the event loop once it is over', async () => {
    const { watchEventLoop } = await import('./eventLoopWatch');
    const reports: number[] = [];
    const { stop } = watchEventLoop((block) => reports.push(block.seconds), FAST);
    // The histogram measures from its first loop turn, so let one pass first.
    await sleep(220);
    holdLoop(300);
    // One sample to see it, one more of grace before it is reported.
    await sleep(700);
    stop();
    expect(reports).toEqual([0]);
  });

  it('keeps a pause the user was away for to itself', async () => {
    const { watchEventLoop } = await import('./eventLoopWatch');
    const reports: number[] = [];
    // A pause of 0 s (rounded) against a machine idle for an hour.
    const { stop } = watchEventLoop((block) => reports.push(block.seconds), {
      ...FAST,
      idleMs: () => 3_600_000,
    });
    await sleep(220);
    holdLoop(300);
    await sleep(700);
    stop();
    expect(reports).toEqual([]);
  });
});

describe('watchEventLoop after a system sleep', () => {
  it('drops the sample window that a sleep inflated', async () => {
    const { watchEventLoop } = await import('./eventLoopWatch');
    const reports: number[] = [];
    const watch = watchEventLoop((block) => reports.push(block.seconds), FAST);
    await sleep(220);
    holdLoop(300);
    watch.discardCurrentWindow();
    await sleep(700);
    watch.stop();
    expect(reports).toEqual([]);
  });

  it('still drops it when the discard lands after the sample, as on wake', async () => {
    const { watchEventLoop } = await import('./eventLoopWatch');
    const reports: number[] = [];
    const watch = watchEventLoop((block) => reports.push(block.seconds), FAST);
    await sleep(220);
    holdLoop(300);
    // The sample timer has run by now; Electron's `resume` arrives a beat later.
    await sleep(50);
    watch.discardCurrentWindow();
    await sleep(700);
    watch.stop();
    expect(reports).toEqual([]);
  });
});
