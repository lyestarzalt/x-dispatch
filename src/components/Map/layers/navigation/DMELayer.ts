import maplibregl from 'maplibre-gl';
import { NAV_COLORS } from '@/config/navLayerConfig';
import type { Navaid } from '@/types/navigation';
import { NavLayerRenderer } from './NavLayerRenderer';

/**
 * DME Layer - renders Distance Measuring Equipment navaids
 */
export class DMELayerRenderer extends NavLayerRenderer<Navaid> {
  readonly layerId = 'nav-dmes';
  readonly sourceId = 'nav-dmes-source';
  readonly additionalLayerIds = ['nav-dmes-labels'];

  protected createGeoJSON(dmes: Navaid[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: dmes.map((dme) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [dme.longitude, dme.latitude],
        },
        properties: {
          id: dme.id,
          name: dme.name,
          frequency: dme.frequency,
          freqDisplay: `${(dme.frequency / 100).toFixed(2)}`,
        },
      })),
    };
  }

  protected addLayers(map: maplibregl.Map): void {
    const labelsLayerId = this.additionalLayerIds[0];
    if (!labelsLayerId) return;

    // DME symbol - small circle outline
    map.addLayer({
      id: this.layerId,
      type: 'circle',
      source: this.sourceId,
      paint: {
        'circle-color': 'transparent',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2, 10, 4, 14, 6],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': NAV_COLORS.dme,
      },
    });

    // DME labels
    map.addLayer({
      id: labelsLayerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: 9,
      layout: {
        'text-field': ['get', 'id'],
        'text-font': ['Open Sans Semibold'],
        'text-size': 9,
        'text-offset': [0, 0.8],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': NAV_COLORS.dme,
        'text-halo-color': '#000000',
        'text-halo-width': 1,
      },
    });
  }
}

export const dmeLayer = new DMELayerRenderer();
export const DME_LAYER_IDS = dmeLayer.getAllLayerIds();
