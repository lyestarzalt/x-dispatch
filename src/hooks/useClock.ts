import { useEffect, useState } from 'react';
import { type ResolvedClock, resolveClock } from '@/lib/utils/clock';
import { usePlaneStore } from '@/stores/planeStore';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * The instant the app runs on right now: the simulator clock while X-Plane
 * is connected and "follow X-Plane time" is on, otherwise the machine clock.
 * The toolbar clock and the sun-driven layers both read this so they never
 * disagree.
 */
export function readClock(nowMs = Date.now()): ResolvedClock {
  const { followSimTime } = useSettingsStore.getState().graphics;
  const { connected, state } = usePlaneStore.getState();
  return resolveClock({
    followSimTime,
    connected,
    simZuluTimeSec: state?.simZuluTimeSec,
    simDayOfYear: state?.simDayOfYear,
    nowMs,
  });
}

/** Ticks once a second; re-reads immediately when the source setting or connection flips. */
export function useClock(): ResolvedClock {
  const followSimTime = useSettingsStore((s) => s.graphics.followSimTime);
  const connected = usePlaneStore((s) => s.connected);
  const [clock, setClock] = useState<ResolvedClock>(readClock);

  useEffect(() => {
    const tick = () => setClock(readClock());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [followSimTime, connected]);

  return clock;
}
