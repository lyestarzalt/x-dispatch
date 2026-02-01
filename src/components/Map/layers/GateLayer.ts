import maplibregl from 'maplibre-gl';
import { ParsedAirport } from '@/lib/aptParser';
import { StartupLocation } from '@/lib/aptParser/types';
import { BaseLayerRenderer } from './BaseLayerRenderer';

export class GateLayer extends BaseLayerRenderer {
  layerId = 'airport-gates';
  sourceId = 'airport-gates';
  additionalLayerIds = ['airport-gate-labels', 'airport-gates-hitbox', 'airport-gates-ring'];

  hasData(airport: ParsedAirport): boolean {
    return airport.startupLocations && airport.startupLocations.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    this.loadAircraftIcon(map);

    const geoJSON = this.createGeoJSON(airport.startupLocations);
    this.addSource(map, geoJSON);

    this.addLayer(map, {
      id: 'airport-gates-ring',
      type: 'circle',
      source: this.sourceId,
      minzoom: 15,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 12, 17, 16, 19, 22],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          '#22c55e',
          ['boolean', ['feature-state', 'hover'], false],
          '#334155',
          '#1e293b',
        ],
        'circle-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          0.9,
          ['boolean', ['feature-state', 'hover'], false],
          0.85,
          0.7,
        ],
        'circle-stroke-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          2,
          ['boolean', ['feature-state', 'hover'], false],
          1.5,
          1,
        ],
        'circle-stroke-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          '#22c55e',
          ['boolean', ['feature-state', 'hover'], false],
          '#94a3b8',
          '#64748b',
        ],
      },
    });

    this.addLayer(map, {
      id: 'airport-gates-hitbox',
      type: 'circle',
      source: this.sourceId,
      minzoom: 15,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 12, 17, 16, 19, 22],
        'circle-color': 'transparent',
        'circle-opacity': 0,
      },
    });

    this.addLayer(map, {
      id: this.layerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: 15,
      layout: {
        'icon-image': 'aircraft-icon',
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15,
          ['*', ['get', 'iconScale'], 0.35],
          17,
          ['*', ['get', 'iconScale'], 0.5],
          19,
          ['*', ['get', 'iconScale'], 0.7],
        ],
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          '#ffffff',
          '#ffffff',
        ],
        'icon-opacity': 1,
      },
    });

    this.addLayer(map, {
      id: 'airport-gate-labels',
      type: 'symbol',
      source: this.sourceId,
      minzoom: 17,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-size': 10,
        'text-offset': [0, 1.8],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          '#22c55e',
          '#94a3b8',
        ],
        'text-halo-color': '#000000',
        'text-halo-width': 1,
      },
    });
  }

  private loadAircraftIcon(map: maplibregl.Map): void {
    if (map.hasImage('aircraft-icon')) return;

    const img = new Image(48, 48);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48"><path fill="white" d="M21,16V14L13,9V3.5A1.5,1.5,0,0,0,11.5,2A1.5,1.5,0,0,0,10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z"/></svg>`;
    img.onload = () => {
      if (!map.hasImage('aircraft-icon')) {
        map.addImage('aircraft-icon', img, { sdf: true });
      }
    };
    img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  private createGeoJSON(locations: StartupLocation[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: locations.map((location, index) => ({
        type: 'Feature' as const,
        id: index,
        geometry: {
          type: 'Point' as const,
          coordinates: [location.longitude, location.latitude],
        },
        properties: {
          id: index,
          name: location.name,
          locationType: location.location_type,
          heading: location.heading,
          airplaneTypes: location.airplane_types,
          iconScale: this.getIconScale(location.airplane_types),
          latitude: location.latitude,
          longitude: location.longitude,
        },
      })),
    };
  }

  private getIconScale(airplaneTypes: string): number {
    if (!airplaneTypes) return 1.0;
    const types = airplaneTypes.toUpperCase();
    if (types.includes('A')) return 1.8;
    if (types.includes('B')) return 1.5;
    if (types.includes('C')) return 1.2;
    if (types.includes('D')) return 1.0;
    if (types.includes('E')) return 0.8;
    if (types.includes('F')) return 0.6;
    return 1.0;
  }
}
