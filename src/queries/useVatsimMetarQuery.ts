import { useQuery } from '@tanstack/react-query';
import { CloudQuantity, DistanceUnit, IMetar, parseMetar } from 'metar-taf-parser';

export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

export interface ParsedMetarData {
  raw: string;
  parsed: IMetar;
  flightCategory: FlightCategory;
}

/**
 * Calculate flight category based on ceiling and visibility
 * LIFR: Ceiling < 500ft OR Visibility < 1SM
 * IFR: Ceiling 500-999ft OR Visibility 1-3SM
 * MVFR: Ceiling 1000-3000ft OR Visibility 3-5SM
 * VFR: Ceiling > 3000ft AND Visibility > 5SM
 */
function calculateFlightCategory(metar: IMetar): FlightCategory {
  // Find ceiling (lowest BKN, OVC, or vertical visibility)
  let ceilingFt: number | null = null;
  for (const cloud of metar.clouds) {
    if (
      (cloud.quantity === CloudQuantity.BKN || cloud.quantity === CloudQuantity.OVC) &&
      cloud.height !== undefined
    ) {
      const altFeet = cloud.height * 100;
      if (ceilingFt === null || altFeet < ceilingFt) {
        ceilingFt = altFeet;
      }
    }
  }
  // Check vertical visibility
  if (metar.verticalVisibility !== undefined) {
    const vvFeet = metar.verticalVisibility * 100;
    if (ceilingFt === null || vvFeet < ceilingFt) {
      ceilingFt = vvFeet;
    }
  }

  // Convert visibility to statute miles
  let visSM: number | null = null;
  if (metar.visibility) {
    const vis = metar.visibility;
    if (vis.unit === DistanceUnit.StatuteMiles) {
      visSM = vis.value;
    } else if (vis.unit === DistanceUnit.Meters) {
      visSM = vis.value / 1609.34;
    }
  } else if (metar.cavok) {
    visSM = 10; // CAVOK means visibility > 10km
  }

  // Determine category (most restrictive wins)
  if ((ceilingFt !== null && ceilingFt < 500) || (visSM !== null && visSM < 1)) {
    return 'LIFR';
  }
  if ((ceilingFt !== null && ceilingFt < 1000) || (visSM !== null && visSM < 3)) {
    return 'IFR';
  }
  if ((ceilingFt !== null && ceilingFt <= 3000) || (visSM !== null && visSM <= 5)) {
    return 'MVFR';
  }
  return 'VFR';
}

const vatsimMetarKeys = {
  all: ['vatsim-metar'] as const,
  metar: (icao: string) => ['vatsim-metar', icao.toUpperCase()] as const,
};

async function fetchVatsimMetar(icao: string): Promise<ParsedMetarData | null> {
  try {
    const response = await window.airportAPI.fetchVatsimMetar(icao);
    if (!response.data || response.error) return null;

    const raw = response.data;
    const parsed = parseMetar(raw);
    const flightCategory = calculateFlightCategory(parsed);

    return { raw, parsed, flightCategory };
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
