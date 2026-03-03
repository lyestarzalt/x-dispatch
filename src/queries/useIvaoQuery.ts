import { useQuery } from '@tanstack/react-query';
import type { IvaoData, IvaoPilot } from '@/types/ivao';

export type { IvaoPilot, IvaoData };

const ivaoKeys = {
  all: ['ivao'] as const,
  data: ['ivao', 'data'] as const,
};

async function fetchIvaoData(): Promise<IvaoData> {
  const response = await window.airportAPI.fetchIvaoData();
  if (!response.data || response.error) {
    throw new Error(response.error || 'Failed to fetch IVAO data');
  }
  return response.data;
}

export function useIvaoQuery(enabled: boolean = false) {
  return useQuery({
    queryKey: ivaoKeys.data,
    queryFn: fetchIvaoData,
    enabled,
    staleTime: 14_000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: enabled ? 15_000 : false,
  });
}

export function getPilotsInBounds(
  data: IvaoData | undefined,
  bounds: { north: number; south: number; east: number; west: number }
): IvaoPilot[] {
  if (!data?.clients?.pilots) return [];
  return data.clients.pilots.filter(
    (p) =>
      p.lastTrack &&
      p.lastTrack.latitude >= bounds.south &&
      p.lastTrack.latitude <= bounds.north &&
      p.lastTrack.longitude >= bounds.west &&
      p.lastTrack.longitude <= bounds.east
  );
}

export function getTrafficCountsForAirport(
  data: IvaoData | undefined,
  icao: string
): { departures: number; arrivals: number } {
  if (!data?.clients?.pilots) return { departures: 0, arrivals: 0 };
  const upperIcao = icao.toUpperCase();

  let departures = 0;
  let arrivals = 0;

  for (const pilot of data.clients.pilots) {
    if (pilot.flightPlan?.departureId?.toUpperCase() === upperIcao) {
      departures++;
    }
    if (pilot.flightPlan?.arrivalId?.toUpperCase() === upperIcao) {
      arrivals++;
    }
  }

  return { departures, arrivals };
}
