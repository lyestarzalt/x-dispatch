import { MaplibreStarfieldLayer } from '@geoql/maplibre-gl-starfield';
import mlcontour from 'maplibre-contour';
import * as maplibregl from 'maplibre-gl';
import {
  CITY_LIGHTS_BASEMAP_LAYER_IDS,
  CITY_LIGHTS_PLACE_LAYER_IDS,
} from '@/lib/map/solar/cityLightsStyle';
import { useMapStore } from '@/stores/mapStore';
import { lowestOf } from '../layers/world/layerOrder';
import { makePreserveCustomStyle as makePreserveCustomStyleInternal } from './preserveCustomStyle';

const TERRAIN_SOURCE_ID = 'terrain-dem';
const HILLSHADE_SOURCE_ID = 'terrain-hillshade-dem';
// Use tile-cache:// scheme for contour worker fetches — bypasses Electron CSP
// (blob workers don't inherit CSP from onHeadersReceived)
const TERRAIN_TILES_CACHE_URL = 'tile-cache://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
const TERRAIN_DEM_MAXZOOM = 10;
// Contour thresholds start at this zoom; requesting contour tiles below it
// only produces empty tiles after a DEM fetch.
const CONTOUR_MINZOOM = 11;
export const HILLSHADE_LAYER_ID = 'terrain-hillshade';
const CONTOUR_SOURCE_ID = 'terrain-contours';
const CONTOUR_LINE_LAYER_ID = 'terrain-contour-lines';
const CONTOUR_LABEL_LAYER_ID = 'terrain-contour-labels';

// Singleton — register contour protocol only once
let contourDemSource: InstanceType<typeof mlcontour.DemSource> | null = null;

function getContourDemSource(): InstanceType<typeof mlcontour.DemSource> {
  if (!contourDemSource) {
    contourDemSource = new mlcontour.DemSource({
      url: TERRAIN_TILES_CACHE_URL,
      encoding: 'terrarium',
      maxzoom: TERRAIN_DEM_MAXZOOM,
    });
    contourDemSource.setupMaplibre(maplibregl);
  }
  return contourDemSource;
}

// Zoom level at which to switch from globe to mercator projection
// Globe projection causes layer displacement issues when rotated at higher zooms
export const GLOBE_TO_MERCATOR_ZOOM = 7;

const STARFIELD_LAYER_ID = 'starfield';

/**
 * Sky settings that hold regardless of the sun: the atmosphere halo fades
 * out as the globe hands over to mercator. The solar sky hook layers its
 * colours on top of this.
 */
export const BASE_SKY: maplibregl.SkySpecification = {
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
};

// Re-export from the dedicated style-transition module so external callers
// keep the single import surface (`from './utils/globeUtils'`).
export { captureBasemapSnapshot } from './preserveCustomStyle';

/**
 * MapLibre's `getStyle()` does not serialize CustomLayerInterface objects,
 * so the starfield layer cannot be carried across `setStyle()` via
 * `transformStyle`. Re-add it on every `style.load` if the new style
 * doesn't already have it.
 */
function addStarfieldIfMissing(map: maplibregl.Map): void {
  if (map.getLayer(STARFIELD_LAYER_ID)) return;
  const starfield = new MaplibreStarfieldLayer({
    id: STARFIELD_LAYER_ID,
    starCount: 3000,
    starSize: 1.5,
  });
  const firstLayer = map.getStyle().layers?.[0]?.id;
  map.addLayer(starfield as unknown as maplibregl.CustomLayerInterface, firstLayer);
}

