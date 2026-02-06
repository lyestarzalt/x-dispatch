import maplibregl from 'maplibre-gl';
import { AIRSPACE_STYLES } from '@/config/navLayerConfig';
import type { Airspace } from '@/types/navigation';
import { NavLayerRenderer } from '../navigation/NavLayerRenderer';

const DASHED_CLASSES = ['D', 'E', 'F', 'G', 'Q', 'W', 'GP', 'OTHER'];

function getLocalAirspaceStyle(airspaceClass: string) {
  const style = AIRSPACE_STYLES[airspaceClass] || AIRSPACE_STYLES.OTHER;
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

export const airspaceLayer = new AirspaceLayerRenderer();
export const AIRSPACE_LAYER_IDS = airspaceLayer.getAllLayerIds();
