import maplibregl from 'maplibre-gl';
import type { PlanePosition } from '@/types/xplane';

const LAYER_ID = 'player-plane';
const SOURCE_ID = 'player-plane-source';

const COLOR = '#3b82f6';

// Inline SVG for the 3D glossy plane icon
const ICON_SVG = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="leftFace" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5eb3ff"/>
      <stop offset="100%" stop-color="#3a8de0"/>
    </linearGradient>
    <linearGradient id="rightFace" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2d6fbf"/>
      <stop offset="100%" stop-color="#163d6e"/>
    </linearGradient>
    <linearGradient id="topShine" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.5)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <polygon points="17,5 29,28 17,22 5,28" fill="rgba(0,0,0,0.25)"/>
  <polygon points="16,3 16,20 6,26" fill="url(#leftFace)"/>
  <polygon points="16,3 16,20 26,26" fill="url(#rightFace)"/>
  <polygon points="6,26 16,20 12,20" fill="#2568a8"/>
  <polygon points="26,26 16,20 20,20" fill="#163d6e"/>
  <line x1="16" y1="3" x2="16" y2="20" stroke="rgba(255,255,255,0.25)" stroke-width="0.6"/>
  <polygon points="16,3 16,12 10,14" fill="url(#topShine)" opacity="0.4"/>
  <line x1="16" y1="3" x2="6" y2="26" stroke="rgba(255,255,255,0.15)" stroke-width="0.4"/>
</svg>`;

function createIcon(): string {
  return `data:image/svg+xml;base64,${btoa(ICON_SVG)}`;
}

function createGeoJSON(position: PlanePosition | null): GeoJSON.FeatureCollection {
  if (!position) {
    return { type: 'FeatureCollection', features: [] };
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [position.lng, position.lat],
        },
        properties: {
          heading: position.heading,
          altitude: position.altitude,
          groundspeed: position.groundspeed,
        },
      },
    ],
  };
}

const iconLoaded = new WeakSet<maplibregl.Map>();

export function addPlaneLayer(map: maplibregl.Map, position: PlanePosition | null): void {
  removePlaneLayer(map);

  // Load icon first if needed
  if (!iconLoaded.has(map) && !map.hasImage('player-plane-icon')) {
    const img = new Image();
    img.onload = () => {
      if (!map.hasImage('player-plane-icon')) {
        map.addImage('player-plane-icon', img, { sdf: false });
      }
      iconLoaded.add(map);
      addPlaneLayer(map, position);
    };
    img.onerror = () => {
      iconLoaded.add(map);
      addPlaneLayer(map, position);
    };
    img.src = createIcon();
    return;
  }

  const geojson = createGeoJSON(position);

  map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

  // Glow effect
  map.addLayer({
    id: `${LAYER_ID}-glow`,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-color': COLOR,
      'circle-radius': 12,
      'circle-blur': 0.8,
      'circle-opacity': 0.4,
    },
  });

  // Plane icon
  if (map.hasImage('player-plane-icon')) {
    map.addLayer({
      id: LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'icon-image': 'player-plane-icon',
        'icon-size': 0.6,
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  } else {
    // Fallback circle if icon didn't load
    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-color': COLOR,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 6, 8, 8, 12, 10],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });
  }
}

export function removePlaneLayer(map: maplibregl.Map | null | undefined): void {
  if (!map) return;
  try {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getLayer(`${LAYER_ID}-glow`)) map.removeLayer(`${LAYER_ID}-glow`);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  } catch {
    // Map might be in invalid state during unmount
  }
}

export function updatePlaneLayer(
  map: maplibregl.Map | null | undefined,
  position: PlanePosition | null
): void {
  if (!map) return;
  try {
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(createGeoJSON(position));
    } else if (position) {
      addPlaneLayer(map, position);
    }
  } catch {
    // Map might be in invalid state
  }
}

export function setPlaneLayerVisibility(
  map: maplibregl.Map | null | undefined,
  visible: boolean
): void {
  if (!map) return;
  try {
    const v = visible ? 'visible' : 'none';
    if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', v);
    if (map.getLayer(`${LAYER_ID}-glow`))
      map.setLayoutProperty(`${LAYER_ID}-glow`, 'visibility', v);
  } catch {
    // Map might be in invalid state
  }
}

export function bringPlaneLayerToTop(map: maplibregl.Map | null | undefined): void {
  if (!map) return;
  try {
    if (map.getLayer(`${LAYER_ID}-glow`)) map.moveLayer(`${LAYER_ID}-glow`);
    if (map.getLayer(LAYER_ID)) map.moveLayer(LAYER_ID);
  } catch {
    // Map might be in invalid state
  }
}

export const PLANE_LAYER_IDS = [LAYER_ID, `${LAYER_ID}-glow`];
