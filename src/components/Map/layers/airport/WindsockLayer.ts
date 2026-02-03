import maplibregl from 'maplibre-gl';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { ParsedAirport } from '@/lib/aptParser';
import { createWindsockGeoJSON } from '../../utils/geoJsonFactory';
import { BaseLayerRenderer } from './BaseLayerRenderer';

export class WindsockLayer extends BaseLayerRenderer {
  layerId = 'airport-windsocks';
  sourceId = 'airport-windsocks';
  additionalLayerIds = ['airport-windsock-labels'];

  hasData(airport: ParsedAirport): boolean {
    return airport.windsocks && airport.windsocks.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    const geoJSON = createWindsockGeoJSON(airport.windsocks);
    this.addSource(map, geoJSON);

    // Windsock markers - different colors for illuminated vs non-illuminated
    this.addLayer(map, {
      id: this.layerId,
      type: 'circle',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.windsocks.minZoom,
      paint: {
        'circle-color': [
          'case',
          ['get', 'illuminated'],
          '#00FF88', // Bright green for illuminated
          '#FF8800', // Orange for non-illuminated
        ],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 4, 18, 8],
        'circle-stroke-width': 2,
        'circle-stroke-color': [
          'case',
          ['get', 'illuminated'],
          '#FFFFFF', // White stroke for illuminated
          '#FFFFFF', // White stroke for non-illuminated
        ],
        // Add glow effect for illuminated windsocks
        'circle-blur': ['case', ['get', 'illuminated'], 0.3, 0],
      },
    });

    // Windsock labels
    this.addLayer(map, {
      id: 'airport-windsock-labels',
      type: 'symbol',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.labels.minZoom + 2,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-size': ['interpolate', ['linear'], ['zoom'], 16, 10, 20, 14],
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#000000',
        'text-halo-width': 1,
      },
    });
  }
}
