import { useQuery } from '@tanstack/react-query';
import type { Airspace, AirwaySegmentWithCoords, Navaid, Waypoint } from '@/types/navigation';

// Local nav data (around airport)
export interface NavigationData {
  vors: Navaid[];
  ndbs: Navaid[];
  dmes: Navaid[];
  ils: Navaid[];
  waypoints: Waypoint[];
  airspaces: Airspace[];
}

// Global airways data (separate from local nav)
export interface GlobalAirwaysData {
  highAirways: AirwaySegmentWithCoords[];
  lowAirways: AirwaySegmentWithCoords[];
}

const EMPTY_NAV_DATA: NavigationData = {
  vors: [],
  ndbs: [],
  dmes: [],
  ils: [],
  waypoints: [],
  airspaces: [],
};

const EMPTY_AIRWAYS_DATA: GlobalAirwaysData = {
  highAirways: [],
  lowAirways: [],
};

const navDataKeys = {
  all: ['navData'] as const,
  byLocation: (lat: number, lon: number, radius: number) =>
    ['navData', { lat, lon, radius }] as const,
  airspaces: ['navData', 'airspaces', 'global'] as const,
  airways: ['navData', 'airways', 'global'] as const,
};

async function fetchNavData(lat: number, lon: number, radiusNm: number): Promise<NavigationData> {
  const [vors, ndbs, dmes, ils, waypoints, airspaces] = await Promise.all([
    window.navAPI.getVORsInRadius(lat, lon, radiusNm),
    window.navAPI.getNDBsInRadius(lat, lon, radiusNm),
    window.navAPI.getDMEsInRadius(lat, lon, radiusNm),
    window.navAPI.getILSInRadius(lat, lon, radiusNm),
    window.navAPI.getWaypointsInRadius(lat, lon, radiusNm),
    window.navAPI.getAirspacesNearPoint(lat, lon, radiusNm),
  ]);

  return { vors, ndbs, dmes, ils, waypoints, airspaces };
}

export function useNavDataQuery(
  lat: number | null,
  lon: number | null,
  radiusNm: number = 50,
  enabled?: boolean
) {
  const isEnabled = enabled ?? (lat !== null && lon !== null);

  return useQuery({
    queryKey: navDataKeys.byLocation(lat ?? 0, lon ?? 0, radiusNm),
    queryFn: () => fetchNavData(lat!, lon!, radiusNm),
    enabled: isEnabled && lat !== null && lon !== null,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    placeholderData: EMPTY_NAV_DATA,
  });
}

function useGlobalAirspacesQuery(enabled: boolean = false) {
  return useQuery({
    queryKey: navDataKeys.airspaces,
    queryFn: () => window.navAPI.getAllAirspaces(),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function getNavDataCounts(
  data: NavigationData | undefined,
  airwaysData?: GlobalAirwaysData
) {
  const baseCounts = {
    vors: data?.vors.length ?? 0,
    ndbs: data?.ndbs.length ?? 0,
    dmes: data?.dmes.length ?? 0,
    ils: data?.ils.length ?? 0,
    waypoints: data?.waypoints.length ?? 0,
    airspaces: data?.airspaces.length ?? 0,
    highAirways: airwaysData?.highAirways.length ?? 0,
    lowAirways: airwaysData?.lowAirways.length ?? 0,
  };
  return baseCounts;
}

async function fetchGlobalAirways(): Promise<GlobalAirwaysData> {
  const airways = await window.navAPI.getAllAirwaysWithCoords();
  return {
    highAirways: airways.filter((a) => a.isHigh),
    lowAirways: airways.filter((a) => !a.isHigh),
  };
}

export function useGlobalAirwaysQuery(enabled: boolean = false) {
  return useQuery({
    queryKey: navDataKeys.airways,
    queryFn: fetchGlobalAirways,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    placeholderData: EMPTY_AIRWAYS_DATA,
  });
}
