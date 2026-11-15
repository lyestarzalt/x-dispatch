import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

// ---------- Zod Schemas ----------

const GatewayReleaseSchema = z.object({
  Version: z.string(),
  Date: z.string(),
});

const ReleasesResponseSchema = z.array(GatewayReleaseSchema);

const ReleasePacksResponseSchema = z.object({
  SceneryPacks: z.array(z.number()),
});

const GatewaySceneryPackSchema = z.object({
  sceneryId: z.number(),
  userName: z.string(),
  dateApproved: z.string().nullable(),
  Status: z.string(),
});

const GatewayAirportResponseSchema = z.object({
  airport: z.object({
    icao: z.string(),
    airportName: z.string(),
    recommendedSceneryId: z.number(),
    scenery: z.array(GatewaySceneryPackSchema),
  }),
});

// ---------- Derived types ----------

type GatewayRelease = z.infer<typeof GatewayReleaseSchema>;

export interface GatewayUpdateInfo {
  hasUpdate: boolean;
  currentPackId: number | null;
  recommendedPackId: number;
  artistName: string;
  dateApproved: string;
  gatewayUrl: string;
  /** The airport is served by a Gateway pack X-Dispatch installed. */
  installedByUs: boolean;
}

interface ReleasePacks {
  releaseVersion: string;
  packIds: Set<number>;
}

// ---------- Version comparison ----------

function parseVersion(v: string): [number, number, number] {
  const parts = v.split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function versionLte(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    const ai = a[i] as number;
    const bi = b[i] as number;
    if (ai < bi) return true;
    if (ai > bi) return false;
  }
  return true;
}

function findMatchingRelease(
  releases: GatewayRelease[],
  userVersion: [number, number, number]
): GatewayRelease | null {
  let best: GatewayRelease | null = null;
  let bestV: [number, number, number] = [0, 0, 0];

  for (const release of releases) {
    const rv = parseVersion(release.Version);
    if (versionLte(rv, userVersion) && versionLte(bestV, rv)) {
      best = release;
      bestV = rv;
    }
  }
  return best;
}

// ---------- IPC helpers ----------

function parseIpcJson(response: { data: string | null; error: string | null }): unknown {
  if (response.error || !response.data) return null;
  return JSON.parse(response.data);
}

// ---------- Query keys ----------

const gatewayKeys = {
  releasePacks: ['gateway-release-packs'] as const,
  updateCheck: (icao: string) => ['gateway-update-check', icao.toUpperCase()] as const,
  installed: (icao: string) => ['gateway-installed', icao.toUpperCase()] as const,
};

// ---------- Query functions ----------

async function fetchReleasePacks(): Promise<ReleasePacks | null> {
  const versionInfo = await window.appAPI.getXPlaneVersion();
  if (!versionInfo) return null;

  const userVersion: [number, number, number] = [
    versionInfo.major,
    versionInfo.minor,
    versionInfo.patch,
  ];

  // 1. Fetch all releases
  const releasesJson = parseIpcJson(await window.airportAPI.fetchGatewayReleases());
  const releases = ReleasesResponseSchema.parse(releasesJson);
  if (releases.length === 0) return null;

  // 2. Find matching release for user's X-Plane version
  const matchedRelease = findMatchingRelease(releases, userVersion);
  if (!matchedRelease) return null;

  // 3. Fetch pack IDs for that release
  const packsJson = parseIpcJson(
    await window.airportAPI.fetchGatewayReleasePacks(matchedRelease.Version)
  );
  const { SceneryPacks } = ReleasePacksResponseSchema.parse(packsJson);
  if (SceneryPacks.length === 0) return null;

  return {
    releaseVersion: matchedRelease.Version,
    packIds: new Set(SceneryPacks),
  };
}

