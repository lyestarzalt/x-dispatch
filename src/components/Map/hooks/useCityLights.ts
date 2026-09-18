import { useEffect } from 'react';
import { nightSidePlaces, quantizeNightFactor } from '@/lib/map/solar/cityLightsStyle';
import { POPULATED_PLACES } from '@/lib/map/solar/populatedPlaces';
import { nightFactor, sunPosition } from '@/lib/map/solar/solarPosition';
import { useSolarStore } from '@/stores/solarStore';
import {
  ensureCityLightsLayers,
  removeCityLightsLayers,
  updateCityLightsNight,
  updateCityLightsPlaces,
} from '../layers/world/CityLightsLayer';
import { runWhenStyleIsReady } from './styleReadiness';
import type { MapRef } from './useMapSetup';

/**
 * Night-side city lights driven by the solar clock.
 *
 * Each tick recomputes which bundled places are in the dark (a few thousand
 * sine terms) and the night factor at the map centre for the regional
 * layers. Paint properties are only touched when the quantised night factor
 * actually changes, so a pan across daylight costs nothing.
 */
export function useCityLights(mapRef: MapRef, enabled: boolean): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!enabled) {
      removeCityLightsLayers(map);
      return;
    }

    let appliedNight = -1;

    const nightAtCenter = () => {
      const center = map.getCenter();
      const { timeMs } = useSolarStore.getState();
      return quantizeNightFactor(nightFactor(sunPosition(timeMs, center.lat, center.lng).altitude));
    };

    const ensure = () => {
      if (!map.getStyle()) return;
      appliedNight = nightAtCenter();
      ensureCityLightsLayers(map, appliedNight);
      updateCityLightsPlaces(
        map,
        nightSidePlaces(POPULATED_PLACES, useSolarStore.getState().timeMs)
      );
    };

    const refreshNight = () => {
      if (!map.getStyle()) return;
      const night = nightAtCenter();
      if (night === appliedNight) return;
      appliedNight = night;
      updateCityLightsNight(map, night);
    };

    const onTick = () => {
      if (!map.getStyle()) return;
      updateCityLightsPlaces(
        map,
        nightSidePlaces(POPULATED_PLACES, useSolarStore.getState().timeMs)
      );
      refreshNight();
    };

    let cancelStyleReapply: (() => void) | null = null;
    const onStyleLoad = () => {
      cancelStyleReapply?.();
      cancelStyleReapply = runWhenStyleIsReady(map, ensure);
    };

    const cancelInitial = runWhenStyleIsReady(map, ensure);
    const unsubscribe = useSolarStore.subscribe((state, prev) => {
      if (state.timeMs !== prev.timeMs) onTick();
    });
    map.on('moveend', refreshNight);
    map.on('style.load', onStyleLoad);

    return () => {
      cancelInitial();
      cancelStyleReapply?.();
      unsubscribe();
      map.off('moveend', refreshNight);
      map.off('style.load', onStyleLoad);
      removeCityLightsLayers(map);
    };
  }, [mapRef, enabled]);
}
