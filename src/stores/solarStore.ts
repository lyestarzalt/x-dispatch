import { create } from 'zustand';
import { type GeoPoint, subsolarPoint } from '@/lib/map/solar/solarPosition';
import type { ClockSource } from '@/lib/utils/clock';

/** Same source the toolbar clock shows, so the sun and the readout agree. */
export type SolarClockSource = ClockSource;

interface SolarState {
  /** Instant the map is lit for, epoch milliseconds. */
  timeMs: number;
  source: SolarClockSource;
  /** Where the sun is overhead at `timeMs`. Derived once per tick. */
  subsolar: GeoPoint;
  /**
   * A time the user is previewing (the plan builder's takeoff time). While
   * set it replaces the live clock as `timeMs`; null hands the map back to
   * the clock on its next tick.
   */
  previewMs: number | null;
  setClock: (timeMs: number, source: SolarClockSource) => void;
  setPreview: (timeMs: number | null) => void;
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
    previewMs: null,
    setClock: (timeMs, source) => set({ timeMs, source, subsolar: subsolarPoint(timeMs) }),
    setPreview: (timeMs) =>
      set(
        timeMs === null
          ? { previewMs: null }
          : { previewMs: timeMs, timeMs, subsolar: subsolarPoint(timeMs) }
      ),
  };
});
