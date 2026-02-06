import maplibregl from 'maplibre-gl';
import { ParsedAirport } from '@/lib/aptParser';
import { BaseLayerRenderer } from './BaseLayerRenderer';

const TOWER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <rect fill="white" x="20" y="16" width="8" height="28"/>
  <rect fill="white" x="10" y="10" width="28" height="10" rx="2"/>
</svg>`;

export class TowerLayer extends BaseLayerRenderer {
  layerId = 'airport-tower';
  sourceId = 'airport-tower';
  additionalLayerIds: string[] = [];

  hasData(airport: ParsedAirport): boolean {
    return !!airport.towerLocation;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    this.loadIcon(map);

    const tower = airport.towerLocation!;
    const geoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [tower.longitude, tower.latitude],
          },
          properties: {
            name: tower.name,
          },
        },
      ],
    };

    this.addSource(map, geoJSON);

    this.addLayer(map, {
      id: this.layerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: 13,
      layout: {
        'icon-image': 'tower-icon',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 17, 0.7],
        'icon-allow-overlap': true,
      },
      paint: {
        'icon-color': '#94a3b8',
        'icon-opacity': 0.9,
      },
    });
  }

  private loadIcon(map: maplibregl.Map): void {
    if (map.hasImage('tower-icon')) return;

    const img = new Image(48, 48);
    img.onload = () => {
      if (!map.hasImage('tower-icon')) {
        map.addImage('tower-icon', img, { sdf: true });
      }
    };
    img.src = 'data:image/svg+xml,' + encodeURIComponent(TOWER_ICON);
  }
}
