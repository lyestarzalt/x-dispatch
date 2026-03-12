import maplibregl from 'maplibre-gl';
import type { StyleImageInterface } from 'maplibre-gl';
import type { PlanePosition } from '@/types/xplane';

const LAYER_ID = 'player-plane';
const SOURCE_ID = 'player-plane-source';

// Canvas dimensions: 64px total, 48px shape area, 8px padding for glow bleed
const ICON_SIZE = 64;
const SHAPE_SIZE = 48;
const PADDING = (ICON_SIZE - SHAPE_SIZE) / 2;

// Design-system cyan (--xp-cyan-primary #1DA0F2 → rgb 29, 160, 242)
const CYAN = '#1DA0F2';
const CYAN_RGB = '29, 160, 242';

// Pulse ring animation
const PULSE_DURATION_MS = 2000;
const PULSE_MIN_R = 10;
const PULSE_MAX_R = ICON_SIZE / 2;

// A320 top-down silhouette
const PLANE_PATH =
  'm 17.10525,0.06681738 -0.902035,0.73499118 -0.968852,2.50565184 -0.167044,1.4365737 -0.03341,7.0826419 -0.26727,1.302939 -2.605878,1.236122 0.06682,-0.935443 -0.0167,-1.670435 -0.133635,-0.267269 -1.670435,-0.01671 -0.200452,0.200452 -0.0167,2.238382 0.167043,0.918739 0.233861,0.367496 -9.92238106,5.128234 -0.36749561,0.434313 -0.25056518,0.684878 0.01670434,1.369756 0.13363476,0.0167 0.0668174,-0.701583 4.49346885,-1.403165 0.1837478,0.551244 0.1670434,1e-6 0.066818,-0.584652 3.2239386,-1.119191 0.1837478,0.517835 0.1670433,-1e-6 0.1336344,-0.618061 1.7038432,-0.534539 1.403165,0.0167 0.08352,0.467722 0.167043,0.01671 0.08352,-0.484427 2.655991,0.01671 0.03341,9.153982 0.283974,1.954408 0.434313,2.021224 -0.183748,0.317383 -4.426651,2.856445 -0.26727,0.400904 0.01671,1.035669 5.328686,-1.18601 0.317383,1.152601 0.417609,0.885331 0.267269,0.01669 0.379656,-0.846045 0.30033,-1.204534 5.433805,1.198658 -0.01671,-1.002261 -0.250565,-0.451016 -4.476765,-2.873148 -0.183748,-0.367495 0.3842,-1.987818 0.317383,-1.920999 -0.0167,-9.18739 2.65599,-0.03341 0.15034,0.551243 h 0.150339 l 0.100226,-0.50113 1.286234,-0.05011 1.787365,0.551243 0.06682,0.584652 0.217157,-3e-6 0.11693,-0.467721 3.240644,1.00226 0.100227,0.668174 0.23386,0.0167 0.133635,-0.567947 4.526878,1.38646 0.100224,0.65147 0.150339,-0.0167 -0.06681,-1.503392 -0.317384,-0.651469 -0.400904,-0.3842 -9.822155,-4.994599 c 0.07965,-0.247814 0.334087,-0.367497 0.334087,-0.367497 l 0.03341,-3.006782 -0.267269,-0.300678 -1.570209,0.03341 -0.200452,0.23386 10e-7,1.904296 0.150339,0.734991 -2.622582,-1.386461 -0.334087,-1.336347 0.0167,-7.0826429 -0.283974,-1.2862345 -0.835217,-2.62258215 z';

// EC35 helicopter body (rotor drawn procedurally for animation)
const HELI_BODY =
  'm 4.5262285,1.0018037 -0.637168,0.212389 -0.232617,0.586598 -0.0708,0.728193 0.02022,0.202275 -0.141593,-0.01012 -0.02023,-0.627054 -0.121366,0.01012 0.06069,3.206066 0.09102,-0.01011 -0.01012,-0.202275 0.141593,0.02023 0.101139,0.869784 0.303413,0.839444 0.242732,0.353982 0.0809,2.235144 -1.345135,-0.02023 -0.121366,0.8293303 h 0.13148 l 0.04046,-0.2326173 h 1.264223 l 0.121365,1.5676363 0.121367,0.525916 0.192161,-0.02023 0.05057,-2.0834383 1.213654,0.01011 0.01011,0.2326183 0.111252,0.01011 0.09102,-0.8394433 -1.405817,0.01012 -0.03033,-2.265486 0.303414,-0.374209 0.273072,-0.707965 0.06069,-1.001263 h 0.13148 l 0.01012,0.24273 0.161821,0.02023 -0.04046,-1.517067 v -1.689001 l -0.131479,-0.03034 v 0.627054 l -0.161821,0.02023 -0.05057,-0.849556 -0.202276,-0.566372 -0.21239,-0.202276 z';

// ── Icon configs ──────────────────────────────────────────────────────────────

interface RotorConfig {
  /** Hub center X in SVG path coordinates */
  cx: number;
  /** Hub center Y in SVG path coordinates */
  cy: number;
  /** Blade length in canvas pixels */
  bladeRadius: number;
}

interface IconConfig {
  path: string;
  rotor?: RotorConfig;
}

const AIRPLANE_CONFIG: IconConfig = {
  path: PLANE_PATH,
};

const HELICOPTER_CONFIG: IconConfig = {
  path: HELI_BODY,
  rotor: { cx: 4.5, cy: 3.5, bladeRadius: 14 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute exact bounding box of an SVG path via DOM getBBox(). */
function getPathBounds(d: string): { x: number; y: number; w: number; h: number } {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.style.position = 'absolute';
  svg.style.visibility = 'hidden';
  document.body.appendChild(svg);
  const pathEl = document.createElementNS(ns, 'path');
  pathEl.setAttribute('d', d);
  svg.appendChild(pathEl);
  const { x, y, width, height } = pathEl.getBBox();
  document.body.removeChild(svg);
  return { x, y, w: width, h: height };
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
        geometry: { type: 'Point', coordinates: [position.lng, position.lat] },
        properties: {
          heading: position.heading,
          altitude: position.altitude,
          groundspeed: position.groundspeed,
        },
      },
    ],
  };
}