export function setupGlobeProjection(map: maplibregl.Map): void {
  // Start with globe projection
  map.setProjection({ type: 'globe' });
  map.setSky(BASE_SKY);

  addStarfieldIfMissing(map);

  // Switch projection based on zoom level to avoid layer displacement.
  // 3D terrain is only enabled in mercator mode — globe projection doesn't
  // implement getRayDirectionFromPixel, which crashes the render loop.
  let currentProjection: 'globe' | 'mercator' = 'globe';

  map.on('zoom', () => {
    const zoom = map.getZoom();
    const { terrain3dEnabled } = useMapStore.getState();

    if (zoom > GLOBE_TO_MERCATOR_ZOOM && currentProjection === 'globe') {
      map.setProjection({ type: 'mercator' });
      currentProjection = 'mercator';
      // Hide starfield in mercator — no sky to render into
      if (map.getLayer(STARFIELD_LAYER_ID)) {
        map.setLayoutProperty(STARFIELD_LAYER_ID, 'visibility', 'none');
      }
      // Apply terrain in mercator if the user has 3D terrain enabled
      if (terrain3dEnabled && map.getSource(TERRAIN_SOURCE_ID)) {
        map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1 });
      }
    } else if (zoom <= GLOBE_TO_MERCATOR_ZOOM && currentProjection === 'mercator') {
      // Globe is incompatible with terrain — force off, the setting is preserved.
      map.setTerrain(null);
      map.setProjection({ type: 'globe' });
      currentProjection = 'globe';
      // Show starfield again in globe mode
      if (map.getLayer(STARFIELD_LAYER_ID)) {
        map.setLayoutProperty(STARFIELD_LAYER_ID, 'visibility', 'visible');
      }
    }
  });

  // React to user toggling 3D terrain in Settings → Graphics. Only takes
  // effect in mercator (globe forbids terrain), but we always update the
  // map state so the next projection switch picks it up.
  useMapStore.subscribe((state, prev) => {
    if (state.terrain3dEnabled === prev.terrain3dEnabled) return;
    if (currentProjection !== 'mercator') return;
    if (state.terrain3dEnabled && map.getSource(TERRAIN_SOURCE_ID)) {
      map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1 });
    } else {
      map.setTerrain(null);
    }
  });

  // map.setStyle() rebuilds the map's transform from the new style spec, which
  // resets the projection to whatever the spec defines (mercator by default
  // for raster styles like Esri Satellite, since `tileUrlToStyle` doesn't
  // emit a `projection` field). Re-assert the projection we want every time
  // a new style finishes loading. `style.load` fires once per setStyle call,
  // after the style is committed.
  map.on('style.load', () => {
    map.setProjection({ type: currentProjection });
    // Sky is also style-scoped — re-apply for globe so the atmosphere
    // gradient comes back when the user toggles styles at low zoom.
    if (currentProjection === 'globe') {
      map.setSky(BASE_SKY);
    }
    // Re-add the starfield since CustomLayerInterface doesn't survive setStyle.
    addStarfieldIfMissing(map);
    // Match starfield visibility to current projection (hidden in mercator).
    if (map.getLayer(STARFIELD_LAYER_ID)) {
      map.setLayoutProperty(
        STARFIELD_LAYER_ID,
        'visibility',
        currentProjection === 'globe' ? 'visible' : 'none'
      );
    }
  });
}

export const TERRAIN_SHADING_LAYER_IDS = [
  HILLSHADE_LAYER_ID,
  CONTOUR_LINE_LAYER_ID,
  CONTOUR_LABEL_LAYER_ID,
];

