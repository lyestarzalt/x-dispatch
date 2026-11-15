/**
 * Controllers and ATIS positions from either feed as one station list, and the airports
 * they staff.
 */
import type { Airport } from '@/lib/xplaneServices/dataService';
import type { IvaoAtc } from '@/types/ivao';
import type {
  AirportStaffing,
  AtcRole,
  NetworkPilot,
  NetworkStation,
} from '@/types/networkTraffic';
import type { VatsimATIS, VatsimController } from '@/types/vatsim';
import {
  AIRPORT_STRIP_ROLES,
  callsignParts,
  roleFromCallsign,
  sortStations,
  topRole,
} from './atcRoles';
import { atisLetterFromText, broadcastLines } from './atis';

export function fromVatsimController(c: VatsimController): NetworkStation {
  return {
    network: 'vatsim',
    callsign: c.callsign,
    name: c.name,
    frequency: c.frequency,
    role: roleFromCallsign(c.callsign),
    atis: null,
  };
}

export function fromVatsimAtis(a: VatsimATIS): NetworkStation {
  const lines = a.text_atis ?? [];
  return {
    network: 'vatsim',
    callsign: a.callsign,
    name: a.name,
    frequency: a.frequency,
    role: 'ATIS',
    atis: { code: a.atis_code || atisLetterFromText(lines), lines },
  };
}

/** Null for a session without a position; observers and the like. */
export function fromIvaoAtc(a: IvaoAtc): NetworkStation | null {
  if (!a.atcSession) return null;
  const lines = broadcastLines(a.atis?.lines ?? []);
  // The revision letter is the information code when the position actually broadcasts one.
  const revision = a.atis?.revision?.trim().toUpperCase() ?? '';
  const code = atisLetterFromText(lines) ?? (/^[A-Z]$/.test(revision) ? revision : null);
  return {
    network: 'ivao',
    callsign: a.callsign,
    name: '',
    frequency: Number.isFinite(a.atcSession.frequency) ? a.atcSession.frequency.toFixed(3) : '',
    role: roleFromCallsign(a.callsign),
    atis: lines.length ? { code, lines } : null,
  };
}

const AIRPORT_ROLES: ReadonlySet<AtcRole> = new Set([...AIRPORT_STRIP_ROLES, 'ATIS']);

// Rebuilt only when the airport list itself changes; the lookup runs on every poll.
const lookupCache = new WeakMap<Airport[], { byIcao: Set<string>; byIata: Map<string, string> }>();
function airportLookup(airports: Airport[]) {
  let lookup = lookupCache.get(airports);
  if (!lookup) {
    lookup = { byIcao: new Set(), byIata: new Map() };
    for (const a of airports) {
      const icao = a.icao.toUpperCase();
      lookup.byIcao.add(icao);
      const iata = a.iataCode?.toUpperCase();
      if (iata && !lookup.byIata.has(iata)) lookup.byIata.set(iata, icao);
    }
    lookupCache.set(airports, lookup);
  }
  return lookup;
}

/** The airport a position's callsign names: a four-letter ICAO, or an IATA code X-Plane knows. */
export function stationAirport(callsign: string, airports: Airport[]): string | null {
  const prefix = callsignParts(callsign)[0] ?? '';
  if (/^[A-Z]{4}$/.test(prefix)) return prefix;
  if (/^[A-Z]{3}$/.test(prefix)) return airportLookup(airports).byIata.get(prefix) ?? null;
  return null;
}

/** Staffing per airport ICAO, for every airport with a delivery, ground, tower, approach or ATIS online. */
export function buildAirportStaffing(
  stations: NetworkStation[],
  airports: Airport[]
): Record<string, AirportStaffing> {
  const grouped = new Map<string, NetworkStation[]>();
  for (const s of stations) {
    if (!AIRPORT_ROLES.has(s.role)) continue;
    const icao = stationAirport(s.callsign, airports);
    if (!icao) continue;
    grouped.set(icao, [...(grouped.get(icao) ?? []), s]);
  }
  const out: Record<string, AirportStaffing> = {};
  for (const [icao, list] of grouped) {
    const sorted = sortStations(list);
    const online = new Set(sorted.map((s) => s.role));
    const roles = AIRPORT_STRIP_ROLES.filter((r) => online.has(r));
    const atisCode = sorted.find((s) => s.atis?.code)?.atis?.code ?? null;
    out[icao] = {
      icao,
      network: sorted[0]!.network,
      stations: sorted,
      roles,
      top: topRole(online),
      atisCode,
    };
  }
  return out;
}

export function trafficCountsForAirport(
  pilots: NetworkPilot[],
  icao: string
): { departures: number; arrivals: number } {
  const upper = icao.toUpperCase();
  let departures = 0;
  let arrivals = 0;
  for (const p of pilots) {
    if (p.flightPlan?.departure === upper) departures++;
    if (p.flightPlan?.arrival === upper) arrivals++;
  }
  return { departures, arrivals };
}

/** Filed departures and arrivals per airport, in one pass over the network's pilots. */
export function trafficCountsByAirport(
  pilots: NetworkPilot[]
): Map<string, { departures: number; arrivals: number }> {
  const counts = new Map<string, { departures: number; arrivals: number }>();
  const at = (icao: string) => {
    let entry = counts.get(icao);
    if (!entry) {
      entry = { departures: 0, arrivals: 0 };
      counts.set(icao, entry);
    }
    return entry;
  };
  for (const p of pilots) {
    if (p.flightPlan?.departure) at(p.flightPlan.departure).departures++;
    if (p.flightPlan?.arrival) at(p.flightPlan.arrival).arrivals++;
  }
  return counts;
}
