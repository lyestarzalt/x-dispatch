import { useCallback, useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import LaunchDialog from '@/components/dialogs/LaunchDialog';
import SettingsDialog from '@/components/dialogs/SettingsDialog';
import Sidebar from '@/components/layout/Sidebar';
import Toolbar from '@/components/layout/Toolbar';
import { ExplorePanel } from '@/components/layout/Toolbar/ExplorePanel';
import { NAV_GLOBAL_LOADING } from '@/config/navLayerConfig';
import { Airport } from '@/lib/xplaneServices/dataService';
import { usePlaneState, useXPlaneStatus } from '@/queries';
import { useGlobalAirwaysQuery, useNavDataQuery } from '@/queries/useNavDataQuery';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { useVatsimQuery } from '@/queries/useVatsimQuery';
import { useAppStore } from '@/stores/appStore';
import { FeatureDebugInfo, useMapStore } from '@/stores/mapStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ParsedAirport } from '@/types/apt';
import { Coordinates } from '@/types/geo';
import { AirwaysMode, LayerVisibility, NavLayerVisibility } from '@/types/layers';
import type { PlanePosition, PlaneState } from '@/types/xplane';
import {
  applyNavVisibilityChange,
  setupAirportPopup,
  setupAirportsLayer,
  toggleVatsimLayer,
  useAirportInteractions,
  useAirportRenderer,
  useMapSetup,
  useNavLayerSync,
  useProcedureRouteSync,
  useRouteLineSync,
  useVatsimSync,
} from './hooks';
import {
  bringPlaneLayerToTop,
  bringVatsimLayersToTop,
  firLayer,
  removePlaneLayer,
  removeVatsimPilotLayer,
  updatePlaneLayer,
} from './layers';
import './map-animations.css';
import CompassWidget from './widgets/CompassWidget';
import FlightStrip from './widgets/FlightStrip';

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
  const selectedICAO = useAppStore((s) => s.selectedICAO);
  const selectedAirportData = useAppStore((s) => s.selectedAirportData);
  const showSidebar = useAppStore((s) => s.showSidebar);
  const showSettings = useAppStore((s) => s.showSettings);
  const showLaunchDialog = useAppStore((s) => s.showLaunchDialog);
  const startPosition = useAppStore((s) => s.startPosition);
  const storeSelectAirport = useAppStore((s) => s.selectAirport);
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const setShowLaunchDialog = useAppStore((s) => s.setShowLaunchDialog);

  const layerVisibility = useMapStore((s) => s.layerVisibility);
  const navVisibility = useMapStore((s) => s.navVisibility);
  const isNightMode = useMapStore((s) => s.isNightMode);
  const mapBearing = useMapStore((s) => s.mapBearing);
  const debugEnabled = useMapStore((s) => s.debugEnabled);
  const vatsimEnabled = useMapStore((s) => s.vatsimEnabled);
  const showPlaneTracker = useMapStore((s) => s.showPlaneTracker);
  const toggleLayer = useMapStore((s) => s.toggleLayer);
  const toggleNavLayer = useMapStore((s) => s.toggleNavLayer);
  const setAirwaysMode = useMapStore((s) => s.setAirwaysMode);
  const setDebugEnabled = useMapStore((s) => s.setDebugEnabled);
  const setSelectedFeature = useMapStore((s) => s.setSelectedFeature);
  const setVatsimEnabled = useMapStore((s) => s.setVatsimEnabled);
  const setShowPlaneTracker = useMapStore((s) => s.setShowPlaneTracker);

  const { map: mapSettings } = useSettingsStore();
  const mapStyleUrl = mapSettings.mapStyleUrl;

  // Refs for stable airport click callback (avoids circular dependency)
  const renderAirportRef = useRef<((icao: string) => Promise<ParsedAirport | null>) | null>(null);
  const startAnimationsRef = useRef<(() => void) | null>(null);
  const stopAnimationsRef = useRef<(() => void) | null>(null);
  const applyLayerVisibilityRef = useRef<((visibility: LayerVisibility) => void) | null>(null);
  const layerVisibilityRef = useRef<LayerVisibility>(layerVisibility);
  const bringVatsimToTopRef = useRef<(() => void) | null>(null);
  const selectedICAORef = useRef<string | null>(null);

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
          // Bring VATSIM layers to top after airport rendering
          bringVatsimToTopRef.current?.();
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
  const { mapRef, mapContainerRef, airportPopupRef, vatsimPopupRef } = useMapSetup({
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
    bringVatsimToTopRef.current = () => {
      if (mapRef.current) bringVatsimLayersToTop(mapRef.current);
    };
  }, [renderAirport, startAnimations, stopAnimations, applyLayerVisibility, mapRef]);

  useEffect(() => {
    layerVisibilityRef.current = layerVisibility;
  }, [layerVisibility]);

  useEffect(() => {
    selectedICAORef.current = selectedICAO;
  }, [selectedICAO]);

  // Airport interactions (gates, runway ends, helipads)
  const {
    selectGateAsStart,
    selectRunwayEndAsStart,
    selectHelipadAsStart,
    navigateToGate,
    navigateToRunway,
  } = useAirportInteractions({
    mapRef,
    selectedAirportData,
  });

  // Queries - VATSIM METAR always fetched for selected airport (independent of live traffic toggle)
  const { data: vatsimMetar } = useVatsimMetarQuery(selectedICAO);

  const navDataLocation: Coordinates | null =
    selectedAirportData?.metadata?.datum_lat && selectedAirportData?.metadata?.datum_lon
      ? {
          latitude: parseFloat(selectedAirportData.metadata.datum_lat),
          longitude: parseFloat(selectedAirportData.metadata.datum_lon),
        }
      : null;
  const { data: navData, isLoading: navLoading } = useNavDataQuery(
    navDataLocation?.latitude ?? null,
    navDataLocation?.longitude ?? null,
    50
  );

  const shouldLoadAirways = navVisibility.airwaysMode !== 'off';
  const { data: airwaysData, isFetched: airwaysFetched } = useGlobalAirwaysQuery(shouldLoadAirways);

  const { data: vatsimData } = useVatsimQuery(vatsimEnabled);

  // Plane tracker - check X-Plane status and get position when enabled
  const { data: isXPlaneRunning = false } = useXPlaneStatus({
    enabled: true,
    refetchInterval: 3000,
  });
  const { state: planeState, connected: isXPlaneConnected } = usePlaneState();

  // Derive position from state for the map layer
  const planePosition = useMemo<PlanePosition | null>(
    () =>
      planeState
        ? {
            lat: planeState.latitude,
            lng: planeState.longitude,
            altitude: planeState.altitudeMSL,
            heading: planeState.heading,
            groundspeed: planeState.groundspeed,
          }
        : null,
    [planeState]
  );

  // Auto-enable plane tracker ONCE when X-Plane is first detected
  const hasAutoEnabledRef = useRef(false);
  useEffect(() => {
    if (isXPlaneRunning && !showPlaneTracker && !hasAutoEnabledRef.current) {
      hasAutoEnabledRef.current = true;
      setShowPlaneTracker(true);
    }
  }, [isXPlaneRunning, showPlaneTracker, setShowPlaneTracker]);

  // Plane layer sync - update plane position on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (showPlaneTracker && isXPlaneConnected && planePosition) {
      updatePlaneLayer(map, planePosition);
      bringPlaneLayerToTop(map);
    } else if (!showPlaneTracker || !isXPlaneConnected) {
      removePlaneLayer(map);
    }
  }, [mapRef, showPlaneTracker, isXPlaneConnected, planePosition]);

  // Cleanup plane layer on unmount
  useEffect(() => {
    const map = mapRef.current;
    return () => {
      if (map) {
        removePlaneLayer(map);
      }
    };
  }, [mapRef]);

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
  });

  // Route line sync for Explore panel routes
  useRouteLineSync({
    mapRef,
    airports,
  });

  // Procedure route sync - renders selected procedure on map
  useProcedureRouteSync({ mapRef });

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

    const handleStyleLoad = async () => {
      // Re-add airports layer and click handlers
      setupAirportsLayer(map, airports);
      setupAirportPopup(map, airportPopupRef, handleAirportClick);

      // Re-render selected airport if any
      const icao = selectedICAORef.current;
      if (icao && renderAirportRef.current && applyLayerVisibilityRef.current) {
        await renderAirportRef.current(icao);
        applyLayerVisibilityRef.current(layerVisibilityRef.current);
        bringVatsimLayersToTop(map);
      }
    };

    map.once('style.load', handleStyleLoad);
    map.setStyle(mapStyleUrl);

    return () => {
      map.off('style.load', handleStyleLoad);
    };
  }, [mapStyleUrl, mapRef, airports, airportPopupRef, handleAirportClick]);

  // Debug mode click handler
  const handleFeatureClick = useCallback(
    (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const feature = e.features?.[0];
      if (!debugEnabled || !feature) return;

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

    // Store handlers for cleanup (use globalThis.Map to avoid conflict with component name)
    const mouseEnterHandlers = new globalThis.Map<string, () => void>();
    const mouseLeaveHandlers = new globalThis.Map<string, () => void>();

    if (debugEnabled) {
      CLICKABLE_LAYERS.forEach((layerId) => {
        const enterHandler = () => {
          map.getCanvas().style.cursor = 'crosshair';
        };
        const leaveHandler = () => {
          map.getCanvas().style.cursor = '';
        };

        mouseEnterHandlers.set(layerId, enterHandler);
        mouseLeaveHandlers.set(layerId, leaveHandler);

        map.on('click', layerId, handleFeatureClick);
        map.on('mouseenter', layerId, enterHandler);
        map.on('mouseleave', layerId, leaveHandler);
      });
    }

    return () => {
      CLICKABLE_LAYERS.forEach((layerId) => {
        map.off('click', layerId, handleFeatureClick);

        const enterHandler = mouseEnterHandlers.get(layerId);
        const leaveHandler = mouseLeaveHandlers.get(layerId);
        if (enterHandler) map.off('mouseenter', layerId, enterHandler);
        if (leaveHandler) map.off('mouseleave', layerId, leaveHandler);
      });
    };
  }, [mapRef, debugEnabled, handleFeatureClick]);

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
          // Bring VATSIM layers to top after airport rendering
          if (mapRef.current) bringVatsimLayersToTop(mapRef.current);
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

  const handleTogglePlaneTracker = useCallback(() => {
    if (showPlaneTracker) {
      setShowPlaneTracker(false);
      if (mapRef.current) removePlaneLayer(mapRef.current);
    } else {
      setShowPlaneTracker(true);
    }
  }, [mapRef, showPlaneTracker, setShowPlaneTracker]);

  const handleCenterPlane = useCallback(() => {
    if (!planePosition || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [planePosition.lng, planePosition.lat],
      zoom: 12,
      duration: 1500,
    });
  }, [mapRef, planePosition]);

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
        onToggleVatsim={handleToggleVatsim}
        onTogglePlaneTracker={handleTogglePlaneTracker}
        onNavToggle={handleNavLayerToggle}
      />

      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        isVatsimEnabled={vatsimEnabled}
        onToggleVatsim={handleToggleVatsim}
        vatsimPilotCount={vatsimData?.pilots?.length}
      />

      <CompassWidget mapBearing={mapBearing} metar={vatsimMetar?.decoded} />
      <ExplorePanel airports={airports} onSelectAirport={selectAirport} />

      {showPlaneTracker && (
        <FlightStrip
          planeState={planeState}
          connected={isXPlaneConnected}
          onCenterPlane={handleCenterPlane}
        />
      )}

      {showSidebar && selectedAirportData && (
        <SectionErrorBoundary name="Sidebar">
          <Sidebar
            onSelectRunway={navigateToRunway}
            onSelectGateAsStart={selectGateAsStart}
            onSelectRunwayEndAsStart={selectRunwayEndAsStart}
            onSelectHelipadAsStart={selectHelipadAsStart}
          />
        </SectionErrorBoundary>
      )}

      <LaunchDialog
        open={showLaunchDialog}
        onClose={() => setShowLaunchDialog(false)}
        startPosition={startPosition}
      />
    </div>
  );
}
