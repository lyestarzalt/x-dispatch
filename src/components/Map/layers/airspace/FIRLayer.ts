import maplibregl from 'maplibre-gl';
import {
  NAV_LABEL_STYLES,
  NAV_LINE_STYLES,
  NAV_ZOOM_LEVELS,
  getAirspaceColor,
} from '@/config/navLayerConfig';
import type { Airspace } from '@/types/navigation';
import { NavLayerRenderer } from '../navigation/NavLayerRenderer';

/**
 * FIR Layer - renders Flight Information Region boundaries
 */
export class FIRLayerRenderer extends NavLayerRenderer<Airspace> {
  readonly layerId = 'nav-global-airspace-lines';
  readonly sourceId = 'nav-global-airspace-source';
  readonly additionalLayerIds = ['nav-global-airspace-labels'];

  protected createGeoJSON(airspaces: Airspace[]): GeoJSON.FeatureCollection {
    const filtered = airspaces.filter((a) => a.coordinates.length >= 3);
    return {
      type: 'FeatureCollection',
      features: filtered.map((airspace) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [airspace.coordinates],
        },
        properties: {
          name: airspace.name,
          class: airspace.class,
          color: getAirspaceColor(airspace.class),
        },
      })),
    };
  }

  protected addLayers(map: maplibregl.Map): void {
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
      id: this.additionalLayerIds[0],
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

// Singleton instance for backward compatibility
const firLayer = new FIRLayerRenderer();

// Legacy function exports for backward compatibility
export function addFIRLayer(map: maplibregl.Map, airspaces: Airspace[]): void {
  void firLayer.add(map, airspaces);
}

export function removeFIRLayer(map: maplibregl.Map): void {
  return firLayer.remove(map);
}

export function setFIRLayerVisibility(map: maplibregl.Map, visible: boolean): void {
  return firLayer.setVisibility(map, visible);
}

export function updateFIRLayer(map: maplibregl.Map, airspaces: Airspace[]): void {
  void firLayer.update(map, airspaces);
}

export const FIR_LAYER_IDS = firLayer.getAllLayerIds();
