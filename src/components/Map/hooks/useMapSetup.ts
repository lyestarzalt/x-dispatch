import { useEffect, useMemo, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { getBasemapTheme } from '@/lib/map/basemapTheme';
import '@/lib/map/maplibreWorker';
import { terrainShadingAllowed } from '@/lib/map/terrainShading';
import { resolveMapStyleArg } from '@/lib/map/tileUrlToStyle';
import { ATC_ROLE_COLORS, stationLabel } from '@/lib/networkTraffic/atcRoles';
import type { DistanceUnit } from '@/lib/utils/units';
import { Airport } from '@/lib/xplaneServices/dataService';
import { useAppStore } from '@/stores/appStore';
import { useMapStore } from '@/stores/mapStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { EnrichedFlightPlan } from '@/types/fms';
import { ilsLayer } from '../layers/navigation';
import { overlayClaimsClick } from '../layers/types';
import {
  applyAirportEmphasis,
  setupAirportsLayer,
  updateAirportFavoriteFlags,
} from '../layers/world/AirportsLayer';
import { setupNavInfoClicks } from '../navInfo';
import { captureBasemapSnapshot, setup3DTerrain, setupGlobeProjection } from '../utils/globeUtils';
import { runWhenStyleIsReady } from './styleReadiness';

// ============================================================================
// Safe Map Proxy
// ============================================================================
// Wraps MapLibre map to prevent crashes after map.remove() is called.
// After destruction, all method calls become safe no-ops.

const DESTROYED_MAPS = new WeakSet<maplibregl.Map>();

/** Our DistanceUnit -> MapLibre ScaleControl's unit option. */
function distanceUnitToScaleUnit(unit: DistanceUnit): 'imperial' | 'metric' | 'nautical' {
  if (unit === 'nm') return 'nautical';
  if (unit === 'mi') return 'imperial';
  return 'metric';
}

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

/**
 * MapLibre caps the canvas at 4096px per side and silently lowers the pixel
 * ratio to fit, which blurs the map on large HiDPI windows. Lift the cap to
 * what the GPU can actually back.
 */
/**
 * Capped to keep airport markers clickable (#79). The default-allowed 85° puts
 * the horizon in the upper third of the viewport, where the picker dead zone
 * starts. 70° gives a noticeable 3D feel without (typically) crossing into the
 * broken range. "Tilt the map" off sets it to 0: with 3D terrain on, tilting
 * roughly doubles the map's video memory (measured over LOWI, 2026-11-10).
 */
const MAX_PITCH = 70;

function maxCanvasSizeForGpu(): [number, number] {
  const gl = document.createElement('canvas').getContext('webgl2');
  const size = gl?.getParameter(gl.MAX_TEXTURE_SIZE);
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  return typeof size === 'number' && size > 4096 ? [size, size] : [4096, 4096];
}

export type MapRef = React.RefObject<maplibregl.Map | null>;
export type PopupRef = React.MutableRefObject<maplibregl.Popup | null>;

interface UseMapSetupOptions {
  airports: Airport[];
  mapStyleUrl: string;
  onAirportClick: (icao: string, coords: [number, number]) => Promise<void>;
  flightPlan: EnrichedFlightPlan | null;
}

interface UseMapSetupReturn {
  mapRef: MapRef;
  mapContainerRef: React.RefObject<HTMLDivElement>;
  airportPopupRef: PopupRef;
}

export function useMapSetup({
  airports,
  mapStyleUrl,
  onAirportClick,
  flightPlan,
}: UseMapSetupOptions): UseMapSetupReturn {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const airportPopupRef = useRef<maplibregl.Popup | null>(null);
  const scaleControlRef = useRef<maplibregl.ScaleControl | null>(null);

  // Per the unit system (CLAUDE.md "unit display" rule): the scale bar
  // follows the user's distance preference instead of a hardcoded unit.
  const distanceUnit = useSettingsStore((s) => s.map.units.distance);

  const onAirportClickRef = useRef(onAirportClick);

  // Subscribe so the star markers re-render when the user toggles a
  // favourite or sets a different home airport mid-session. Selectors are
  // referentially stable when the values don't change.
  const favoriteIcaos = useSettingsStore((s) => s.airports.favoriteIcaos);
  const homeIcao = useSettingsStore((s) => s.airports.homeIcao);
  const favoriteIcaoSet = useMemo(() => new Set(favoriteIcaos), [favoriteIcaos]);

  // Select the two stable actions rather than the whole store — a whole-store
  // subscription re-renders the Map host on every transient write (cursor
  // elevation publishes per mousemove).
  const setCurrentZoom = useMapStore((s) => s.setCurrentZoom);
  const setMapBearing = useMapStore((s) => s.setMapBearing);
  const mapTiltEnabled = useMapStore((s) => s.mapTiltEnabled);

  const setCurrentZoomRef = useRef(setCurrentZoom);
  const setMapBearingRef = useRef(setMapBearing);

  // Hide the planet-marker for the currently-open airport once we zoom in
  // far enough that apt.dat detail layers carry the visual. Hoisted up
  // here so `setupAirportsLayer` can pick up its initial value at map-load
  // time (the live-update effect below handles subsequent changes).
  const selectedIcao = useAppStore((s) => s.selectedICAO);
  const hasRoute = flightPlan !== null && flightPlan.waypoints.length >= 2;
  const departureIcao = flightPlan?.departure.icao;
  const arrivalIcao = flightPlan?.arrival.icao;
  const alternateIcao = flightPlan?.alternate?.icao;
  const routeIcaos = useMemo(
    () =>
      hasRoute
        ? [departureIcao, arrivalIcao, alternateIcao].flatMap((icao) =>
            icao ? [icao.toUpperCase()] : []
          )
        : [],
    [hasRoute, departureIcao, arrivalIcao, alternateIcao]
  );

  // Refs let the map-setup effect read the latest favourites/home at the
  // moment it fires `setupAirportsLayer`, without making them effect deps
  // (which would recreate the whole map on every favourite toggle).
  const favoriteIcaoSetRef = useRef(favoriteIcaoSet);
  const homeIcaoRef = useRef(homeIcao);
  const selectedIcaoRef = useRef(selectedIcao);
  const routeIcaosRef = useRef(routeIcaos);
  const airportsRef = useRef(airports);

  useEffect(() => {
    onAirportClickRef.current = onAirportClick;
    setCurrentZoomRef.current = setCurrentZoom;
    setMapBearingRef.current = setMapBearing;
    favoriteIcaoSetRef.current = favoriteIcaoSet;
    homeIcaoRef.current = homeIcao;
    selectedIcaoRef.current = selectedIcao;
    routeIcaosRef.current = routeIcaos;
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
      maxPitch: useMapStore.getState().mapTiltEnabled ? MAX_PITCH : 0,
      maxCanvasSize: maxCanvasSizeForGpu(),
      // Keep parsed tiles for more zoom levels so zooming out and back in or
      // panning back does not re-parse them; MapLibre defaults to 5.
      maxTileCacheZoomLevels: 10,
      // Let tiles from the zoom being left finish loading so detail arrives
      // progressively while zooming in instead of all at once at the end.
      cancelPendingTileRequestsWhileZooming: false,
      trackResize: true,
      refreshExpiredTiles: false,
    });

    // Wrap with proxy for safe access after destruction
    const map = createSafeMapProxy(rawMap);
    mapRef.current = map;
    // Expose map instance for DevTools debugging (dev only)
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as Record<string, unknown>).__map = map;
    }

    const scaleControl = new maplibregl.ScaleControl({
      maxWidth: 200,
      unit: distanceUnitToScaleUnit(distanceUnit),
    });
    map.addControl(scaleControl, 'bottom-left');
    scaleControlRef.current = scaleControl;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-left');
    const cleanupIlsOverlayAttach = runWhenStyleIsReady(map, () => {
      ilsLayer.attachTo(map);
    });

    map.on('error', (e) => {
      // TODO: .webp DEM tiles trigger spurious "Could not load image" errors in
      // MapLibre's raster-dem decoder. The tiles decode correctly for terrain and
      // hillshade, so this is log noise. Revisit when switching DEM tile providers.
      const ev = e as unknown as Record<string, unknown>;
      if (ev.sourceId === 'terrain-dem' || ev.sourceId === 'terrain-hillshade-dem') return;

      const parts: string[] = [];
      if (ev.sourceId) parts.push(`source: ${ev.sourceId}`);
      if (ev.tileId) parts.push(`tile: ${JSON.stringify(ev.tileId)}`);
      const detail = parts.length ? ` [${parts.join(', ')}]` : '';
      window.appAPI.log.error(`MapLibre error${detail}`, e.error?.message ?? e.error);
    });

    map.on('load', () => {
      // Snapshot the basemap's source/layer IDs BEFORE any app-added custom
      // sources/layers. preserveCustomStyle relies on this to decide what to
      // drop on style changes.
      captureBasemapSnapshot(map);
      setupGlobeProjection(map);
      setup3DTerrain(map, terrainShadingAllowed(mapStyleUrl));
      setupAirportsLayer(
        map,
        airportsRef.current,
        getBasemapTheme(mapStyleUrl),
        favoriteIcaoSetRef.current,
        homeIcaoRef.current,
        selectedIcaoRef.current,
        routeIcaosRef.current
      );
      setupAirportPopup(map, airportPopupRef, (icao: string, coords: [number, number]) =>
        onAirportClickRef.current(icao, coords)
      );
      setupNavInfoClicks(map);
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
      cleanupIlsOverlayAttach();
      ilsLayer.detachFrom(map);
      map.remove();
      // createSafeMapProxy turns every method into a no-op after remove(),
      // but the ref still points at the proxy, which is truthy. Every
      // `if (!map) return` guard therefore passes and callers operate on a
      // dead map whose getters return undefined. Clear the ref so those
      // guards actually fire.
      if (mapRef.current === map) mapRef.current = null;
      scaleControlRef.current = null;
    };
    // One map per mount. Hooks bind their events to the map once, through mapRef, so a
    // new map would leave them on the destroyed one: after an X-Plane install switch the
    // airport list changed after mount, and gates, the context menu and other clicks went
    // dead. A new airport list updates the existing map instead (effect below);
    // mapStyleUrl changes go through Map/index.tsx's style change handler and distanceUnit
    // through the scale bar effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new airport list (another X-Plane install, a custom scenery resync) goes into the
  // existing map's source. Until the map has loaded there is no source; `load` then
  // reads the latest list from airportsRef.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    updateAirportFavoriteFlags(map, airports, favoriteIcaoSetRef.current, homeIcaoRef.current);
  }, [airports]);

  // "Tilt the map" off holds the map flat; turning it off while tilted levels the view.
  useEffect(() => {
    mapRef.current?.setMaxPitch(mapTiltEnabled ? MAX_PITCH : 0);
  }, [mapTiltEnabled]);

  // Keep the scale bar's unit in sync with the user's distance preference.
  // MapLibre's ScaleControl supports changing this on an existing instance.
  useEffect(() => {
    scaleControlRef.current?.setUnit(distanceUnitToScaleUnit(distanceUnit));
  }, [distanceUnit]);

  // Live-refresh the starred-airport markers when the user toggles a
  // favourite or sets a home in any other component. No-op until the map
  // has finished loading and the source exists.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    updateAirportFavoriteFlags(map, airportsRef.current, favoriteIcaoSet, homeIcao);
  }, [favoriteIcaoSet, homeIcao]);

  // Airport layers may still be loading initially or during a basemap swap.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    return runWhenStyleIsReady(map, () => applyAirportEmphasis(map, selectedIcao, routeIcaos));
  }, [selectedIcao, routeIcaos]);

  return {
    mapRef,
    mapContainerRef: mapContainerRef as React.RefObject<HTMLDivElement>,
    airportPopupRef,
  };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c
  );
}

/** The positions online at the airport, one line each, for the hover tooltip. */
function onlineStationsHtml(icao: string): string {
  const staffing = useMapStore.getState().atcStaffing[icao.toUpperCase()];
  if (!staffing) return '';
  const rows = staffing.stations
    .map(
      (s) =>
        `<div class="flex justify-between gap-3"><span style="color:${ATC_ROLE_COLORS[s.role]}">${escapeHtml(stationLabel(s))}</span><span class="text-muted-foreground tabular-nums">${escapeHtml(s.frequency)}</span></div>`
    )
    .join('');
  return `<div class="mt-1.5 border-t border-border/40 pt-1.5 font-mono text-xs">${rows}</div>`;
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
        `<div class="bg-card text-foreground px-3 py-2 rounded-lg border border-border"><div class="font-mono font-bold text-info">${icao}</div><div class="text-muted-foreground text-sm">${name}</div>${onlineStationsHtml(icao)}</div>`
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
    // A network pilot or ATC badge over the airport takes the click.
    if (overlayClaimsClick(map, e.point)) return;
    const icao = feature.properties.icao as string;
    const coords = feature.geometry.coordinates.slice() as [number, number];
    await onAirportClick(icao, coords);
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
