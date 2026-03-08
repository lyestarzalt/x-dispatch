import { useEffect, useRef } from 'react';
import { NightLayer } from 'maplibre-gl-nightlayer';
import type { MapRef } from './useMapSetup';

const LAYER_ID = 'night-layer';

export function useDayNightLayer(mapRef: MapRef, enabled: boolean): void {
  const layerRef = useRef<NightLayer | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!enabled) {
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
