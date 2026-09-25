/**
 * The one clock the app displays and lights the map by.
 *
 * Both the toolbar clock and the sun-driven layers resolve the instant the
 * same way: the simulator's Zulu time while X-Plane is connected and the
 * user asked to follow it, otherwise the machine clock. Keeping the rule in
 * one place is what keeps the readout and the day/night rendering in step.
 */
import { simTimeToEpochMs } from '@/lib/map/solar/solarPosition';

export type ClockSource = 'system' | 'sim';
export type ClockMode = 'zulu' | 'local';

export interface ResolvedClock {
  /** Epoch milliseconds. */
  timeMs: number;
  source: ClockSource;
}

export interface ClockInputs {
  followSimTime: boolean;
  connected: boolean;
  /** sim/time/zulu_time_sec */
  simZuluTimeSec?: number;
  /** sim/time/local_date_days, 0-based day of the year */
  simDayOfYear?: number;
  /** Machine clock, epoch ms. */
  nowMs: number;
}

export function resolveClock({
  followSimTime,
  connected,
  simZuluTimeSec,
  simDayOfYear,
  nowMs,
}: ClockInputs): ResolvedClock {
  if (followSimTime && connected && simZuluTimeSec !== undefined && simDayOfYear !== undefined) {
    return {
      timeMs: simTimeToEpochMs(simDayOfYear, simZuluTimeSec, new Date(nowMs).getUTCFullYear()),
      source: 'sim',
    };
  }
  return { timeMs: nowMs, source: 'system' };
}

/** HH:MM:SS, in UTC for Zulu or in the machine's zone (or `timeZone`) for local. */
export function formatClock(timeMs: number, mode: ClockMode, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: mode === 'zulu' ? 'UTC' : timeZone,
  }).formatToParts(new Date(timeMs));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  // en-GB may render midnight as "24" with hour12:false; normalise.
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  return `${hour}:${pick('minute')}:${pick('second')}`;
}
