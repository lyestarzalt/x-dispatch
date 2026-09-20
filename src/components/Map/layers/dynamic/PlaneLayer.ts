import * as maplibregl from 'maplibre-gl';
import type { StyleImageInterface } from 'maplibre-gl';
import { useSolarStore } from '@/stores/solarStore';
import type { PlanePosition } from '@/types/xplane';
import { safeAddGeoJSONSource } from '../types';
import { ensureAircraftIcons, ensureFallbackIcon, normalizeIcao } from './aircraftIcons';

const SOURCE_ID = 'player-plane-source';
const GLOW_LAYER_ID = 'player-plane-glow';
const SHADOW_LAYER_ID = 'player-plane-shadow';
const LAYER_ID = 'player-plane';
const LABEL_LAYER_ID = 'player-plane-label';
const HELI_ICON_ID = 'player-heli-icon';
const ALL_LAYER_IDS = [GLOW_LAYER_ID, SHADOW_LAYER_ID, LAYER_ID, LABEL_LAYER_ID];

// Design-system cyan (--xp-cyan-primary #1DA0F2 → rgb 29, 160, 242)
const CYAN = '#1DA0F2';

/** Wingspan of the silhouette in sprite pixels; the sprites are 48 px with a little padding. */
const SPRITE_SPAN_PX = 40;
/** Readable floor when zoomed out, and a ceiling so a heavy does not swallow the screen at zoom 22. */
const MIN_ICON_SCALE = 0.55;
const MAX_ICON_SCALE = 8;
const DEFAULT_WINGSPAN_M = 30;
const SIZE_STOPS = [10, 12, 14, 16, 18, 20, 22];
/** Shadow drifts away from the sun as the aircraft climbs, capped so it stays attached. */
const SHADOW_MAX_PX = 18;
const SHADOW_FT_PER_PX = 250;
/** Recompute the zoom-to-size curve only when the span or latitude moved enough to matter. */
const RELAYOUT_LAT_DELTA_DEG = 3;

// Helicopter body stays a canvas icon: the spinning rotor is the one animation worth a repaint.
const ICON_SIZE = 64;
const SHAPE_SIZE = 48;
const PADDING = (ICON_SIZE - SHAPE_SIZE) / 2;
const ICON_FRAME_INTERVAL_MS = 1000 / 12;
const ROTOR_REVOLUTIONS_PER_SECOND = 4;
const HELI_BODY =
  'm 4.5262285,1.0018037 -0.637168,0.212389 -0.232617,0.586598 -0.0708,0.728193 0.02022,0.202275 -0.141593,-0.01012 -0.02023,-0.627054 -0.121366,0.01012 0.06069,3.206066 0.09102,-0.01011 -0.01012,-0.202275 0.141593,0.02023 0.101139,0.869784 0.303413,0.839444 0.242732,0.353982 0.0809,2.235144 -1.345135,-0.02023 -0.121366,0.8293303 h 0.13148 l 0.04046,-0.2326173 h 1.264223 l 0.121365,1.5676363 0.121367,0.525916 0.192161,-0.02023 0.05057,-2.0834383 1.213654,0.01011 0.01011,0.2326183 0.111252,0.01011 0.09102,-0.8394433 -1.405817,0.01012 -0.03033,-2.265486 0.303414,-0.374209 0.273072,-0.707965 0.06069,-1.001263 h 0.13148 l 0.01012,0.24273 0.161821,0.02023 -0.04046,-1.517067 v -1.689001 l -0.131479,-0.03034 v 0.627054 l -0.161821,0.02023 -0.05057,-0.849556 -0.202276,-0.566372 -0.21239,-0.202276 z';
const HELI_ROTOR = { cx: 4.5, cy: 3.5, bladeRadius: 14 };

function metersPerPixel(zoom: number, latDeg: number): number {
  return (156543.03392 * Math.cos((latDeg * Math.PI) / 180)) / 2 ** zoom;
}

/** True-size curve: the silhouette covers its real wingspan once zoomed in, clamped either side. */
function sizeExpression(wingspanM: number, latDeg: number): maplibregl.ExpressionSpecification {
  const stops: number[] = [];
  for (const z of SIZE_STOPS) {
    const scale = wingspanM / (metersPerPixel(z, latDeg) * SPRITE_SPAN_PX);
    stops.push(z, Math.min(MAX_ICON_SCALE, Math.max(MIN_ICON_SCALE, scale)));
  }
  return ['interpolate', ['exponential', 2], ['zoom'], ...stops];
}

