/**
 * Range Rings Layer
 *
 * Renders aircraft-category reach circles with labels embedded along the ring line.
 * Uses MapLibre symbol-placement: 'line' (same technique as contour elevation labels).
 * Includes a drag handle on the outermost ring to interactively resize all rings.
 */
import * as maplibregl from 'maplibre-gl';
import { labelFont } from '@/lib/map/labelFonts';
import { destinationPoint, haversineDistance, nauticalMilesToMeters } from '@/lib/utils/geomath';
import type { RangeRingCategory } from '@/types/layers';
import { safeAddGeoJSONSource } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface RangeRingsConfig {
  centerLat: number;
  centerLon: number;
  durationHours: number;
  categories: { id: RangeRingCategory; color: string; speed: number; label: string }[];
}

// ============================================================================
// Constants
// ============================================================================

const RING_LINE_LAYER_ID = 'range-rings-line';
const RING_GLOW_LAYER_ID = 'range-rings-glow';
const RING_HITBOX_LAYER_ID = 'range-rings-hitbox';
const RING_LABEL_LAYER_ID = 'range-rings-labels';
const RING_TICKS_LAYER_ID = 'range-rings-ticks';
const RING_SOURCE_ID = 'range-rings-source';

export const RANGE_RINGS_LAYER_IDS = [
  RING_LINE_LAYER_ID,
  RING_GLOW_LAYER_ID,
  RING_HITBOX_LAYER_ID,
  RING_LABEL_LAYER_ID,
  RING_TICKS_LAYER_ID,
];

const ENTRANCE_MS = 450;

// ============================================================================
// Geometry
// ============================================================================

function generateCircleCoords(
  lat: number,
  lon: number,
  radiusNm: number,
  steps = 128
): [number, number][] {
  const radiusMeters = nauticalMilesToMeters(radiusNm) as number;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (360 / steps) * i;
    coords.push(destinationPoint(lat, lon, radiusMeters, bearing));
  }
  return coords;
}

function formatDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Bearing ticks on the outermost ring, every 30° with longer cardinal marks,
 * so the rings double as a compass rose.
 */
function createBearingTicks(
  lat: number,
  lon: number,
  radiusNm: number,
  color: string
): GeoJSON.Feature[] {
  const radiusMeters = nauticalMilesToMeters(radiusNm) as number;
  const features: GeoJSON.Feature[] = [];
  for (let bearing = 0; bearing < 360; bearing += 30) {
    const isCardinal = bearing % 90 === 0;
    const innerFraction = isCardinal ? 0.92 : 0.955;
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          destinationPoint(lat, lon, radiusMeters * innerFraction, bearing),
          destinationPoint(lat, lon, radiusMeters, bearing),
        ],
      },
      properties: { tick: true, color, cardinal: isCardinal },
    });
  }
  return features;
}

/** `scale` shrinks the radii during the entrance sweep; labels/ticks only at 1. */
function createRingsGeoJSON(config: RangeRingsConfig, scale = 1): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  let maxRadiusNm = 0;
  let outerColor = '';
  for (const cat of config.categories) {
    const radiusNm = cat.speed * config.durationHours * scale;
    if (radiusNm > maxRadiusNm) {
      maxRadiusNm = radiusNm;
      outerColor = cat.color;
    }
    const displayNm = Math.round((cat.speed * config.durationHours) / 5) * 5;
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: generateCircleCoords(config.centerLat, config.centerLon, radiusNm),
      },
      properties: {
        color: cat.color,
        label: `${cat.label} · ${displayNm} nm · ${formatDuration(config.durationHours)}`,
      },
    });
  }
  if (scale === 1 && maxRadiusNm > 0) {
    features.push(
      ...createBearingTicks(config.centerLat, config.centerLon, maxRadiusNm, outerColor)
    );
  }
  return { type: 'FeatureCollection', features };
}

// ============================================================================
// Interactive Ring Drag
// ============================================================================

const METERS_PER_NM = 1852;

// Stored references to clean up all listeners
let dragState: {
  map: maplibregl.Map;
  onEnter: () => void;
  onLeave: () => void;
  onDown: (e: maplibregl.MapLayerMouseEvent) => void;
  // Active drag listeners (only while dragging)
  onMove: ((e: maplibregl.MapMouseEvent) => void) | null;
  onUp: ((e: maplibregl.MapMouseEvent) => void) | null;
} | null = null;

