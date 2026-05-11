/**
 * Taxi route renderer — MapLibre line + symbol + circle layers.
 *
 * Replaced an earlier 2D-canvas overlay that re-projected every node and
 * cleared/repainted the viewport at 60 fps. The canvas approach also showed
 * "alternating direction" chevrons at high zoom: when A* sub-paths were
 * stitched at junction nodes the route could contain a pair of nodes at the
 * same physical position with distinct IDs, which the id-based dedup in
 * `taxiRouteStore` doesn't catch. In screen space those near-coincident
 * pairs produced backward-pointing segments and chevrons drawn on them
 * inverted. Switching to native layers fixes both: MapLibre rasterises the
 * line and symbols on the GPU, and the coord-level dedup we apply before
 * feeding the source removes the root cause of the inverted chevrons.
 *
 * Static — no animation. MapLibre has no native "offset symbols along a
 * line" property, and the workarounds (animated `line-dasharray` overlay,
 * per-frame source-data shifting) cost a full map re-render per tick,
 * which lags meaningfully against a heavy basemap. The chevrons themselves
 * are enough of a direction indicator; if we ever want continuous motion
 * we'll need a `CustomLayerInterface` WebGL layer.
 */
import type maplibregl from 'maplibre-gl';

const SOURCE_ID = 'taxi-route-source';
const PREVIEW_SOURCE_ID = 'taxi-route-preview-source';
const ENDPOINTS_SOURCE_ID = 'taxi-route-endpoints-source';
const HANDLE_SOURCE_ID = 'taxi-route-handle-source';

const CASING_LAYER_ID = 'taxi-route-casing';
const LINE_LAYER_ID = 'taxi-route-line';
const CHEVRON_LAYER_ID = 'taxi-route-chevrons';
const PREVIEW_LAYER_ID = 'taxi-route-preview';
const ENDPOINTS_LAYER_ID = 'taxi-route-endpoints';
const HANDLE_LAYER_ID = 'taxi-route-handle';

const CHEVRON_IMAGE_ID = 'taxi-chevron';

const ROUTE_GREEN = '#22c55e';
const ROUTE_CASING = 'rgba(0, 0, 0, 0.7)';
const PREVIEW_COLOR = 'rgba(34, 197, 94, 0.55)';

export const TAXI_ROUTE_LAYER_IDS = [
  CASING_LAYER_ID,
  LINE_LAYER_ID,
  CHEVRON_LAYER_ID,
  PREVIEW_LAYER_ID,
  ENDPOINTS_LAYER_ID,
  HANDLE_LAYER_ID,
];

export interface RoutePoint {
  longitude: number;
  latitude: number;
}

export interface EndpointDef {
  longitude: number;
  latitude: number;
  kind: 'start' | 'end';
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Render the chevron icon synchronously into an ImageData buffer that
 * MapLibre can register without waiting for an HTMLImageElement load
 * event. The async approach (Image.src = data URL) raced against tile
 * rendering and tripped a `getImage` error path inside MapLibre — and the
 * symbol layer that referenced the not-yet-loaded image silently failed
 * along with the rest of the route.
 */
function renderChevronImage(): ImageData {
  const w = 20;
  const h = 14;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(3, 3);
  ctx.lineTo(12, 7);
  ctx.lineTo(3, 11);
  ctx.stroke();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Drop consecutive points that share a position within `epsilon` degrees
 * (~11 cm at the equator at 1e-6). This is the dedup that the id-based one
 * in `taxiRouteStore` can't do — junction nodes from different A* sub-paths
 * may carry distinct IDs but identical lat/lon, and feeding both to MapLibre
 * gives a zero-or-near-zero-length sub-segment whose tangent direction
 * inverts the chevrons placed on it.
 */
function dedupCoincident(points: RoutePoint[], epsilon = 1e-6): RoutePoint[] {
  if (points.length < 2) return points.slice();
  const out: RoutePoint[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1]!;
    const cur = points[i]!;
    if (
      Math.abs(prev.longitude - cur.longitude) > epsilon ||
      Math.abs(prev.latitude - cur.latitude) > epsilon
    ) {
      out.push(cur);
    }
  }
  return out;
}

function buildLineFC(points: RoutePoint[]): GeoJSON.FeatureCollection {
  const cleaned = dedupCoincident(points);
  if (cleaned.length < 2) return EMPTY_FC;
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: cleaned.map((p) => [p.longitude, p.latitude]),
        },
        properties: {},
      },
    ],
  };
}

function buildEndpointsFC(endpoints: EndpointDef[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: endpoints.map((e) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.longitude, e.latitude] },
      properties: { kind: e.kind },
    })),
  };
}

/**
 * Pick a `beforeId` so our taxi-route layers slot *between* the airport's
 * centerline pair and marking pair. `airport-linear-features-border` is the
 * marking casing — inserting before it keeps the visual stack:
 *   1. taxiway surface + centerline pair (rendered earlier)
 *   2. our route + chevrons (here)
 *   3. marking pair + lights + gates + plane (rendered after)
 *
 * If the airport hasn't rendered yet we return undefined (append). The
 * subsequent airport render adds the marking pair without a `before` arg,
 * so they end up on top of us anyway.
 */
function pickTaxiRouteAnchor(map: maplibregl.Map): string | undefined {
  const candidates = ['airport-linear-features-border', 'airport-linear-features'];
  for (const id of candidates) {
    if (map.getLayer(id)) return id;
  }
  return undefined;
}

