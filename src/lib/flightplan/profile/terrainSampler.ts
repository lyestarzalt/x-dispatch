/**
 * Ground elevation under a route, read from the same decoded DEM tiles the map's terrain uses.
 * Each leg is sampled at a fixed step along its great circle for the drawn ground line, and
 * again on parallel tracks across a corridor either side for the highest terrain per leg,
 * which is what the safe altitude is built from.
 */
import type { LatLon } from '@/lib/flightplan/builder/geometry';
import { bearingDeg, destinationPoint, greatCircleNm } from '@/lib/flightplan/builder/geometry';

export interface DemTileLike {
  width: number;
  height: number;
  /** Elevation in metres, row-major. */
  data: Float32Array;
}

export type TileFetcher = (z: number, x: number, y: number) => Promise<DemTileLike>;

export interface TerrainSample extends LatLon {
  distanceNm: number;
  elevationFt: number;
}

export interface TerrainResult {
  /** Ground under the route itself, with cumulative distance. */
  track: TerrainSample[];
  /** Highest terrain under each leg, including the corridor either side. */
  maxElevationPerLegFt: number[];
}

export interface SampleOptions {
  zoom?: number;
  stepNm?: number;
  /** Half-width of the corridor searched for the per-leg maximum, NM. 0 disables it. */
  corridorNm?: number;
  maxSamples?: number;
  /** A tile slower than this counts as missing (sea level) rather than holding everything up. */
  tileTimeoutMs?: number;
  /** Called when a tile fails or times out, with the reason. */
  onTileError?: (z: number, x: number, y: number, reason: unknown) => void;
  /** Called as tiles arrive, with how many are done out of how many are needed. */
  onProgress?: (done: number, total: number) => void;
}

const FEET_PER_METRE = 3.28084;
const MAX_LAT = 85.05112878;

/** Standard XYZ tile for a position at `zoom`, plus the pixel inside a `size`-px tile. */
export function tileCoordinate(
  lon: number,
  lat: number,
  zoom: number,
  size: number
): { x: number; y: number; px: number; py: number } {
  const n = 2 ** zoom;
  const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const xf = ((lon + 180) / 360) * n;
  const latRad = (clampedLat * Math.PI) / 180;
  const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x = Math.min(n - 1, Math.max(0, Math.floor(xf)));
  const y = Math.min(n - 1, Math.max(0, Math.floor(yf)));
  return { x, y, px: (xf - x) * size, py: (yf - y) * size };
}

function elevationAt(tile: DemTileLike, px: number, py: number): number {
  const col = Math.min(tile.width - 1, Math.max(0, Math.floor(px)));
  const row = Math.min(tile.height - 1, Math.max(0, Math.floor(py)));
  const m = tile.data[row * tile.width + col];
  return m === undefined || Number.isNaN(m) ? 0 : m * FEET_PER_METRE;
}

/** Positions at `stepNm` along the leg, start included, end included. */
function pointsAlong(a: LatLon, b: LatLon, stepNm: number): { pos: LatLon; alongNm: number }[] {
  const legNm = greatCircleNm(a, b);
  const out: { pos: LatLon; alongNm: number }[] = [{ pos: a, alongNm: 0 }];
  if (legNm < 1e-6) return out;
  const brg = bearingDeg(a, b);
  for (let d = stepNm; d < legNm; d += stepNm)
    out.push({ pos: destinationPoint(a, brg, d), alongNm: d });
  out.push({ pos: b, alongNm: legNm });
  return out;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${ms} ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    );
  });
}

export async function sampleTerrain(
  legs: { a: LatLon; b: LatLon }[],
  fetchTile: TileFetcher,
  options: SampleOptions = {}
): Promise<TerrainResult> {
  const zoom = options.zoom ?? 9;
  const corridorNm = options.corridorNm ?? 5;
  const maxSamples = options.maxSamples ?? 1500;
  const tileTimeoutMs = options.tileTimeoutMs ?? 10000;
  const totalNm = legs.reduce((sum, leg) => sum + greatCircleNm(leg.a, leg.b), 0);
  const stepNm = Math.max(options.stepNm ?? 1, totalNm / maxSamples);
  const offsets = corridorNm > 0 ? [-corridorNm, 0, corridorNm] : [0];

  // Plan every sample first so each tile is fetched exactly once, then sample synchronously.
  interface Planned {
    pos: LatLon;
    distanceNm: number;
    leg: number;
    onTrack: boolean;
    tileX: number;
    tileY: number;
    px: number;
    py: number;
  }
  const planned: Planned[] = [];
  let base = 0;
  legs.forEach((leg, legIndex) => {
    const brg = bearingDeg(leg.a, leg.b);
    for (const { pos, alongNm } of pointsAlong(leg.a, leg.b, stepNm)) {
      for (const offset of offsets) {
        const p = offset === 0 ? pos : destinationPoint(pos, brg + 90, offset);
        const c = tileCoordinate(p.longitude, p.latitude, zoom, 1);
        planned.push({
          pos: p,
          distanceNm: base + alongNm,
          leg: legIndex,
          onTrack: offset === 0,
          tileX: c.x,
          tileY: c.y,
          px: c.px,
          py: c.py,
        });
      }
    }
    base += greatCircleNm(leg.a, leg.b);
  });

  const tileKeys = [...new Set(planned.map((p) => `${p.tileX}/${p.tileY}`))];
  const tiles = new Map<string, DemTileLike | null>();
  let done = 0;
  options.onProgress?.(0, tileKeys.length);
  await Promise.all(
    tileKeys.map(async (key) => {
      const [x, y] = key.split('/').map(Number) as [number, number];
      try {
        tiles.set(key, await withTimeout(fetchTile(zoom, x, y), tileTimeoutMs));
      } catch (reason) {
        options.onTileError?.(zoom, x, y, reason);
        tiles.set(key, null); // missing tile: treat as sea level
      }
      done++;
      options.onProgress?.(done, tileKeys.length);
    })
  );

  const track: TerrainSample[] = [];
  const maxElevationPerLegFt = legs.map(() => Number.NEGATIVE_INFINITY);
  for (const p of planned) {
    const tile = tiles.get(`${p.tileX}/${p.tileY}`);
    const elevationFt = tile ? elevationAt(tile, p.px * tile.width, p.py * tile.height) : 0;
    if (elevationFt > maxElevationPerLegFt[p.leg]!) maxElevationPerLegFt[p.leg] = elevationFt;
    if (p.onTrack) {
      const last = track[track.length - 1];
      // Legs share their boundary point; keep one sample for it.
      if (last && Math.abs(last.distanceNm - p.distanceNm) < 1e-6) continue;
      track.push({ ...p.pos, distanceNm: p.distanceNm, elevationFt });
    }
  }

  return {
    track,
    maxElevationPerLegFt: maxElevationPerLegFt.map((v) => (Number.isFinite(v) ? v : 0)),
  };
}