function bearingDeg(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
  const φ1 = (fromLat * Math.PI) / 180;
  const φ2 = (toLat * Math.PI) / 180;
  const Δλ = ((toLon - fromLon) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Screen-space shadow offset: away from the sun, growing with height above ground. */
function shadowTranslate(map: maplibregl.Map, position: PlanePosition): [number, number] {
  const px = Math.min(SHADOW_MAX_PX, Math.max(0, position.altitudeAGL) / SHADOW_FT_PER_PX);
  if (px < 0.5) return [0, 0];
  const sun = useSolarStore.getState().subsolar;
  const awayFromSun = bearingDeg(position.lat, position.lng, sun.lat, sun.lon) + 180;
  const screenRad = ((awayFromSun - map.getBearing()) * Math.PI) / 180;
  return [Math.sin(screenRad) * px, -Math.cos(screenRad) * px];
}

function createGeoJSON(position: PlanePosition | null): GeoJSON.FeatureCollection {
  if (!position) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [position.lng, position.lat] },
        properties: {
          heading: position.heading,
          altitude: Math.round(position.altitude),
          flightLevel: Math.round(position.altitude / 100),
          groundspeed: Math.round(position.groundspeed),
          acIcon: position.icaoType ? normalizeIcao(position.icaoType) : '',
          label: position.tailNumber || position.icaoType,
        },
      },
    ],
  };
}

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

function createHeliIcon(): StyleImageInterface {
  const canvas = document.createElement('canvas');
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext('2d')!;
  const bounds = getPathBounds(HELI_BODY);
  const scale = Math.min(SHAPE_SIZE / bounds.w, SHAPE_SIZE / bounds.h);
  const tx = PADDING + (SHAPE_SIZE - bounds.w * scale) / 2 - bounds.x * scale;
  const ty = PADDING + (SHAPE_SIZE - bounds.h * scale) / 2 - bounds.y * scale;
  const shape = new Path2D(HELI_BODY);
  const hubX = tx + HELI_ROTOR.cx * scale;
  const hubY = ty + HELI_ROTOR.cy * scale;

  let angle = 0;
  let mapInstance: maplibregl.Map | null = null;
  let lastFrameAt = 0;
  let repaintTimer: ReturnType<typeof setTimeout> | null = null;
  const data = new Uint8Array(ICON_SIZE * ICON_SIZE * 4);

  const scheduleRepaint = (delayMs: number) => {
    if (repaintTimer !== null || !mapInstance) return;
    repaintTimer = setTimeout(() => {
      repaintTimer = null;
      mapInstance?.triggerRepaint();
    }, delayMs);
  };

  const draw = () => {
    ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 / scale;
    ctx.stroke(shape);
    ctx.fillStyle = CYAN;
    ctx.fill(shape);
    ctx.restore();
    ctx.save();
    ctx.translate(hubX, hubY);
    ctx.rotate(angle);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-HELI_ROTOR.bladeRadius, 0);
    ctx.lineTo(HELI_ROTOR.bladeRadius, 0);
    ctx.moveTo(0, -HELI_ROTOR.bladeRadius);
    ctx.lineTo(0, HELI_ROTOR.bladeRadius);
    ctx.stroke();
    ctx.restore();
    data.set(new Uint8Array(ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE).data.buffer));
  };

  return {
    width: ICON_SIZE,
    height: ICON_SIZE,
    data,
    onAdd(map: maplibregl.Map) {
      mapInstance = map;
    },
    onRemove() {
      mapInstance = null;
      if (repaintTimer !== null) clearTimeout(repaintTimer);
      repaintTimer = null;
    },
    render(): boolean {
      const now = performance.now();
      const elapsed = now - lastFrameAt;
      if (elapsed < ICON_FRAME_INTERVAL_MS) {
        scheduleRepaint(ICON_FRAME_INTERVAL_MS - elapsed);
        return false;
      }
      lastFrameAt = now;
      angle += Math.PI * 2 * ROTOR_REVOLUTIONS_PER_SECOND * (elapsed / 1000);
      draw();
      scheduleRepaint(ICON_FRAME_INTERVAL_MS);
      return true;
    },
  };
}

interface LayoutMemo {
  heli: boolean;
  wingspanM: number;
  lat: number;
  shadow: [number, number];
}
const layoutMemo = new WeakMap<maplibregl.Map, LayoutMemo>();

function iconImageExpression(heli: boolean): maplibregl.ExpressionSpecification | string {
  if (heli) return HELI_ICON_ID;
  return ['coalesce', ['image', ['concat', 'ac-', ['get', 'acIcon']]], ['image', 'ac-fallback']];
}

