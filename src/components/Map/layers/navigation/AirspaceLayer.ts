/**
 * Consolidated Airspace Layer
 * Renders all airspace types: Class A/B/C/D/E, FIR, TMA, CTR, etc.
 * Can display both local airspaces (near airport) and global boundaries.
 */
import maplibregl from 'maplibre-gl';
import {
  NAV_LABEL_STYLES,
  NAV_LINE_STYLES,
  NAV_ZOOM_LEVELS,
  getAirspaceColor,
  getAirspaceStyle,
} from '@/config/navLayerConfig';
import type { Airspace } from '@/types/navigation';
import { NavLayerRenderer } from './NavLayerRenderer';

// ============================================================================
// Styling Helpers
// ============================================================================

// Airspace classes that use dashed borders
const DASHED_CLASSES = ['D', 'E', 'F', 'G', 'Q', 'W', 'GP', 'OTHER'];

function getLocalAirspaceStyle(airspaceClass: string) {
  const style = getAirspaceStyle(airspaceClass);
  return { color: style.border, dashed: DASHED_CLASSES.includes(airspaceClass) };
}

/**
 * Check if airspace can be rendered (doesn't cross antimeridian).
 * Polygons spanning > 180° longitude can't be rendered correctly in MapLibre.
 */
function isRenderable(airspace: Airspace): boolean {
  if (airspace.coordinates.length < 3) return false;
  const lons = airspace.coordinates.map((c) => c[0]);
  return Math.max(...lons) - Math.min(...lons) <= 180;
}

/**
 * Calculate signed area using Shoelace formula.
 * Positive = clockwise, Negative = counter-clockwise
 */
function signedArea(coords: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < coords.length; i++) {
    const c1 = coords[i];
    const c2 = coords[(i + 1) % coords.length];
    if (!c1 || !c2) continue;
    const [x1, y1] = c1;
    const [x2, y2] = c2;
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/**
 * Ensure polygon is wound counter-clockwise (GeoJSON exterior ring spec).
 */
function ensureCounterClockwise(coords: [number, number][]): [number, number][] {
  if (signedArea(coords) > 0) {
    return [...coords].reverse();
  }
  return coords;
}

// ============================================================================
// Airspace Layer Renderer
// ============================================================================

/**
 * Airspace Layer - renders airspace boundaries (Class A/B/C/D/E, FIR, TMA, etc.)
 * Consolidates local and global airspace rendering into one layer.
 */
export class AirspaceLayerRenderer extends NavLayerRenderer<Airspace> {
  readonly layerId = 'nav-airspaces-fill';
  readonly sourceId = 'nav-airspaces-source';
  readonly additionalLayerIds = ['nav-airspaces-outline', 'nav-airspaces-labels'];

  protected createGeoJSON(airspaces: Airspace[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: airspaces.filter(isRenderable).map((airspace) => {
        const style = getLocalAirspaceStyle(airspace.class);
        const coords = ensureCounterClockwise(airspace.coordinates);
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [coords],
          },
          properties: {
            class: airspace.class,
            name: airspace.name,
            upperLimit: airspace.upperLimit,
            lowerLimit: airspace.lowerLimit,
            color: style.color,
            dashed: style.dashed ? 1 : 0,
            label: `${airspace.class} ${airspace.name}`,
          },
        };
      }),
    };
  }

  protected addLayers(map: maplibregl.Map): void {
    const outlineLayerId = this.additionalLayerIds[0];
    const labelsLayerId = this.additionalLayerIds[1];
    if (!outlineLayerId || !labelsLayerId) return;

    // Fill layer - very subtle fill
    map.addLayer({
      id: this.layerId,
      type: 'fill',
      source: this.sourceId,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.02,
      },
    });

    // Outline layer - the main visual
    map.addLayer({
      id: outlineLayerId,
      type: 'line',
      source: this.sourceId,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 8, 1.5, 12, 2],
        'line-opacity': 0.6,
      },
    });

    // Labels along boundary - large halo creates "cut" effect in the border
    map.addLayer({
      id: labelsLayerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: 8,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 12],
        'text-allow-overlap': false,
        'symbol-placement': 'line',
        'symbol-spacing': 300,
        'text-max-angle': 45,
        'text-padding': 20,
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': '#0d1117',
        'text-halo-width': 6,
        'text-halo-blur': 1,
      },
    });
  }
}

// ============================================================================
// FIR (Global) Layer Renderer
// ============================================================================

/**
 * FIR Layer - renders Flight Information Region boundaries globally
 * Lighter styling than local airspaces, designed for zoomed-out views.
 */
export class FIRLayerRenderer extends NavLayerRenderer<Airspace> {
  readonly layerId = 'nav-global-airspace-lines';
  readonly sourceId = 'nav-global-airspace-source';
  readonly additionalLayerIds = ['nav-global-airspace-labels'];

  protected createGeoJSON(airspaces: Airspace[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: airspaces.filter(isRenderable).map((airspace) => {
        const coords = ensureCounterClockwise(airspace.coordinates);
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [coords],
          },
          properties: {
            name: airspace.name,
            class: airspace.class,
            color: getAirspaceColor(airspace.class),
          },
        };
      }),
    };
  }

  protected addLayers(map: maplibregl.Map): void {
    const labelsLayerId = this.additionalLayerIds[0];
    if (!labelsLayerId) return;

    // Line layer
    map.addLayer({
      id: this.layerId,
      type: 'line',
      source: this.sourceId,
      minzoom: NAV_ZOOM_LEVELS.firBoundaries.lines,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': NAV_LINE_STYLES.fir.width,
        'line-opacity': NAV_LINE_STYLES.fir.opacity,
      },
    });

    // Label layer
    map.addLayer({
      id: labelsLayerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: NAV_ZOOM_LEVELS.firBoundaries.labels,
      layout: {
        'text-field': ['concat', ['get', 'class'], ' ', ['get', 'name']],
        'text-font': NAV_LABEL_STYLES.fonts.bold,
        'text-size': NAV_LABEL_STYLES.textSize.fir,
        'text-allow-overlap': false,
        'symbol-placement': 'point',
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': '#000000',
        'text-halo-width': NAV_LABEL_STYLES.haloWidth.medium,
      },
    });
  }
}

// ============================================================================
// Exports
// ============================================================================

export const airspaceLayer = new AirspaceLayerRenderer();
export const firLayer = new FIRLayerRenderer();

export const AIRSPACE_LAYER_IDS = airspaceLayer.getAllLayerIds();
export const FIR_LAYER_IDS = firLayer.getAllLayerIds();
