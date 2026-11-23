import type { FlightSummary } from '@/types/flightRecorder';
import type { FeetPerMinute, NauticalMiles, Seconds } from '@/types/units';

/** The fields a pilot can change on a logged flight, or fill in for one added by hand. */
export interface FlightEditInput {
  startedAt: number;
  departureIcao: string;
  departureName: string;
  arrivalIcao: string;
  arrivalName: string;
  aircraftIcao: string;
  aircraftName: string;
  livery: string;
  blockTimeSec: Seconds;
  airTimeSec: Seconds;
  distanceNm: NauticalMiles;
  landingCount: number;
}

export function flightEditInput(flight: FlightSummary): FlightEditInput {
  return {
    startedAt: flight.startedAt,
    departureIcao: flight.departure?.icao ?? '',
    departureName: flight.departure?.name ?? '',
    arrivalIcao: flight.arrival?.icao ?? '',
    arrivalName: flight.arrival?.name ?? '',
    aircraftIcao: flight.aircraft.icao ?? '',
    aircraftName: flight.aircraft.name ?? '',
    livery: flight.aircraft.livery ?? '',
    blockTimeSec: flight.blockTimeSec,
    airTimeSec: flight.airTimeSec,
    distanceNm: flight.distanceNm,
    landingCount: flight.landingCount,
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function icao(value: unknown): string {
  return text(value).toUpperCase().slice(0, 4);
}

function nonNegative(value: unknown, integer = false): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return integer ? Math.round(n) : n;
}

function airport(code: string, name: string): FlightSummary['departure'] {
  return code ? { icao: code, name } : null;
}

/**
 * IPC input is untrusted: a copy of `flight` with the editable fields replaced by
 * cleaned values from `input`. Everything else (track, landings, fuel, status) is
 * what the recorder wrote.
 */
export function applyFlightEdit(flight: FlightSummary, input: unknown): FlightSummary {
  const source =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const startedAt = nonNegative(source.startedAt, true) || flight.startedAt;
  const blockTimeSec = nonNegative(source.blockTimeSec, true);
  const airTimeSec = Math.min(blockTimeSec, nonNegative(source.airTimeSec, true));
  const departureIcao = icao(source.departureIcao);
  const arrivalIcao = icao(source.arrivalIcao);
  const aircraftIcao = icao(source.aircraftIcao);
  const aircraftName = text(source.aircraftName);
  const livery = text(source.livery);
  const ended = flight.endedAt === null ? null : startedAt + blockTimeSec * 1000;
  return {
    ...flight,
    startedAt,
    endedAt: ended,
    departure: airport(departureIcao, text(source.departureName)),
    arrival: airport(arrivalIcao, text(source.arrivalName)),
    aircraft: {
      icao: aircraftIcao || null,
      name: aircraftName || null,
      livery: livery || null,
    },
    blockTimeSec,
    airTimeSec,
    distanceNm: nonNegative(source.distanceNm),
    landingCount: nonNegative(source.landingCount, true),
  };
}

/**
 * Airport names come from the database, not the pilot: an ICAO the database
 * knows gets its name; one it does not keeps whatever name came with it.
 */
export function fillAirportNames(
  flight: FlightSummary,
  lookup: (icao: string) => string | null
): FlightSummary {
  const named = (airport: FlightSummary['departure']) => {
    if (!airport) return null;
    const name = lookup(airport.icao);
    return name ? { ...airport, name } : airport;
  };
  return { ...flight, departure: named(flight.departure), arrival: named(flight.arrival) };
}

export function manualFlightId(now = Date.now()): string {
  return `manual-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A complete flight with no track, entered by hand. */
export function newManualFlight(input: unknown, id = manualFlightId()): FlightSummary {
  const blank: FlightSummary = {
    id,
    startedAt: Date.now(),
    endedAt: Date.now(),
    status: 'complete',
    aircraft: { icao: null, name: null, livery: null },
    departure: null,
    arrival: null,
    blockTimeSec: 0,
    airTimeSec: 0,
    distanceNm: 0,
    maxAltFt: 0,
    maxGroundspeedKt: 0,
    fuelStartKg: null,
    fuelEndKg: null,
    landing: null,
    landingCount: 0,
    pointCount: 0,
    preview: [],
  };
  return applyFlightEdit(blank, input);
}

export interface LogbookTotals {
  flights: number;
  blockTimeSec: Seconds;
  airTimeSec: Seconds;
  distanceNm: NauticalMiles;
  landings: number;
  /** Mean touchdown rate over flights with a landing report, fpm (negative is down). */
  averageTouchdownRateFpm: FeetPerMinute | null;
  /** Gentlest touchdown on record, fpm. */
  bestTouchdownRateFpm: FeetPerMinute | null;
}

/** Flights still being recorded are left out so the totals do not move while flying. */
export function logbookTotals(flights: FlightSummary[]): LogbookTotals {
  const totals: LogbookTotals = {
    flights: 0,
    blockTimeSec: 0,
    airTimeSec: 0,
    distanceNm: 0,
    landings: 0,
    averageTouchdownRateFpm: null,
    bestTouchdownRateFpm: null,
  };
  let rateSum = 0;
  let rated = 0;
  for (const flight of flights) {
    if (flight.status === 'active') continue;
    totals.flights += 1;
    totals.blockTimeSec += flight.blockTimeSec;
    totals.airTimeSec += flight.airTimeSec;
    totals.distanceNm += flight.distanceNm;
    totals.landings += flight.landingCount;
    const rate = flight.landing?.touchdownRateFpm;
    if (typeof rate === 'number' && Number.isFinite(rate)) {
      rateSum += rate;
      rated += 1;
      if (totals.bestTouchdownRateFpm === null || rate > totals.bestTouchdownRateFpm) {
        totals.bestTouchdownRateFpm = rate;
      }
    }
  }
  if (rated > 0) totals.averageTouchdownRateFpm = rateSum / rated;
  return totals;
}
