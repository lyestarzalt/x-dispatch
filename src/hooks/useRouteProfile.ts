/**
 * The vertical profile of the plan currently on the map: planned altitudes from the route and
 * cruise level, terrain sampled under it from the map's DEM tiles, and the safe altitudes
 * derived from that terrain.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import mlcontour from 'maplibre-contour';
import { TERRAIN_TILES_CACHE_URL, getContourDemSource } from '@/components/Map/utils/globeUtils';
import type { LatLon } from '@/lib/flightplan/builder/geometry';
import { greatCircleNm } from '@/lib/flightplan/builder/geometry';
import { planningClass } from '@/lib/flightplan/builder/planningClass';
import { type ProfileChartRow, buildProfileRows } from '@/lib/flightplan/profile/profileRows';
import {
  CLASS_PERFORMANCE,
  type ProfileWaypointInput,
  type RouteProfile,
  computeRouteProfile,
  legSafeAltitudes,
} from '@/lib/flightplan/profile/routeProfile';
import {
  type DemTileLike,
  type TerrainResult,
  type TerrainSample,
  sampleTerrain,
} from '@/lib/flightplan/profile/terrainSampler';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';
import { usePlaneStore } from '@/stores/planeStore';
import type { EnrichedFlightPlan } from '@/types/fms';

/** Sampling step along the route, NM; widened automatically on very long routes. */
const TERRAIN_STEP_NM = 0.25;
/** How long to wait for the shared DEM worker before decoding the tile here instead. */
const WORKER_WAIT_MS = 2500;
/** The chart gets at most this many terrain rows; peaks survive the reduction. */
const MAX_CHART_TERRAIN_ROWS = 700;

/** Finer tiles for short routes, fewer tiles for long ones: the fetch stays a few seconds. */
function terrainZoomFor(totalNm: number): number {
  if (totalNm < 250) return 10;
  if (totalNm < 900) return 9;
  return 8;
}

/** Fetch and decode one terrain tile on this thread, bypassing the shared DEM worker. */
async function fetchDemTileDirect(z: number, x: number, y: number): Promise<DemTileLike> {
  const url = TERRAIN_TILES_CACHE_URL.replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`tile ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(bitmap, 0, 0);
  const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
  return mlcontour.decodeParsedImage(bitmap.width, bitmap.height, 'terrarium', pixels);
}

/** The shared DEM worker first (it caches with the map's terrain), else decode here. */
function fetchDemTile(z: number, x: number, y: number): Promise<DemTileLike> {
  const viaWorker = getContourDemSource().getDemTile(z, x, y, new AbortController());
  const slow = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('worker slow')), WORKER_WAIT_MS)
  );
  return Promise.race([viaWorker, slow]).catch(() => fetchDemTileDirect(z, x, y));
}

/** Keep at most `max` samples, taking the highest point of each bucket so ridges stay. */
export function thinTerrain(track: TerrainSample[], max: number): TerrainSample[] {
  if (track.length <= max) return track;
  const bucket = track.length / max;
  const out: TerrainSample[] = [];
  for (let i = 0; i < max; i++) {
    const from = Math.floor(i * bucket);
    const to = Math.min(track.length, Math.floor((i + 1) * bucket));
    let best = track[from]!;
    for (let j = from + 1; j < to; j++)
      if (track[j]!.elevationFt > best.elevationFt) best = track[j]!;
    out.push(best);
  }
  const last = track[track.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** The cruise level for a plan: the stored one, else the highest enroute altitude it carries. */
export function cruiseAltitudeFor(plan: EnrichedFlightPlan, stored: number | null): number | null {
  if (stored && stored > 0) return stored;
  let max = 0;
  for (const wp of plan.waypoints) {
    if (wp.via === 'ADEP' || wp.via === 'ADES') continue;
    if (wp.altitude > max) max = wp.altitude;
  }
  return max > 0 ? max : null;
}

export function profileInputs(
  plan: EnrichedFlightPlan,
  airports: Airport[]
): ProfileWaypointInput[] {
  const kindByVia = new Map((plan.procedurePaths ?? []).map((p) => [p.via, p.kind]));
  const elevationOf = (icao: string | undefined, runwayElev: number | undefined) =>
    runwayElev ?? airports.find((a) => a.icao === icao)?.elevation;
  return plan.waypoints.map((wp) => ({
    id: wp.id,
    latitude: wp.latitude,
    longitude: wp.longitude,
    via: wp.via,
    procedure: kindByVia.get(wp.via),
    constraint: wp.constraint ?? null,
    elevationFt:
      wp.via === 'ADEP'
        ? elevationOf(plan.departure.icao, plan.runwayEnds?.departure?.elevationFt)
        : wp.via === 'ADES'
          ? elevationOf(plan.arrival.icao, plan.runwayEnds?.arrival?.elevationFt)
          : undefined,
  }));
}

export interface TerrainProgress {
  done: number;
  total: number;
}

/**
 * Terrain under the plan on the map, cached per route. Mount it once near the map so the tiles
 * are fetched as soon as a plan exists, and again wherever the data is shown: both share the
 * same query.
 */
export function useRouteTerrain(): {
  terrain: TerrainResult | undefined;
  isLoading: boolean;
  progress: TerrainProgress | null;
} {
  const fmsData = useFlightPlanStore((s) => s.fmsData);
  const [progress, setProgress] = useState<TerrainProgress | null>(null);

  const legs = useMemo(() => {
    const wps: LatLon[] = fmsData?.waypoints ?? [];
    return wps.slice(1).map((b, i) => ({ a: wps[i]!, b }));
  }, [fmsData]);
  const key = useMemo(
    () =>
      legs.length > 0
        ? [legs[0]!.a, ...legs.map((l) => l.b)]
            .map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`)
            .join('|')
        : '',
    [legs]
  );
  const totalNm = useMemo(() => legs.reduce((sum, l) => sum + greatCircleNm(l.a, l.b), 0), [legs]);

  const query = useQuery({
    queryKey: ['routeTerrain', key],
    queryFn: () => {
      const started = Date.now();
      return sampleTerrain(legs, fetchDemTile, {
        zoom: terrainZoomFor(totalNm),
        stepNm: TERRAIN_STEP_NM,
        maxSamples: 3000,
        onProgress: (done, total) => setProgress({ done, total }),
        onTileError: (z, x, y, reason) =>
          window.appAPI.log.warn(
            `Route terrain tile ${z}/${x}/${y} failed after ${Date.now() - started} ms`,
            reason
          ),
      });
    },
    enabled: legs.length > 0,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });

  return { terrain: query.data, isLoading: query.isLoading, progress };
}

