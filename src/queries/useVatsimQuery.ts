import { useQuery } from '@tanstack/react-query';
import { type AtisMemory, carryOverAtis } from '@/lib/networkTraffic/atisCarryOver';
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

// The feed drops an ATIS for a poll or lists it blank while it reconnects; the last broadcast
// bridges the gap so the airport card's runways do not blink out (GitHub #415).
let atisMemory: AtisMemory = new Map();

async function fetchVatsimData(): Promise<VatsimData> {
  const response = await window.airportAPI.fetchVatsimData();
  if (!response.data || response.error) {
    throw new Error(response.error || 'Failed to fetch VATSIM data');
  }
  const carried = carryOverAtis(
    atisMemory,
    (response.data.atis || []) as unknown as VatsimATIS[],
    Date.now()
  );
  atisMemory = carried.memory;
  return {
    general: response.data.general,
    pilots: (response.data.pilots || []) as unknown as VatsimPilot[],
    controllers: (response.data.controllers || []) as unknown as VatsimController[],
    atis: carried.atis,
    prefiles: (response.data.prefiles || []) as unknown as VatsimPrefile[],
    lastUpdate: new Date(),
  };
}

export function useVatsimQuery(enabled: boolean = false) {
  const vatsimRefreshInterval = useSettingsStore((s) => s.map.vatsimRefreshInterval);
  const refreshInterval = vatsimRefreshInterval * 1000;

  return useQuery({
    queryKey: vatsimKeys.data,
    queryFn: fetchVatsimData,
    enabled,
    staleTime: refreshInterval - 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: enabled ? refreshInterval : false,
  });
}

/** Every callsign prefix with a controller or ATIS online, for airport lookups in bulk. */
export function getStaffedCallsignPrefixes(data: VatsimData | undefined): Set<string> {
  const prefixes = new Set<string>();
  if (!data) return prefixes;
  for (const station of [...data.controllers, ...data.atis]) {
    const prefix = station.callsign.toUpperCase().split('_')[0];
    if (prefix) prefixes.add(prefix);
  }
  return prefixes;
}
