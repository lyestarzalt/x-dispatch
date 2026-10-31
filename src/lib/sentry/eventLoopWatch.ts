/**
 * Reports main-process event loop blocks to Sentry.
 *
 * A long synchronous call in the main process freezes every IPC call and, on
 * Windows, marks the window "Not Responding". It throws nothing, so the error
 * SDK never sees it: 2.9.0 shipped a startup freeze that only users noticed.
 * Node's event loop delay histogram records the longest pause between loop
 * turns; sampling it on an interval turns a pause over the threshold into one
 * Sentry event, with the app log tail that `beforeSend` already attaches, so
 * the next freeze names the step that caused it.
 *
 * `@sentry/node-native`'s block detector would also capture a stack, but its
 * prebuilt binaries are keyed to Node ABIs rather than Electron's, so it is
 * not used until it is verified on every packaged platform.
 */
import { monitorEventLoopDelay } from 'node:perf_hooks';

export const BLOCK_THRESHOLD_MS = 5_000;
const SAMPLE_INTERVAL_MS = 2_000;

export interface BlockReport {
  seconds: number;
  message: string;
}

/** The report for the longest pause seen since the last sample, or null when it was ordinary. */
export function blockToReport(sample: { maxMs: number; thresholdMs: number }): BlockReport | null {
  if (sample.maxMs <= sample.thresholdMs) return null;
  const seconds = Math.round(sample.maxMs / 1000);
  return { seconds, message: `Main process blocked for ${seconds} s` };
}

export interface EventLoopWatch {
  stop: () => void;
  /**
   * Forgets the pause currently recorded. A machine going to sleep stalls the
   * loop just like a block does; the caller discards the window on wake.
   */
  discardCurrentWindow: () => void;
}

/** Starts sampling; `report` receives one call per block. */
export function watchEventLoop(
  report: (block: BlockReport) => void,
  thresholdMs = BLOCK_THRESHOLD_MS
): EventLoopWatch {
  const histogram = monitorEventLoopDelay({ resolution: 50 });
  histogram.enable();
  let discard = false;
  const timer = setInterval(() => {
    // The histogram is in nanoseconds.
    const block = blockToReport({ maxMs: histogram.max / 1e6, thresholdMs });
    histogram.reset();
    if (discard) {
      discard = false;
      return;
    }
    if (block) report(block);
  }, SAMPLE_INTERVAL_MS);
  timer.unref();
  return {
    stop: () => {
      clearInterval(timer);
      histogram.disable();
    },
    discardCurrentWindow: () => {
      histogram.reset();
      discard = true;
    },
  };
}
