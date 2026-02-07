import type { GeoJSONSource, Map } from 'maplibre-gl';

const SOURCE_ID = 'route-line-source';
const LAYER_ID = 'route-line';

export const ROUTE_LINE_LAYER_IDS = [LAYER_ID];

// Calculate intermediate points along a great circle arc
function greatCircleArc(
  from: [number, number],
  to: [number, number],
  numPoints: number = 100
): [number, number][] {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;

  // Convert to radians
  const φ1 = (lat1 * Math.PI) / 180;
  const λ1 = (lon1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const λ2 = (lon2 * Math.PI) / 180;

  // Calculate angular distance
  const Δσ = Math.acos(
    Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)
  );

  // If points are very close, just return a straight line
  if (Δσ < 0.0001) {
    return [from, to];
  }

  const points: [number, number][] = [];

  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;

    // Spherical linear interpolation
    const A = Math.sin((1 - f) * Δσ) / Math.sin(Δσ);
    const B = Math.sin(f * Δσ) / Math.sin(Δσ);

    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);

    points.push([(lon * 180) / Math.PI, (lat * 180) / Math.PI]);
  }

  return points;
}

export function addRouteLineLayer(map: Map): void {
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
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}
