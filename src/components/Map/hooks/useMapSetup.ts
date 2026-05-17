import { useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { getBasemapTheme } from '@/lib/map/basemapTheme';
import { resolveMapStyleArg } from '@/lib/map/tileUrlToStyle';
import { Airport } from '@/lib/xplaneServices/dataService';
import { useAppStore } from '@/stores/appStore';
import { useMapStore } from '@/stores/mapStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { ilsLayer } from '../layers/navigation';
import {
  setSelectedAirportIcao,
  setupAirportsLayer,
  updateAirportFavoriteFlags,
} from '../layers/world/AirportsLayer';
import { captureBasemapSnapshot, setup3DTerrain, setupGlobeProjection } from '../utils/globeUtils';
import { runWhenStyleIsReady } from './styleReadiness';

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

  // Subscribe so the star markers re-render when the user toggles a
  // favourite or sets a different home airport mid-session. Selectors are
  // referentially stable when the values don't change.
  const favoriteIcaos = useSettingsStore((s) => s.airports.favoriteIcaos);
  const homeIcao = useSettingsStore((s) => s.airports.homeIcao);
  const favoriteIcaoSet = useMemo(() => new Set(favoriteIcaos), [favoriteIcaos]);

  const { setCurrentZoom, setMapBearing } = useMapStore();

  const setCurrentZoomRef = useRef(setCurrentZoom);
  const setMapBearingRef = useRef(setMapBearing);

  // Hide the planet-marker for the currently-open airport once we zoom in
  // far enough that apt.dat detail layers carry the visual. Hoisted up
  // here so `setupAirportsLayer` can pick up its initial value at map-load
  // time (the live-update effect below handles subsequent changes).
  const selectedIcao = useAppStore((s) => s.selectedICAO);

  // Refs let the map-setup effect read the latest favourites/home at the
  // moment it fires `setupAirportsLayer`, without making them effect deps
  // (which would recreate the whole map on every favourite toggle).
  const favoriteIcaoSetRef = useRef(favoriteIcaoSet);
  const homeIcaoRef = useRef(homeIcao);
  const selectedIcaoRef = useRef(selectedIcao);
  const airportsRef = useRef(airports);

  useEffect(() => {
    onAirportClickRef.current = onAirportClick;
    setCurrentZoomRef.current = setCurrentZoom;
    setMapBearingRef.current = setMapBearing;
    favoriteIcaoSetRef.current = favoriteIcaoSet;
    homeIcaoRef.current = homeIcao;
    selectedIcaoRef.current = selectedIcao;
    airportsRef.current = airports;
  });

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const rawMap = new maplibregl.Map({
      container: mapContainerRef.current,
      style: resolveMapStyleArg(mapStyleUrl),
      center: [0, 30],
      zoom: 2,
      pitch: 0,
      bearing: 0,
      // Capped to keep airport markers clickable (#79). The default-allowed
      // 85° puts the horizon in the upper third of the viewport, which is
      // where the picker dead zone starts. 70° gives a noticeable 3D feel
      // without (typically) crossing into the broken range; revisit when
      // the underlying high-pitch hit-testing bug is fixed.
      maxPitch: 70,
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
            url.includes('arcgisonline.com') ||
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
    // Expose map instance for DevTools debugging (dev only)
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as Record<string, unknown>).__map = map;
    }

    map.addControl(new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }), 'bottom-left');
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-left');
    const cleanupIlsOverlayAttach = runWhenStyleIsReady(map, () => {
      ilsLayer.attachTo(map);
    });

    // maplibre-gl 5.x raises rejected promises out the side of its tile
    // image-fetch path that don't go through `map.on('error')`. They surface
    // in DevTools as "Uncaught (in promise) TypeError: Cannot read properties
    // of undefined (reading 'signal')" and flood the console on every
    // projection swap. Filter them at the window level — the message is
    // specific enough that we won't swallow real rejections.
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = (event.reason as { message?: unknown } | null)?.message;
      if (typeof msg === 'string' && msg.includes("reading 'signal'")) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    map.on('error', (e) => {
      // TODO: DEM tiles served as .webp via tile-cache:// trigger spurious "Could not
      // load image" errors in MapLibre's raster-dem decoder. The tiles decode correctly
      // for terrain/hillshade — this is log noise. Revisit when upgrading MapLibre or
      // switching DEM tile providers.
      const ev = e as unknown as Record<string, unknown>;
      if (ev.sourceId === 'terrain-dem' || ev.sourceId === 'terrain-hillshade-dem') return;

      // maplibre-gl 5.x bug: when `setProjection` reloads raster tiles, the
      // internal `getImage` call paths a request object missing its
      // AbortController.signal, throwing
      // `Cannot read properties of undefined (reading 'signal')`. The tile
      // still ends up loading via the normal flow — this is purely the side
      // channel rejection and floods the log on every projection swap.
      // Suppress until we upgrade/downgrade maplibre-gl past the regression.
      const errMsg = e.error?.message ?? '';
      if (typeof errMsg === 'string' && errMsg.includes("reading 'signal'")) return;

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
      // Snapshot the basemap's source/layer IDs BEFORE any app-added custom
      // sources/layers. preserveCustomStyle relies on this to decide what to
      // drop on style changes.
      captureBasemapSnapshot(map);
      setupGlobeProjection(map);
      setup3DTerrain(map);
      setupAirportsLayer(
        map,
        airports,
        getBasemapTheme(mapStyleUrl),
        favoriteIcaoSetRef.current,
        homeIcaoRef.current,
        selectedIcaoRef.current
      );
      setupAirportPopup(map, airportPopupRef, (icao: string, coords: [number, number]) =>
        onAirportClickRef.current(icao, coords)
      );
      setupVatsimPopup(vatsimPopupRef);
      setupMapEvents(
        map,
        (zoom: number) => setCurrentZoomRef.current(zoom),
        (bearing: number) => setMapBearingRef.current(bearing)
      );

      // The deck.gl ILS overlay is attached as soon as the style object is
      // usable (above), not from this `load` handler. `load` waits for all
      // sources to settle; airport animations/source churn can keep that
      // false even after the style can safely accept controls/layers.
    });

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      cleanupIlsOverlayAttach();
      ilsLayer.detachFrom(map);
      map.remove();
    };
    // Note: mapStyleUrl changes are handled by Map/index.tsx style change handler
    // to preserve map state. Only recreate map when airports change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airports]);

  // Live-refresh the starred-airport markers when the user toggles a
  // favourite or sets a home in any other component. No-op until the map
  // has finished loading and the source exists.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    updateAirportFavoriteFlags(map, airportsRef.current, favoriteIcaoSet, homeIcao);
  }, [favoriteIcaoSet, homeIcao]);

  // Live-refresh the selected-airport fade. If the style isn't loaded yet
  // (e.g. cold-start auto-nav fires before `map.on('load', …)` resolves),
  // `setupAirportsLayer` re-applies it from selectedIcaoRef at the end of
  // setup so we don't miss the initial selection.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setSelectedAirportIcao(map, selectedIcao);
  }, [selectedIcao]);

  return {
    mapRef,
    mapContainerRef: mapContainerRef as React.RefObject<HTMLDivElement>,
    airportPopupRef,
    vatsimPopupRef,
  };
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
