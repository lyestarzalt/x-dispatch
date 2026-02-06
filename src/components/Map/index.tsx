import { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import LaunchDialog from '@/components/dialogs/LaunchDialog';
import SettingsDialog from '@/components/dialogs/SettingsDialog';
import Sidebar from '@/components/layout/Sidebar';
import Toolbar from '@/components/layout/Toolbar';
import { NAV_GLOBAL_LOADING, NAV_LIMITS } from '@/config/navLayerConfig';
import { ParsedAirport } from '@/lib/aptParser';
import { Airport } from '@/lib/xplaneData';
import { useGatewayQuery } from '@/queries/useGatewayQuery';
import {
  getNavDataCounts,
  useGlobalAirwaysQuery,
  useNavDataQuery,
} from '@/queries/useNavDataQuery';
import { useVatsimQuery } from '@/queries/useVatsimQuery';
import { useWeatherQuery } from '@/queries/useWeatherQuery';
import { useAppStore } from '@/stores/appStore';
import { FeatureDebugInfo, useMapStore } from '@/stores/mapStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { AirwaysMode, LayerVisibility, NavLayerVisibility } from '@/types/layers';
import {
  applyNavVisibilityChange,
  toggleVatsimLayer,
  useAirportInteractions,
  useAirportRenderer,
  useMapSetup,
  useNavLayerSync,
  useVatsimSync,
} from './hooks';
import {
  addProcedureRouteLayer,
  firLayer,
  removeProcedureRouteLayer,
  removeVatsimPilotLayer,
} from './layers';
import './map-animations.css';
import CompassWidget from './widgets/CompassWidget';

interface MapProps {
  airports: Airport[];
}

const CLICKABLE_LAYERS = [
  'airport-linear-features',
  'airport-linear-features-border',
  'airport-signs',
  'airport-gates',
  'airport-runways',
  'airport-taxiways',
  'airport-windsocks',
];

export default function Map({ airports }: MapProps) {
  const {
    selectedICAO,
    selectedAirportData,
    showSidebar,
    showSettings,
    showLaunchDialog,
    selectedProcedure,
    startPosition: selectedStartPosition,
    selectAirport: storeSelectAirport,
    setShowSidebar,
    setShowSettings,
    setShowLaunchDialog,
    selectProcedure: setSelectedProcedure,
  } = useAppStore();

  const {
    layerVisibility,
    navVisibility,
    isNightMode,
    mapBearing,
    debugEnabled,
    selectedFeature,
    vatsimEnabled,
    toggleLayer,
    toggleNavLayer,
    setAirwaysMode,
    setDebugEnabled,
    setSelectedFeature,
    setVatsimEnabled,
  } = useMapStore();

  const { map: mapSettings } = useSettingsStore();
  const mapStyleUrl = mapSettings.mapStyleUrl;

  // Refs for stable airport click callback (avoids circular dependency)
  const renderAirportRef = useRef<((icao: string) => Promise<ParsedAirport | null>) | null>(null);
  const startAnimationsRef = useRef<(() => void) | null>(null);
  const stopAnimationsRef = useRef<(() => void) | null>(null);
  const applyLayerVisibilityRef = useRef<((visibility: LayerVisibility) => void) | null>(null);
  const layerVisibilityRef = useRef<LayerVisibility>(layerVisibility);

  // Stable callback for airport click - uses refs to access renderer functions
  const handleAirportClick = useCallback(async (icao: string) => {
    try {
      useMapStore.getState().setSelectedFeature(null);
      const parsedAirport = await renderAirportRef.current?.(icao);
      if (parsedAirport) {
        useAppStore.getState().selectAirport(icao, parsedAirport);
        setTimeout(() => {
          startAnimationsRef.current?.();
          applyLayerVisibilityRef.current?.(layerVisibilityRef.current);
        }, 100);
      } else {
        useAppStore.getState().clearAirport();
        stopAnimationsRef.current?.();
      }
    } catch (err) {
      window.appAPI.log.error('Airport click error', err);
    }
  }, []);

  // Map initialization
  const { mapRef, mapContainerRef, vatsimPopupRef } = useMapSetup({
    airports,
    mapStyleUrl,
    onAirportClick: handleAirportClick,
  });

  // Airport renderer
  const {
    renderAirport,
    setLayerVisibility: applyLayerVisibility,
    startAnimations,
    stopAnimations,
  } = useAirportRenderer(mapRef, isNightMode);

  // Update refs after useAirportRenderer is called
  useEffect(() => {
    renderAirportRef.current = renderAirport;
    startAnimationsRef.current = startAnimations;
    stopAnimationsRef.current = stopAnimations;
    applyLayerVisibilityRef.current = applyLayerVisibility;
  }, [renderAirport, startAnimations, stopAnimations, applyLayerVisibility]);

  useEffect(() => {
    layerVisibilityRef.current = layerVisibility;
  }, [layerVisibility]);

  // Airport interactions (gates, runway ends)
  const { selectGateAsStart, selectRunwayEndAsStart, navigateToGate, navigateToRunway } =
    useAirportInteractions({
      mapRef,
      selectedAirportData,
    });

  // Queries
  const { data: weatherData } = useWeatherQuery(selectedICAO);
  const weather = {
    metar: weatherData?.metar || null,
    taf: weatherData?.taf || null,
    loading: false,
    error: null as string | null,
  };

  const { data: gatewayData } = useGatewayQuery(selectedICAO);

  const navDataLocation = selectedAirportData
    ? {
        lat: selectedAirportData.runways[0]?.ends[0]?.latitude,
        lon: selectedAirportData.runways[0]?.ends[0]?.longitude,
      }
    : null;
  const { data: navData, isLoading: navLoading } = useNavDataQuery(
    navDataLocation?.lat ?? null,
    navDataLocation?.lon ?? null,
    50
  );

  const shouldLoadAirways = navVisibility.airwaysMode !== 'off';
  const { data: airwaysData, isFetched: airwaysFetched } = useGlobalAirwaysQuery(shouldLoadAirways);
  const navDataCounts = getNavDataCounts(navData, airwaysFetched ? airwaysData : undefined);

  const { data: vatsimData } = useVatsimQuery(vatsimEnabled);

  // Nav layer sync
  useNavLayerSync({
    mapRef,
    navData,
    airwaysData,
    airwaysFetched,
    navVisibility,
  });

  // Vatsim sync
  useVatsimSync({
    mapRef,
    vatsimPopupRef,
    vatsimData,
    vatsimEnabled,
    selectedAirportId: selectedAirportData?.id,
  });

  // Load FIR boundaries on map load
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !NAV_GLOBAL_LOADING.firBoundaries) return;

    const loadFIR = async () => {
      if (!map.isStyleLoaded()) {
        map.once('load', loadFIR);
        return;
      }

      try {
        const allAirspaces = await window.navAPI.getAllAirspaces();
        if (allAirspaces.length > 0) {
          await firLayer.add(map, allAirspaces);
          firLayer.setVisibility(map, useMapStore.getState().navVisibility.airspaces);
        }
      } catch (err) {
        window.appAPI.log.error('Failed to load airspaces', err);
      }
    };

    loadFIR();
  }, [mapRef]);

  // Style change handler
  const initialStyleRef = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (initialStyleRef.current) {
      initialStyleRef.current = false;
      return;
    }

    const currentICAO = selectedICAO;
    const handleStyleLoad = async () => {
      if (currentICAO) {
        await renderAirport(currentICAO);
        applyLayerVisibility(layerVisibility);
      }
    };

    map.once('style.load', handleStyleLoad);
    map.setStyle(mapStyleUrl);

    return () => {
      map.off('style.load', handleStyleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyleUrl]);

  // Debug mode click handler
  const handleFeatureClick = useCallback(
    (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (!debugEnabled || !e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const props = feature.properties || {};
      const geom = feature.geometry;
      const layerId = feature.layer?.id || 'unknown';

      let featureType: FeatureDebugInfo['type'] = 'unknown';
      if (layerId.includes('linear-feature')) featureType = 'line';
      else if (layerId.includes('sign')) featureType = 'sign';
      else if (layerId.includes('gate')) featureType = 'gate';
      else if (layerId.includes('runway')) featureType = 'runway';
      else if (layerId.includes('taxiway')) featureType = 'taxiway';

      const debugInfo: FeatureDebugInfo = {
        type: featureType,
        name: (props.name as string) || (props.text as string) || undefined,
        properties: { ...props, _layerId: layerId },
        coordinates:
          geom.type === 'Point'
            ? ((geom as GeoJSON.Point).coordinates as [number, number])
            : geom.type === 'LineString'
              ? ((geom as GeoJSON.LineString).coordinates as [number, number][])
              : undefined,
      };

      setSelectedFeature(debugInfo);
    },
    [debugEnabled, setSelectedFeature]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (debugEnabled) {
      CLICKABLE_LAYERS.forEach((layerId) => {
        map.on('click', layerId, handleFeatureClick);
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'crosshair';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      });
    }

    return () => {
      CLICKABLE_LAYERS.forEach((layerId) => {
        map.off('click', layerId, handleFeatureClick);
      });
    };
  }, [mapRef, debugEnabled, handleFeatureClick]);

  // Ref for selectAirport to use in auto-load effect without causing re-runs
  const selectAirportRef = useRef<((airport: Airport) => Promise<void>) | null>(null);

  // Auto-load nearby airport
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const checkNearbyAirport = () => {
      if (timeoutId) clearTimeout(timeoutId);
      const zoom = map.getZoom();
      if (zoom < NAV_LIMITS.autoLoadAirport) return;

      timeoutId = setTimeout(() => {
        const center = map.getCenter();
        const currentAirport = useAppStore.getState().selectedAirportData;
        let nearestAirport: Airport | null = null;
        let nearestDistance = Infinity;

        for (const airport of airports) {
          const dLat = airport.lat - center.lat;
          const dLon = airport.lon - center.lng;
          const distance = dLat * dLat + dLon * dLon;
          if (distance < NAV_LIMITS.autoLoadSearchRadius && distance < nearestDistance) {
            nearestDistance = distance;
            nearestAirport = airport;
          }
        }

        if (nearestAirport && nearestAirport.icao !== currentAirport?.id) {
          selectAirportRef.current?.(nearestAirport);
        }
      }, NAV_LIMITS.autoLoadDebounce);
    };

    map.on('moveend', checkNearbyAirport);
    checkNearbyAirport();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      map.off('moveend', checkNearbyAirport);
    };
  }, [mapRef, airports]);

  // Callbacks
  const selectAirport = useCallback(
    async (airport: Airport) => {
      setSelectedFeature(null);
      mapRef.current?.flyTo({
        center: [airport.lon, airport.lat],
        zoom: 14,
        duration: 2000,
      });

      const parsedAirport = await renderAirport(airport.icao);
      if (parsedAirport) {
        storeSelectAirport(airport.icao, parsedAirport);
        setTimeout(() => {
          startAnimations();
          applyLayerVisibility(layerVisibility);
        }, 100);
      }
    },
    [
      mapRef,
      renderAirport,
      startAnimations,
      applyLayerVisibility,
      layerVisibility,
      storeSelectAirport,
      setSelectedFeature,
    ]
  );

  // Update selectAirport ref for auto-load effect
  useEffect(() => {
    selectAirportRef.current = selectAirport;
  }, [selectAirport]);

  const handleLayerToggle = useCallback(
    (layer: keyof LayerVisibility) => {
      toggleLayer(layer);
      const newVisibility = { ...layerVisibility, [layer]: !layerVisibility[layer] };
      applyLayerVisibility(newVisibility);
    },
    [toggleLayer, layerVisibility, applyLayerVisibility]
  );

  const handleNavLayerToggle = useCallback(
    (layer: keyof NavLayerVisibility) => {
      toggleNavLayer(layer);
      const newVisibility = { ...navVisibility, [layer]: !navVisibility[layer] };

      const map = mapRef.current;
      if (map) {
        applyNavVisibilityChange(map, layer, newVisibility);
        if (layer === 'airspaces') {
          firLayer.setVisibility(map, newVisibility.airspaces);
        }
      }
    },
    [mapRef, toggleNavLayer, navVisibility]
  );

  const handleSetAirwaysMode = useCallback(
    (mode: AirwaysMode) => {
      setAirwaysMode(mode);
    },
    [setAirwaysMode]
  );

  const handleLoadViewportNavaids = useCallback(async () => {}, []);

  const handleToggleVatsim = useCallback(() => {
    if (vatsimEnabled) {
      setVatsimEnabled(false);
      if (mapRef.current) removeVatsimPilotLayer(mapRef.current);
    } else {
      setVatsimEnabled(true);
      toggleVatsimLayer(mapRef, vatsimPopupRef, true);
    }
  }, [mapRef, vatsimPopupRef, vatsimEnabled, setVatsimEnabled]);

  const handleSelectProcedure = useCallback(
    async (procedure: any) => {
      setSelectedProcedure(procedure);

      const map = mapRef.current;
      if (!map || !procedure) {
        if (map) removeProcedureRouteLayer(map);
        return;
      }

      addProcedureRouteLayer(map, {
        type: procedure.type as 'SID' | 'STAR' | 'APPROACH',
        name: procedure.name,
        waypoints: procedure.waypoints.map(
          (wp: { fixId: string; latitude?: number; longitude?: number; resolved?: boolean }) => ({
            fixId: wp.fixId,
            latitude: wp.latitude,
            longitude: wp.longitude,
            resolved: wp.resolved,
          })
        ),
      });
    },
    [mapRef, setSelectedProcedure]
  );

  const closeSidebar = useCallback(() => {
    setShowSidebar(false);
    setSelectedFeature(null);
  }, [setShowSidebar, setSelectedFeature]);

  return (
    <div
      className="relative overflow-hidden bg-background"
      style={{ width: '100vw', height: '100vh' }}
    >
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
      />

      <Toolbar
        airports={airports}
        onSelectAirport={selectAirport}
        onOpenSettings={() => setShowSettings(true)}
        onToggleVatsim={handleToggleVatsim}
        onOpenLauncher={() => setShowLaunchDialog(true)}
        isVatsimEnabled={vatsimEnabled}
        vatsimPilotCount={vatsimData?.pilots?.length}
        hasStartPosition={!!selectedStartPosition}
        navVisibility={navVisibility}
        onNavToggle={handleNavLayerToggle}
        onSetAirwaysMode={handleSetAirwaysMode}
        navDataCounts={navDataCounts}
      />

      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        isVatsimEnabled={vatsimEnabled}
        onToggleVatsim={handleToggleVatsim}
        vatsimPilotCount={vatsimData?.pilots?.length}
      />

      <CompassWidget mapBearing={mapBearing} weather={weather} />

      {showSidebar && selectedAirportData && (
        <Sidebar
          airport={selectedAirportData}
          onCloseAirport={closeSidebar}
          weather={weather}
          gatewayInfo={gatewayData ?? null}
          onRefreshGateway={() => {}}
          layerVisibility={layerVisibility}
          onLayerToggle={handleLayerToggle}
          navVisibility={navVisibility}
          onNavToggle={handleNavLayerToggle}
          onLoadViewportNavaids={handleLoadViewportNavaids}
          isLoadingNav={navLoading}
          navDataCounts={navDataCounts}
          onNavigateToGate={navigateToGate}
          onSelectRunway={navigateToRunway}
          debugEnabled={debugEnabled}
          onDebugToggle={() => setDebugEnabled(!debugEnabled)}
          selectedFeature={selectedFeature}
          onClearSelectedFeature={() => setSelectedFeature(null)}
          onSelectProcedure={handleSelectProcedure}
          selectedProcedure={selectedProcedure}
          onSelectGateAsStart={selectGateAsStart}
          onSelectRunwayEndAsStart={selectRunwayEndAsStart}
          selectedStartPosition={selectedStartPosition}
        />
      )}

      <LaunchDialog
        open={showLaunchDialog}
        onClose={() => setShowLaunchDialog(false)}
        startPosition={selectedStartPosition}
      />
    </div>
  );
}
