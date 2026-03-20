/**
 * Range Rings Layer
 *
 * Renders aircraft-category reach circles with labels embedded along the ring line.
 * Uses MapLibre symbol-placement: 'line' (same technique as contour elevation labels).
 * Includes a drag handle on the outermost ring to interactively resize all rings.
 */
import maplibregl from 'maplibre-gl';
import { destinationPoint, haversineDistance, nauticalMilesToMeters } from '@/lib/utils/geomath';
import type { RangeRingCategory } from '@/types/layers';

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
const RING_SOURCE_ID = 'range-rings-source';

export const RANGE_RINGS_LAYER_IDS = [
  RING_LINE_LAYER_ID,
  RING_GLOW_LAYER_ID,
  RING_HITBOX_LAYER_ID,
  RING_LABEL_LAYER_ID,
];

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

function createRingsGeoJSON(config: RangeRingsConfig): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const cat of config.categories) {
    const radiusNm = cat.speed * config.durationHours;
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: generateCircleCoords(config.centerLat, config.centerLon, radiusNm),
      },
      properties: {
        color: cat.color,
        label: `${cat.label} · ${Math.round(radiusNm)}nm · ${config.durationHours}h`,
      },
    });
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
      const hours = Math.max(0.5, Math.round((distNm / maxSpeed) * 10) / 10);

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
      const finalHours = Math.max(
        0.5,
        Math.round((finalDist / METERS_PER_NM / maxSpeed) * 10) / 10
      );
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
  if (!dragState) return;
  const { map, onEnter, onLeave, onDown, onMove, onUp } = dragState;

  // Remove layer-bound listeners
  map.off('mouseenter', RING_HITBOX_LAYER_ID, onEnter);
  map.off('mouseleave', RING_HITBOX_LAYER_ID, onLeave);
  map.off('mousedown', RING_HITBOX_LAYER_ID, onDown);

  // Remove active drag listeners if mid-drag
  if (onMove) map.off('mousemove', onMove);
  if (onUp) map.off('mouseup', onUp);

  map.dragPan.enable();
  map.getCanvas().style.cursor = '';
  dragState = null;
}

// ============================================================================
// Public API
// ============================================================================

export function addRangeRingsLayer(
  map: maplibregl.Map,
  config: RangeRingsConfig,
  onDurationChange?: (hours: number) => void
): void {
  if (!map.getStyle()) return;

  removeRangeRingsLayer(map);
  if (config.categories.length === 0) return;

  map.addSource(RING_SOURCE_ID, { type: 'geojson', data: createRingsGeoJSON(config) });

  // Glow layer — hidden by default, shown on hover
  map.addLayer({
    id: RING_GLOW_LAYER_ID,
    type: 'line',
    source: RING_SOURCE_ID,
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
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1.2,
      'line-opacity': 0.5,
      'line-dasharray': [6, 4],
    },
  });

  // Invisible fat hitbox for easy grabbing (20px wide, fully transparent)
  map.addLayer({
    id: RING_HITBOX_LAYER_ID,
    type: 'line',
    source: RING_SOURCE_ID,
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
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 400,
      'text-field': ['get', 'label'],
      'text-font': ['Open Sans Regular'],
      'text-size': 11,
      'text-letter-spacing': 0.05,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': 'rgba(0, 0, 0, 0.8)',
      'text-halo-width': 1.5,
      'text-opacity': 0.8,
    },
  });

  // Interactive drag on ring lines
  setupRingDrag(map, config, onDurationChange);
}

export function removeRangeRingsLayer(map: maplibregl.Map): void {
  teardownRingDrag();
  try {
    if (map.getLayer(RING_HITBOX_LAYER_ID)) map.removeLayer(RING_HITBOX_LAYER_ID);
    if (map.getLayer(RING_LABEL_LAYER_ID)) map.removeLayer(RING_LABEL_LAYER_ID);
    if (map.getLayer(RING_LINE_LAYER_ID)) map.removeLayer(RING_LINE_LAYER_ID);
    if (map.getLayer(RING_GLOW_LAYER_ID)) map.removeLayer(RING_GLOW_LAYER_ID);
    if (map.getSource(RING_SOURCE_ID)) map.removeSource(RING_SOURCE_ID);
  } catch {
    // Silently ignore if map is in a bad state
  }
}

export function updateRangeRings(
  map: maplibregl.Map,
  config: RangeRingsConfig | null,
  onDurationChange?: (hours: number) => void
): void {
  if (!config || config.categories.length === 0) {
    removeRangeRingsLayer(map);
  } else {
    addRangeRingsLayer(map, config, onDurationChange);
  }
}
