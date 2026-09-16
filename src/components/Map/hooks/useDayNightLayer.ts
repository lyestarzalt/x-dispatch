import { useEffect, useRef } from 'react';
import { NightLayer } from 'maplibre-gl-nightlayer';
import type { MapRef } from './useMapSetup';

/**
 * maplibre-gl-nightlayer (1.0.0-alpha.16) reads `map.transform`, which
 * maplibre-gl v6 removed. Its render() does
 * `'getProjectionDataForCustomLayer' in map.transform`, and `in` on
 * undefined throws, killing the render loop on the first frame after the
 * layer is added.
 *
 * The fix upstream is small — render() is already handed
 * `options.defaultProjectionData`, which carries the same mainMatrix,
 * fallbackMatrix, tileMercatorCoords, clippingPlane and
 * projectionTransition it asks the transform for. Until that ships, the
 * layer stays off. The package is still installed (forced onto v6 by an
 * `overrides` entry in package.json), so re-enabling is this one flag.
 *
 * Upstream: https://github.com/kikuchan/maplibre-gl-nightlayer
 */
export const DAY_NIGHT_LAYER_SUPPORTED: boolean = false;

const LAYER_ID = 'night-layer';

export function useDayNightLayer(mapRef: MapRef, enabled: boolean): void {
  const layerRef = useRef<NightLayer | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!enabled || !DAY_NIGHT_LAYER_SUPPORTED) {
      if (map.getLayer(LAYER_ID)) {
        map.removeLayer(LAYER_ID);
      }
      layerRef.current = null;
      return;
    }

    const addLayer = () => {
      if (map.getLayer(LAYER_ID)) return;

      const nightLayer = new NightLayer({
        opacity: 0.5,
        color: [0, 12, 55, 255],
        twilightSteps: 3,
        twilightAttenuation: 0.5,
      });
      nightLayer.id = LAYER_ID;

      map.addLayer(nightLayer);
      layerRef.current = nightLayer;
    };

    if (map.isStyleLoaded()) {
      addLayer();
    } else {
      map.once('style.load', addLayer);
    }

    return () => {
      if (map.getLayer(LAYER_ID)) {
        map.removeLayer(LAYER_ID);
      }
      layerRef.current = null;
    };
  }, [mapRef, enabled]);
}
