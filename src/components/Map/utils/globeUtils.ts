import mlcontour from 'maplibre-contour';
import maplibregl from 'maplibre-gl';
import { useMapStore } from '@/stores/mapStore';

const TERRAIN_SOURCE_ID = 'terrain-dem';
const HILLSHADE_SOURCE_ID = 'terrain-hillshade-dem';
const TERRAIN_TILES_URL = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
// Use tile-cache:// scheme for contour worker fetches — bypasses Electron CSP
// (blob workers don't inherit CSP from onHeadersReceived)
const TERRAIN_TILES_CACHE_URL = 'tile-cache://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
const HILLSHADE_LAYER_ID = 'terrain-hillshade';
const CONTOUR_SOURCE_ID = 'terrain-contours';
const CONTOUR_LINE_LAYER_ID = 'terrain-contour-lines';
const CONTOUR_LABEL_LAYER_ID = 'terrain-contour-labels';

// Track which map instances already have the TerrainControl (survives style changes)
const terrainControlAdded = new WeakSet<maplibregl.Map>();

// Singleton — register contour protocol only once
let contourDemSource: InstanceType<typeof mlcontour.DemSource> | null = null;

function getContourDemSource(): InstanceType<typeof mlcontour.DemSource> {
  if (!contourDemSource) {
    contourDemSource = new mlcontour.DemSource({
      url: TERRAIN_TILES_CACHE_URL,
      encoding: 'terrarium',
      maxzoom: 10,
    });
    contourDemSource.setupMaplibre(maplibregl);
  }
  return contourDemSource;
}

// Zoom level at which to switch from globe to mercator projection
// Globe projection causes layer displacement issues when rotated at higher zooms
const GLOBE_TO_MERCATOR_ZOOM = 7;

export function setupGlobeProjection(map: maplibregl.Map): void {
  // Start with globe projection
  map.setProjection({ type: 'globe' });
  map.setSky({
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
  });

  // Switch projection based on zoom level to avoid layer displacement.
  // 3D terrain is only enabled in mercator mode — globe projection doesn't
  // implement getRayDirectionFromPixel, which crashes the render loop.
  let currentProjection: 'globe' | 'mercator' = 'globe';
  // Track whether the user wants terrain on (default: on).
  // When switching to globe we must disable terrain, but we remember the preference
  // so we can restore it when switching back to mercator.
  let terrainUserEnabled = true;

  map.on('zoom', () => {
    const zoom = map.getZoom();

    if (zoom > GLOBE_TO_MERCATOR_ZOOM && currentProjection === 'globe') {
      map.setProjection({ type: 'mercator' });
      currentProjection = 'mercator';
      // Restore terrain if the user had it enabled
      if (terrainUserEnabled && map.getSource(TERRAIN_SOURCE_ID)) {
        map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1 });
      }
    } else if (zoom <= GLOBE_TO_MERCATOR_ZOOM && currentProjection === 'mercator') {
      // Remember user preference before forcing terrain off for globe
      terrainUserEnabled = map.getTerrain() != null;
      map.setTerrain(null);
      map.setProjection({ type: 'globe' });
      currentProjection = 'globe';
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

  // Terrain DEM source — used for 3D terrain extrusion (enabled only in mercator mode)
  map.addSource(TERRAIN_SOURCE_ID, {
    type: 'raster-dem',
    encoding: 'terrarium',
    tiles: [TERRAIN_TILES_URL],
    tileSize: 256,
    maxzoom: 10,
  });

  // Separate DEM source for hillshade — avoids competing with terrain extrusion
  // for tile decoding resources (MapLibre recommends separate sources)
  map.addSource(HILLSHADE_SOURCE_ID, {
    type: 'raster-dem',
    encoding: 'terrarium',
    tiles: [TERRAIN_TILES_URL],
    tileSize: 256,
    maxzoom: 10,
  });

  // Terrain is not enabled here — we start in globe mode where it would crash.
  // setupGlobeProjection() enables/disables terrain on projection switches.
  // The TerrainControl button lets the user toggle 3D extrusion when in mercator.
  // Only add the control once (it survives style changes since it's a DOM element).
  if (!terrainControlAdded.has(map)) {
    map.addControl(
      new maplibregl.TerrainControl({ source: TERRAIN_SOURCE_ID, exaggeration: 1 }),
      'bottom-left'
    );
    terrainControlAdded.add(map);
  }

  // Hillshade — shadow/light shading from DEM (uses its own source)
  const beforeLayer = getFirstSymbolLayerId(map);
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
  const demSource = getContourDemSource();

  map.addSource(CONTOUR_SOURCE_ID, {
    type: 'vector',
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

/**
 * TransformStyle callback for map.setStyle() — carries over all custom sources,
 * layers, terrain, and sky from the previous style into the new basemap style.
 * This prevents the "nuke and re-add" cascade that previously required
 * incrementStyleVersion() to trigger every hook to re-add its layers.
 */
export function preserveCustomStyle(
  previous: maplibregl.StyleSpecification | undefined,
  next: maplibregl.StyleSpecification
): maplibregl.StyleSpecification {
  if (!previous) return next;

  const nextSourceIds = new Set(Object.keys(next.sources ?? {}));
  const nextLayerIds = new Set((next.layers ?? []).map((l) => l.id));

  // Carry over all sources that don't exist in the new basemap
  const customSources: Record<string, maplibregl.SourceSpecification> = {};
  for (const [id, source] of Object.entries(previous.sources ?? {})) {
    if (!nextSourceIds.has(id)) {
      customSources[id] = source as maplibregl.SourceSpecification;
    }
  }

  // Carry over all layers that don't exist in the new basemap.
  // Insert terrain shading layers (hillshade, contours) before the first symbol
  // layer so they render below labels; all other custom layers go on top.
  const customLayers = (previous.layers ?? []).filter((l) => !nextLayerIds.has(l.id));
  const terrainIds = new Set(TERRAIN_SHADING_LAYER_IDS);
  const terrainLayers = customLayers.filter((l) => terrainIds.has(l.id));
  const otherLayers = customLayers.filter((l) => !terrainIds.has(l.id));

  const layers = [...next.layers];
  if (terrainLayers.length > 0) {
    const symbolIdx = layers.findIndex((l) => l.type === 'symbol');
    if (symbolIdx >= 0) {
      layers.splice(symbolIdx, 0, ...terrainLayers);
    } else {
      layers.push(...terrainLayers);
    }
  }
  layers.push(...otherLayers);

  return {
    ...next,
    sources: { ...next.sources, ...customSources },
    layers,
    terrain: previous.terrain ?? next.terrain,
    sky: previous.sky ?? next.sky,
  };
}

/** Find the first symbol layer to insert raster/line layers below labels. */
function getFirstSymbolLayerId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle()?.layers;
  if (!layers) return undefined;
  for (const layer of layers) {
    if (layer.type === 'symbol') return layer.id;
  }
  return undefined;
}
