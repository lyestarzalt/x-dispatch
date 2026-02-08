import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { Airport } from '@/lib/xplaneData';
import { useMapStore } from '@/stores/mapStore';
import { setup3DTerrain, setupGlobeProjection } from '../utils/globeUtils';

export type MapRef = React.RefObject<maplibregl.Map | null>;
export type PopupRef = React.MutableRefObject<maplibregl.Popup | null>;

interface UseMapSetupOptions {
  airports: Airport[];
  mapStyleUrl: string;
  onAirportClick: (icao: string) => Promise<void>;
}

interface UseMapSetupReturn {
  mapRef: MapRef;
  mapContainerRef: React.RefObject<HTMLDivElement>;
  airportPopupRef: PopupRef;
  vatsimPopupRef: PopupRef;
}

export function useMapSetup({
  airports,
  mapStyleUrl,
  onAirportClick,
}: UseMapSetupOptions): UseMapSetupReturn {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const airportPopupRef = useRef<maplibregl.Popup | null>(null);
  const vatsimPopupRef = useRef<maplibregl.Popup | null>(null);

  const { setCurrentZoom, setMapBearing } = useMapStore();

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
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

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }), 'bottom-left');

    map.on('error', (e) => {
      window.appAPI.log.error('MapLibre error', e.error);
    });

    map.on('load', () => {
      setupGlobeProjection(map);
      setup3DTerrain(map);
      setupAirportsLayer(map, airports);
      setupAirportPopup(map, airportPopupRef, onAirportClick);
      setupVatsimPopup(vatsimPopupRef);
      setupMapEvents(map, setCurrentZoom, setMapBearing);
    });

    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airports]);

  return {
    mapRef,
    mapContainerRef: mapContainerRef as React.RefObject<HTMLDivElement>,
    airportPopupRef,
    vatsimPopupRef,
  };
}

export function setupAirportsLayer(map: maplibregl.Map, airports: Airport[]) {
  const features = airports.map((airport) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [airport.lon, airport.lat] },
    properties: { icao: airport.icao, name: airport.name },
  }));

  map.addSource('airports', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  });

  map.addLayer({
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

  map.addLayer({
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

  map.addLayer({
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

  // Hitbox layer for easier clicking
  map.addLayer({
    id: 'airports-hitbox',
    type: 'circle',
    source: 'airports',
    minzoom: 4,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 10, 6, 14, 10, 18, 14, 22],
      'circle-color': 'transparent',
      'circle-opacity': 0,
    },
  });
}

function setupAirportPopup(
  map: maplibregl.Map,
  popupRef: PopupRef,
  onAirportClick: (icao: string) => Promise<void>
) {
  popupRef.current = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: 'airport-popup',
  });

  map.on('mouseenter', 'airports-hitbox', (e) => {
    if (!e.features || e.features[0].geometry.type !== 'Point') return;
    map.getCanvas().style.cursor = 'pointer';

    const coordinates = e.features[0].geometry.coordinates.slice() as [number, number];
    const { name, icao } = e.features[0].properties as { name: string; icao: string };

    popupRef.current
      ?.setLngLat(coordinates)
      .setHTML(
        `<div class="bg-card text-foreground px-3 py-2 rounded-lg border border-border"><div class="font-mono font-bold text-info">${icao}</div><div class="text-muted-foreground text-xs">${name}</div></div>`
      )
      .addTo(map);
  });

  map.on('mouseleave', 'airports-hitbox', () => {
    map.getCanvas().style.cursor = '';
    popupRef.current?.remove();
  });

  map.on('click', 'airports-hitbox', async (e) => {
    if (!e.features || !e.features[0].properties?.icao) return;
    if (e.features[0].geometry.type !== 'Point') return;
    const icao = e.features[0].properties.icao;
    await onAirportClick(icao);
  });
}

function setupVatsimPopup(popupRef: PopupRef) {
  popupRef.current = new maplibregl.Popup({
    closeButton: true,
    closeOnClick: true,
    className: 'vatsim-popup',
    maxWidth: '300px',
  });
}

function setupMapEvents(
  map: maplibregl.Map,
  setCurrentZoom: (zoom: number) => void,
  setMapBearing: (bearing: number) => void
) {
  map.on('zoomend', () => {
    setCurrentZoom(map.getZoom());
  });

  map.on('rotate', () => {
    setMapBearing(map.getBearing());
  });

  setCurrentZoom(map.getZoom());
}
