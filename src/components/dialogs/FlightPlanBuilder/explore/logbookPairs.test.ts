import { describe, expect, it } from 'vitest';
import type { FlightSummary } from '@/types/flightRecorder';
import { logbookPairs } from './logbookPairs';

function flight(
  from: string | null,
  to: string | null,
  startedAt: number,
  status: FlightSummary['status'] = 'complete',
  aircraft = 'A320'
): FlightSummary {
  return {
    id: `${from}-${to}-${startedAt}`,
    startedAt,
    endedAt: startedAt + 3600,
    status,
    aircraft: { icao: aircraft, name: null, livery: null },
    departure: from ? { icao: from, name: from } : null,
    arrival: to ? { icao: to, name: to } : null,
    blockTimeSec: 0,
    airTimeSec: 0,
    distanceNm: 0,
    maxAltFt: 0,
    maxGroundspeedKt: 0,
    fuelStartKg: null,
    fuelEndKg: null,
    landing: null,
    landingCount: 1,
    pointCount: 0,
    preview: [],
  };
}

describe('logbookPairs', () => {
  it('counts completed pairs, most flown first, newest aircraft kept', () => {
    const pairs = logbookPairs([
      flight('EHAM', 'EGLL', 100, 'complete', 'B738'),
      flight('EHAM', 'EGLL', 300, 'complete', 'A320'),
      flight('LFPG', 'EHAM', 200),
      flight('EHAM', 'EGLL', 50, 'aborted'),
    ]);
    expect(pairs.map((p) => [p.from, p.to, p.count, p.aircraft])).toEqual([
      ['EHAM', 'EGLL', 2, 'A320'],
      ['LFPG', 'EHAM', 1, 'A320'],
    ]);
  });

  it('skips flights missing an end or ending where they started', () => {
    expect(logbookPairs([flight('EHAM', null, 1), flight('EHAM', 'EHAM', 2)])).toEqual([]);
  });

  it('breaks a tie on count by the most recent flight', () => {
    const pairs = logbookPairs([flight('A', 'B', 10), flight('C', 'D', 20)]);
    expect(pairs.map((p) => p.from)).toEqual(['C', 'A']);
  });
});
