import { useQuery } from '@tanstack/react-query';
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
  releasePacks: ReleasePacks
): Promise<GatewayUpdateInfo | null> {
  const airportJson = parseIpcJson(await window.airportAPI.fetchGatewayAirport(icao));
  const { airport } = GatewayAirportResponseSchema.parse(airportJson);

  const gatewayUrl = `https://gateway.x-plane.com/airports/${icao.toUpperCase()}/show`;
  const recommendedId = airport.recommendedSceneryId;

  // Already bundled in user's X-Plane version
  if (releasePacks.packIds.has(recommendedId)) {
    return null;
  }

  const recommendedPack = airport.scenery.find((s) => s.sceneryId === recommendedId);
  const currentPackId =
    airport.scenery.find((s) => releasePacks.packIds.has(s.sceneryId))?.sceneryId ?? null;

  return {
    hasUpdate: true,
    currentPackId,
    recommendedPackId: recommendedId,
    artistName: recommendedPack?.userName ?? '',
    dateApproved: recommendedPack?.dateApproved ?? '',
    gatewayUrl,
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

export function useGatewayUpdateCheck(icao: string | null, isCustom: boolean) {
  const { data: releasePacks } = useGatewayReleasePacks();

  return useQuery({
    queryKey: gatewayKeys.updateCheck(icao ?? ''),
    queryFn: () => fetchUpdateCheck(icao!, releasePacks!),
    enabled: !!icao && !isCustom && !!releasePacks,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
}
