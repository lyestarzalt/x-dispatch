import maplibregl from 'maplibre-gl';
import { ParsedAirport } from '@/lib/aptParser';
import { BaseLayerRenderer } from './BaseLayerRenderer';

const BEACON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <circle fill="white" cx="24" cy="24" r="6"/>
  <circle fill="none" stroke="white" stroke-width="3" cx="24" cy="24" r="16"/>
</svg>`;

export class BeaconLayer extends BaseLayerRenderer {
  layerId = 'airport-beacon';
  sourceId = 'airport-beacon';
  additionalLayerIds: string[] = [];

  hasData(airport: ParsedAirport): boolean {
    return !!airport.beacon;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    this.loadIcon(map);

    const beacon = airport.beacon!;
    const geoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [beacon.longitude, beacon.latitude],
          },
          properties: {
            name: beacon.name,
          },
        },
      ],
    };

    this.addSource(map, geoJSON);

    this.addLayer(map, {
      id: this.layerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: 12,
      layout: {
        'icon-image': 'beacon-icon',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 16, 0.6],
        'icon-allow-overlap': true,
      },
      paint: {
        'icon-color': '#facc15',
        'icon-opacity': 0.9,
      },
    });
  }

  private loadIcon(map: maplibregl.Map): void {
    if (map.hasImage('beacon-icon')) return;

    const img = new Image(48, 48);
    img.onload = () => {
      if (!map.hasImage('beacon-icon')) {
        map.addImage('beacon-icon', img, { sdf: true });
      }
    };
    img.src = 'data:image/svg+xml,' + encodeURIComponent(BEACON_ICON);
  }
}
