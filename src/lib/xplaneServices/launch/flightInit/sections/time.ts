import tzLookup from 'tz-lookup';
import type { StartPosition } from '@/types/position';

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
      hour12: false,
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

    const airportDate = new Date(year, month - 1, day);
    const startOfYear = new Date(year, 0, 0);
    const dayOfYear = Math.floor(
      (airportDate.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
    );
    const timeInHours = hours + minutes / 60;
    return { dayOfYear, timeInHours };
  }

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  return { dayOfYear, timeInHours: timeOfDay };
}
