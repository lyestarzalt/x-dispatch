import * as maplibregl from 'maplibre-gl';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { taxiwayLightLines, taxiwayLightPoints } from '@/lib/airportLights/taxiwayLights';
import type { ParsedAirport } from '@/types/apt';
import { safeAddGeoJSONSource } from '../types';
import { BaseLayerRenderer } from './BaseLayerRenderer';
import { LIGHT_COLOR_EXPR, lightCoreLayerId, lightLayers } from './lightLayers';

const WINDSOCK_GLOW_SIZE = 3;

export const TAXIWAY_LIGHT_LAYERS = [
  'airport-taxiway-lights',
  lightCoreLayerId('airport-taxiway-lights'),
  'airport-taxiway-light-glow',
];

/**
 * Taxiway fixtures from the apt.dat line light codes: glowing points when
 * close, the same segments as blurred lines further out.
 */
export class AirfieldLightsLayer extends BaseLayerRenderer {
  layerId = 'airport-taxiway-lights';
  sourceId = 'airport-taxiway-lights';
  additionalLayerIds = TAXIWAY_LIGHT_LAYERS.filter((id) => id !== 'airport-taxiway-lights');
  additionalSourceIds = ['airport-taxiway-light-lines'];

  hasData(airport: ParsedAirport): boolean {
    return (
      airport.linearFeatures.some((f) => f.lighting_line_type > 0) ||
      airport.windsocks.some((w) => w.illuminated)
    );
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    const pointZoom = ZOOM_BEHAVIORS.lighting.minZoom;
    const points = taxiwayLightPoints(airport.linearFeatures);
    for (const sock of airport.windsocks) {
      if (!sock.illuminated) continue;
      points.features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [sock.longitude, sock.latitude] },
        properties: { color: 'white', pulse: false, size: WINDSOCK_GLOW_SIZE },
      });
    }
    this.addSource(map, points);
    safeAddGeoJSONSource(
      map,
      'airport-taxiway-light-lines',
      taxiwayLightLines(airport.linearFeatures)
    );

    this.addLayer(map, {
      id: 'airport-taxiway-light-glow',
      type: 'line',
      source: 'airport-taxiway-light-lines',
      minzoom: ZOOM_BEHAVIORS.taxiways.minZoom,
      maxzoom: pointZoom,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': LIGHT_COLOR_EXPR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, pointZoom, 1.6],
        'line-blur': 1.2,
        'line-opacity': 0,
      },
    });

    for (const spec of lightLayers({
      id: this.layerId,
      source: this.sourceId,
      minzoom: pointZoom,
      scale: 0.8,
    })) {
      this.addLayer(map, spec);
    }
  }
}
