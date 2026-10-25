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

export interface AirportLocalTime {
  /** HH:MM in the airport's zone. */
  time: string;
  /** `UTC`, `UTC+2`, `UTC-4`, `UTC+5:30`. */
  offset: string;
}

/**
 * The wall clock at an airport: the instant rendered in its IANA zone, with
 * the zone's offset from UTC so the pilot sees how far it is from their own.
 * Throws for an unknown zone, as `Intl.DateTimeFormat` does.
 */
export function formatAirportLocalTime(timeMs: number, timeZone: string): AirportLocalTime {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(new Date(timeMs));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  const time = `${hour}:${pick('minute')}`;
  // longOffset renders "GMT" or "GMT+00:00", "GMT+02:00", "GMT-04:00", "GMT+05:30".
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(pick('timeZoneName'));
  if (!match) return { time, offset: 'UTC' };
  const [, sign, hh, mm] = match;
  if (hh === '00' && mm === '00') return { time, offset: 'UTC' };
  const offset = `UTC${sign}${Number(hh)}${mm === '00' ? '' : `:${mm}`}`;
  return { time, offset };
}
