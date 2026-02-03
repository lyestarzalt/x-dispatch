/**
 * Airspace Layer - Renders airspace boundaries
 * ICAO Standard Colors:
 * - Class B: Blue solid
 * - Class C: Magenta solid
 * - Class D: Blue dashed
 * - Class E: Magenta dashed
 * - Restricted/Prohibited: Red
 */
import maplibregl from 'maplibre-gl';
import type { Airspace } from '@/types/navigation';
import { NavLayerRenderer } from '../navigation/NavLayerRenderer';

// ICAO standard airspace colors - borders only
const AIRSPACE_STYLES: Record<string, { color: string; dashed: boolean }> = {
  A: { color: '#0066CC', dashed: false },
  B: { color: '#0066CC', dashed: false },
  C: { color: '#CC0099', dashed: false },
  D: { color: '#0066CC', dashed: true },
  E: { color: '#CC0099', dashed: true },
  F: { color: '#CC6600', dashed: true },
  G: { color: '#666666', dashed: true },
  CTR: { color: '#0066CC', dashed: false },
  TMA: { color: '#CC0099', dashed: false },
  R: { color: '#CC0000', dashed: false },
  P: { color: '#CC0000', dashed: false },
  Q: { color: '#CC0000', dashed: true },
  W: { color: '#CC6600', dashed: true },
  GP: { color: '#666666', dashed: true },
  OTHER: { color: '#666666', dashed: true },
};

function getAirspaceStyle(airspaceClass: string) {
  return AIRSPACE_STYLES[airspaceClass] || AIRSPACE_STYLES['OTHER'];
}

/**
 * Airspace Layer - renders airspace boundaries (Class B, C, D, etc.)
 */
export class AirspaceLayerRenderer extends NavLayerRenderer<Airspace> {
  readonly layerId = 'nav-airspaces-fill';
  readonly sourceId = 'nav-airspaces-source';
  readonly additionalLayerIds = ['nav-airspaces-outline', 'nav-airspaces-labels'];

  protected createGeoJSON(airspaces: Airspace[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: airspaces
        .filter((a) => a.coordinates.length >= 3)
        .map((airspace) => {
          const style = getAirspaceStyle(airspace.class);
          return {
            type: 'Feature' as const,
            geometry: {
              type: 'Polygon' as const,
              coordinates: [airspace.coordinates],
            },
            properties: {
              class: airspace.class,
              name: airspace.name,
              upperLimit: airspace.upperLimit,
              lowerLimit: airspace.lowerLimit,
              color: style.color,
              dashed: style.dashed ? 1 : 0,
            },
          };
        }),
    };
  }

  protected addLayers(map: maplibregl.Map): void {
    // Fill layer
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
      id: this.additionalLayerIds[0],
      type: 'line',
      source: this.sourceId,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 8, 1.5, 12, 2],
        'line-opacity': 0.6,
      },
    });

    // Labels at higher zoom
    map.addLayer({
      id: this.additionalLayerIds[1],
      type: 'symbol',
      source: this.sourceId,
      minzoom: 9,
      layout: {
        'text-field': ['concat', ['get', 'class'], ' ', ['get', 'name']],
        'text-font': ['Open Sans Semibold'],
        'text-size': 10,
        'text-allow-overlap': false,
        'symbol-placement': 'point',
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': '#000000',
        'text-halo-width': 1,
        'text-opacity': 0.8,
      },
    });
  }
}

// Singleton instance for backward compatibility
const airspaceLayer = new AirspaceLayerRenderer();

// Legacy function exports for backward compatibility
export function addAirspaceLayer(map: maplibregl.Map, airspaces: Airspace[]): void {
  void airspaceLayer.add(map, airspaces);
}

export function removeAirspaceLayer(map: maplibregl.Map): void {
  return airspaceLayer.remove(map);
}

export function setAirspaceLayerVisibility(map: maplibregl.Map, visible: boolean): void {
  return airspaceLayer.setVisibility(map, visible);
}

export function updateAirspaceLayer(map: maplibregl.Map, airspaces: Airspace[]): void {
  void airspaceLayer.update(map, airspaces);
}

export const AIRSPACE_LAYER_IDS = airspaceLayer.getAllLayerIds();