async function fetchUpdateCheck(
  icao: string,
  releasePacks: ReleasePacks,
  installed: { sceneryId: number } | null
): Promise<GatewayUpdateInfo | null> {
  const airportJson = parseIpcJson(await window.airportAPI.fetchGatewayAirport(icao));
  const { airport } = GatewayAirportResponseSchema.parse(airportJson);

  const gatewayUrl = `https://gateway.x-plane.com/airports/${icao.toUpperCase()}/show`;
  const recommendedId = airport.recommendedSceneryId;
  const recommendedPack = airport.scenery.find((s) => s.sceneryId === recommendedId);

  // A pack we installed: newer when the Gateway recommends another submission.
  if (installed) {
    return {
      hasUpdate: recommendedId !== installed.sceneryId,
      currentPackId: installed.sceneryId,
      recommendedPackId: recommendedId,
      artistName: recommendedPack?.userName ?? '',
      dateApproved: recommendedPack?.dateApproved ?? '',
      gatewayUrl,
      installedByUs: true,
    };
  }

  // Already bundled in user's X-Plane version
  if (releasePacks.packIds.has(recommendedId)) {
    return null;
  }

  const currentPackId =
    airport.scenery.find((s) => releasePacks.packIds.has(s.sceneryId))?.sceneryId ?? null;

  return {
    hasUpdate: true,
    currentPackId,
    recommendedPackId: recommendedId,
    artistName: recommendedPack?.userName ?? '',
    dateApproved: recommendedPack?.dateApproved ?? '',
    gatewayUrl,
    installedByUs: false,
  };
}

// ---------- Hooks ----------

export function useGatewayReleasePacks() {
  return useQuery({
    queryKey: gatewayKeys.releasePacks,
    queryFn: fetchReleasePacks,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}

/** The marker of the Gateway pack X-Dispatch installed for this airport, if any. */
export function useGatewayInstalled(icao: string | null) {
  return useQuery({
    queryKey: gatewayKeys.installed(icao ?? ''),
    queryFn: () => window.addonManagerAPI.gateway.installed(icao!),
    enabled: !!icao,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGatewayUpdateCheck(icao: string | null, isCustom: boolean) {
  const { data: releasePacks } = useGatewayReleasePacks();
  const { data: installed, isFetched: installedKnown } = useGatewayInstalled(icao);

  return useQuery({
    queryKey: [...gatewayKeys.updateCheck(icao ?? ''), installed?.sceneryId ?? null],
    queryFn: () => fetchUpdateCheck(icao!, releasePacks!, installed ?? null),
    // A custom airport is checked only when the pack is ours; a stock one always.
    enabled: !!icao && !!releasePacks && installedKnown && (!isCustom || !!installed),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
}

/** Install (or update) the Gateway's recommended pack for an airport. */
export function useGatewayInstall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: { icao: string; sceneryId: number; force?: boolean }) => {
      const result = await window.addonManagerAPI.gateway.install(
        request.icao,
        request.sceneryId,
        request.force ?? false
      );
      if (!result.ok) throw new GatewayActionError(result.error);
      return result.value;
    },
    onSuccess: (_value, request) => {
      void window.appAPI.resyncCustomAirports();
      queryClient.invalidateQueries({ queryKey: gatewayKeys.installed(request.icao) });
      queryClient.invalidateQueries({ queryKey: gatewayKeys.updateCheck(request.icao) });
      queryClient.invalidateQueries({ queryKey: ['addon', 'scenery'] });
    },
  });
}

export function useGatewayRemove() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (icao: string) => {
      const result = await window.addonManagerAPI.gateway.remove(icao);
      if (!result.ok) throw new GatewayActionError(result.error);
    },
    onSuccess: (_value, icao) => {
      void window.appAPI.resyncCustomAirports();
      queryClient.invalidateQueries({ queryKey: gatewayKeys.installed(icao) });
      queryClient.invalidateQueries({ queryKey: gatewayKeys.updateCheck(icao) });
      queryClient.invalidateQueries({ queryKey: ['addon', 'scenery'] });
    },
  });
}

/** A refused Gateway action, carrying its code for the dialog that handles it. */
export class GatewayActionError extends Error {
  constructor(readonly error: import('@/lib/addonManager/gateway').GatewayError) {
    super(error.code);
    this.name = 'GatewayActionError';
  }
}