function setupRingDrag(
  map: maplibregl.Map,
  config: RangeRingsConfig,
  onDurationChange: ((hours: number) => void) | undefined
): void {
  teardownRingDrag();
  if (!onDurationChange) return;

  const canvas = map.getCanvas();
  const maxSpeed = Math.max(...config.categories.map((c) => c.speed));
  let dragging = false;

  const onEnter = () => {
    canvas.style.cursor = 'ew-resize';
    if (map.getLayer(RING_GLOW_LAYER_ID)) {
      map.setPaintProperty(RING_GLOW_LAYER_ID, 'line-opacity', 0.4);
    }
    if (map.getLayer(RING_LINE_LAYER_ID)) {
      map.setPaintProperty(RING_LINE_LAYER_ID, 'line-width', 2);
      map.setPaintProperty(RING_LINE_LAYER_ID, 'line-opacity', 0.8);
    }
  };

  const onLeave = () => {
    if (dragging) return;
    canvas.style.cursor = '';
    if (map.getLayer(RING_GLOW_LAYER_ID)) {
      map.setPaintProperty(RING_GLOW_LAYER_ID, 'line-opacity', 0);
    }
    if (map.getLayer(RING_LINE_LAYER_ID)) {
      map.setPaintProperty(RING_LINE_LAYER_ID, 'line-width', 1.2);
      map.setPaintProperty(RING_LINE_LAYER_ID, 'line-opacity', 0.5);
    }
  };

  const onDown = (e: maplibregl.MapLayerMouseEvent) => {
    e.preventDefault();
    dragging = true;
    canvas.style.cursor = 'ew-resize';
    map.dragPan.disable();

    const onMove = (moveEvent: maplibregl.MapMouseEvent) => {
      const lngLat = moveEvent.lngLat;
      const distMeters = haversineDistance(
        config.centerLat,
        config.centerLon,
        lngLat.lat,
        lngLat.lng
      ) as number;
      const distNm = distMeters / METERS_PER_NM;
      // Snap to 15-minute steps, the granularity fuel planning talks in
      const hours = Math.max(0.5, Math.round((distNm / maxSpeed) * 4) / 4);

      const source = map.getSource(RING_SOURCE_ID) as maplibregl.GeoJSONSource;
      if (source) {
        source.setData(createRingsGeoJSON({ ...config, durationHours: hours }));
      }
    };

    const onUp = (upEvent: maplibregl.MapMouseEvent) => {
      dragging = false;
      canvas.style.cursor = '';
      map.dragPan.enable();
      map.off('mousemove', onMove);
      map.off('mouseup', onUp);
      if (dragState) {
        dragState.onMove = null;
        dragState.onUp = null;
      }

      // Reset glow/line to default
      onLeave();

      const lngLat = upEvent.lngLat;
      const finalDist = haversineDistance(
        config.centerLat,
        config.centerLon,
        lngLat.lat,
        lngLat.lng
      ) as number;
      const finalHours = Math.max(0.5, Math.round((finalDist / METERS_PER_NM / maxSpeed) * 4) / 4);
      onDurationChange(finalHours);
    };

    map.on('mousemove', onMove);
    map.on('mouseup', onUp);
    if (dragState) {
      dragState.onMove = onMove;
      dragState.onUp = onUp;
    }
  };

  map.on('mouseenter', RING_HITBOX_LAYER_ID, onEnter);
  map.on('mouseleave', RING_HITBOX_LAYER_ID, onLeave);
  map.on('mousedown', RING_HITBOX_LAYER_ID, onDown);

  dragState = { map, onEnter, onLeave, onDown, onMove: null, onUp: null };
}

function teardownRingDrag(): void {
  const state = dragState;
  if (!state) return;
  // Clear first so a throw below can't re-enter (and so the next setup sees a
  // clean slate even if cleanup partially fails).
  dragState = null;

  const { map, onEnter, onLeave, onDown, onMove, onUp } = state;

  // If the map was destroyed before teardown ran, `dragPan` is nulled out by
  // MapLibre's .remove(). Touching it (or any of the map's `.off` handlers)
  // throws. We hold a module-level reference to the map, so this is the
  // window we can land in. Skip cleanup — the map is already gone.
  if (!map.dragPan) return;

  try {
    map.off('mouseenter', RING_HITBOX_LAYER_ID, onEnter);
    map.off('mouseleave', RING_HITBOX_LAYER_ID, onLeave);
    map.off('mousedown', RING_HITBOX_LAYER_ID, onDown);
    if (onMove) map.off('mousemove', onMove);
    if (onUp) map.off('mouseup', onUp);
    map.dragPan.enable();
    map.getCanvas().style.cursor = '';
  } catch {
    // Map is mid-teardown between the dragPan check and these calls — nothing
    // to do.
  }
}

// ============================================================================
// Entrance sweep
// ============================================================================

let entranceFrame: number | null = null;

function cancelEntrance(): void {
  if (entranceFrame !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(entranceFrame);
  }
  entranceFrame = null;
}