export function addPlaneLayer(map: maplibregl.Map, position: PlanePosition | null): void {
  if (!map.getStyle()) return;
  removePlaneLayer(map);

  const heli = position?.aircraftCategory === 'helicopter';
  const wingspanM = position?.wingspanM ?? DEFAULT_WINGSPAN_M;
  const lat = position?.lat ?? 0;

  if (heli) {
    if (map.hasImage(HELI_ICON_ID)) map.removeImage(HELI_ICON_ID);
    map.addImage(HELI_ICON_ID, createHeliIcon());
  } else {
    // Fire and forget: symbol layers pick a sprite up as soon as it is added.
    void ensureFallbackIcon(map);
    if (position?.icaoType) void ensureAircraftIcons(map, [normalizeIcao(position.icaoType)]);
  }

  const size = heli ? 0.8 : sizeExpression(wingspanM, lat);
  const shadow: [number, number] = position ? shadowTranslate(map, position) : [0, 0];
  layoutMemo.set(map, { heli, wingspanM, lat, shadow });

  safeAddGeoJSONSource(map, SOURCE_ID, createGeoJSON(position));

  map.addLayer({
    id: GLOW_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-color': CYAN,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 9, 10, 14, 16, 26],
      'circle-blur': 0.9,
      'circle-opacity': 0.35,
    },
  });

  const symbolLayout: maplibregl.SymbolLayerSpecification['layout'] = {
    'icon-image': iconImageExpression(heli),
    'icon-size': size,
    'icon-rotate': ['get', 'heading'],
    'icon-rotation-alignment': 'map',
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  };

  if (!heli) {
    map.addLayer({
      id: SHADOW_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: symbolLayout,
      paint: {
        'icon-color': '#000000',
        'icon-opacity': 0.35,
        'icon-translate': shadow,
        'icon-translate-anchor': 'viewport',
      },
    });
  }

  map.addLayer({
    id: LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    layout: symbolLayout,
    paint: heli
      ? {}
      : {
          'icon-color': CYAN,
          'icon-halo-color': '#ffffff',
          'icon-halo-width': 1,
        },
  });

  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    minzoom: 7,
    layout: {
      'text-field': [
        'format',
        ['get', 'label'],
        { 'font-scale': 1 },
        '\n',
        {},
        [
          'concat',
          'FL',
          ['to-string', ['get', 'flightLevel']],
          '  ',
          ['to-string', ['get', 'groundspeed']],
          ' kt',
        ],
        { 'font-scale': 0.8 },
      ],
      'text-font': ['Open Sans Semibold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 7, 10, 12, 12],
      'text-offset': [1.6, 0],
      'text-anchor': 'left',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': CYAN,
      'text-halo-color': 'rgba(0, 0, 0, 0.9)',
      'text-halo-width': 1.5,
    },
  });
}

export function removePlaneLayer(map: maplibregl.Map | null | undefined): void {
  if (!map || !map.getStyle()) return;
  try {
    for (const id of ALL_LAYER_IDS) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    layoutMemo.delete(map);
  } catch {
    // Map might be in invalid state during unmount
  }
}

export function updatePlaneLayer(
  map: maplibregl.Map | null | undefined,
  position: PlanePosition | null
): void {
  if (!map || !map.getStyle()) return;
  try {
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      if (position) addPlaneLayer(map, position);
      return;
    }
    const memo = layoutMemo.get(map);
    const heli = position?.aircraftCategory === 'helicopter';
    if (!memo || memo.heli !== heli) {
      addPlaneLayer(map, position);
      return;
    }

    source.setData(createGeoJSON(position));
    if (!position || heli) return;

    if (position.icaoType) void ensureAircraftIcons(map, [normalizeIcao(position.icaoType)]);

    const wingspanM = position.wingspanM ?? DEFAULT_WINGSPAN_M;
    if (
      wingspanM !== memo.wingspanM ||
      Math.abs(position.lat - memo.lat) > RELAYOUT_LAT_DELTA_DEG
    ) {
      const size = sizeExpression(wingspanM, position.lat);
      map.setLayoutProperty(LAYER_ID, 'icon-size', size);
      map.setLayoutProperty(SHADOW_LAYER_ID, 'icon-size', size);
      memo.wingspanM = wingspanM;
      memo.lat = position.lat;
    }

    const shadow = shadowTranslate(map, position);
    if (Math.abs(shadow[0] - memo.shadow[0]) > 0.5 || Math.abs(shadow[1] - memo.shadow[1]) > 0.5) {
      map.setPaintProperty(SHADOW_LAYER_ID, 'icon-translate', shadow);
      memo.shadow = shadow;
    }
  } catch {
    // Map might be in invalid state
  }
}

export function bringPlaneLayerToTop(map: maplibregl.Map | null | undefined): void {
  if (!map) return;
  try {
    for (const id of ALL_LAYER_IDS) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
  } catch {
    // Map might be in invalid state
  }
}
