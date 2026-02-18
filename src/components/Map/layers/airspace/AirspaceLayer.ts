import maplibregl from 'maplibre-gl';
import { getAirspaceStyle } from '@/config/navLayerConfig';
import type { Airspace } from '@/types/navigation';
import { NavLayerRenderer } from '../navigation/NavLayerRenderer';

const DASHED_CLASSES = ['D', 'E', 'F', 'G', 'Q', 'W', 'GP', 'OTHER'];

function getLocalAirspaceStyle(airspaceClass: string) {
  const style = getAirspaceStyle(airspaceClass);
  return { color: style.border, dashed: DASHED_CLASSES.includes(airspaceClass) };
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
          const style = getLocalAirspaceStyle(airspace.class);
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
    const outlineLayerId = this.additionalLayerIds[0];
    const labelsLayerId = this.additionalLayerIds[1];
    if (!outlineLayerId || !labelsLayerId) return;

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

export const airspaceLayer = new AirspaceLayerRenderer();
export const AIRSPACE_LAYER_IDS = airspaceLayer.getAllLayerIds();
