import maplibregl from 'maplibre-gl';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import type { ParsedAirport, TaxiNodeUsage } from '@/types/apt';
import { createRoutingNetworkGeoJSON } from '../../utils/geoJsonFactory';
import { safeAddGeoJSONSource } from '../types';
import { BaseLayerRenderer } from './BaseLayerRenderer';

/**
 * Draws X-Plane's raw ground routing network: the taxi routing graph that
 * taxi routes are computed on (apt.dat 1201 nodes, 1202 edges) plus the
 * service road network (1206), which reuses the same nodes.
 *
 * This is a technical view rather than a depiction of the airport. It is what
 * the router sees, so it is drawn as a schematic — thin lines on the node
 * centres, not to the width of the real taxiway — and deliberately does not
 * follow the surface colours the other airport layers use.
 */

/**
 * Taxi routing edges. Magenta rather than taxiway yellow: this is the router's
 * view, not a depiction of the surface, and it has to stay separable from the
 * amber taxiway name labels already drawn over the same geometry.
 */
const TAXI_COLOR = '#d946ef';
/** Runway edges within the routing graph. */
const RUNWAY_COLOR = '#ef4444';
/** Service roads (1206). Deliberately muted — usually the densest network. */
const TRUCK_COLOR = '#94a3b8';

/** Node colours by usage flag, so junctions vs start/end points are legible. */
const NODE_COLORS = {
  junc: '#38bdf8',
  init: '#22c55e',
  // Yellow and orange rather than the pink they were: pink sat too close to
  // the magenta edges to be readable where a node overlaps its own line.
  dest: '#facc15',
  both: '#fb923c',
} as const satisfies Record<TaxiNodeUsage, string>;
const NODE_FALLBACK_COLOR = '#64748b';

export class RoutingNetworkLayer extends BaseLayerRenderer {
  layerId = 'airport-routing-edges';
  sourceId = 'airport-routing-edges';
  additionalLayerIds = [
    'airport-routing-truck-edges',
    'airport-routing-arrows',
    'airport-routing-nodes',
  ];
  additionalSourceIds = ['airport-routing-nodes'];

  private readonly nodeSourceId = 'airport-routing-nodes';

  hasData(airport: ParsedAirport): boolean {
    const network = airport.taxiNetwork;
    if (!network || network.nodes.length === 0) return false;
    return network.edges.length > 0 || network.truckEdges.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport) || !airport.taxiNetwork) return;

    const { edges, nodes } = createRoutingNetworkGeoJSON(airport.taxiNetwork);
    if (edges.features.length === 0 && nodes.features.length === 0) return;

    this.addSource(map, edges);
    safeAddGeoJSONSource(map, this.nodeSourceId, nodes);

    // Two line layers rather than one, because `line-dasharray` is not a
    // data-driven property in MapLibre — it cannot be varied per feature, so
    // the dashed service roads have to be filtered into their own layer.
    this.addLayer(map, {
      id: this.layerId,
      type: 'line',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.taxiways.minZoom,
      filter: ['!=', ['get', 'kind'], 'truck'],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['match', ['get', 'kind'], 'runway', RUNWAY_COLOR, TAXI_COLOR],
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 2, 18, 3.5],
        'line-opacity': 0.9,
      },
    });

    // Service roads dashed, so they stay distinguishable from taxi edges where
    // the two networks run parallel — which is most of an apron.
    this.addLayer(map, {
      id: 'airport-routing-truck-edges',
      type: 'line',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.taxiways.minZoom,
      filter: ['==', ['get', 'kind'], 'truck'],
      layout: {
        'line-cap': 'butt',
        'line-join': 'round',
      },
      paint: {
        'line-color': TRUCK_COLOR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.8, 15, 1.4, 18, 2.4],
        'line-opacity': 0.75,
        'line-dasharray': [2, 2],
      },
    });

    // One-way markers. Placed along the line so the direction of travel the
    // router is constrained by is visible, which is the main thing you cannot
    // infer from the geometry alone.
    this.addLayer(map, {
      id: 'airport-routing-arrows',
      type: 'symbol',
      source: this.sourceId,
      minzoom: 14,
      filter: ['==', ['get', 'oneway'], true],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 60,
        'text-field': '▶',
        'text-font': ['Open Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 8, 18, 13],
        'text-rotation-alignment': 'map',
        'text-keep-upright': false,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': [
          'match',
          ['get', 'kind'],
          'runway',
          RUNWAY_COLOR,
          'truck',
          TRUCK_COLOR,
          TAXI_COLOR,
        ],
        'text-halo-color': 'rgba(0, 0, 0, 0.6)',
        'text-halo-width': 1,
      },
    });

    this.addLayer(map, {
      id: 'airport-routing-nodes',
      type: 'circle',
      source: this.nodeSourceId,
      minzoom: 13,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 16, 3, 19, 5],
        'circle-color': [
          'match',
          ['get', 'usage'],
          'junc',
          NODE_COLORS.junc,
          'init',
          NODE_COLORS.init,
          'dest',
          NODE_COLORS.dest,
          'both',
          NODE_COLORS.both,
          NODE_FALLBACK_COLOR,
        ],
        'circle-stroke-color': 'rgba(0, 0, 0, 0.7)',
        'circle-stroke-width': 0.5,
      },
    });
  }
}
