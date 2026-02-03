import maplibregl from 'maplibre-gl';
import type { Navaid } from '@/types/navigation';
import { NavLayerRenderer } from './NavLayerRenderer';

const DME_COLOR = '#0099CC';

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
    // DME symbol - small circle outline
    map.addLayer({
      id: this.layerId,
      type: 'circle',
      source: this.sourceId,
      paint: {
        'circle-color': 'transparent',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2, 10, 4, 14, 6],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': DME_COLOR,
      },
    });

    // DME labels
    map.addLayer({
      id: this.additionalLayerIds[0],
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
        'text-color': DME_COLOR,
        'text-halo-color': '#000000',
        'text-halo-width': 1,
      },
    });
  }
}

// Singleton instance for backward compatibility
const dmeLayer = new DMELayerRenderer();

// Legacy function exports for backward compatibility
export function addDMELayer(map: maplibregl.Map, dmes: Navaid[]): void {
  // Note: Using void return to match original sync signature
  void dmeLayer.add(map, dmes);
}

export function removeDMELayer(map: maplibregl.Map): void {
  return dmeLayer.remove(map);
}

export function setDMELayerVisibility(map: maplibregl.Map, visible: boolean): void {
  return dmeLayer.setVisibility(map, visible);
}

export function updateDMELayer(map: maplibregl.Map, dmes: Navaid[]): void {
  // Note: Using void return to match original sync signature
  void dmeLayer.update(map, dmes);
}

export const DME_LAYER_IDS = dmeLayer.getAllLayerIds();
