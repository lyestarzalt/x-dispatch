import { useQuery } from '@tanstack/react-query';
import type { AirportProcedures } from '@/lib/parsers/nav/cifpParser';
import type { ATCController } from '@/types/navigation';

export const appKeys = {
  all: ['app'] as const,
  version: ['app', 'version'] as const,
  xplanePath: ['app', 'xplanePath'] as const,
  loadingStatus: ['app', 'loadingStatus'] as const,
  airportMetadata: (icao: string) => ['app', 'airportMetadata', icao] as const,
  atcControllers: (icao: string) => ['app', 'atcControllers', icao] as const,
  procedures: (icao: string) => ['app', 'procedures', icao] as const,
};

export function useAppVersion() {
  return useQuery({
    queryKey: appKeys.version,
    queryFn: () => window.appAPI.getVersion(),
    staleTime: Infinity,
  });
}

export function useXPlanePath() {
  return useQuery({
    queryKey: appKeys.xplanePath,
    queryFn: () => window.xplaneAPI.getPath(),
    staleTime: Infinity,
  });
}

export function useLoadingStatus() {
  return useQuery({
    queryKey: appKeys.loadingStatus,
    queryFn: () => window.appAPI.getLoadingStatus(),
    staleTime: 5 * 60 * 1000,
  });
}

interface AirportMetadata {
  transitionAlt: number | null;
  transitionLevel: string | null;
  longestRunway: number | null;
}

export function useAirportMetadata(icao: string | null) {
  return useQuery({
    queryKey: appKeys.airportMetadata(icao ?? ''),
    queryFn: async (): Promise<AirportMetadata | null> => {
      if (!icao) return null;
      const meta = await window.navAPI.getAirportMetadata(icao);
      if (!meta) return null;
      return {
        transitionAlt: meta.transitionAlt,
        transitionLevel: meta.transitionLevel,
        longestRunway: meta.longestRunway,
      };
    },
    enabled: !!icao,
    staleTime: 10 * 60 * 1000,
  });
}

export function useATCControllers(icao: string | null) {
  return useQuery({
    queryKey: appKeys.atcControllers(icao ?? ''),
    queryFn: async (): Promise<ATCController[]> => {
      if (!icao) return [];
      const controllers = await window.navAPI.getAllATCControllers();
      const prefix = icao.substring(0, 2).toUpperCase();
      const relevant = controllers.filter(
        (c: ATCController) =>
          c.facilityId.toUpperCase().startsWith(prefix) ||
          c.name.toUpperCase().includes(icao.toUpperCase())
      );
      return relevant.slice(0, 10);
    },
    enabled: !!icao,
    staleTime: 10 * 60 * 1000,
  });
}

export function useAirportProcedures(icao: string | null) {
  return useQuery({
    queryKey: appKeys.procedures(icao ?? ''),
    queryFn: (): Promise<AirportProcedures | null> => {
      if (!icao) return Promise.resolve(null);
      return window.navAPI.getAirportProcedures(icao);
    },
    enabled: !!icao,
    staleTime: 10 * 60 * 1000,
  });
}
