import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '@/stores/settingsStore';
import type {
  VatsimATIS,
  VatsimController,
  VatsimData,
  VatsimPilot,
  VatsimPrefile,
} from '@/types/vatsim';

export type { VatsimPilot, VatsimData, VatsimController, VatsimATIS, VatsimPrefile };

const vatsimKeys = {
  all: ['vatsim'] as const,
  data: ['vatsim', 'data'] as const,
};

async function fetchVatsimData(): Promise<VatsimData> {
  const response = await window.airportAPI.fetchVatsimData();
  if (!response.data || response.error) {
    throw new Error(response.error || 'Failed to fetch VATSIM data');
  }
  return {
    general: response.data.general,
    pilots: (response.data.pilots || []) as unknown as VatsimPilot[],
    controllers: (response.data.controllers || []) as unknown as VatsimController[],
    atis: (response.data.atis || []) as unknown as VatsimATIS[],
    prefiles: (response.data.prefiles || []) as unknown as VatsimPrefile[],
    lastUpdate: new Date(),
  };
}

export function useVatsimQuery(enabled: boolean = false) {
  const { map: mapSettings } = useSettingsStore();
  const refreshInterval = mapSettings.vatsimRefreshInterval * 1000;

  return useQuery({
    queryKey: vatsimKeys.data,
    queryFn: fetchVatsimData,
    enabled,
    staleTime: refreshInterval - 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: enabled ? refreshInterval : false,
  });
}

export function getPilotsInBounds(
  data: VatsimData | undefined,
  bounds: { north: number; south: number; east: number; west: number }
): VatsimPilot[] {
  if (!data) return [];
  return data.pilots.filter(
    (p) =>
      p.latitude >= bounds.south &&
      p.latitude <= bounds.north &&
      p.longitude >= bounds.west &&
      p.longitude <= bounds.east
  );
}

export function getPilotsNearAirport(
  data: VatsimData | undefined,
  lat: number,
  lon: number,
  radiusNm: number = 50
): VatsimPilot[] {
  if (!data) return [];
  const radiusDeg = radiusNm / 60;
  return data.pilots.filter((p) => {
    const dLat = Math.abs(p.latitude - lat);
    const dLon = Math.abs(p.longitude - lon);
    return dLat < radiusDeg && dLon < radiusDeg;
  });
}

export function getControllersForAirport(
  data: VatsimData | undefined,
  icao: string
): VatsimController[] {
  if (!data) return [];
  const prefix = icao.toUpperCase();
  return data.controllers.filter((c) => c.callsign.toUpperCase().startsWith(prefix));
}

export function getATISForAirport(data: VatsimData | undefined, icao: string): VatsimATIS[] {
  if (!data) return [];
  const prefix = icao.toUpperCase();
  return data.atis.filter((a) => a.callsign.toUpperCase().startsWith(prefix));
}

export function getPrefilesForAirport(data: VatsimData | undefined, icao: string): VatsimPrefile[] {
  if (!data?.prefiles) return [];
  const upperIcao = icao.toUpperCase();
  return data.prefiles.filter(
    (p) =>
      p.flight_plan?.departure?.toUpperCase() === upperIcao ||
      p.flight_plan?.arrival?.toUpperCase() === upperIcao
  );
}

export function getTrafficCountsForAirport(
  data: VatsimData | undefined,
  icao: string
): { departures: number; arrivals: number } {
  if (!data) return { departures: 0, arrivals: 0 };
  const upperIcao = icao.toUpperCase();

  let departures = 0;
  let arrivals = 0;

  for (const pilot of data.pilots) {
    if (pilot.flight_plan?.departure?.toUpperCase() === upperIcao) {
      departures++;
    }
    if (pilot.flight_plan?.arrival?.toUpperCase() === upperIcao) {
      arrivals++;
    }
  }

  return { departures, arrivals };
}

export interface BusiestAirport {
  icao: string;
  total: number;
  departures: number;
  arrivals: number;
}

export function getBusiestAirports(
  data: VatsimData | undefined,
  limit: number = 5
): BusiestAirport[] {
  if (!data) return [];

  const counts = new Map<string, { departures: number; arrivals: number }>();

  for (const pilot of data.pilots) {
    const dep = pilot.flight_plan?.departure?.toUpperCase();
    const arr = pilot.flight_plan?.arrival?.toUpperCase();

    if (dep) {
      const existing = counts.get(dep) || { departures: 0, arrivals: 0 };
      existing.departures++;
      counts.set(dep, existing);
    }

    if (arr) {
      const existing = counts.get(arr) || { departures: 0, arrivals: 0 };
      existing.arrivals++;
      counts.set(arr, existing);
    }
  }

  const airports: BusiestAirport[] = [];
  for (const [icao, { departures, arrivals }] of counts) {
    airports.push({ icao, total: departures + arrivals, departures, arrivals });
  }

  return airports.sort((a, b) => b.total - a.total).slice(0, limit);
}

/**
 * Parse ATIS text to extract runway information
 */
export function parseATISRunways(atis: VatsimATIS): string[] {
  if (!atis.text_atis) return [];

  const text = atis.text_atis.join(' ');
  const runwayPattern = /R(?:WY?|Y)\s*(\d{1,2}[LRC]?)/gi;
  const runways = new Set<string>();

  let match;
  while ((match = runwayPattern.exec(text)) !== null) {
    runways.add(match[1].toUpperCase());
  }

  return Array.from(runways);
}
