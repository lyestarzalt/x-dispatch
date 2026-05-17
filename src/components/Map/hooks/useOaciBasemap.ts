import { useEffect } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { MapRef } from './useMapSetup';

const SOURCE_ID = 'oaci-mbtiles';
const LAYER_ID = 'oaci-mbtiles-raster';

export function useOaciBasemap(mapRef: MapRef): void {
  const enabled = useMapStore((s) => s.oaciBasemapEnabled);
  const opacity = useSettingsStore((s) => s.sia.oaciOpacity);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const remove = () => {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };

    if (!enabled) {
      remove();
      return;
    }

    let cancelled = false;

    void window.mbtilesAPI.getConfig().then((cfg) => {
      if (cancelled || !cfg) {
        remove();
        return;
      }

      remove();
      map.addSource(SOURCE_ID, {
        type: 'raster',
        tiles: ['mbtiles://tile/{z}/{x}/{y}'],
        tileSize: 256,
        maxzoom: 14,
      });

      const beforeId = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
      map.addLayer(
        {
          id: LAYER_ID,
          type: 'raster',
          source: SOURCE_ID,
          paint: { 'raster-opacity': opacity },
        },
        beforeId
      );
    });

    return () => {
      cancelled = true;
      remove();
    };
  }, [mapRef, enabled, opacity]);
}