function finishEntrance(map: maplibregl.Map, config: RangeRingsConfig): void {
  entranceFrame = null;
  const source = map.getSource(RING_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (source) source.setData(createRingsGeoJSON(config));
  if (map.getLayer(RING_LABEL_LAYER_ID)) {
    map.setPaintProperty(RING_LABEL_LAYER_ID, 'text-opacity', 0.8);
  }
  if (map.getLayer(RING_TICKS_LAYER_ID)) {
    map.setPaintProperty(RING_TICKS_LAYER_ID, 'line-opacity', 0.35);
  }
}

/** Rings sweep out from the airport; labels and ticks fade in once settled. */
function runEntrance(map: maplibregl.Map, config: RangeRingsConfig): void {
  cancelEntrance();
  const reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof requestAnimationFrame !== 'function' || reducedMotion) {
    finishEntrance(map, config);
    return;
  }

  const start = performance.now();
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const tick = (now: number) => {
    const source = map.getSource(RING_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      entranceFrame = null;
      return;
    }
    const t = Math.min(1, (now - start) / ENTRANCE_MS);
    if (t >= 1) {
      finishEntrance(map, config);
      return;
    }
    source.setData(createRingsGeoJSON(config, 0.2 + 0.8 * easeOutCubic(t)));
    entranceFrame = requestAnimationFrame(tick);
  };
  entranceFrame = requestAnimationFrame(tick);
}

// ============================================================================
// Public API
// ============================================================================

const NOT_TICK_FILTER: maplibregl.FilterSpecification = ['!', ['has', 'tick']];

export function addRangeRingsLayer(
  map: maplibregl.Map,
  config: RangeRingsConfig,
  onDurationChange?: (hours: number) => void
): void {
  if (!map.getStyle()) return;

  removeRangeRingsLayer(map);
  if (config.categories.length === 0) return;

  safeAddGeoJSONSource(map, RING_SOURCE_ID, createRingsGeoJSON(config, 0.2));

  // Glow layer — hidden by default, shown on hover
  map.addLayer({
    id: RING_GLOW_LAYER_ID,
    type: 'line',
    source: RING_SOURCE_ID,
    filter: NOT_TICK_FILTER,
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 8,
      'line-opacity': 0,
      'line-blur': 6,
    },
  });

  // Ring lines — dashed, colored per category
  map.addLayer({
    id: RING_LINE_LAYER_ID,
    type: 'line',
    source: RING_SOURCE_ID,
    filter: NOT_TICK_FILTER,
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1.2,
      'line-opacity': 0.5,
      'line-dasharray': [6, 4],
    },
  });

  // Bearing ticks on the outer ring — solid, faded in after the sweep
  map.addLayer({
    id: RING_TICKS_LAYER_ID,
    type: 'line',
    source: RING_SOURCE_ID,
    filter: ['has', 'tick'],
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['case', ['get', 'cardinal'], 1.6, 1],
      'line-opacity': 0,
      'line-opacity-transition': { duration: 300 },
    },
  });

  // Invisible fat hitbox for easy grabbing (20px wide, fully transparent)
  map.addLayer({
    id: RING_HITBOX_LAYER_ID,
    type: 'line',
    source: RING_SOURCE_ID,
    filter: NOT_TICK_FILTER,
    paint: {
      'line-color': '#000000',
      'line-width': 20,
      'line-opacity': 0,
    },
  });

  // Labels along the ring line — category, distance, duration
  map.addLayer({
    id: RING_LABEL_LAYER_ID,
    type: 'symbol',
    source: RING_SOURCE_ID,
    filter: NOT_TICK_FILTER,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 400,
      'text-field': ['get', 'label'],
      'text-font': labelFont(map, 'regular'),
      'text-size': 11,
      'text-letter-spacing': 0.05,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': 'rgba(0, 0, 0, 0.8)',
      'text-halo-width': 1.5,
      'text-opacity': 0,
      'text-opacity-transition': { duration: 300 },
    },
  });

  // Interactive drag on ring lines
  setupRingDrag(map, config, onDurationChange);

  runEntrance(map, config);
}

/**
 * Refresh ring radii in place (duration changes). Keeps the layers and drag
 * listeners, so there is no flicker after a resize drag.
 */
export function updateRangeRingsData(map: maplibregl.Map, config: RangeRingsConfig): void {
  const source = map.getSource(RING_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (!source) return;
  cancelEntrance();
  source.setData(createRingsGeoJSON(config));
}

export function removeRangeRingsLayer(map: maplibregl.Map): void {
  teardownRingDrag();
  cancelEntrance();
  try {
    if (map.getLayer(RING_HITBOX_LAYER_ID)) map.removeLayer(RING_HITBOX_LAYER_ID);
    if (map.getLayer(RING_LABEL_LAYER_ID)) map.removeLayer(RING_LABEL_LAYER_ID);
    if (map.getLayer(RING_TICKS_LAYER_ID)) map.removeLayer(RING_TICKS_LAYER_ID);
    if (map.getLayer(RING_LINE_LAYER_ID)) map.removeLayer(RING_LINE_LAYER_ID);
    if (map.getLayer(RING_GLOW_LAYER_ID)) map.removeLayer(RING_GLOW_LAYER_ID);
    if (map.getSource(RING_SOURCE_ID)) map.removeSource(RING_SOURCE_ID);
  } catch {
    // Silently ignore if map is in a bad state
  }
}
