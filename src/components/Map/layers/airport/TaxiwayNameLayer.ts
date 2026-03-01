import maplibregl from 'maplibre-gl';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import type { ParsedAirport } from '@/types/apt';
import { createTaxiwayNameGeoJSON } from '../../utils/geoJsonFactory';
import { BaseLayerRenderer } from './BaseLayerRenderer';

export class TaxiwayNameLayer extends BaseLayerRenderer {
  layerId = 'airport-taxiway-names';
  sourceId = 'airport-taxiway-names';
  additionalLayerIds: string[] = [];

  hasData(airport: ParsedAirport): boolean {
    return (
      airport.taxiNetwork !== undefined &&
      airport.taxiNetwork.nodes.length > 0 &&
      airport.taxiNetwork.edges.length > 0
    );
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport) || !airport.taxiNetwork) return;

    const geoJSON = createTaxiwayNameGeoJSON(airport.taxiNetwork);
    if (geoJSON.features.length === 0) return;

    this.addSource(map, geoJSON);

    this.addLayer(map, {
      id: this.layerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.taxiwayNames.minZoom,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 19, 13, 18, 17],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-padding': 29,
      },
      paint: {
        'text-color': '#1a1a2e',
        'text-halo-color': 'rgba(255, 255, 255, 0.9)',
        'text-halo-width': 4,
        'text-halo-blur': 2,
      },
    });
  }
}
