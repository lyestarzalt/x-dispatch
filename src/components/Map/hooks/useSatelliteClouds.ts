import { useEffect } from 'react';
import * as maplibregl from 'maplibre-gl';
import { GIBS_MAX_ZOOM, GIBS_TILE_SIZE } from '@/lib/satelliteClouds/cloudTiles';
import type { CloudWorkerResponse } from '@/lib/satelliteClouds/cloudTiles.worker';
import logger from '@/lib/utils/loggerRenderer';
import { safeRemove } from '../layers/types';
import { ensureLayerBelow } from '../layers/world/layerOrder';
import { runWhenStyleIsReady } from './styleReadiness';
import type { MapRef } from './useMapSetup';

const PROTOCOL = 'sat-clouds';
const SOURCE_ID = 'satellite-clouds-source';
const LAYER_ID = 'satellite-clouds-layer';
const CLOUD_OPACITY = 0.85;
/** Fade out before airport detail appears at z11+, so clouds never cover it. */
const FADE_START_ZOOM = 8;
const HIDE_ZOOM = 10;
/** GIBS publishes a new geostationary frame every 10 minutes. */
const REFRESH_INTERVAL = 10 * 60 * 1000;
const NO_LAYERS: ReadonlySet<string> = new Set();

/**
 * All fetching, decoding and pixel work runs in a dedicated worker; the map
 * thread only forwards tile coordinates and receives transferred ImageBitmaps,
 * so tile loads never eat into the frame budget.
 */
let tileWorker: Worker | null = null;
let nextRequestId = 0;
const pendingTiles = new Map<
  number,
  { resolve: (bitmap: ImageBitmap) => void; reject: (err: Error) => void }
>();

function getTileWorker(): Worker {
  if (tileWorker) return tileWorker;
  tileWorker = new Worker(
    new URL('../../../lib/satelliteClouds/cloudTiles.worker.ts', import.meta.url),
    { type: 'module' }
  );
  tileWorker.onmessage = (event: MessageEvent<CloudWorkerResponse>) => {
    const { id, bitmap, error } = event.data;
    const pending = pendingTiles.get(id);
    if (!pending) {
      bitmap?.close();
      return;
    }
    pendingTiles.delete(id);
    if (bitmap) pending.resolve(bitmap);
    else pending.reject(new Error(error ?? 'Satellite cloud tile failed'));
  };
  tileWorker.onerror = (event) => {
    logger.weather.warn('Satellite cloud worker error:', event.message);
    for (const pending of pendingTiles.values()) {
      pending.reject(new Error(event.message || 'Satellite cloud worker error'));
    }
    pendingTiles.clear();
  };
  return tileWorker;
}

function composeTileInWorker(
  z: number,
  x: number,
  y: number,
  signal: AbortSignal
): Promise<ImageBitmap> {
  const worker = getTileWorker();
  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    pendingTiles.set(id, { resolve, reject });
    worker.postMessage({ type: 'tile', id, z, x, y });
    signal.addEventListener(
      'abort',
      () => {
        if (!pendingTiles.delete(id)) return;
        worker.postMessage({ type: 'abort', id });
        reject(new DOMException('Tile request aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

let protocolRegistered = false;

function registerProtocol() {
  if (protocolRegistered) return;
  protocolRegistered = true;
  // URL shape: sat-clouds://{version}/{z}/{x}/{y}; the version only busts MapLibre's tile cache.
  maplibregl.addProtocol(PROTOCOL, async (params, abortController) => {
    const [z = 0, x = 0, y = 0] = params.url.split('/').slice(-3).map(Number);
    return { data: await composeTileInWorker(z, x, y, abortController.signal) };
  });
}

function tileTemplate(version: number) {
  return `${PROTOCOL}://${version}/{z}/{x}/{y}`;
}

function ensureCloudLayer(map: maplibregl.Map, version: number) {
  if (!map.getStyle()) return;
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: 'raster',
      tiles: [tileTemplate(version)],
      tileSize: GIBS_TILE_SIZE,
      maxzoom: GIBS_MAX_ZOOM,
      attribution: 'NASA GIBS',
    });
  }
  ensureLayerBelow(
    map,
    {
      id: LAYER_ID,
      type: 'raster',
      source: SOURCE_ID,
      maxzoom: HIDE_ZOOM,
      paint: {
        'raster-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          FADE_START_ZOOM,
          CLOUD_OPACITY,
          HIDE_ZOOM,
          0,
        ],
        'raster-fade-duration': 0,
      },
    },
    NO_LAYERS
  );
}

function removeCloudLayer(map: maplibregl.Map) {
  safeRemove(map, () => {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  });
}

/** Near-live white cloud overlay from geostationary infrared imagery. */
export function useSatelliteClouds(mapRef: MapRef, enabled: boolean): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!enabled) {
      removeCloudLayer(map);
      return;
    }

    registerProtocol();
    let version = Date.now();
    const ensure = () => ensureCloudLayer(map, version);

    let cancelStyleReapply: (() => void) | null = null;
    const onStyleLoad = () => {
      cancelStyleReapply?.();
      cancelStyleReapply = runWhenStyleIsReady(map, ensure);
    };

    const refresh = setInterval(() => {
      version = Date.now();
      const source = map.getSource(SOURCE_ID) as maplibregl.RasterTileSource | undefined;
      source?.setTiles([tileTemplate(version)]);
    }, REFRESH_INTERVAL);

    const cancelInitial = runWhenStyleIsReady(map, ensure);
    map.on('style.load', onStyleLoad);

    return () => {
      cancelInitial();
      cancelStyleReapply?.();
      clearInterval(refresh);
      map.off('style.load', onStyleLoad);
      removeCloudLayer(map);
    };
  }, [mapRef, enabled]);
}
