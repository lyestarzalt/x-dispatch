import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { getBasemapTheme } from '@/lib/map/basemapTheme';
import {
  DEFAULT_HILLSHADE_DIRECTION,
  DEFAULT_HILLSHADE_HIGHLIGHT,
  globeSunLight,
  localSunLight,
  skyKeyframeAt,
  solarAppearance,
} from '@/lib/map/solar/skyPresets';
import { sunPosition } from '@/lib/map/solar/solarPosition';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSolarStore } from '@/stores/solarStore';
import { BASE_SKY, GLOBE_TO_MERCATOR_ZOOM, HILLSHADE_LAYER_ID } from '../utils/globeUtils';
import { runWhenStyleIsReady } from './styleReadiness';
import type { MapRef } from './useMapSetup';

/** Sun movement below which a tick or pan changes nothing visible. */
const MIN_ALTITUDE_STEP = 0.25;
const MIN_AZIMUTH_STEP = 1;

/** MapLibre's style-spec defaults, restored when the feature is switched off. */
const DEFAULT_SKY: maplibregl.SkySpecification = {
  ...BASE_SKY,
  'sky-color': '#88C6FC',
  'horizon-color': '#ffffff',
  'fog-color': '#ffffff',
};
const DEFAULT_LIGHT: maplibregl.LightSpecification = {
  anchor: 'viewport',
  position: [1.15, 210, 30],
  color: '#ffffff',
  intensity: 0.4,
};

/**
 * The daylit half of the atmosphere adds a bright haze. Over a dark basemap
 * that reads as daylight; over a light one it bleaches the map, so light
 * basemaps get a thinner atmosphere.
 */
const LIGHT_BASEMAP_SKY: maplibregl.SkySpecification = {
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.45, 5, 0.45, 7, 0],
};

function atmosphereForBasemap(): maplibregl.SkySpecification {
  const theme = getBasemapTheme(useSettingsStore.getState().map.mapStyleUrl);
  return theme === 'light' || theme === 'custom' ? LIGHT_BASEMAP_SKY : BASE_SKY;
}

/**
 * MapLibre draws the sky gradient as a ring around the globe whenever the
 * atmosphere is thinner than full, which reads as a white halo. The sky
 * colours are for the flat map's horizon, so they fade in only as the globe
 * hands over to mercator.
 */
function flatMapOnly(color: string): maplibregl.ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    GLOBE_TO_MERCATOR_ZOOM - 1.5,
    'rgba(0, 0, 0, 0)',
    GLOBE_TO_MERCATOR_ZOOM,
    color,
  ];
}

function setHillshade(map: maplibregl.Map, direction: number, highlight: string): void {
  if (!map.getLayer(HILLSHADE_LAYER_ID)) return;
  map.setPaintProperty(HILLSHADE_LAYER_ID, 'hillshade-illumination-direction', direction);
  map.setPaintProperty(HILLSHADE_LAYER_ID, 'hillshade-highlight-color', highlight);
}

function resetSolarAppearance(map: maplibregl.Map): void {
  map.setSky(DEFAULT_SKY);
  map.setLight(DEFAULT_LIGHT);
  setHillshade(map, DEFAULT_HILLSHADE_DIRECTION, DEFAULT_HILLSHADE_HIGHLIGHT);
}

/**
 * Sky colours, globe lighting and hillshade direction follow the sun.
 *
 * Two frames for the light. On the globe the sun is fixed to the Earth from
 * the subsolar point, so it only moves with the clock and stays put while
 * the globe is dragged. On the flat map the light is the sun as seen from
 * the map centre, which is what shades the extruded buildings. Sky colours
 * and hillshade always use the sun at the map centre.
 *
 * Work happens on solar-clock ticks, on `moveend`, and on `style.load`
 * (sky and light are style-scoped). Nothing runs per frame.
 */
export function useSolarSky(mapRef: MapRef, enabled: boolean): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!enabled) {
      return runWhenStyleIsReady(map, () => resetSolarAppearance(map));
    }

    let lastAltitude = Number.NaN;
    let lastAzimuth = Number.NaN;
    let lastLightKey = '';
    let hillshadeDirection = DEFAULT_HILLSHADE_DIRECTION;

    const applyLight = () => {
      const { timeMs, subsolar } = useSolarStore.getState();
      const onGlobe = map.getZoom() <= GLOBE_TO_MERCATOR_ZOOM;
      let light: maplibregl.LightSpecification;
      if (onGlobe) {
        light = globeSunLight(subsolar);
      } else {
        const center = map.getCenter();
        const { altitude, azimuth } = sunPosition(timeMs, center.lat, center.lng);
        light = localSunLight(altitude, azimuth, skyKeyframeAt(altitude));
      }
      const key = `${onGlobe}:${(light.position as number[]).map((v) => v.toFixed(1)).join(',')}`;
      if (key === lastLightKey) return;
      lastLightKey = key;
      map.setLight(light);
    };

    const applySkyAndHillshade = (force: boolean) => {
      const center = map.getCenter();
      const { altitude, azimuth } = sunPosition(
        useSolarStore.getState().timeMs,
        center.lat,
        center.lng
      );
      const unchanged =
        Math.abs(altitude - lastAltitude) < MIN_ALTITUDE_STEP &&
        Math.abs(((azimuth - lastAzimuth + 540) % 360) - 180) < MIN_AZIMUTH_STEP;
      if (!force && unchanged) return;
      lastAltitude = altitude;
      lastAzimuth = azimuth;

      const appearance = solarAppearance(altitude, azimuth, hillshadeDirection);
      hillshadeDirection = appearance.hillshade['hillshade-illumination-direction'];
      map.setSky({
        ...atmosphereForBasemap(),
        'sky-color': flatMapOnly(appearance.sky['sky-color'] as string),
        'horizon-color': flatMapOnly(appearance.sky['horizon-color'] as string),
        'fog-color': flatMapOnly(appearance.sky['fog-color'] as string),
      });
      setHillshade(map, hillshadeDirection, appearance.hillshade['hillshade-highlight-color']);
    };

    const apply = (force: boolean) => {
      if (!map.getStyle()) return;
      if (force) lastLightKey = '';
      applyLight();
      applySkyAndHillshade(force);
    };

    const onMoveEnd = () => apply(false);
    const onTick = () => apply(false);
    let cancelStyleReapply: (() => void) | null = null;
    const onStyleLoad = () => {
      cancelStyleReapply?.();
      cancelStyleReapply = runWhenStyleIsReady(map, () => apply(true));
    };

    const cancelInitial = runWhenStyleIsReady(map, () => apply(true));
    const unsubscribe = useSolarStore.subscribe((state, prev) => {
      if (state.timeMs !== prev.timeMs) onTick();
    });
    map.on('moveend', onMoveEnd);
    map.on('style.load', onStyleLoad);

    return () => {
      cancelInitial();
      cancelStyleReapply?.();
      unsubscribe();
      map.off('moveend', onMoveEnd);
      map.off('style.load', onStyleLoad);
    };
  }, [mapRef, enabled]);
}
