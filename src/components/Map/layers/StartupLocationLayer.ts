import maplibregl from 'maplibre-gl';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { ParsedAirport } from '@/lib/aptParser';
import { createStartupLocationGeoJSON } from '../utils/geoJsonFactory';
import { BaseLayerRenderer } from './BaseLayerRenderer';

/**
 * Location type colors based on X-Plane startup location types
 */
const LOCATION_TYPE_COLORS: Record<string, string> = {
  gate: '#FFA500', // Orange - commercial gates
  hangar: '#4169E1', // Royal blue - hangars
  misc: '#808080', // Gray - miscellaneous
  tie_down: '#32CD32', // Lime green - tie-down spots
  fuel: '#FFD700', // Gold - fuel stations
  default: '#FFA500', // Default orange
};

export class StartupLocationLayer extends BaseLayerRenderer {
  layerId = 'airport-startup-locations';
  sourceId = 'airport-startup-locations';
  additionalLayerIds = ['airport-startup-location-labels'];

  hasData(airport: ParsedAirport): boolean {
    return airport.startupLocations && airport.startupLocations.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    const geoJSON = createStartupLocationGeoJSON(airport.startupLocations);
    this.addSource(map, geoJSON);

    // Startup location markers
    this.addLayer(map, {
      id: this.layerId,
      type: 'circle',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.startupLocations.minZoom,
      paint: {
        'circle-color': this.buildLocationTypeColorExpression(),
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 3, 18, 7],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#FFFFFF',
      },
    });

    // Startup location labels
    this.addLayer(map, {
      id: 'airport-startup-location-labels',
      type: 'symbol',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.labels.minZoom,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 18, 14],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#000000',
        'text-halo-width': 1,
      },
    });
  }

  private buildLocationTypeColorExpression(): maplibregl.ExpressionSpecification {
    const matchExpression: unknown[] = ['match', ['get', 'type']];

    // Add all known location types
    for (const [type, color] of Object.entries(LOCATION_TYPE_COLORS)) {
      if (type !== 'default') {
        matchExpression.push(type, color);
      }
    }

    matchExpression.push(LOCATION_TYPE_COLORS.default); // fallback
    return matchExpression as maplibregl.ExpressionSpecification;
  }
}
