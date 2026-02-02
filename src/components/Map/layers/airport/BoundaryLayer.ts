import maplibregl from 'maplibre-gl';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { ParsedAirport } from '@/lib/aptParser';
import { createBoundaryGeoJSON } from '../../utils/geoJsonFactory';
import { BaseLayerRenderer } from '../BaseLayerRenderer';

export class BoundaryLayer extends BaseLayerRenderer {
  layerId = 'airport-boundaries';
  sourceId = 'airport-boundaries';

  hasData(airport: ParsedAirport): boolean {
    return airport.boundaries && airport.boundaries.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    const geoJSON = createBoundaryGeoJSON(airport.boundaries);
    this.addSource(map, geoJSON);

    this.addLayer(map, {
      id: this.layerId,
      type: 'line',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.boundaries.minZoom,
      paint: {
        'line-color': '#ffffff',
        'line-width': 2,
        'line-dasharray': [2, 2],
        'line-opacity': 0.8,
      },
    });
  }
}
