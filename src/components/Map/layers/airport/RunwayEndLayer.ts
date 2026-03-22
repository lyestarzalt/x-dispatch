import maplibregl from 'maplibre-gl';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import type { ParsedAirport } from '@/types/apt';
import type { Runway } from '@/types/apt';
import { BaseLayerRenderer } from './BaseLayerRenderer';

// Same colors as GateLayer for visual consistency
const COLORS = {
  default: '#64748b',
  hover: '#94a3b8',
  selected: '#1DA0F2',
} as const;

/**
 * Runway End Layer — circle markers at each runway threshold.
 * Same visual style as gates for consistent clickable feel.
 */
export class RunwayEndLayer extends BaseLayerRenderer {
  layerId = 'airport-runway-ends';
  sourceId = 'airport-runway-ends';
  additionalLayerIds = ['airport-runway-ends-labels'];

  hasData(airport: ParsedAirport): boolean {
    return airport.runways && airport.runways.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    const geoJSON = this.createGeoJSON(airport.runways);
    this.addSource(map, geoJSON);

    const minZoom = ZOOM_BEHAVIORS.runwayEnds.minZoom;

    // Circle markers — same style as gates
    this.addLayer(map, {
      id: this.layerId,
      type: 'circle',
      source: this.sourceId,
      minzoom: minZoom,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], minZoom, 8, minZoom + 2, 12, 19, 18],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          COLORS.selected,
          ['boolean', ['feature-state', 'hover'], false],
          COLORS.hover,
          COLORS.default,
        ],
        'circle-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          0.95,
          ['boolean', ['feature-state', 'hover'], false],
          0.85,
          0.7,
        ],
        'circle-stroke-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          2.5,
          ['boolean', ['feature-state', 'hover'], false],
          1.5,
          1,
        ],
        'circle-stroke-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          COLORS.selected,
          ['boolean', ['feature-state', 'hover'], false],
          '#ffffff',
          COLORS.hover,
        ],
      },
    });

    // Runway end labels
    this.addLayer(map, {
      id: 'airport-runway-ends-labels',
      type: 'symbol',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.labels.minZoom,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          ZOOM_BEHAVIORS.labels.minZoom,
          10,
          17,
          14,
        ],
        'text-anchor': 'center',
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          '#000000',
          '#ffffff',
        ],
        'text-halo-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          COLORS.selected,
          COLORS.default,
        ],
        'text-halo-width': 0,
      },
    });
  }

  private createGeoJSON(runways: Runway[]): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];
    let id = 0;

    for (const runway of runways) {
      for (const end of runway.ends) {
        features.push({
          type: 'Feature',
          id: id++,
          geometry: {
            type: 'Point',
            coordinates: [end.longitude, end.latitude],
          },
          properties: {
            id: id - 1,
            name: end.name,
            latitude: end.latitude,
            longitude: end.longitude,
            hasILS: end.lighting > 0,
          },
        });
      }
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }
}
