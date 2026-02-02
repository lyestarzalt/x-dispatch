import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '@/stores/settingsStore';
import type { VatsimATIS, VatsimController, VatsimData, VatsimPilot } from '@/types/vatsim';

export type { VatsimPilot, VatsimData };

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
    pilots: (response.data.pilots || []) as unknown as VatsimPilot[],
    controllers: (response.data.controllers || []) as unknown as VatsimController[],
    atis: (response.data.atis || []) as unknown as VatsimATIS[],
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

function getPilotsNearAirport(
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

function getControllersForAirport(data: VatsimData | undefined, icao: string): VatsimController[] {
  if (!data) return [];
  const prefix = icao.toUpperCase();
  return data.controllers.filter((c) => c.callsign.toUpperCase().startsWith(prefix));
}

function getATISForAirport(data: VatsimData | undefined, icao: string): VatsimATIS[] {
  if (!data) return [];
  const prefix = icao.toUpperCase();
  return data.atis.filter((a) => a.callsign.toUpperCase().startsWith(prefix));
}
