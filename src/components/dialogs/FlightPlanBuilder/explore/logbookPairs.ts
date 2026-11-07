import type { FlightSummary } from '@/types/flightRecorder';

/** A city pair the pilot has flown, with how often and when last. */
export interface LogbookPair {
  from: string;
  to: string;
  count: number;
  /** Start time of the most recent flight on the pair. */
  lastAt: number;
  /** Aircraft of the most recent flight, when the recorder knew it. */
  aircraft: string | null;
}

/**
 * The pairs in the logbook, most flown first, most recent first within a count.
 * Only completed flights with both ends known count; a flight that ended where
 * it started is not a pair.
 */
export function logbookPairs(flights: readonly FlightSummary[]): LogbookPair[] {
  const pairs = new Map<string, LogbookPair>();
  for (const flight of flights) {
    if (flight.status !== 'complete' || !flight.departure || !flight.arrival) continue;
    const from = flight.departure.icao.toUpperCase();
    const to = flight.arrival.icao.toUpperCase();
    if (from === to) continue;
    const key = `${from}-${to}`;
    const seen = pairs.get(key);
    if (!seen) {
      pairs.set(key, {
        from,
        to,
        count: 1,
        lastAt: flight.startedAt,
        aircraft: flight.aircraft.icao ?? flight.aircraft.name,
      });
      continue;
    }
    seen.count += 1;
    if (flight.startedAt > seen.lastAt) {
      seen.lastAt = flight.startedAt;
      seen.aircraft = flight.aircraft.icao ?? flight.aircraft.name;
    }
  }
  return [...pairs.values()].sort((a, b) => b.count - a.count || b.lastAt - a.lastAt);
}