// ── StyleImageInterface factory ───────────────────────────────────────────────

function createPlayerIcon(config: IconConfig): StyleImageInterface {
  const { path, rotor } = config;

  const canvas = document.createElement('canvas');
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Compute exact bounds so shape + glow are perfectly centered
  const bounds = getPathBounds(path);
  const scale = Math.min(SHAPE_SIZE / bounds.w, SHAPE_SIZE / bounds.h);
  const scaledW = bounds.w * scale;
  const scaledH = bounds.h * scale;
  const tx = PADDING + (SHAPE_SIZE - scaledW) / 2 - bounds.x * scale;
  const ty = PADDING + (SHAPE_SIZE - scaledH) / 2 - bounds.y * scale;

  const shape = new Path2D(path);

  // Rotor hub in canvas coordinates
  const hubX = rotor ? tx + rotor.cx * scale : 0;
  const hubY = rotor ? ty + rotor.cy * scale : 0;

  let angle = 0;
  let mapInstance: maplibregl.Map | null = null;
  const data = new Uint8Array(ICON_SIZE * ICON_SIZE * 4);

  function draw(): void {
    ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
    const mid = ICON_SIZE / 2;
    const t = (performance.now() % PULSE_DURATION_MS) / PULSE_DURATION_MS;

    // Pulsing ring — "this is you" radar ping
    const pulseR = PULSE_MIN_R + (PULSE_MAX_R - PULSE_MIN_R) * t;
    ctx.beginPath();
    ctx.arc(mid, mid, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${CYAN_RGB}, ${0.5 * (1 - t)})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Soft radial glow
    const grad = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
    grad.addColorStop(0, `rgba(${CYAN_RGB}, 0.4)`);
    grad.addColorStop(0.5, `rgba(${CYAN_RGB}, 0.12)`);
    grad.addColorStop(1, `rgba(${CYAN_RGB}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(mid, mid, mid, 0, Math.PI * 2);
    ctx.fill();

    // Cyan silhouette with white outline for contrast on any map style
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 / scale;
    ctx.stroke(shape);
    ctx.fillStyle = CYAN;
    ctx.fill(shape);
    ctx.restore();

    // Spinning rotor blades
    if (rotor) {
      ctx.save();
      ctx.translate(hubX, hubY);
      ctx.rotate(angle);
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-rotor.bladeRadius, 0);
      ctx.lineTo(rotor.bladeRadius, 0);
      ctx.moveTo(0, -rotor.bladeRadius);
      ctx.lineTo(0, rotor.bladeRadius);
      ctx.stroke();
      ctx.fillStyle = CYAN;
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const imgData = ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
    data.set(new Uint8Array(imgData.data.buffer));
  }

  return {
    width: ICON_SIZE,
    height: ICON_SIZE,
    data,
    onAdd(map: maplibregl.Map) {
      mapInstance = map;
    },
    onRemove() {
      mapInstance = null;
    },
    render(): boolean {
      if (rotor) angle += (Math.PI * 2 * 4) / 60;
      draw();
      mapInstance?.triggerRepaint();
      return true;
    },
  };
}

// ── Layer management ──────────────────────────────────────────────────────────

const activeCategory = new WeakMap<maplibregl.Map, string | null>();

export function addPlaneLayer(map: maplibregl.Map, position: PlanePosition | null): void {
  if (!map.isStyleLoaded()) {
    map.once('style.load', () => addPlaneLayer(map, position));
    return;
  }

  removePlaneLayer(map);

  const category = position?.aircraftCategory ?? null;
  const isHeli = category === 'helicopter';
  const iconName = isHeli ? 'player-heli-icon' : 'player-plane-icon';
  const otherIcon = isHeli ? 'player-plane-icon' : 'player-heli-icon';

  // Clean up both icon slots so stale StyleImageInterface instances are freed
  if (map.hasImage(iconName)) map.removeImage(iconName);
  if (map.hasImage(otherIcon)) map.removeImage(otherIcon);

  map.addImage(iconName, createPlayerIcon(isHeli ? HELICOPTER_CONFIG : AIRPLANE_CONFIG));
  activeCategory.set(map, category);

  map.addSource(SOURCE_ID, { type: 'geojson', data: createGeoJSON(position) });
  map.addLayer({
    id: LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    layout: {
      'icon-image': iconName,
      'icon-size': 0.8,
      'icon-rotate': ['get', 'heading'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
}

export function removePlaneLayer(map: maplibregl.Map | null | undefined): void {
  if (!map) return;

  const doRemove = () => {
    try {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    } catch {
      // Map might be in invalid state during unmount
    }
  };

  if (!map.getStyle()) return;
  doRemove();
}

export function updatePlaneLayer(
  map: maplibregl.Map | null | undefined,
  position: PlanePosition | null
): void {
  if (!map || !map.isStyleLoaded()) return;
  try {
    const currentCat = position?.aircraftCategory ?? null;
    if (activeCategory.get(map) !== currentCat && map.getSource(SOURCE_ID)) {
      addPlaneLayer(map, position);
      return;
    }

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

export function bringPlaneLayerToTop(map: maplibregl.Map | null | undefined): void {
  if (!map) return;
  try {
    if (map.getLayer(LAYER_ID)) map.moveLayer(LAYER_ID);
  } catch {
    // Map might be in invalid state
  }
}
