import { useEffect } from 'react';
import { simTimeToEpochMs } from '@/lib/map/solar/solarPosition';
import { usePlaneStore } from '@/stores/planeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { type SolarClockSource, useSolarStore } from '@/stores/solarStore';

/** How often the candidate time is sampled. */
const SAMPLE_INTERVAL_MS = 1000;
/** Minimum change of clock time between published ticks: a quarter degree of sun. */
const PUBLISH_STEP_MS = 60_000;

function candidateClock(): { timeMs: number; source: SolarClockSource } {
  const { followSimTime } = useSettingsStore.getState().graphics;
  const { connected, state } = usePlaneStore.getState();
  if (
    followSimTime &&
    connected &&
    state?.simZuluTimeSec !== undefined &&
    state.simDayOfYear !== undefined
  ) {
    return {
      timeMs: simTimeToEpochMs(
        state.simDayOfYear,
        state.simZuluTimeSec,
        new Date().getUTCFullYear()
      ),
      source: 'sim',
    };
  }
  return { timeMs: Date.now(), source: 'system' };
}

/**
 * Feeds the solar store from the simulator clock when X-Plane is connected,
 * otherwise from the system clock. Samples every second but publishes only
 * when the clock moved by a minute or the source changed, so a paused sim
 * or a slow real-time crawl costs subscribers nothing. Jumps (time set in
 * the sim, reconnects) publish within a second.
 */
export function useSolarClock(): void {
  useEffect(() => {
    const tick = () => {
      const candidate = candidateClock();
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
