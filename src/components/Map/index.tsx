import { useCallback, useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';
import LaunchDialog from '@/components/dialogs/LaunchDialog';
import SettingsDialog from '@/components/dialogs/SettingsDialog';
import AirportInfoPanel from '@/components/layout/AirportInfoPanel';
import FlightInfoPanel from '@/components/layout/FlightInfoPanel';
import FlightPlanBar from '@/components/layout/FlightPlanBar';
import Toolbar from '@/components/layout/Toolbar';
import { ExplorePanel } from '@/components/layout/Toolbar/ExplorePanel';
import { NAV_GLOBAL_LOADING } from '@/config/navLayerConfig';
import { Airport } from '@/lib/xplaneServices/dataService';
import { usePlaneState } from '@/queries';
import { useIvaoQuery } from '@/queries/useIvaoQuery';
import { useNavDataQuery } from '@/queries/useNavDataQuery';
import { useVatsimMetarQuery } from '@/queries/useVatsimMetarQuery';
import { useVatsimQuery } from '@/queries/useVatsimQuery';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { FeatureDebugInfo, useMapStore } from '@/stores/mapStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ParsedAirport } from '@/types/apt';
import { Coordinates } from '@/types/geo';
import { LayerVisibility, NavLayerVisibility } from '@/types/layers';
import type { PlanePosition } from '@/types/xplane';
import {
  applyNavVisibilityChange,
  toggleIvaoLayer,
  toggleVatsimLayer,
  useAirportFilters,
  useAirportInteractions,
  useAirportRenderer,
  useIdleOrbit,
  useIvaoSync,
  useMapSetup,
  useNavLayerSync,
  usePinDrop,
  useProcedureRouteSync,
  useRangeRingsSync,
  useRouteLineSync,
  useTaxiRouteSync,
  useTerrainShading,
  useTrackControl,
  useVatsimSync,
} from './hooks';
import { useDayNightLayer } from './hooks/useDayNightLayer';
import { useWeatherRadar } from './hooks/useWeatherRadar';
import {
  addFlightPlanLayer,
  bringIvaoLayersToTop,
  bringPlaneLayerToTop,
  bringVatsimLayersToTop,
  firLayer,
  fitMapToFlightPlan,
  removeFlightPlanLayer,
  removeIvaoPilotLayer,
  removePlaneLayer,
  removeVatsimPilotLayer,
  updatePlaneLayer,
} from './layers';
import './map-animations.css';
import { preserveCustomStyle } from './utils/globeUtils';
import CompassWidget from './widgets/CompassWidget';
import DevDebugOverlay from './widgets/DevDebugOverlay';
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
  const ivaoEnabled = useMapStore((s) => s.ivaoEnabled);
  const weatherRadarEnabled = useMapStore((s) => s.weatherRadarEnabled);
  const setWeatherRadarEnabled = useMapStore((s) => s.setWeatherRadarEnabled);
  const dayNightEnabled = useMapStore((s) => s.dayNightEnabled);
  const terrainShadingEnabled = useMapStore((s) => s.terrainShadingEnabled);
  const showPlaneTracker = useMapStore((s) => s.showPlaneTracker);
  const followPlane = useMapStore((s) => s.followPlane);
  const setFollowPlane = useMapStore((s) => s.setFollowPlane);
  const toggleNavLayer = useMapStore((s) => s.toggleNavLayer);
  const setSelectedFeature = useMapStore((s) => s.setSelectedFeature);
  const setVatsimEnabled = useMapStore((s) => s.setVatsimEnabled);
  const setIvaoEnabled = useMapStore((s) => s.setIvaoEnabled);
  const setShowPlaneTracker = useMapStore((s) => s.setShowPlaneTracker);

  const { map: mapSettings } = useSettingsStore();
  const mapStyleUrl = mapSettings.mapStyleUrl;

  // Refs for stable airport click callback (avoids circular dependency)
  const renderAirportRef = useRef<
    ((icao: string, center: [number, number]) => Promise<ParsedAirport | null>) | null
  >(null);
  const startAnimationsRef = useRef<(() => void) | null>(null);
  const stopAnimationsRef = useRef<(() => void) | null>(null);
  const applyLayerVisibilityRef = useRef<((visibility: LayerVisibility) => void) | null>(null);
  const layerVisibilityRef = useRef<LayerVisibility>(layerVisibility);
  const bringNetworkLayersToTopRef = useRef<(() => void) | null>(null);
  const selectedICAORef = useRef<string | null>(null);
  const airportsRef = useRef<Airport[]>(airports);
  airportsRef.current = airports;

  // Stable callback for airport click - uses refs to access renderer functions
  const handleAirportClick = useCallback(async (icao: string, coords: [number, number]) => {
    try {
      useMapStore.getState().setSelectedFeature(null);
      const parsedAirport = await renderAirportRef.current?.(icao, coords);
      if (parsedAirport) {
        const airportEntry = airportsRef.current.find((a) => a.icao === icao);
        useAppStore.getState().selectAirport(icao, parsedAirport, airportEntry?.isCustom);
        setTimeout(() => {
          startAnimationsRef.current?.();
          applyLayerVisibilityRef.current?.(layerVisibilityRef.current);
          // Bring network layers to top after airport rendering
          bringNetworkLayersToTopRef.current?.();
        }, 100);
      } else {
        useAppStore.getState().clearAirport();
        stopAnimationsRef.current?.();
      }
    } catch (err) {
      window.appAPI.log.error('Airport click error', err);
    }
  }, []);

  const ivaoPopupRef = useRef<maplibregl.Popup | null>(null);

  // Map initialization
  const { mapRef, mapContainerRef, vatsimPopupRef } = useMapSetup({
    airports,
    mapStyleUrl,
    onAirportClick: handleAirportClick,
  });

  // Initialize IVAO popup
  useEffect(() => {
    if (!ivaoPopupRef.current) {
      ivaoPopupRef.current = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        className: 'ivao-popup',
        maxWidth: '300px',
      });
    }
  }, []);

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
    bringNetworkLayersToTopRef.current = () => {
      if (mapRef.current) {
        bringVatsimLayersToTop(mapRef.current);
        bringIvaoLayersToTop(mapRef.current);
      }
    };
  }, [renderAirport, startAnimations, stopAnimations, applyLayerVisibility, mapRef]);

  useEffect(() => {
    layerVisibilityRef.current = layerVisibility;
  }, [layerVisibility]);

  useEffect(() => {
    selectedICAORef.current = selectedICAO;
  }, [selectedICAO]);

  // Airport interactions (gates, runway ends, helipads)
  const { selectGateAsStart, selectRunwayEndAsStart, selectHelipadAsStart, navigateToRunway } =
    useAirportInteractions({
      mapRef,
      selectedAirportData,
    });

  // Queries - VATSIM METAR always fetched for selected airport (independent of live traffic toggle)
  useVatsimMetarQuery(selectedICAO);

  // Get airport coordinates - prefer airports array, fallback to metadata
  const selectedAirport = useMemo(
    () => airports.find((a) => a.icao === selectedICAO),
    [airports, selectedICAO]
  );
  const navDataLocation: Coordinates | null = useMemo(() => {
    // First try the airports array (always has coords)
    if (selectedAirport) {
      return { latitude: selectedAirport.lat, longitude: selectedAirport.lon };
    }
    // Fallback to metadata
    if (selectedAirportData?.metadata?.datum_lat && selectedAirportData?.metadata?.datum_lon) {
      return {
        latitude: parseFloat(selectedAirportData.metadata.datum_lat),
        longitude: parseFloat(selectedAirportData.metadata.datum_lon),
      };
    }
    return null;
  }, [selectedAirport, selectedAirportData]);
  const { data: navData } = useNavDataQuery(
    navDataLocation?.latitude ?? null,
    navDataLocation?.longitude ?? null,
    50
  );

  const { data: vatsimData } = useVatsimQuery(vatsimEnabled);
  const { data: ivaoData } = useIvaoQuery(ivaoEnabled);

  // Plane tracker - live position via WebSocket
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
            aircraftCategory: planeState.aircraftCategory,
          }
        : null,
    [planeState]
  );

  // Auto-enable plane tracker ONCE when X-Plane WebSocket first connects
  const hasAutoEnabledRef = useRef(false);
  useEffect(() => {
    if (isXPlaneConnected && !showPlaneTracker && !hasAutoEnabledRef.current) {
      hasAutoEnabledRef.current = true;
      setShowPlaneTracker(true);
    }
  }, [isXPlaneConnected, showPlaneTracker, setShowPlaneTracker]);

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
    navVisibility,
  });

  // Vatsim sync
  useVatsimSync({
    mapRef,
    vatsimPopupRef,
    vatsimData,
    vatsimEnabled,
  });

  // IVAO sync
  useIvaoSync({
    mapRef,
    ivaoPopupRef,
    ivaoData,
    ivaoEnabled,
  });

  // Route line sync for Explore panel routes
  useRouteLineSync({
    mapRef,
    airports,
  });

  // Procedure route sync - renders selected procedure on map
  useProcedureRouteSync({ mapRef });

  // Range rings sync - renders reach circles from selected airport
  useRangeRingsSync({ mapRef, navDataLocation });

  // Taxi route sync - renders user-placed waypoints as a canvas overlay
  useTaxiRouteSync(mapRef);

  // Pin-drop custom start location
  const { placeAtCenter: handlePinDrop, placeAtCoordinates: handlePinDropAtCoordinates } =
    usePinDrop({ mapRef });

  // Weather radar overlay
  const weatherRadarControls = useWeatherRadar(mapRef, weatherRadarEnabled);

  // Day/night terminator overlay
  useDayNightLayer(mapRef, dayNightEnabled);

  // Terrain shading (hillshade + contour lines)
  useTerrainShading(mapRef, terrainShadingEnabled);

  // Airport dot filters (type, surface, IATA, custom, runways)
  useAirportFilters(mapRef);

  // Idle orbit camera - slowly orbit around selected airport after inactivity
  useIdleOrbit({ mapRef, airportCenter: navDataLocation });

  // Flight plan state
  const fmsData = useFlightPlanStore((s) => s.fmsData);
  const selectedWaypointIndex = useFlightPlanStore((s) => s.selectedWaypointIndex);
  // Flight plan layer sync — always fit bounds when fmsData changes
  const prevFmsDataRef = useRef<typeof fmsData>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (fmsData) {
      addFlightPlanLayer(map, fmsData);
      // Fit bounds when plan changes (new plan loaded or replaced)
      if (fmsData !== prevFmsDataRef.current) {
        fitMapToFlightPlan(map, fmsData);
      }
    } else {
      removeFlightPlanLayer(map);
    }
    prevFmsDataRef.current = fmsData;
  }, [mapRef, fmsData]);

  // Fly to selected waypoint
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedWaypointIndex === null || !fmsData) return;

    const wp = fmsData.waypoints[selectedWaypointIndex];
    if (wp) {
      map.flyTo({
        center: [wp.longitude, wp.latitude],
        zoom: 10,
        duration: 1500,
      });
    }
  }, [mapRef, selectedWaypointIndex, fmsData]);

  // Handle waypoint click from FlightPlanBar
  const handleWaypointClick = useCallback(
    (chip: import('@/types/fms').FlightPlanChip) => {
      if (chip.latitude !== undefined && chip.longitude !== undefined) {
        mapRef.current?.flyTo({
          center: [chip.longitude, chip.latitude],
          zoom: 10,
          duration: 1500,
        });
      }
    },
    [mapRef]
  );

  // Load FIR boundaries on map load
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !NAV_GLOBAL_LOADING.firBoundaries) return;

    const loadFIR = async () => {
      if (!map.isStyleLoaded()) {
        map.once('style.load', loadFIR);
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

  // Style change handler — uses transformStyle to carry over all custom
  // sources/layers into the new basemap, avoiding the nuke-and-re-add cascade.
  const previousStyleUrlRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Skip if this is the initial render or style URL hasn't changed
    if (previousStyleUrlRef.current === null) {
      previousStyleUrlRef.current = mapStyleUrl;
      return;
    }

    if (previousStyleUrlRef.current === mapStyleUrl) {
      return;
    }

    previousStyleUrlRef.current = mapStyleUrl;

    map.setStyle(mapStyleUrl, { transformStyle: preserveCustomStyle });
  }, [mapStyleUrl, mapRef]);

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

  const selectAirport = useCallback(
    async (airport: Airport) => {
      setSelectedFeature(null);
      const parsedAirport = await renderAirport(airport.icao, [airport.lon, airport.lat]);
      if (parsedAirport) {
        storeSelectAirport(airport.icao, parsedAirport);
        setTimeout(() => {
          startAnimations();
          applyLayerVisibility(layerVisibility);
          // Bring network layers to top after airport rendering
          if (mapRef.current) {
            bringVatsimLayersToTop(mapRef.current);
            bringIvaoLayersToTop(mapRef.current);
          }
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

  // Deep link handler — navigate to airport from xdispatch:// URL
  useEffect(() => {
    return window.appAPI.onDeepLink((data) => {
      if (data.type === 'airport' && data.icao) {
        const airport = airports.find((a) => a.icao === data.icao);
        if (airport) {
          selectAirport(airport);
        }
      }
    });
  }, [airports, selectAirport]);

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

  const handleToggleWeatherRadar = useCallback(() => {
    setWeatherRadarEnabled(!weatherRadarEnabled);
  }, [weatherRadarEnabled, setWeatherRadarEnabled]);

  const handleToggleVatsim = useCallback(() => {
    if (vatsimEnabled) {
      setVatsimEnabled(false);
      if (mapRef.current) removeVatsimPilotLayer(mapRef.current);
    } else {
      // Disable IVAO when enabling VATSIM
      if (ivaoEnabled) {
        setIvaoEnabled(false);
        if (mapRef.current) removeIvaoPilotLayer(mapRef.current);
      }
      setVatsimEnabled(true);
      toggleVatsimLayer(mapRef, vatsimPopupRef, true);
    }
  }, [mapRef, vatsimPopupRef, vatsimEnabled, ivaoEnabled, setVatsimEnabled, setIvaoEnabled]);

  const handleToggleIvao = useCallback(() => {
    if (ivaoEnabled) {
      setIvaoEnabled(false);
      if (mapRef.current) removeIvaoPilotLayer(mapRef.current);
    } else {
      // Disable VATSIM when enabling IVAO
      if (vatsimEnabled) {
        setVatsimEnabled(false);
        if (mapRef.current) removeVatsimPilotLayer(mapRef.current);
      }
      setIvaoEnabled(true);
      toggleIvaoLayer(mapRef, ivaoPopupRef, true);
    }
  }, [mapRef, ivaoPopupRef, vatsimEnabled, ivaoEnabled, setVatsimEnabled, setIvaoEnabled]);

  const handleTogglePlaneTracker = useCallback(() => {
    if (showPlaneTracker) {
      setShowPlaneTracker(false);
      if (mapRef.current) removePlaneLayer(mapRef.current);
    } else {
      setShowPlaneTracker(true);
    }
  }, [mapRef, showPlaneTracker, setShowPlaneTracker]);

  // Track button (bottom-left map control)
  useTrackControl({ mapRef, onToggle: handleTogglePlaneTracker, isConnected: isXPlaneConnected });

  // Track programmatic map movements to avoid disabling follow mode
  const isProgrammaticMoveRef = useRef(false);

  const handleCenterPlane = useCallback(() => {
    if (!planePosition || !mapRef.current) return;
    // Toggle follow mode
    const newFollowState = !followPlane;
    setFollowPlane(newFollowState);

    if (newFollowState) {
      // Mark as programmatic to avoid triggering disable
      isProgrammaticMoveRef.current = true;
      mapRef.current.flyTo({
        center: [planePosition.lng, planePosition.lat],
        bearing: planePosition.heading ?? 0,
        zoom: 12,
        duration: 1500,
      });
      // Reset after animation completes
      setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, 1600);
    }
  }, [mapRef, planePosition, followPlane, setFollowPlane]);

  // Follow plane position and heading when follow mode is active
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !followPlane || !planePosition) return;

    // Use jumpTo for instant updates - no lag from overlapping animations
    isProgrammaticMoveRef.current = true;
    map.jumpTo({
      center: [planePosition.lng, planePosition.lat],
      bearing: planePosition.heading ?? 0,
    });
    isProgrammaticMoveRef.current = false;
  }, [mapRef, followPlane, planePosition]);

  // Disable follow mode when user interacts with the map (not programmatic)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const disableFollow = () => {
      // Only disable if this is a user interaction, not programmatic
      if (!isProgrammaticMoveRef.current && followPlane) {
        setFollowPlane(false);
      }
    };

    // User interactions that should disable follow mode
    map.on('dragstart', disableFollow);

    return () => {
      map.off('dragstart', disableFollow);
    };
  }, [mapRef, followPlane, setFollowPlane]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* MapLibre container - fills entire viewport */}
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Top bar overlay - full width, above sidebar */}
      <div className="absolute left-4 right-4 top-4 z-30 space-y-2">
        <Toolbar
          airports={airports}
          onSelectAirport={selectAirport}
          onToggleVatsim={handleToggleVatsim}
          onToggleIvao={handleToggleIvao}
          onToggleWeatherRadar={handleToggleWeatherRadar}
          weatherRadarControls={weatherRadarControls}
          onNavToggle={handleNavLayerToggle}
          onPinDrop={handlePinDrop}
          onPinDropAtCoordinates={handlePinDropAtCoordinates}
        />
        <FlightPlanBar onWaypointClick={handleWaypointClick} />
      </div>

      {/* Map widgets - left side */}
      <CompassWidget mapBearing={mapBearing} />
      <DevDebugOverlay mapRef={mapRef} />
      <ExplorePanel airports={airports} onSelectAirport={selectAirport} />

      {showPlaneTracker && (
        <FlightStrip
          planeState={planeState}
          connected={isXPlaneConnected}
          onCenterPlane={handleCenterPlane}
        />
      )}

      {/* Flight Info Panel - shows SimBrief data when loaded */}
      <FlightInfoPanel />

      {/* Airport Info Panel - floating overlay */}
      {showSidebar && selectedAirportData && (
        <SectionErrorBoundary name="AirportInfoPanel">
          <AirportInfoPanel
            onSelectRunway={navigateToRunway}
            onSelectGateAsStart={selectGateAsStart}
            onSelectRunwayEndAsStart={selectRunwayEndAsStart}
            onSelectHelipadAsStart={selectHelipadAsStart}
          />
        </SectionErrorBoundary>
      )}

      {/* Dialogs - render as modals, positioning handled by dialog component */}
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />

      <LaunchDialog
        open={showLaunchDialog}
        onClose={() => setShowLaunchDialog(false)}
        startPosition={startPosition}
      />
    </div>
  );
}
