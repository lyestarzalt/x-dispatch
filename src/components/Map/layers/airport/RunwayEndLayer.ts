import maplibregl from 'maplibre-gl';
import { ParsedAirport } from '@/lib/aptParser';
import { Runway } from '@/lib/aptParser/types';
import { BaseLayerRenderer } from './BaseLayerRenderer';

/**
 * Runway End Layer - Shows clickable markers at each runway end
 * For selecting start position in X-Plane launcher
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

    // Runway end markers - small circles
    this.addLayer(map, {
      id: this.layerId,
      type: 'circle',
      source: this.sourceId,
      minzoom: 13,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 4, 15, 6, 17, 10, 19, 14],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          '#22c55e',
          '#3b82f6',
        ],
        'circle-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          1,
          ['boolean', ['feature-state', 'selected'], false],
          1,
          0.8,
        ],
        'circle-stroke-width': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          3,
          ['boolean', ['feature-state', 'selected'], false],
          3,
          2,
        ],
        'circle-stroke-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          '#22c55e',
          '#ffffff',
        ],
      },
    });

    // Runway end labels
    this.addLayer(map, {
      id: 'airport-runway-ends-labels',
      type: 'symbol',
      source: this.sourceId,
      minzoom: 14,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 17, 14],
        'text-offset': [0, 0],
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
          '#22c55e',
          '#3b82f6',
        ],
        'text-halo-width': 0,
      },
    });
  }

  private createGeoJSON(runways: Runway[]): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];
    let id = 0;

    for (const runway of runways) {
      // Add both ends of each runway
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
