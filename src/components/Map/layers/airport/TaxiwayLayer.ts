import * as maplibregl from 'maplibre-gl';
import {
  SURFACE_TYPES,
  getSurfaceColor,
  getSurfaceOutlineColor,
} from '@/config/mapStyles/surfaceColors';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import type { ParsedAirport } from '@/types/apt';
import { BaseLayerRenderer } from './BaseLayerRenderer';

/**
 * Every apt.dat taxiway row is also a pavement, so this layer draws the
 * polygons the PavementLayer already uploaded rather than tiling a second
 * copy of the same geometry. PavementLayer renders first and owns the source.
 */
export class TaxiwayLayer extends BaseLayerRenderer {
  layerId = 'airport-taxiways';
  sourceId = 'airport-pavements';

  hasData(airport: ParsedAirport): boolean {
    return airport.pavements && airport.pavements.length > 0;
  }

  protected performRemove(map: maplibregl.Map): void {
    if (map.getLayer(this.layerId)) map.removeLayer(this.layerId);
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport) || !map.getSource(this.sourceId)) return;

    // Build color expression for surface types
    const colorExpression = this.buildSurfaceColorExpression();

    this.addLayer(map, {
      id: this.layerId,
      type: 'fill',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.taxiways.minZoom,
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

    matchExpression.push('#555555'); // fallback (default taxiway color)
    return matchExpression as maplibregl.ExpressionSpecification;
  }

  private buildSurfaceOutlineColorExpression(): maplibregl.ExpressionSpecification {
    const matchExpression: unknown[] = ['match', ['get', 'surface']];

    for (const type of SURFACE_TYPES) {
      matchExpression.push(type, getSurfaceOutlineColor(type));
    }

    matchExpression.push('#666666'); // fallback
    return matchExpression as maplibregl.ExpressionSpecification;
  }
}
