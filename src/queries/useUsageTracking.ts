import { useEffect } from 'react';
import i18n from 'i18next';
import { classifyCompanionApp } from '@/lib/analytics/companionApps';
import {
  ANALYTICS_LANGUAGES,
  type AnalyticsLayer,
  type AnalyticsWidget,
} from '@/lib/analytics/events';
import { builtTaxiRoute, isNewStartPosition } from '@/lib/analytics/mapActions';
import { useAppStore } from '@/stores/appStore';
import { useCompanionAppsStore } from '@/stores/companionAppsStore';
import { useFlightRecorderStore } from '@/stores/flightRecorderStore';
import { useMapStore } from '@/stores/mapStore';
import { MAP_STYLE_PRESETS, useSettingsStore } from '@/stores/settingsStore';
import { useTaxiRouteStore } from '@/stores/taxiRouteStore';
import { useThemeStore } from '@/stores/themeStore';
import { trackEvent, useAnalyticsConsent } from './useAnalytics';

type MapState = ReturnType<typeof useMapStore.getState>;

/** Map state that counts as "switched on" for each tracked layer. */
const LAYER_STATE: ReadonlyArray<[AnalyticsLayer, (s: MapState) => boolean]> = [
  ['vatsim', (s) => s.vatsimEnabled],
  ['ivao', (s) => s.ivaoEnabled],
  ['sim_traffic', (s) => s.simTrafficEnabled],
  ['weather_radar', (s) => s.weatherRadarEnabled],
  ['clouds', (s) => s.cloudLayerEnabled],
  ['flight_trail', (s) => s.flightTrailEnabled],
  ['range_rings', (s) => s.rangeRingsEnabled],
  ['terrain_3d', (s) => s.terrain3dEnabled],
  ['terrain_shading', (s) => s.terrainShadingEnabled],
  ['plane_tracker', (s) => s.showPlaneTracker],
  ['follow_plane', (s) => s.followPlane],
  ['night_mode', (s) => s.isNightMode],
  ['navaids', (s) => s.navVisibility.navaids],
  ['ils', (s) => s.navVisibility.ils],
  ['airspaces', (s) => s.navVisibility.airspaces],
  ['airways', (s) => s.navVisibility.airwaysMode !== 'off'],
];

const MAP_WIDGET_STATE: ReadonlyArray<[AnalyticsWidget, (s: MapState) => boolean]> = [
  ['explore', (s) => s.explore.isOpen],
  ['nav_info', (s) => s.navInfo !== null],
];

function mapStyleId(url: string) {
  const preset = MAP_STYLE_PRESETS.find((s) => s.url === url);
  switch (preset?.id) {
    case 'carto-dark':
    case 'ofm-liberty':
    case 'carto-positron':
    case 'esri-satellite':
      return preset.id;
    default:
      return 'custom';
  }
}

function appLanguage() {
  const lang = i18n.language as (typeof ANALYTICS_LANGUAGES)[number];
  return ANALYTICS_LANGUAGES.includes(lang) ? lang : 'en';
}

function sendPreferences() {
  const settings = useSettingsStore.getState();
  const tools = useCompanionAppsStore.getState().tools;
  trackEvent('preferences', {
    theme: useThemeStore.getState().theme,
    map_style: mapStyleId(settings.map.mapStyleUrl),
    app_language: appLanguage(),
    weight_unit: settings.map.units.weight,
    font_size: settings.appearance.fontSize,
    clock_mode: settings.appearance.clockMode,
    surface_detail: settings.graphics.surfaceDetail,
    dynamic_sky: settings.graphics.dynamicSky,
    city_lights: settings.graphics.cityLights,
    idle_orbit: settings.map.idleOrbitEnabled,
    simbrief_linked: settings.simbrief.pilotId.trim() !== '',
    fms_export_targets: settings.simbrief.fmsExportTargets.length,
    custom_map_styles: settings.map.userMapStyles.length,
    companion_apps: tools.length,
  });
  for (const tool of tools) {
    trackEvent('companion_app_configured', {
      app: classifyCompanionApp(tool.exePath),
      auto_launch: tool.autoLaunch,
    });
  }
}

/**
 * Reports how the map is used: layers as they are switched on and off, widgets
 * and Explore tabs as they are opened, airports and start positions as they are
 * picked, taxi routes once they are built, and one preferences snapshot per session.
 * Mounted once by the map; events are dropped in main unless consent is granted.
 */
export function useUsageTracking() {
  const consented = useAnalyticsConsent().data?.consent === 'granted';

  useEffect(() => {
    if (consented) sendPreferences();
  }, [consented]);

  useEffect(() => {
    const unsubMap = useMapStore.subscribe((next, prev) => {
      for (const [layer, isOn] of LAYER_STATE) {
        if (isOn(next) && !isOn(prev)) trackEvent('layer_enabled', { layer });
        if (!isOn(next) && isOn(prev)) trackEvent('layer_disabled', { layer });
      }
      for (const [widget, isOpen] of MAP_WIDGET_STATE) {
        if (isOpen(next) && !isOpen(prev)) trackEvent('widget_opened', { widget });
      }
      const explore = next.explore;
      if (
        explore.isOpen &&
        (!prev.explore.isOpen || explore.activeTab !== prev.explore.activeTab)
      ) {
        trackEvent('explore_tab_opened', { tab: explore.activeTab });
      }
      if (explore.featuredCategory !== prev.explore.featuredCategory) {
        trackEvent('explore_filter_selected', {
          tab: 'featured',
          filter: explore.featuredCategory,
        });
      }
      if (explore.selectedRoute && explore.selectedRoute !== prev.explore.selectedRoute) {
        trackEvent('explore_item_selected', { tab: 'routes' });
      }
    });
    const unsubApp = useAppStore.subscribe((next, prev) => {
      if (next.selectedICAO && next.selectedICAO !== prev.selectedICAO) {
        trackEvent('airport_selected', { airport: next.selectedICAO });
      }
      const start = next.startPosition;
      if (start && isNewStartPosition(start, prev.startPosition)) {
        trackEvent('start_position_selected', {
          start_type: start.type,
          helipad: start.isHelipad ?? false,
        });
      }
    });
    const unsubTaxiRoute = useTaxiRouteStore.subscribe((next, prev) => {
      const method = builtTaxiRoute(next, prev);
      if (method) trackEvent('taxi_route_built', { method });
    });
    const unsubRecorder = useFlightRecorderStore.subscribe((next, prev) => {
      if (next.replay && !prev.replay) trackEvent('widget_opened', { widget: 'replay' });
      if (next.landing && !prev.landing) trackEvent('widget_opened', { widget: 'landing_report' });
    });
    return () => {
      unsubMap();
      unsubApp();
      unsubTaxiRoute();
      unsubRecorder();
    };
  }, []);
}
