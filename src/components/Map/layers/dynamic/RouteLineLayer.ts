import type { GeoJSONSource, Map } from 'maplibre-gl';
import { greatCircleArc } from '@/lib/measure/geodesic';

const SOURCE_ID = 'route-line-source';
const LAYER_ID = 'route-line';

export const ROUTE_LINE_LAYER_IDS = [LAYER_ID];

export function addRouteLineLayer(map: Map): void {
  if (!map.getStyle()) return;

  if (map.getSource(SOURCE_ID)) return;

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    paint: {
      'line-color': '#f59e0b',
      'line-width': 2,
      'line-dasharray': [4, 2],
    },
  });
}

export function updateRouteLine(
  map: Map,
  route: { from: [number, number]; to: [number, number] } | null
): void {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;

  if (!route) {
    source.setData({ type: 'FeatureCollection', features: [] });
    return;
  }

  // Create great circle arc
  const coordinates = greatCircleArc(route.from, route.to, 100);

  source.setData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    ],
  });
}

export function removeRouteLineLayer(map: Map): void {
  const doRemove = () => {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  };

  if (!map.getStyle()) return;
  doRemove();
}
