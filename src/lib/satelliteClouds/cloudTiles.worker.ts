/// <reference lib="webworker" />
/**
 * Dedicated worker for the satellite cloud overlay. Fetching, decoding and
 * the per-pixel composition all happen here, so the map thread only ever
 * posts tile coordinates and receives a finished, transferable ImageBitmap.
 */
import {
  GIBS_TILE_SIZE,
  composeCloudTile,
  satTileUrl,
  satellitesForTile,
  warmTemperatureLut,
} from './cloudTiles';

declare const self: DedicatedWorkerGlobalScope;

export interface CloudTileRequest {
  type: 'tile';
  id: number;
  z: number;
  x: number;
  y: number;
}

export interface CloudTileAbort {
  type: 'abort';
  id: number;
}

export type CloudWorkerRequest = CloudTileRequest | CloudTileAbort;

export interface CloudWorkerResponse {
  id: number;
  bitmap?: ImageBitmap;
  error?: string;
}

const inFlight = new Map<number, AbortController>();

// Shared scratch canvas; drawImage + getImageData run with no await between
// them, so interleaved tile requests cannot corrupt each other's reads.
const scratch = new OffscreenCanvas(GIBS_TILE_SIZE, GIBS_TILE_SIZE);
const scratchCtx = scratch.getContext('2d', { willReadFrequently: true });

warmTemperatureLut();

async function fetchPixels(url: string, signal: AbortSignal): Promise<Uint8ClampedArray | null> {
  try {
    const resp = await fetch(url, { signal });
    if (!resp.ok || !scratchCtx) return null;
    const bitmap = await createImageBitmap(await resp.blob());
    scratchCtx.clearRect(0, 0, GIBS_TILE_SIZE, GIBS_TILE_SIZE);
    scratchCtx.drawImage(bitmap, 0, 0, GIBS_TILE_SIZE, GIBS_TILE_SIZE);
    bitmap.close();
    return scratchCtx.getImageData(0, 0, GIBS_TILE_SIZE, GIBS_TILE_SIZE).data;
  } catch {
    return null;
  }
}

async function handleTile({ id, z, x, y }: CloudTileRequest): Promise<void> {
  const abort = new AbortController();
  inFlight.set(id, abort);
  try {
    const satellites = satellitesForTile(z, x);
    const sources = await Promise.all(
      satellites.map((sat) => fetchPixels(satTileUrl(sat, z, x, y), abort.signal))
    );
    if (abort.signal.aborted) return;
    const pixels = composeCloudTile(z, x, satellites, sources);
    const image = new ImageData(
      pixels as Uint8ClampedArray<ArrayBuffer>,
      GIBS_TILE_SIZE,
      GIBS_TILE_SIZE
    );
    const bitmap = await createImageBitmap(image);
    self.postMessage({ id, bitmap } satisfies CloudWorkerResponse, [bitmap]);
  } catch (err) {
    self.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    } satisfies CloudWorkerResponse);
  } finally {
    inFlight.delete(id);
  }
}

self.onmessage = (event: MessageEvent<CloudWorkerRequest>) => {
  const msg = event.data;
  if (msg.type === 'tile') void handleTile(msg);
  else inFlight.get(msg.id)?.abort();
};
