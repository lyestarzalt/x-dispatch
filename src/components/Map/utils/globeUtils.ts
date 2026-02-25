import maplibregl from 'maplibre-gl';

const TERRAIN_SOURCE_ID = 'terrain-dem';
const TERRAIN_TILES_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

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
    maxzoom: 15,
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
}
