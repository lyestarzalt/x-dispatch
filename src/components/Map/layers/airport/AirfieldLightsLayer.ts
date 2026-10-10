import * as maplibregl from 'maplibre-gl';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { LIGHT_RULES, taxiwayLightPoints } from '@/lib/airportLights/taxiwayLights';
import type { LineLightingType, ParsedAirport } from '@/types/apt';
import { BaseLayerRenderer } from './BaseLayerRenderer';
import { LIGHT_HEX, lightCoreLayerId, lightLayers } from './lightLayers';

const WINDSOCK_GLOW_SIZE = 3;

/** The painted-line source already carries every lit segment and its light code. */
const LINE_SOURCE_ID = 'airport-linear-features';

const LIT_CODES = Object.keys(LIGHT_RULES).map(Number) as LineLightingType[];

/** Line light code to the fixture colour, for the far-zoom glow. */
const GLOW_COLOR_EXPR = [
  'match',
  ['get', 'lightingType'],
  ...LIT_CODES.flatMap((code) => [code, LIGHT_HEX[LIGHT_RULES[code]!.colors[0]!]]),
  LIGHT_HEX.white,
] as unknown as maplibregl.ExpressionSpecification;

export const TAXIWAY_LIGHT_LAYERS = [
  'airport-taxiway-lights',
  lightCoreLayerId('airport-taxiway-lights'),
  'airport-taxiway-light-glow',
];

/**
 * Taxiway fixtures from the apt.dat line light codes: glowing points when
 * close, the same segments as blurred lines further out. The line glow is
 * drawn straight from the linear-features source rather than a second
 * copy of the geometry.
 */
export class AirfieldLightsLayer extends BaseLayerRenderer {
  layerId = 'airport-taxiway-lights';
  sourceId = 'airport-taxiway-lights';
  additionalLayerIds = TAXIWAY_LIGHT_LAYERS.filter((id) => id !== 'airport-taxiway-lights');

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

    // LinearFeatureLayer renders first and owns the line source.
    if (map.getSource(LINE_SOURCE_ID)) {
      this.addLayer(map, {
        id: 'airport-taxiway-light-glow',
        type: 'line',
        source: LINE_SOURCE_ID,
        filter: ['match', ['get', 'lightingType'], LIT_CODES, true, false],
        minzoom: ZOOM_BEHAVIORS.taxiways.minZoom,
        maxzoom: pointZoom,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': GLOW_COLOR_EXPR,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, pointZoom, 1.6],
          'line-blur': 1.2,
          'line-opacity': 0,
        },
      });
    }

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
