import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { Airport } from '@/lib/xplaneServices/dataService';
import { useMapStore } from '@/stores/mapStore';
import { setup3DTerrain, setupGlobeProjection } from '../utils/globeUtils';

// ============================================================================
// Safe Map Proxy
// ============================================================================
// Wraps MapLibre map to prevent crashes after map.remove() is called.
// After destruction, all method calls become safe no-ops.

const DESTROYED_MAPS = new WeakSet<maplibregl.Map>();

function createSafeMapProxy(map: maplibregl.Map): maplibregl.Map {
  const handler: ProxyHandler<maplibregl.Map> = {
    get(target, prop) {
      // Check if this map has been destroyed
      if (DESTROYED_MAPS.has(target)) {
        // Return safe no-op values
        if (typeof prop === 'string') {
          // Methods that return boolean
          if (prop === 'hasImage' || prop === 'isStyleLoaded' || prop === 'loaded') {
            return () => false;
          }
          // Methods that return objects/values - return undefined
          if (
            prop === 'getLayer' ||
            prop === 'getSource' ||
            prop === 'getStyle' ||
            prop === 'getCanvas' ||
            prop === 'getContainer' ||
            prop === 'getBounds' ||
            prop === 'getCenter' ||
            prop === 'getFilter' ||
            prop === 'getPaintProperty' ||
            prop === 'getLayoutProperty'
          ) {
            return () => undefined;
          }
          // Numeric getters
          if (prop === 'getZoom' || prop === 'getBearing' || prop === 'getPitch') {
            return () => 0;
          }
        }
        // All other methods become no-ops
        const originalValue = Reflect.get(target, prop);
        if (typeof originalValue === 'function') {
          return () => undefined;
        }
        return undefined;
      }

      // Intercept remove() to mark as destroyed
      if (prop === 'remove') {
        return () => {
          DESTROYED_MAPS.add(target);
          target.remove();
        };
      }

      // Normal operation - bind functions to target
      const value = Reflect.get(target, prop);
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
  };

  return new Proxy(map, handler);
}

export type MapRef = React.RefObject<maplibregl.Map | null>;
export type PopupRef = React.MutableRefObject<maplibregl.Popup | null>;

interface UseMapSetupOptions {
  airports: Airport[];
  mapStyleUrl: string;
  onAirportClick: (icao: string, coords: [number, number]) => Promise<void>;
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

  const onAirportClickRef = useRef(onAirportClick);
  onAirportClickRef.current = onAirportClick;

  const { setCurrentZoom, setMapBearing } = useMapStore();

  const setCurrentZoomRef = useRef(setCurrentZoom);
  const setMapBearingRef = useRef(setMapBearing);
  setCurrentZoomRef.current = setCurrentZoom;
  setMapBearingRef.current = setMapBearing;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const rawMap = new maplibregl.Map({
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
      transformRequest: (url, resourceType) => {
        // Only cache tile data — skip style JSON, glyphs, and sprites
        if (resourceType !== 'Tile') return { url };
        if (
          url.startsWith('https://') &&
          (url.includes('tiles.openfreemap.org') ||
            url.includes('basemaps.cartocdn.com') ||
            url.includes('tiles.mapterhorn.com') ||
            url.includes('rainviewer.com'))
        ) {
          return { url: url.replace('https://', 'tile-cache://') };
        }
        return { url };
      },
    });

    // Wrap with proxy for safe access after destruction
    const map = createSafeMapProxy(rawMap);
    mapRef.current = map;

    map.addControl(new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }), 'bottom-left');
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-left');

    map.on('error', (e) => {
      // TODO: DEM tiles served as .webp via tile-cache:// trigger spurious "Could not
      // load image" errors in MapLibre's raster-dem decoder. The tiles decode correctly
      // for terrain/hillshade — this is log noise. Revisit when upgrading MapLibre or
      // switching DEM tile providers.
      const ev = e as unknown as Record<string, unknown>;
      if (ev.sourceId === 'terrain-dem' || ev.sourceId === 'terrain-hillshade-dem') return;

      const parts: string[] = [];
      if (ev.sourceId) parts.push(`source: ${ev.sourceId}`);
      if (ev.tileId) parts.push(`tile: ${JSON.stringify(ev.tileId)}`);
      const detail = parts.length ? ` [${parts.join(', ')}]` : '';
      window.appAPI.log.error(`MapLibre error${detail}`, e.error?.message ?? e.error);
    });

    // TODO: Remove this patch when upgrading to MapLibre >= 5.22 (5.21 has a projection regression).
    // Monkey-patch: guard against partial layout in _updatePlacement.
    // MapLibre 5.19.0 crashes when a layer's source cache isn't ready during placement.
    // Fixed upstream in 5.21.0 (PR #7079) but that version has a projection regression.
    // This wraps _updatePlacement in a try/catch to suppress the crash.

    const origRender = (map as any)._render;

    (map as any)._render = function (paintStartTimeStamp?: number) {
      try {
        return origRender.call(this, paintStartTimeStamp);
      } catch (e) {
        if (e instanceof TypeError && (e as Error).message?.includes("reading 'get'")) {
          // Suppress known MapLibre placement crash — harmless, layers still render
          return;
        }
        throw e;
      }
    };

    map.on('load', () => {
      setupGlobeProjection(map);
      setup3DTerrain(map);
      setupAirportsLayer(map, airports);
      setupAirportPopup(map, airportPopupRef, (icao: string, coords: [number, number]) =>
        onAirportClickRef.current(icao, coords)
      );
      setupVatsimPopup(vatsimPopupRef);
      setupMapEvents(
        map,
        (zoom: number) => setCurrentZoomRef.current(zoom),
        (bearing: number) => setMapBearingRef.current(bearing)
      );
    });

    return () => {
      map.remove();
    };
    // Note: mapStyleUrl changes are handled by Map/index.tsx style change handler
    // to preserve map state. Only recreate map when airports change.
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
  const COLOR_DEFAULT = '#4a90d9';
  const COLOR_CUSTOM = '#e8c36a';

  // Clean pin marker for custom airports — uses --warning amber token (#d4a017)
  const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="28" viewBox="0 0 20 28">
    <path d="M10 0C4.5 0 0 4.5 0 10c0 7 10 18 10 18s10-11 10-18C20 4.5 15.5 0 10 0z"
          fill="#d4a017" stroke="rgba(255,255,255,0.8)" stroke-width="1.2"/>
    <circle cx="10" cy="10" r="2.5" fill="#fff" opacity="0.95"/>
  </svg>`;

  const pinImage = new Image();
  pinImage.onload = () => {
    if (!map.hasImage('custom-pin')) {
      map.addImage('custom-pin', pinImage, { sdf: false });
    }
  };
  pinImage.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pinSvg);

  const features = airports.map((airport) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [airport.lon, airport.lat] },
    properties: {
      icao: airport.icao,
      name: airport.name,
      isCustom: airport.isCustom ? 1 : 0,
      type: airport.type,
      surfaceType: airport.surfaceType,
      runwayCount: airport.runwayCount,
      elevation: airport.elevation,
      country: airport.country ?? '',
    },
  }));

  map.addSource('airports', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  });

  const filterCustom: maplibregl.FilterSpecification = ['==', ['get', 'isCustom'], 1];
  const filterDefault: maplibregl.FilterSpecification = ['==', ['get', 'isCustom'], 0];

  // === CUSTOM AIRPORTS: Clean gold pin marker ===
  map.addLayer({
    id: 'airports-custom',
    type: 'symbol',
    source: 'airports',
    filter: filterCustom,
    layout: {
      'icon-image': 'custom-pin',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.35, 4, 0.5, 8, 0.7, 12, 0.85],
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
    },
  });

  // === DEFAULT AIRPORTS: Subtle blue ===

  // Default glow
  map.addLayer({
    id: 'airports-glow',
    type: 'circle',
    source: 'airports',
    filter: filterDefault,
    paint: {
      'circle-color': COLOR_DEFAULT,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 5, 4, 8, 6, 12, 8],
      'circle-blur': 0.6,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.05, 5, 0.1, 8, 0.2],
    },
  });

  // Default airport dots
  map.addLayer({
    id: 'airports',
    type: 'circle',
    source: 'airports',
    filter: filterDefault,
    paint: {
      'circle-color': COLOR_DEFAULT,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 3, 1, 6, 3, 10, 5, 14, 6],
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 0, 4, 0.5, 8, 1],
      'circle-stroke-color': '#ffffff',
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 4, 0.6, 6, 0.9, 8, 1],
    },
  });

  // Labels - appear at zoom 6+
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
      'text-color': ['case', ['==', ['get', 'isCustom'], 1], '#e8c36a', '#cccccc'],
      'text-halo-color': '#000000',
      'text-halo-width': 1,
    },
  });

  // Hitbox layer for easier clicking - visible at all zoom levels
  map.addLayer({
    id: 'airports-hitbox',
    type: 'circle',
    source: 'airports',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 6, 4, 10, 6, 14, 10, 18, 14, 22],
      'circle-color': 'transparent',
      'circle-opacity': 0,
    },
  });
}

export function setupAirportPopup(
  map: maplibregl.Map,
  popupRef: PopupRef,
  onAirportClick: (icao: string, coords: [number, number]) => Promise<void>
) {
  popupRef.current = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: 'airport-popup',
  });

  map.on('mouseenter', 'airports-hitbox', (e) => {
    const feature = e.features?.[0];
    if (!feature || feature.geometry.type !== 'Point') return;
    map.getCanvas().style.cursor = 'pointer';

    const coordinates = feature.geometry.coordinates.slice() as [number, number];
    const { name, icao } = feature.properties as { name: string; icao: string };

    popupRef.current
      ?.setLngLat(coordinates)
      .setHTML(
        `<div class="bg-card text-foreground px-3 py-2 rounded-lg border border-border"><div class="font-mono font-bold text-info">${icao}</div><div class="text-muted-foreground text-sm">${name}</div></div>`
      )
      .addTo(map);
  });

  map.on('mouseleave', 'airports-hitbox', () => {
    map.getCanvas().style.cursor = '';
    popupRef.current?.remove();
  });

  map.on('click', 'airports-hitbox', async (e) => {
    const feature = e.features?.[0];
    if (!feature?.properties?.icao) return;
    if (feature.geometry.type !== 'Point') return;
    const icao = feature.properties.icao as string;
    const coords = feature.geometry.coordinates.slice() as [number, number];
    await onAirportClick(icao, coords);
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
