import { create } from 'zustand';
import { type GeoPoint, subsolarPoint } from '@/lib/map/solar/solarPosition';

export type SolarClockSource = 'system' | 'sim';

interface SolarState {
  /** Instant the map is lit for, epoch milliseconds. */
  timeMs: number;
  source: SolarClockSource;
  /** Where the sun is overhead at `timeMs`. Derived once per tick. */
  subsolar: GeoPoint;
  setClock: (timeMs: number, source: SolarClockSource) => void;
}

/**
 * The one clock every sun-driven layer reads. Ticks arrive from
 * useSolarClock about once a minute of clock time, so subscribers can treat
 * each change as a real move of the sun rather than throttling on their own.
 */
export const useSolarStore = create<SolarState>()((set) => {
  const now = Date.now();
  return {
    timeMs: now,
    source: 'system',
    subsolar: subsolarPoint(now),
    setClock: (timeMs, source) => set({ timeMs, source, subsolar: subsolarPoint(timeMs) }),
  };
});
