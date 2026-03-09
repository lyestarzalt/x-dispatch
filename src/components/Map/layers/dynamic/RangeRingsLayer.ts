/**
 * Range Rings Layer
 *
 * Renders aircraft-category reach circles as clean dashed lines
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

const RING_LAYER_ID = 'range-rings-line';
const RING_SOURCE_ID = 'range-rings-source';

export const RANGE_RINGS_LAYER_IDS = [RING_LAYER_ID];

// ============================================================================
// Module State
// ============================================================================

let markers: maplibregl.Marker[] = [];

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
      properties: { color: cat.color },
    });
  }
  return { type: 'FeatureCollection', features };
}

// ============================================================================
// Labels
// ============================================================================

let cssInjected = false;
function injectCSS(): void {
  if (cssInjected) return;
  cssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes range-label-in {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

function createLabelElement(color: string, label: string, radiusNm: number): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 1px 6px;
    border-radius: 2px;
    background: oklch(var(--popover) / 0.85);
    backdrop-filter: blur(4px);
    border: 1px solid ${color}33;
    font-size: 10px;
    font-family: ui-monospace, SFMono-Regular, monospace;
    letter-spacing: 0.04em;
    white-space: nowrap;
    opacity: 0;
    animation: range-label-in 0.3s ease-out 0.1s forwards;
  `;
  el.innerHTML =
    `<span style="color:${color}; font-weight: 600;">${label}</span>` +
    `<span style="color: oklch(var(--muted-foreground)); font-weight: 400;">${Math.round(radiusNm)}nm</span>`;
  return el;
}

function addMarkers(map: maplibregl.Map, config: RangeRingsConfig): void {
  removeMarkers();
  for (const cat of config.categories) {
    const radiusNm = cat.speed * config.durationHours;
    const radiusMeters = nauticalMilesToMeters(radiusNm) as number;
    const [lon, lat] = destinationPoint(config.centerLat, config.centerLon, radiusMeters, 45);
    const el = createLabelElement(cat.color, cat.label, radiusNm);
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom-left' })
      .setLngLat([lon, lat])
      .addTo(map);
    markers.push(marker);
  }
}

function removeMarkers(): void {
  for (const m of markers) m.remove();
  markers = [];
}

// ============================================================================
// Public API
// ============================================================================

export function addRangeRingsLayer(map: maplibregl.Map, config: RangeRingsConfig): void {
  // Guard: wait for style before touching sources/layers
  if (!map.isStyleLoaded()) {
    map.once('style.load', () => addRangeRingsLayer(map, config));
    return;
  }

  removeRangeRingsLayer(map);
  if (config.categories.length === 0) return;

  injectCSS();

  map.addSource(RING_SOURCE_ID, { type: 'geojson', data: createRingsGeoJSON(config) });

  map.addLayer({
    id: RING_LAYER_ID,
    type: 'line',
    source: RING_SOURCE_ID,
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1,
      'line-opacity': 0.6,
      'line-dasharray': [6, 4],
    },
  });

  addMarkers(map, config);
}

export function removeRangeRingsLayer(map: maplibregl.Map): void {
  removeMarkers();
  try {
    if (map.getLayer(RING_LAYER_ID)) map.removeLayer(RING_LAYER_ID);
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