function buildHandleFC(
  handle: { longitude: number; latitude: number; grabbed: boolean } | null
): GeoJSON.FeatureCollection {
  if (!handle) return EMPTY_FC;
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [handle.longitude, handle.latitude] },
        properties: { grabbed: handle.grabbed ? 1 : 0 },
      },
    ],
  };
}

export function addTaxiRouteLayer(map: maplibregl.Map): void {
  if (!map.isStyleLoaded()) return;

  // The chevron image is per-style; setStyle wipes images even though
  // `transformStyle` carries our sources/layers across. Re-add when missing,
  // independent of the source-existence guard below.
  if (!map.hasImage(CHEVRON_IMAGE_ID)) {
    try {
      const data = renderChevronImage();
      map.addImage(
        CHEVRON_IMAGE_ID,
        { width: data.width, height: data.height, data: new Uint8Array(data.data) },
        { sdf: false, pixelRatio: Math.max(1, window.devicePixelRatio || 1) }
      );
    } catch (err) {
      window.appAPI?.log?.warn?.('[TaxiRouteLayer] addImage failed', err);
    }
  }

  if (map.getSource(SOURCE_ID)) return;

  try {
    map.addSource(SOURCE_ID, { type: 'geojson', data: EMPTY_FC });
    map.addSource(PREVIEW_SOURCE_ID, { type: 'geojson', data: EMPTY_FC });
    map.addSource(ENDPOINTS_SOURCE_ID, { type: 'geojson', data: EMPTY_FC });
    map.addSource(HANDLE_SOURCE_ID, { type: 'geojson', data: EMPTY_FC });
    addTaxiRouteLayers(map);
    window.appAPI?.log?.info?.('[TaxiRouteLayer] mounted');
  } catch (err) {
    window.appAPI?.log?.error?.('[TaxiRouteLayer] mount failed', err);
  }
}

function addTaxiRouteLayers(map: maplibregl.Map): void {
  // Two z-bands. The route's visual layers (casing → line → chevrons) slot
  // *between* the airport's centerline pair and marking pair so painted
  // markings (hold-short bars, gate lines) still read on top of the green
  // path. The interactive helpers (preview, endpoints, handle) go *on top*
  // of everything — the user needs them clickable and unobscured while
  // editing the route.
  const before = pickTaxiRouteAnchor(map);

  map.addLayer(
    {
      id: CASING_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ROUTE_CASING,
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 7, 18, 14, 22, 22],
      },
    },
    before
  );

  map.addLayer(
    {
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ROUTE_GREEN,
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 5, 18, 10, 22, 18],
      },
    },
    before
  );

  map.addLayer(
    {
      id: CHEVRON_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 13, 30, 18, 55, 22, 90],
        'icon-image': CHEVRON_IMAGE_ID,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.6, 18, 0.95, 22, 1.25],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
    before
  );

  // Helpers — no beforeId → appended to the top of the layer stack so they
  // sit above every airport feature regardless of basemap or anchor lookup.
  map.addLayer({
    id: PREVIEW_LAYER_ID,
    type: 'line',
    source: PREVIEW_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': PREVIEW_COLOR,
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 3, 18, 6, 22, 9],
      'line-dasharray': [2, 2],
    },
  });

  map.addLayer({
    id: ENDPOINTS_LAYER_ID,
    type: 'circle',
    source: ENDPOINTS_SOURCE_ID,
    paint: {
      'circle-color': ROUTE_GREEN,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 5, 18, 7, 22, 9],
      'circle-stroke-color': ROUTE_CASING,
      'circle-stroke-width': 2.5,
    },
  });

  map.addLayer({
    id: HANDLE_LAYER_ID,
    type: 'circle',
    source: HANDLE_SOURCE_ID,
    paint: {
      'circle-color': '#ffffff',
      // MapLibre forbids nesting two zoom-based subexpressions, so the
      // grab-vs-hover sizing lives inside the interpolate stops, not around
      // a separate `case`.
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        13,
        ['case', ['==', ['get', 'grabbed'], 1], 7, 5],
        22,
        ['case', ['==', ['get', 'grabbed'], 1], 11, 8],
      ],
      'circle-stroke-color': ROUTE_GREEN,
      'circle-stroke-width': 2,
    },
  });
}

export function setTaxiRoute(map: maplibregl.Map, points: RoutePoint[]): void {
  const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  src?.setData(buildLineFC(points));
}

export function setTaxiRoutePreview(map: maplibregl.Map, points: RoutePoint[] | null): void {
  const src = map.getSource(PREVIEW_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  src?.setData(buildLineFC(points ?? []));
}

export function setTaxiRouteEndpoints(map: maplibregl.Map, endpoints: EndpointDef[]): void {
  const src = map.getSource(ENDPOINTS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  src?.setData(buildEndpointsFC(endpoints));
}

export function setTaxiRouteHandle(
  map: maplibregl.Map,
  handle: { longitude: number; latitude: number; grabbed: boolean } | null
): void {
  const src = map.getSource(HANDLE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  src?.setData(buildHandleFC(handle));
}

export function removeTaxiRouteLayer(map: maplibregl.Map): void {
  if (!map.getStyle()) return;
  for (const id of TAXI_ROUTE_LAYER_IDS) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of [SOURCE_ID, PREVIEW_SOURCE_ID, ENDPOINTS_SOURCE_ID, HANDLE_SOURCE_ID]) {
    if (map.getSource(id)) map.removeSource(id);
  }
}

// Exported for unit tests.
export { dedupCoincident };
