import mlcontour from 'maplibre-contour';
import maplibregl from 'maplibre-gl';

const TERRAIN_SOURCE_ID = 'terrain-dem';
const TERRAIN_TILES_URL = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
// Use tile-cache:// scheme for contour worker fetches — bypasses Electron CSP
// (blob workers don't inherit CSP from onHeadersReceived)
const TERRAIN_TILES_CACHE_URL = 'tile-cache://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
const HILLSHADE_LAYER_ID = 'terrain-hillshade';
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

  // Switch projection based on zoom level to avoid layer displacement
  let currentProjection: 'globe' | 'mercator' = 'globe';

  map.on('zoom', () => {
    const zoom = map.getZoom();

    if (zoom > GLOBE_TO_MERCATOR_ZOOM && currentProjection === 'globe') {
      map.setProjection({ type: 'mercator' });
      currentProjection = 'mercator';
    } else if (zoom <= GLOBE_TO_MERCATOR_ZOOM && currentProjection === 'mercator') {
      map.setProjection({ type: 'globe' });
      currentProjection = 'globe';
    }
  });
}

export function setup3DTerrain(map: maplibregl.Map): void {
  if (map.getSource(TERRAIN_SOURCE_ID)) return;

  map.addSource(TERRAIN_SOURCE_ID, {
    type: 'raster-dem',
    encoding: 'terrarium',
    tiles: [TERRAIN_TILES_URL],
    tileSize: 256,
    maxzoom: 10,
  });

  // TODO: Replace TerrainControl with custom SafeTerrainControl
  // Issue: MapLibre's built-in TerrainControl calls map.setTerrain() internally
  // when user clicks the button. If map is mid-render, this crashes with:
  // "TypeError: Cannot read properties of undefined (reading 'key')"
  // in _updateRetainedTiles during DEM tile loading.
  // Fix: Create custom control that checks map.isStyleLoaded() before toggling terrain.
  map.addControl(
    new maplibregl.TerrainControl({ source: TERRAIN_SOURCE_ID, exaggeration: 1 }),
    'bottom-left'
  );

  // Hillshade — shadow/light shading from DEM
  const beforeLayer = getFirstSymbolLayerId(map);
  map.addLayer(
    {
      id: HILLSHADE_LAYER_ID,
      type: 'hillshade',
      source: TERRAIN_SOURCE_ID,
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
