import { useQuery } from '@tanstack/react-query';
import { AirportParser, ParsedAirport } from '@/lib/aptParser';

export type { ParsedAirport };

export const airportKeys = {
  all: ['airports'] as const,
  detail: (icao: string) => ['airports', 'detail', icao.toUpperCase()] as const,
  procedures: (icao: string) => ['airports', 'procedures', icao.toUpperCase()] as const,
};

async function fetchAirportData(icao: string): Promise<ParsedAirport | null> {
  try {
    const rawData = await window.airportAPI.getAirportData(icao);
    if (!rawData) return null;
    return new AirportParser(rawData).parse();
  } catch {
    return null;
  }
}

export interface ProcedureWaypoint {
  fixId: string;
  fixRegion: string;
  fixType: string;
  pathTerminator: string;
  course: number | null;
  distance: number | null;
  altitude: { descriptor: string; altitude1: number | null; altitude2: number | null } | null;
  speed: number | null;
  turnDirection: 'L' | 'R' | null;
}

export interface Procedure {
  type: 'SID' | 'STAR' | 'APPROACH';
  name: string;
  runway: string | null;
  transition: string | null;
  waypoints: ProcedureWaypoint[];
}

export interface AirportProcedures {
  icao: string;
  sids: Procedure[];
  stars: Procedure[];
  approaches: Procedure[];
}

async function fetchAirportProcedures(icao: string): Promise<AirportProcedures | null> {
  try {
    return await window.navAPI.getAirportProcedures(icao);
  } catch {
    return null;
  }
}

export function useAirportQuery(icao: string | null) {
  return useQuery({
    queryKey: airportKeys.detail(icao ?? ''),
    queryFn: () => fetchAirportData(icao!),
    enabled: !!icao,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
  });
}

export function useAirportProceduresQuery(icao: string | null) {
  return useQuery({
    queryKey: airportKeys.procedures(icao ?? ''),
    queryFn: () => fetchAirportProcedures(icao!),
    enabled: !!icao,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
  });
}
