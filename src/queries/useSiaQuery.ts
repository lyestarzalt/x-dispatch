import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SiaInstallStatus, SiaProduct } from '@/lib/sia/types';

export function useSiaProductsQuery() {
  return useQuery({
    queryKey: ['sia', 'products'],
    queryFn: () => window.siaAPI.listProducts() as Promise<readonly SiaProduct[]>,
  });
}

export function useSiaInstallStatusQuery() {
  return useQuery({
    queryKey: ['sia', 'status'],
    queryFn: () => window.siaAPI.getInstallStatus() as Promise<SiaInstallStatus>,
    refetchInterval: 30_000,
  });
}

export function useVacChartQuery(icao: string | null, airportGeoref: unknown) {
  return useQuery({
    // Georef input is rebuilt each render — keep it out of the key to avoid endless refetch.
    queryKey: ['sia', 'vac', icao?.toUpperCase() ?? null],
    queryFn: () => {
      if (!icao) return null;
      return window.siaAPI.getVacForIcao(icao, airportGeoref as Parameters<
        typeof window.siaAPI.getVacForIcao
      >[1]);
    },
    enabled: !!icao,
    staleTime: 60_000,
  });
}

export function useSiaInstallMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      zipPath,
      productId,
    }: {
      zipPath: string;
      productId: string;
    }) => window.siaAPI.installFromLocalZip(zipPath, productId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sia'] });
    },
  });
}

export function useSiaClearMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => window.siaAPI.clearCache(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sia'] });
    },
  });
}

export function useSiaCredentialsStatusQuery() {
  return useQuery({
    queryKey: ['sia', 'credentials'],
    queryFn: () => window.siaAPI.getCredentialsStatus(),
  });
}

export function useSiaDownloadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => window.siaAPI.downloadProduct(productId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sia'] });
    },
  });
}