export function setup3DTerrain(map: maplibregl.Map): void {
  if (map.getSource(TERRAIN_SOURCE_ID)) return;

  // Terrain, hillshade and contours all consume the same DEM tiles. The
  // contour worker keeps a decoded-tile cache and exposes it through a
  // protocol URL, so the two raster-dem sources read from that cache instead
  // of fetching every tile a second and third time.
  const demSource = getContourDemSource();

  // Terrain DEM source — used for 3D terrain extrusion (enabled only in mercator mode)
  map.addSource(TERRAIN_SOURCE_ID, {
    type: 'raster-dem',
    encoding: 'terrarium',
    tiles: [demSource.sharedDemProtocolUrl],
    tileSize: 256,
    maxzoom: TERRAIN_DEM_MAXZOOM,
  });

  // Separate DEM source for hillshade — avoids competing with terrain extrusion
  // for tile decoding resources (MapLibre recommends separate sources)
  map.addSource(HILLSHADE_SOURCE_ID, {
    type: 'raster-dem',
    encoding: 'terrarium',
    tiles: [demSource.sharedDemProtocolUrl],
    tileSize: 256,
    maxzoom: TERRAIN_DEM_MAXZOOM,
  });

  // Terrain is not enabled here — we start in globe mode where it would crash.
  // setupGlobeProjection() enables/disables terrain on projection switches
  // based on the `terrain3dEnabled` setting in mapStore (Settings → Graphics).

  // Hillshade — shadow/light shading from DEM (uses its own source). Sits
  // below labels and below the sun-driven overlays, which may already be on
  // the map since they attach as soon as the style is usable.
  const beforeLayer = lowestOf(map, SOLAR_OVERLAY_LAYER_IDS);
  map.addLayer(
    {
      id: HILLSHADE_LAYER_ID,
      type: 'hillshade',
      source: HILLSHADE_SOURCE_ID,
      minzoom: GLOBE_TO_MERCATOR_ZOOM,
      paint: {
        'hillshade-exaggeration': 0.5,
        'hillshade-shadow-color': '#000000',
        'hillshade-highlight-color': '#ffffff',
        'hillshade-illumination-direction': 315,
      },
    },
    beforeLayer
  );

  // Contour lines
  map.addSource(CONTOUR_SOURCE_ID, {
    type: 'vector',
    minzoom: CONTOUR_MINZOOM,
    tiles: [
      demSource.contourProtocolUrl({
        overzoom: 1,
        thresholds: {
          11: [200, 1000],
          12: [100, 500],
          13: [50, 200],
          14: [20, 100],
        },
        elevationKey: 'ele',
        levelKey: 'level',
        contourLayer: 'contours',
      }),
    ],
    maxzoom: 15,
  });

  map.addLayer(
    {
      id: CONTOUR_LINE_LAYER_ID,
      type: 'line',
      source: CONTOUR_SOURCE_ID,
      'source-layer': 'contours',
      paint: {
        'line-color': 'rgba(180, 140, 80, 0.5)',
        'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5],
      },
    },
    beforeLayer
  );

  map.addLayer({
    id: CONTOUR_LABEL_LAYER_ID,
    type: 'symbol',
    source: CONTOUR_SOURCE_ID,
    'source-layer': 'contours',
    filter: ['==', ['get', 'level'], 1],
    layout: {
      'symbol-placement': 'line',
      'text-field': ['concat', ['number-format', ['get', 'ele'], {}], ' m'],
      'text-font': ['Open Sans Regular'],
      'text-size': 10,
    },
    paint: {
      'text-color': 'rgba(180, 140, 80, 0.8)',
      'text-halo-color': 'rgba(0, 0, 0, 0.7)',
      'text-halo-width': 1,
    },
  });

  // Apply persisted visibility (layers default to visible, hide if user toggled off)
  const { terrainShadingEnabled } = useMapStore.getState();
  if (!terrainShadingEnabled) {
    setTerrainShadingVisibility(map, false);
  }
}

export function setTerrainShadingVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  for (const id of TERRAIN_SHADING_LAYER_IDS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visibility);
    }
  }
}

/** City lights: above terrain shading, below labels. */
const SOLAR_OVERLAY_LAYER_IDS: ReadonlySet<string> = new Set([
  ...CITY_LIGHTS_BASEMAP_LAYER_IDS,
  ...CITY_LIGHTS_PLACE_LAYER_IDS,
]);

/**
 * App layers that must stay below the basemap's labels across a style
 * change. The city-light layers drawn from basemap tiles are not listed:
 * they reference the old basemap's source and are rebuilt on `style.load`.
 */
const BELOW_LABEL_LAYER_IDS = [...TERRAIN_SHADING_LAYER_IDS, ...CITY_LIGHTS_PLACE_LAYER_IDS];

/**
 * Build a transformStyle callback bound to a specific map instance, wired
 * with this app's known custom-layer IDs (starfield, below-label overlays).
 * Implementation lives in `./preserveCustomStyle` so it can be tested
 * without dragging in `maplibre-contour` and the starfield runtime.
 */
export function makePreserveCustomStyle(map: maplibregl.Map) {
  return makePreserveCustomStyleInternal(map, BELOW_LABEL_LAYER_IDS, STARFIELD_LAYER_ID);
}
