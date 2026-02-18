import { useQuery } from '@tanstack/react-query';
import { DecodedMETAR, decodeMetar } from '@/lib/utils/format/metar';

interface VatsimMetarData {
  raw: string;
  decoded: DecodedMETAR;
}

const vatsimMetarKeys = {
  all: ['vatsim-metar'] as const,
  metar: (icao: string) => ['vatsim-metar', icao.toUpperCase()] as const,
};

async function fetchVatsimMetar(icao: string): Promise<VatsimMetarData | null> {
  try {
    const response = await window.airportAPI.fetchVatsimMetar(icao);
    if (!response.data || response.error) return null;
    return {
      raw: response.data,
      decoded: decodeMetar(response.data),
    };
  } catch {
    return null;
  }
}

export function useVatsimMetarQuery(icao: string | null) {
  return useQuery({
    queryKey: vatsimMetarKeys.metar(icao ?? ''),
    queryFn: () => fetchVatsimMetar(icao!),
    enabled: !!icao,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
