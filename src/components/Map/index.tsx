import { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import LaunchDialog from '@/components/dialogs/LaunchDialog';
import SettingsDialog from '@/components/dialogs/SettingsDialog';
import Sidebar from '@/components/layout/Sidebar';
import Toolbar from '@/components/layout/Toolbar';
import { NAV_GLOBAL_LOADING, NAV_LIMITS } from '@/config/navLayerConfig';
import { ParsedAirport } from '@/lib/aptParser';
import { Runway } from '@/lib/aptParser/types';
import { Airport } from '@/lib/xplaneData';
import { useGatewayQuery } from '@/queries/useGatewayQuery';
import {
  getNavDataCounts,
  useGlobalAirwaysQuery,
  useNavDataQuery,
} from '@/queries/useNavDataQuery';
import { getPilotsInBounds, useVatsimQuery } from '@/queries/useVatsimQuery';
import { useWeatherQuery } from '@/queries/useWeatherQuery';
import { useAppStore } from '@/stores/appStore';
import { FeatureDebugInfo, useMapStore } from '@/stores/mapStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { AirwaysMode, LayerVisibility, NavLayerVisibility } from '@/types/layers';
import { useAirportRenderer } from './hooks/useAirportRenderer';
import {
  addAirspaceLayer,
  addDMELayer,
  addFIRLayer,
  addHighAirwayLayer,
  addILSLayer,
  addLowAirwayLayer,
  addNDBLayer,
  addProcedureRouteLayer,
  addVORLayer,
  addVatsimPilotLayer,
  addWaypointLayer,
  removeHighAirwayLayer,
  removeLowAirwayLayer,
  removeProcedureRouteLayer,
  removeVatsimPilotLayer,
  setAirspaceLayerVisibility,
  setDMELayerVisibility,
  setFIRLayerVisibility,
  setILSLayerVisibility,
  setNDBLayerVisibility,
  setVORLayerVisibility,
  setWaypointLayerVisibility,
  setupVatsimClickHandler,
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
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const vatsimPopup = useRef<maplibregl.Popup | null>(null);

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
    setStartPosition: setSelectedStartPosition,
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
    setCurrentZoom,
    setMapBearing,
    setDebugEnabled,
    setSelectedFeature,
    setVatsimEnabled,
  } = useMapStore();

  const { map: mapSettings } = useSettingsStore();
  const mapStyleUrl = mapSettings.mapStyleUrl;

  const {
    renderAirport,
    setLayerVisibility: applyLayerVisibility,
    startAnimations,
    stopAnimations,
  } = useAirportRenderer(map, isNightMode);

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

  const waypointCoordsRef = useRef<globalThis.Map<string, { lat: number; lon: number }>>(
    new globalThis.Map()
  );

  const hoveredGateId = useRef<number | null>(null);
  const hoveredRunwayEndId = useRef<number | null>(null);
  const selectedGateId = useRef<number | null>(null);
  const selectedRunwayEndId = useRef<number | null>(null);

  const selectedAirportDataRef = useRef<ParsedAirport | null>(null);
  selectedAirportDataRef.current = selectedAirportData;

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

      if (map.current) {
        if (layer === 'vors') setVORLayerVisibility(map.current, newVisibility.vors);
        if (layer === 'ndbs') setNDBLayerVisibility(map.current, newVisibility.ndbs);
        if (layer === 'dmes') setDMELayerVisibility(map.current, newVisibility.dmes);
        if (layer === 'ils') setILSLayerVisibility(map.current, newVisibility.ils);
        if (layer === 'waypoints') setWaypointLayerVisibility(map.current, newVisibility.waypoints);
        if (layer === 'airspaces') {
          setAirspaceLayerVisibility(map.current, newVisibility.airspaces);
          setFIRLayerVisibility(map.current, newVisibility.airspaces);
        }
      }
    },
    [toggleNavLayer, navVisibility]
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
      if (map.current) removeVatsimPilotLayer(map.current);
    } else {
      setVatsimEnabled(true);
      if (map.current && vatsimPopup.current) {
        setupVatsimClickHandler(map.current, vatsimPopup.current);
      }
    }
  }, [vatsimEnabled, setVatsimEnabled]);

  const handleSelectProcedure = useCallback(
    async (procedure: any) => {
      setSelectedProcedure(procedure);

      if (!map.current || !procedure) {
        if (map.current) removeProcedureRouteLayer(map.current);
        return;
      }

      const coordMap = new globalThis.Map<string, { lat: number; lon: number }>();
      if (navData) {
        navData.waypoints.forEach((wp) => {
          coordMap.set(wp.id.toUpperCase(), { lat: wp.latitude, lon: wp.longitude });
        });
        navData.vors.forEach((vor) => {
          coordMap.set(vor.id.toUpperCase(), { lat: vor.latitude, lon: vor.longitude });
        });
        navData.ndbs.forEach((ndb) => {
          coordMap.set(ndb.id.toUpperCase(), { lat: ndb.latitude, lon: ndb.longitude });
        });
      }
      waypointCoordsRef.current = coordMap;

      addProcedureRouteLayer(
        map.current,
        {
          type: procedure.type,
          name: procedure.name,
          waypoints: procedure.waypoints.map((wp: any) => ({ fixId: wp.fixId })),
        },
        coordMap
      );
    },
    [navData, setSelectedProcedure]
  );

  const selectAirport = useCallback(
    async (airport: Airport) => {
      setSelectedFeature(null);
      map.current?.flyTo({
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
      renderAirport,
      startAnimations,
      applyLayerVisibility,
      layerVisibility,
      storeSelectAirport,
      setSelectedFeature,
    ]
  );

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
        name: props.name || props.text || undefined,
        properties: { ...props, _layerId: layerId },
        coordinates:
          geom.type === 'Point'
            ? (geom.coordinates as [number, number])
            : geom.type === 'LineString'
              ? (geom.coordinates as [number, number][])
              : undefined,
      };

      setSelectedFeature(debugInfo);
    },
    [debugEnabled, setSelectedFeature]
  );

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyleUrl,
      center: [0, 30],
      zoom: 2,
      pitch: 0,
      bearing: 0,
      maxPitch: 85,
      fadeDuration: 0,
      trackResize: true,
      refreshExpiredTiles: false,
    });

    map.current.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      'bottom-right'
    );
    map.current.addControl(
      new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }),
      'bottom-left'
    );

    map.current.on('error', (e) => {
      window.appAPI.log.error('MapLibre error', e.error);
    });

    map.current.on('load', () => {
      if (!map.current) return;

      const features = airports.map((airport) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [airport.lon, airport.lat] },
        properties: { icao: airport.icao, name: airport.name },
      }));

      map.current.addSource('airports', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      });

      map.current.addLayer({
        id: 'airports-glow',
        type: 'circle',
        source: 'airports',
        minzoom: 5,
        paint: {
          'circle-color': '#4a90d9',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 8, 6, 12, 8],
          'circle-blur': 0.6,
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.1, 8, 0.2],
        },
      });

      map.current.addLayer({
        id: 'airports',
        type: 'circle',
        source: 'airports',
        minzoom: 4,
        paint: {
          'circle-color': '#4a90d9',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 6, 3, 10, 5, 14, 6],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 8, 1],
          'circle-stroke-color': '#ffffff',
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 6, 0.9, 8, 1],
        },
      });

      map.current.addLayer({
        id: 'airport-labels',
        type: 'symbol',
        source: 'airports',
        minzoom: 6,
        layout: {
          'text-field': ['get', 'icao'],
          'text-font': ['Open Sans Bold'],
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 8, 10, 10, 14, 12],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color': '#cccccc',
          'text-halo-color': '#000000',
          'text-halo-width': 1,
        },
      });

      popup.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'airport-popup',
      });
      vatsimPopup.current = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        className: 'vatsim-popup',
        maxWidth: '300px',
      });

      map.current.on('mouseenter', 'airports', (e) => {
        if (!map.current || !e.features || e.features[0].geometry.type !== 'Point') return;
        map.current.getCanvas().style.cursor = 'pointer';
        const coordinates = e.features[0].geometry.coordinates.slice() as [number, number];
        const { name, icao } = e.features[0].properties as { name: string; icao: string };
        popup.current
          ?.setLngLat(coordinates)
          .setHTML(
            `<div class="bg-black/90 text-white px-3 py-2 rounded border border-gray-700"><div class="font-mono font-bold text-blue-400">${icao}</div><div class="text-gray-400 text-xs">${name}</div></div>`
          )
          .addTo(map.current);
      });

      map.current.on('mouseleave', 'airports', () => {
        if (!map.current) return;
        map.current.getCanvas().style.cursor = '';
        popup.current?.remove();
      });

      map.current.on('click', 'airports', async (e) => {
        if (!e.features || !e.features[0].properties?.icao) return;
        if (e.features[0].geometry.type !== 'Point') return;

        const icao = e.features[0].properties.icao;
        try {
          useMapStore.getState().setSelectedFeature(null);
          const parsedAirport = await renderAirport(icao);
          if (parsedAirport) {
            useAppStore.getState().selectAirport(icao, parsedAirport);
            setTimeout(() => {
              startAnimations();
              applyLayerVisibility(layerVisibility);
            }, 100);
          } else {
            useAppStore.getState().clearAirport();
            stopAnimations();
          }
        } catch (err) {
          window.appAPI.log.error('Airport click error', err);
        }
      });

      map.current.on('zoomend', () => {
        if (map.current) setCurrentZoom(map.current.getZoom());
      });

      map.current.on('mouseenter', 'airport-gates-hitbox', (e) => {
        if (!map.current || !e.features || e.features.length === 0) return;
        map.current.getCanvas().style.cursor = 'pointer';
        const featureId = e.features[0].id as number;
        if (hoveredGateId.current !== null && hoveredGateId.current !== featureId) {
          map.current.setFeatureState(
            { source: 'airport-gates', id: hoveredGateId.current },
            { hover: false }
          );
        }
        hoveredGateId.current = featureId;
        map.current.setFeatureState({ source: 'airport-gates', id: featureId }, { hover: true });
      });

      map.current.on('mouseleave', 'airport-gates-hitbox', () => {
        if (!map.current) return;
        map.current.getCanvas().style.cursor = '';
        if (hoveredGateId.current !== null) {
          map.current.setFeatureState(
            { source: 'airport-gates', id: hoveredGateId.current },
            { hover: false }
          );
          hoveredGateId.current = null;
        }
      });

      map.current.on('click', 'airport-gates-hitbox', (e) => {
        if (!map.current || !e.features || e.features.length === 0) return;
        e.originalEvent.stopPropagation();

        const feature = e.features[0];
        const props = feature.properties;
        const featureId = feature.id as number;

        if (selectedGateId.current !== null) {
          map.current.setFeatureState(
            { source: 'airport-gates', id: selectedGateId.current },
            { selected: false }
          );
        }
        if (selectedRunwayEndId.current !== null) {
          map.current.setFeatureState(
            { source: 'airport-runway-ends', id: selectedRunwayEndId.current },
            { selected: false }
          );
          selectedRunwayEndId.current = null;
        }

        selectedGateId.current = featureId;
        map.current.setFeatureState({ source: 'airport-gates', id: featureId }, { selected: true });

        const currentAirport = selectedAirportDataRef.current;
        if (props && currentAirport) {
          setSelectedStartPosition({
            type: 'ramp',
            name: props.name || `Gate ${featureId}`,
            airport: currentAirport.id,
            latitude: props.latitude,
            longitude: props.longitude,
          });
        }
      });

      map.current.on('mouseenter', 'airport-runway-ends', (e) => {
        if (!map.current || !e.features || e.features.length === 0) return;
        map.current.getCanvas().style.cursor = 'pointer';
        const featureId = e.features[0].id as number;
        if (hoveredRunwayEndId.current !== null && hoveredRunwayEndId.current !== featureId) {
          map.current.setFeatureState(
            { source: 'airport-runway-ends', id: hoveredRunwayEndId.current },
            { hover: false }
          );
        }
        hoveredRunwayEndId.current = featureId;
        map.current.setFeatureState(
          { source: 'airport-runway-ends', id: featureId },
          { hover: true }
        );
      });

      map.current.on('mouseleave', 'airport-runway-ends', () => {
        if (!map.current) return;
        map.current.getCanvas().style.cursor = '';
        if (hoveredRunwayEndId.current !== null) {
          map.current.setFeatureState(
            { source: 'airport-runway-ends', id: hoveredRunwayEndId.current },
            { hover: false }
          );
          hoveredRunwayEndId.current = null;
        }
      });

      map.current.on('click', 'airport-runway-ends', (e) => {
        if (!map.current || !e.features || e.features.length === 0) return;
        e.originalEvent.stopPropagation();

        const feature = e.features[0];
        const props = feature.properties;
        const featureId = feature.id as number;

        if (selectedRunwayEndId.current !== null) {
          map.current.setFeatureState(
            { source: 'airport-runway-ends', id: selectedRunwayEndId.current },
            { selected: false }
          );
        }
        if (selectedGateId.current !== null) {
          map.current.setFeatureState(
            { source: 'airport-gates', id: selectedGateId.current },
            { selected: false }
          );
          selectedGateId.current = null;
        }

        selectedRunwayEndId.current = featureId;
        map.current.setFeatureState(
          { source: 'airport-runway-ends', id: featureId },
          { selected: true }
        );

        const currentAirport = selectedAirportDataRef.current;
        if (props && currentAirport) {
          setSelectedStartPosition({
            type: 'runway',
            name: props.name || `Runway End ${featureId}`,
            airport: currentAirport.id,
            latitude: props.latitude,
            longitude: props.longitude,
          });
        }
      });

      map.current.on('rotate', () => {
        if (map.current) setMapBearing(map.current.getBearing());
      });

      setCurrentZoom(map.current.getZoom());

      if (NAV_GLOBAL_LOADING.firBoundaries) {
        window.navAPI
          .getAllAirspaces()
          .then((allAirspaces) => {
            if (map.current && allAirspaces.length > 0) {
              addFIRLayer(map.current, allAirspaces);
              setFIRLayerVisibility(map.current, useMapStore.getState().navVisibility.airspaces);
            }
          })
          .catch((err) => window.appAPI.log.error('Failed to load airspaces', err));
      }
    });

    return () => {
      stopAnimations();
      map.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airports]);

  const initialStyleRef = useRef(true);
  useEffect(() => {
    if (!map.current) return;

    if (initialStyleRef.current) {
      initialStyleRef.current = false;
      return;
    }

    const m = map.current;
    const currentICAO = selectedICAO;

    const handleStyleLoad = async () => {
      if (currentICAO) {
        await renderAirport(currentICAO);
        applyLayerVisibility(layerVisibility);
      }
    };

    m.once('style.load', handleStyleLoad);
    m.setStyle(mapStyleUrl);

    return () => {
      m.off('style.load', handleStyleLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyleUrl]);

  useEffect(() => {
    if (!map.current) return;
    const m = map.current;

    if (debugEnabled) {
      CLICKABLE_LAYERS.forEach((layerId) => {
        m.on('click', layerId, handleFeatureClick);
        m.on('mouseenter', layerId, () => {
          m.getCanvas().style.cursor = 'crosshair';
        });
        m.on('mouseleave', layerId, () => {
          m.getCanvas().style.cursor = '';
        });
      });
    }

    return () => {
      CLICKABLE_LAYERS.forEach((layerId) => {
        m.off('click', layerId, handleFeatureClick);
      });
    };
  }, [debugEnabled, handleFeatureClick]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const checkNearbyAirport = () => {
      if (timeoutId) clearTimeout(timeoutId);
      const zoom = m.getZoom();
      if (zoom < NAV_LIMITS.autoLoadAirport) return;

      timeoutId = setTimeout(() => {
        const center = m.getCenter();
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
          selectAirport(nearestAirport);
        }
      }, NAV_LIMITS.autoLoadDebounce);
    };

    m.on('moveend', checkNearbyAirport);
    checkNearbyAirport();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      m.off('moveend', checkNearbyAirport);
    };
  }, [airports, selectAirport]);

  useEffect(() => {
    const m = map.current;
    if (!m || !navData) return;

    const updateNavLayers = async () => {
      try {
        if (!m.isStyleLoaded()) {
          m.once('styledata', () => updateNavLayers());
          return;
        }

        if (navData.vors.length > 0) {
          await addVORLayer(m, navData.vors);
          setVORLayerVisibility(m, navVisibility.vors);
        }
        if (navData.ndbs.length > 0) {
          await addNDBLayer(m, navData.ndbs);
          setNDBLayerVisibility(m, navVisibility.ndbs);
        }
        if (navData.dmes.length > 0) {
          addDMELayer(m, navData.dmes);
          setDMELayerVisibility(m, navVisibility.dmes);
        }
        if (navData.ils.length > 0) {
          await addILSLayer(m, navData.ils);
          setILSLayerVisibility(m, navVisibility.ils);
        }
        if (navData.waypoints.length > 0) {
          addWaypointLayer(m, navData.waypoints.slice(0, 2000));
          setWaypointLayerVisibility(m, navVisibility.waypoints);
        }
        if (navData.airspaces.length > 0) {
          addAirspaceLayer(m, navData.airspaces);
          setAirspaceLayerVisibility(m, navVisibility.airspaces);
        }
      } catch (err) {
        window.appAPI.log.error('Nav layer update failed', err);
      }
    };

    updateNavLayers();
  }, [navData, navVisibility]);

  useEffect(() => {
    const m = map.current;
    if (!m || !airwaysFetched || !airwaysData) return;

    const updateAirwayLayers = () => {
      if (!m.isStyleLoaded()) {
        m.once('styledata', updateAirwayLayers);
        return;
      }

      try {
        if (navVisibility.airwaysMode === 'high' && airwaysData.highAirways.length > 0) {
          removeHighAirwayLayer(m);
          addHighAirwayLayer(m, airwaysData.highAirways);
          removeLowAirwayLayer(m);
        } else if (navVisibility.airwaysMode === 'low' && airwaysData.lowAirways.length > 0) {
          removeLowAirwayLayer(m);
          addLowAirwayLayer(m, airwaysData.lowAirways);
          removeHighAirwayLayer(m);
        } else {
          removeHighAirwayLayer(m);
          removeLowAirwayLayer(m);
        }
      } catch (err) {
        window.appAPI.log.error('Airway layer update failed', err);
      }
    };

    updateAirwayLayers();
  }, [airwaysData, airwaysFetched, navVisibility.airwaysMode]);

  useEffect(() => {
    const m = map.current;
    if (!m || !vatsimEnabled) return;

    const updateVatsim = () => {
      if (!m.isStyleLoaded()) {
        m.once('styledata', updateVatsim);
        return;
      }

      const bounds = m.getBounds();
      const pilotsInView = getPilotsInBounds(vatsimData, {
        north: bounds.getNorthEast().lat,
        south: bounds.getSouthWest().lat,
        east: bounds.getNorthEast().lng,
        west: bounds.getSouthWest().lng,
      });

      addVatsimPilotLayer(m, pilotsInView, selectedAirportData?.id);
      if (vatsimPopup.current) setupVatsimClickHandler(m, vatsimPopup.current);
    };

    const handleMoveEnd = () => {
      if (vatsimEnabled && vatsimData) updateVatsim();
    };

    m.on('moveend', handleMoveEnd);
    updateVatsim();

    return () => {
      m.off('moveend', handleMoveEnd);
    };
  }, [vatsimData, vatsimEnabled, selectedAirportData]);

  const closeSidebar = useCallback(() => {
    setShowSidebar(false);
    setSelectedFeature(null);
  }, [setShowSidebar, setSelectedFeature]);

  const navigateToGate = useCallback(
    (gate: { latitude: number; longitude: number; heading: number; name?: string }) => {
      if (!map.current) return;
      map.current.flyTo({
        center: [gate.longitude, gate.latitude],
        zoom: 18,
        duration: 1500,
        bearing: gate.heading,
      });
    },
    []
  );

  const selectGateAsStart = useCallback(
    (gate: { latitude: number; longitude: number; name: string }, featureId?: number) => {
      if (!selectedAirportData || !map.current) return;

      if (selectedGateId.current !== null) {
        map.current.setFeatureState(
          { source: 'airport-gates', id: selectedGateId.current },
          { selected: false }
        );
      }
      if (selectedRunwayEndId.current !== null) {
        map.current.setFeatureState(
          { source: 'airport-runway-ends', id: selectedRunwayEndId.current },
          { selected: false }
        );
        selectedRunwayEndId.current = null;
      }

      if (featureId !== undefined) {
        selectedGateId.current = featureId;
        map.current.setFeatureState({ source: 'airport-gates', id: featureId }, { selected: true });
      }

      setSelectedStartPosition({
        type: 'ramp',
        name: gate.name,
        airport: selectedAirportData.id,
        latitude: gate.latitude,
        longitude: gate.longitude,
      });

      navigateToGate({ ...gate, heading: 0 });
    },
    [selectedAirportData, setSelectedStartPosition, navigateToGate]
  );

  const selectRunwayEndAsStart = useCallback(
    (runwayEnd: { name: string; latitude: number; longitude: number }, featureId?: number) => {
      if (!selectedAirportData || !map.current) return;

      if (selectedRunwayEndId.current !== null) {
        map.current.setFeatureState(
          { source: 'airport-runway-ends', id: selectedRunwayEndId.current },
          { selected: false }
        );
      }
      if (selectedGateId.current !== null) {
        map.current.setFeatureState(
          { source: 'airport-gates', id: selectedGateId.current },
          { selected: false }
        );
        selectedGateId.current = null;
      }

      if (featureId !== undefined) {
        selectedRunwayEndId.current = featureId;
        map.current.setFeatureState(
          { source: 'airport-runway-ends', id: featureId },
          { selected: true }
        );
      }

      setSelectedStartPosition({
        type: 'runway',
        name: runwayEnd.name,
        airport: selectedAirportData.id,
        latitude: runwayEnd.latitude,
        longitude: runwayEnd.longitude,
      });

      map.current.flyTo({
        center: [runwayEnd.longitude, runwayEnd.latitude],
        zoom: 17,
        duration: 1500,
      });
    },
    [selectedAirportData, setSelectedStartPosition]
  );

  const navigateToRunway = useCallback((runway: Runway) => {
    if (!map.current) return;

    const e1 = runway.ends[0],
      e2 = runway.ends[1];
    const centerLat = (e1.latitude + e2.latitude) / 2;
    const centerLon = (e1.longitude + e2.longitude) / 2;

    const dLon = ((e2.longitude - e1.longitude) * Math.PI) / 180;
    const lat1 = (e1.latitude * Math.PI) / 180;
    const lat2 = (e2.latitude * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

    map.current.flyTo({
      center: [centerLon, centerLat],
      zoom: 16,
      duration: 1500,
      bearing: bearing - 90,
    });
  }, []);

  return (
    <div
      className="relative overflow-hidden bg-gray-950"
      style={{ width: '100vw', height: '100vh' }}
    >
      <div
        ref={mapContainer}
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
