import { useEffect } from 'react';
import * as maplibregl from 'maplibre-gl';
import {
  GIBS_MAX_ZOOM,
  GIBS_TILE_SIZE,
  composeCloudTile,
  gibsTileUrl,
  satellitesForTile,
} from '@/lib/satelliteClouds/cloudTiles';
import logger from '@/lib/utils/loggerRenderer';
import { safeRemove } from '../layers/types';
import { ensureLayerBelow } from '../layers/world/layerOrder';
import { runWhenStyleIsReady } from './styleReadiness';
import type { MapRef } from './useMapSetup';

const PROTOCOL = 'sat-clouds';
const SOURCE_ID = 'satellite-clouds-source';
const LAYER_ID = 'satellite-clouds-layer';
const CLOUD_OPACITY = 0.85;
/** GIBS publishes a new geostationary frame every 10 minutes. */
const REFRESH_INTERVAL = 10 * 60 * 1000;
const NO_LAYERS: ReadonlySet<string> = new Set();

async function fetchPixels(url: string, signal: AbortSignal): Promise<Uint8ClampedArray | null> {
  try {
    const resp = await fetch(url, { signal });
    if (!resp.ok) return null;
    const bitmap = await createImageBitmap(await resp.blob());
    const canvas = new OffscreenCanvas(GIBS_TILE_SIZE, GIBS_TILE_SIZE);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, GIBS_TILE_SIZE, GIBS_TILE_SIZE);
    bitmap.close();
    return ctx.getImageData(0, 0, GIBS_TILE_SIZE, GIBS_TILE_SIZE).data;
  } catch (err) {
    if (!signal.aborted) logger.weather.warn('Satellite cloud tile failed:', url, err);
    return null;
  }
}

let protocolRegistered = false;

function registerProtocol() {
  if (protocolRegistered) return;
  protocolRegistered = true;
  // URL shape: sat-clouds://{version}/{z}/{x}/{y}; the version only busts MapLibre's tile cache.
  maplibregl.addProtocol(PROTOCOL, async (params, abortController) => {
    const [z = 0, x = 0, y = 0] = params.url.split('/').slice(-3).map(Number);
    const satellites = satellitesForTile(z, x);
    const sources = await Promise.all(
      satellites.map((sat) => fetchPixels(gibsTileUrl(sat.layer, z, x, y), abortController.signal))
    );
    const pixels = composeCloudTile(z, x, satellites, sources);
    const image = new ImageData(
      pixels as Uint8ClampedArray<ArrayBuffer>,
      GIBS_TILE_SIZE,
      GIBS_TILE_SIZE
    );
    return { data: await createImageBitmap(image) };
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
      paint: { 'raster-opacity': CLOUD_OPACITY, 'raster-fade-duration': 0 },
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
