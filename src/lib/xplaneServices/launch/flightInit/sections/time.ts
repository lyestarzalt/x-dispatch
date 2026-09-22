import tzLookup from 'tz-lookup';
import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import type { StartPosition } from '@/types/position';

export function buildTimeSection(
  useRealWorldTime: boolean,
  dayOfYear: number,
  timeOfDay: number
): Pick<FlightInit, 'use_system_time' | 'local_time'> {
  if (useRealWorldTime) {
    return { use_system_time: true };
  }
  return {
    local_time: {
      day_of_year: dayOfYear,
      time_in_24_hours: timeOfDay,
    },
  };
}

/**
 * Compute the (dayOfYear, timeInHours) pair to put in `local_time`.
 *
 * X-Plane's `use_system_time` uses the host computer's timezone, which is
 * almost never what the user wants — we want the time at the *airport*. So
 * for real-world time we look up the airport's tz and resolve the current
 * local time there. For manual time, we still need today's day-of-year so
 * X-Plane gets a real date alongside the user's chosen hours.
 */
export function resolveLaunchTime(
  startPosition: StartPosition,
  useRealWorldTime: boolean,
  timeOfDay: number
): { dayOfYear: number; timeInHours: number } {
  if (useRealWorldTime) {
    const timezone = tzLookup(startPosition.latitude, startPosition.longitude);
    const now = new Date();

    const airportTimeStr = now.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });

    const [datePart, timePart] = airportTimeStr.split(', ');
    if (!datePart || !timePart) throw new Error('Failed to parse airport time');
    const dateParts = datePart.split('/').map(Number);
    const timeParts = timePart.split(':').map(Number);
    const month = dateParts[0] ?? 1;
    const day = dateParts[1] ?? 1;
    const year = dateParts[2] ?? new Date().getFullYear();
    const hours = timeParts[0] ?? 0;
    const minutes = timeParts[1] ?? 0;

    const dayOfYear = calendarDayOfYear(year, month - 1, day);
    const timeInHours = hours + minutes / 60;
    return { dayOfYear, timeInHours };
  }

  const now = new Date();
  const dayOfYear = calendarDayOfYear(now.getFullYear(), now.getMonth(), now.getDate());
  return { dayOfYear, timeInHours: timeOfDay };
}

/** The API counts January 1 as zero. UTC arithmetic avoids daylight-saving offsets. */
function calendarDayOfYear(year: number, month: number, day: number): number {
  return (Date.UTC(year, month, day) - Date.UTC(year, 0, 1)) / 86_400_000;
}
