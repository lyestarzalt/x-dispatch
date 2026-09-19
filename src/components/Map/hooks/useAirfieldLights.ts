import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { airfieldLightFactor } from '@/lib/airportLights/lightFactor';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSolarStore } from '@/stores/solarStore';
import { TAXIWAY_LIGHT_LAYERS } from '../layers/airport/AirfieldLightsLayer';
import { RUNWAY_LIGHT_LAYERS } from '../layers/airport/RunwayLightsLayer';

const LIGHT_LAYERS = [...TAXIWAY_LIGHT_LAYERS, ...RUNWAY_LIGHT_LAYERS];

type MapRef = React.MutableRefObject<maplibregl.Map | null>;

function applyFactor(map: maplibregl.Map, factor: number): void {
  const value = Math.round(factor * 100) / 100;
  for (const id of LIGHT_LAYERS) {
    const layer = map.getLayer(id);
    if (!layer) continue;
    const prop = layer.type === 'line' ? 'line-opacity' : 'circle-opacity';
    if (map.getPaintProperty(id, prop) !== value) map.setPaintProperty(id, prop, value);
  }
}

/**
 * Brightness of every airfield fixture layer follows the sun at the selected
 * airport. Recomputed on solar ticks, airport changes and setting changes,
 * never per frame.
 */
export function useAirfieldLights(mapRef: MapRef): void {
  const mode = useSettingsStore((s) => s.graphics.airfieldLights);
  const airport = useAppStore((s) => s.selectedAirportData);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !airport) return;

    const update = () => {
      if (!map.getStyle()) return;
      const { timeMs } = useSolarStore.getState();
      applyFactor(map, airfieldLightFactor(mode, timeMs, airport.latitude, airport.longitude));
    };

    // Layers are added right after the airport is selected; catch that render.
    const onData = (e: maplibregl.MapStyleDataEvent) => {
      if (e.dataType === 'style') update();
    };
    update();
    map.on('styledata', onData);
    const unsubscribe = useSolarStore.subscribe((state, prev) => {
      if (state.timeMs !== prev.timeMs) update();
    });
    return () => {
      map.off('styledata', onData);
      unsubscribe();
    };
  }, [mapRef, mode, airport]);
}
