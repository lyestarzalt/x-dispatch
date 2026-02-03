import maplibregl from 'maplibre-gl';
import {
  SURFACE_TYPES,
  getSurfaceColor,
  getSurfaceOutlineColor,
} from '@/config/mapStyles/surfaceColors';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { ParsedAirport } from '@/lib/aptParser';
import { createPavementGeoJSON } from '../../utils/geoJsonFactory';
import { BaseLayerRenderer } from './BaseLayerRenderer';

export class PavementLayer extends BaseLayerRenderer {
  layerId = 'airport-pavements';
  sourceId = 'airport-pavements';

  hasData(airport: ParsedAirport): boolean {
    return airport.pavements && airport.pavements.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    const geoJSON = createPavementGeoJSON(airport.pavements);
    this.addSource(map, geoJSON);

    // Build color expression for surface types
    const colorExpression = this.buildSurfaceColorExpression();

    this.addLayer(map, {
      id: this.layerId,
      type: 'fill',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.pavements.minZoom,
      paint: {
        'fill-color': colorExpression,
        'fill-opacity': 0.9,
        'fill-outline-color': this.buildSurfaceOutlineColorExpression(),
      },
    });
  }

  private buildSurfaceColorExpression(): maplibregl.ExpressionSpecification {
    const matchExpression: unknown[] = ['match', ['get', 'surface']];

    for (const type of SURFACE_TYPES) {
      matchExpression.push(type, getSurfaceColor(type));
    }

    matchExpression.push('#444444'); // fallback
    return matchExpression as maplibregl.ExpressionSpecification;
  }

  private buildSurfaceOutlineColorExpression(): maplibregl.ExpressionSpecification {
    const matchExpression: unknown[] = ['match', ['get', 'surface']];

    for (const type of SURFACE_TYPES) {
      matchExpression.push(type, getSurfaceOutlineColor(type));
    }

    matchExpression.push('#555555'); // fallback
    return matchExpression as maplibregl.ExpressionSpecification;
  }
}
