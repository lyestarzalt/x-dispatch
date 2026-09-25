import { useEffect } from 'react';
import { readClock } from '@/hooks/useClock';
import { useSolarStore } from '@/stores/solarStore';

/** How often the candidate time is sampled. */
const SAMPLE_INTERVAL_MS = 1000;
/** Minimum change of clock time between published ticks: a quarter degree of sun. */
const PUBLISH_STEP_MS = 60_000;

/**
 * Feeds the solar store from the shared app clock (`readClock`): the
 * simulator clock when X-Plane is connected and followed, otherwise the
 * system clock. Samples every second but publishes only
 * when the clock moved by a minute or the source changed, so a paused sim
 * or a slow real-time crawl costs subscribers nothing. Jumps (time set in
 * the sim, reconnects) publish within a second.
 */
export function useSolarClock(): void {
  useEffect(() => {
    const tick = () => {
      const candidate = readClock();
      const current = useSolarStore.getState();
      const moved = Math.abs(candidate.timeMs - current.timeMs) >= PUBLISH_STEP_MS;
      if (moved || candidate.source !== current.source) {
        current.setClock(candidate.timeMs, candidate.source);
      }
    };
    tick();
    const interval = setInterval(tick, SAMPLE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);
}