export interface RouteProfileView {
  hasPlan: boolean;
  cruiseFt: number | null;
  profile: RouteProfile | null;
  rows: ProfileChartRow[];
  terrain: TerrainResult | undefined;
  isLoadingTerrain: boolean;
  terrainProgress: TerrainProgress | null;
  legSafeFt: number[];
  routeSafeFt: number | null;
}

export function useRouteProfile(airports: Airport[]): RouteProfileView {
  const fmsData = useFlightPlanStore((s) => s.fmsData);
  const storedCruise = useFlightPlanStore((s) => s.cruiseAltitude);
  const aircraftClass = usePlanBuilderStore((s) => s.aircraftClass);
  const aircraftCategory = usePlaneStore((s) => s.state?.aircraftCategory);
  const { terrain, isLoading, progress } = useRouteTerrain();

  const cruiseFt = fmsData ? cruiseAltitudeFor(fmsData, storedCruise) : null;
  const perf = CLASS_PERFORMANCE[aircraftClass ?? planningClass(aircraftCategory)];

  const inputs = useMemo(
    () => (fmsData ? profileInputs(fmsData, airports) : []),
    [fmsData, airports]
  );
  const profile = useMemo(
    () => (fmsData && cruiseFt !== null ? computeRouteProfile(inputs, cruiseFt, perf) : null),
    [fmsData, inputs, cruiseFt, perf]
  );
  const safe = useMemo(() => legSafeAltitudes(terrain?.maxElevationPerLegFt ?? []), [terrain]);
  const chartTerrain = useMemo(
    () => (terrain ? thinTerrain(terrain.track, MAX_CHART_TERRAIN_ROWS) : undefined),
    [terrain]
  );
  const rows = useMemo(
    () =>
      profile && profile.errors.length === 0
        ? buildProfileRows(profile, chartTerrain, safe.perLegFt)
        : [],
    [profile, chartTerrain, safe.perLegFt]
  );

  return {
    hasPlan: !!fmsData,
    cruiseFt,
    profile,
    rows,
    terrain,
    isLoadingTerrain: isLoading,
    terrainProgress: progress,
    legSafeFt: safe.perLegFt,
    routeSafeFt: safe.routeFt,
  };
}
