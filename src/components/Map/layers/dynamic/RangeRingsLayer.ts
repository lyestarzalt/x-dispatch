/**
 * Range Rings Layer
 *
 * Renders aircraft-category reach circles with labels embedded along the ring line.
 * Uses MapLibre symbol-placement: 'line' (same technique as contour elevation labels).
 */
import maplibregl from 'maplibre-gl';
import { destinationPoint, nauticalMilesToMeters } from '@/lib/utils/geomath';
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
const RING_LABEL_LAYER_ID = 'range-rings-labels';
const RING_SOURCE_ID = 'range-rings-source';

export const RANGE_RINGS_LAYER_IDS = [RING_LINE_LAYER_ID, RING_LABEL_LAYER_ID];

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
// Public API
// ============================================================================

export function addRangeRingsLayer(map: maplibregl.Map, config: RangeRingsConfig): void {
  if (!map.getStyle()) return;

  removeRangeRingsLayer(map);
  if (config.categories.length === 0) return;

  map.addSource(RING_SOURCE_ID, { type: 'geojson', data: createRingsGeoJSON(config) });

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
}

export function removeRangeRingsLayer(map: maplibregl.Map): void {
  try {
    if (map.getLayer(RING_LABEL_LAYER_ID)) map.removeLayer(RING_LABEL_LAYER_ID);
    if (map.getLayer(RING_LINE_LAYER_ID)) map.removeLayer(RING_LINE_LAYER_ID);
    if (map.getSource(RING_SOURCE_ID)) map.removeSource(RING_SOURCE_ID);
  } catch {
    // Silently ignore if map is in a bad state
  }
}

export function updateRangeRings(map: maplibregl.Map, config: RangeRingsConfig | null): void {
  if (!config || config.categories.length === 0) {
    removeRangeRingsLayer(map);
  } else {
    addRangeRingsLayer(map, config);
  }
}
