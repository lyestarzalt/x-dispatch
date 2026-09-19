import * as maplibregl from 'maplibre-gl';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { taxiwayLightLines, taxiwayLightPoints } from '@/lib/airportLights/taxiwayLights';
import type { ParsedAirport } from '@/types/apt';
import { safeAddGeoJSONSource } from '../types';
import { BaseLayerRenderer } from './BaseLayerRenderer';
import { LIGHT_HEX, ensureLightSprites, lightSymbolLayout } from './lightSprites';

export const TAXIWAY_LIGHT_LAYERS = ['airport-taxiway-lights', 'airport-taxiway-light-glow'];

const LINE_COLOR: maplibregl.ExpressionSpecification = [
  'match',
  ['get', 'color'],
  'green',
  LIGHT_HEX.green,
  'blue',
  LIGHT_HEX.blue,
  'amber',
  LIGHT_HEX.amber,
  'red',
  LIGHT_HEX.red,
  LIGHT_HEX.white,
];

/**
 * Taxiway fixtures from the apt.dat line light codes: single glowing points
 * when close, the same segments as blurred lines further out.
 */
export class AirfieldLightsLayer extends BaseLayerRenderer {
  layerId = 'airport-taxiway-lights';
  sourceId = 'airport-taxiway-lights';
  additionalLayerIds = ['airport-taxiway-light-glow'];
  additionalSourceIds = ['airport-taxiway-light-lines'];

  hasData(airport: ParsedAirport): boolean {
    return (
      airport.linearFeatures.some((f) => f.lighting_line_type > 0) ||
      airport.windsocks.some((w) => w.illuminated)
    );
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;
    ensureLightSprites(map);

    const pointZoom = ZOOM_BEHAVIORS.lighting.minZoom;
    const points = taxiwayLightPoints(airport.linearFeatures);
    for (const sock of airport.windsocks) {
      if (!sock.illuminated) continue;
      points.features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [sock.longitude, sock.latitude] },
        properties: { color: 'white', pulse: false },
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
        'line-color': LINE_COLOR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, pointZoom, 1.6],
        'line-blur': 1.2,
        'line-opacity': 0,
      },
    });

    this.addLayer(map, {
      id: this.layerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: pointZoom,
      layout: lightSymbolLayout(pointZoom, 0.8),
      paint: { 'icon-opacity': 0 },
    });
  }
}
