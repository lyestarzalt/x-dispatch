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

/** Where the longest pause since the last sample comes from. */
export interface PauseSampler {
  /** The longest pause since the last `reset()`, in milliseconds. */
  readonly maxMs: number;
  enable(): void;
  disable(): void;
  reset(): void;
}

/** The sampler used in the app: Node's event loop delay histogram. */
function delayHistogramSampler(): PauseSampler {
  const histogram = monitorEventLoopDelay({ resolution: 50 });
  return {
    // The histogram is in nanoseconds.
    get maxMs() {
      return histogram.max / 1e6;
    },
    enable: () => histogram.enable(),
    disable: () => histogram.disable(),
    reset: () => histogram.reset(),
  };
}

export interface EventLoopWatchOptions {
  thresholdMs?: number;
  sampleIntervalMs?: number;
  /** Tests feed a stub; the app samples the event loop delay histogram. */
  sampler?: PauseSampler;
  /**
   * Milliseconds since the user last touched the keyboard or mouse. A pause
   * longer than that happened while nobody was there: an unattended machine
   * napping, not a freeze anyone sat through.
   */
  idleMs?: () => number;
}

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

/**
 * Starts sampling; `report` receives one call per block.
 *
 * A block is reported one sample late. When the machine wakes from sleep the
 * pending sample timer runs before Electron delivers `resume`, so the sleep
 * would read as a block; the grace period lets the caller's discard land first.
 */
export function watchEventLoop(
  report: (block: BlockReport) => void,
  options: EventLoopWatchOptions = {}
): EventLoopWatch {
  const thresholdMs = options.thresholdMs ?? BLOCK_THRESHOLD_MS;
  const sampleIntervalMs = options.sampleIntervalMs ?? SAMPLE_INTERVAL_MS;
  const sampler = options.sampler ?? delayHistogramSampler();
  sampler.enable();
  let discard = false;
  let pending: ReturnType<typeof setTimeout> | null = null;
  const dropPending = () => {
    if (pending) clearTimeout(pending);
    pending = null;
  };
  const timer = setInterval(() => {
    const block = blockToReport({ maxMs: sampler.maxMs, thresholdMs });
    sampler.reset();
    if (discard) {
      discard = false;
      dropPending();
      return;
    }
    if (!block) return;
    if (options.idleMs && options.idleMs() >= block.seconds * 1000) return;
    dropPending();
    pending = setTimeout(() => {
      pending = null;
      report(block);
    }, sampleIntervalMs);
    pending.unref();
  }, sampleIntervalMs);
  timer.unref();
  return {
    stop: () => {
      clearInterval(timer);
      dropPending();
      sampler.disable();
    },
    discardCurrentWindow: () => {
      sampler.reset();
      discard = true;
      dropPending();
    },
  };
}
