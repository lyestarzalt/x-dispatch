import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Airspace, Navaid, Waypoint } from '@/types/navigation';

// Local nav data (around airport)
export interface NavigationData {
  vors: Navaid[];
  ndbs: Navaid[];
  dmes: Navaid[];
  ils: Navaid[];
  // Glide-slope navaids are stored as separate Navaid records (type GS) and
  // carry `glidepathAngle`. Join to an ILS/LOC record by `associatedRunway`
  // when you need both pieces (e.g. the airport-info ILS detail panel).
  gs: Navaid[];
  waypoints: Waypoint[];
  airspaces: Airspace[];
}

const navDataKeys = {
  all: ['navData'] as const,
  byLocation: (lat: number, lon: number, radius: number) =>
    ['navData', { lat, lon, radius }] as const,
  airspaces: ['navData', 'airspaces', 'global'] as const,
};

async function fetchNavData(lat: number, lon: number, radiusNm: number): Promise<NavigationData> {
  const [vors, ndbs, dmes, ils, gs, waypoints, airspaces] = await Promise.all([
    window.navAPI.getVORsInRadius(lat, lon, radiusNm),
    window.navAPI.getNDBsInRadius(lat, lon, radiusNm),
    window.navAPI.getDMEsInRadius(lat, lon, radiusNm),
    window.navAPI.getILSInRadius(lat, lon, radiusNm),
    window.navAPI.getGlideSlopesInRadius(lat, lon, radiusNm),
    window.navAPI.getWaypointsInRadius(lat, lon, radiusNm),
    window.navAPI.getAirspacesNearPoint(lat, lon, radiusNm),
  ]);

  return { vors, ndbs, dmes, ils, gs, waypoints, airspaces };
}

export function useNavDataQuery(
  lat: number | null,
  lon: number | null,
  radiusNm: number = 50,
  enabled?: boolean
) {
  const hasCoords = lat !== null && lon !== null;
  const isEnabled = enabled ?? hasCoords;

  return useQuery({
    // Only include coordinates in key when they're valid to avoid cache collisions
    queryKey: hasCoords ? navDataKeys.byLocation(lat, lon, radiusNm) : ['navData', 'disabled'],
    queryFn: () => fetchNavData(lat!, lon!, radiusNm),
    enabled: isEnabled && hasCoords,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    // The previous airport's data stays until the new one arrives. Empty
    // placeholder data made every selection wipe the nav layers mid-flight,
    // and the ILS cones did not come back until a later style change.
    placeholderData: keepPreviousData,
  });
}

export function getNavDataCounts(data: NavigationData | undefined) {
  const vors = data?.vors.length ?? 0;
  const ndbs = data?.ndbs.length ?? 0;
  const dmes = data?.dmes.length ?? 0;

  return {
    // Consolidated navaid count
    navaids: vors + ndbs + dmes,
    ils: data?.ils.length ?? 0,
    airspaces: data?.airspaces.length ?? 0,
  };
}

/**
 * Combined hook that returns nav data counts for the currently selected airport.
 *
 * @param airportLat - Airport latitude (optional, will fetch when provided)
 * @param airportLon - Airport longitude (optional, will fetch when provided)
 */
export function useNavDataCounts(airportLat: number | null, airportLon: number | null) {
  const { data: navData } = useNavDataQuery(airportLat, airportLon, 50);
  return getNavDataCounts(navData);
}
