import type * as maplibregl from 'maplibre-gl';
import { labelFont } from '@/lib/map/labelFonts';
import { destinationPoint } from '@/lib/utils/geomath';
import type { PlanePosition } from '@/types/xplane';
import { moveLayersToTop, safeAddGeoJSONSource } from '../types';
import { fetchAircraftShapeSvg, normalizeIcao } from './aircraftIcons';
import {
  DEFAULT_OWNSHIP_STYLE,
  GENERIC_SHAPE,
  OWNSHIP_ICON_SIZE,
  OWNSHIP_SIZE_PX,
  type OwnshipIconKind,
  type OwnshipStyle,
  createOwnshipIcon,
  createOwnshipShadow,
  createOwnshipShapeIcon,
  createOwnshipShapeShadow,
  ownshipColors,
  ownshipIconId,
  ownshipShadowId,
  ownshipShapeIconId,
  ownshipShapeShadowId,
} from './ownshipIcon';

const SOURCE_ID = 'player-plane-source';
const SHADOW_LAYER_ID = 'player-plane-shadow';
const LAYER_ID = 'player-plane';
const LABEL_LAYER_ID = 'player-plane-label';
const ALL_LAYER_IDS = [SHADOW_LAYER_ID, LAYER_ID, LABEL_LAYER_ID];

const FT_TO_M = 0.3048;

/**
 * Altitude cue: a ground shadow where a sun 60° up would throw it, so the
 * gap to the aircraft grows with height above ground and, being in map
 * units, with zoom like a real scene. The light comes from a fixed
 * north-east so the shadow never swings round with the clock; a cue, not a
 * sundial.
 */
export const AIRBORNE_AGL_FT = 50;
const SHADOW_SLOPE = Math.tan((30 * Math.PI) / 180);
const SHADOW_MAX_M = 4000;
const SHADOW_BEARING = 225;
/** Climb or descent arrow in the label beyond this vertical speed. */
export const TREND_VS_FPM = 300;

function iconKind(position: PlanePosition | null): OwnshipIconKind {
  return position?.aircraftCategory === 'helicopter' ? 'helicopter' : 'airplane';
}

/** The ICAO type whose silhouette to draw, or null when the sim has not said. */
function shapeOf(position: PlanePosition | null): string | null {
  const icao = position?.icaoType ? normalizeIcao(position.icaoType) : '';
  return icao || null;
}

/** Fixed on-screen size like every EFB, from globe view to the taxi map: the pilot picks how big. */
function iconSize(style: OwnshipStyle): number {
  return OWNSHIP_SIZE_PX[style.size] / OWNSHIP_ICON_SIZE;
}

function verticalArrow(verticalSpeed: number): string {
  if (verticalSpeed >= TREND_VS_FPM) return ' ▲';
  if (verticalSpeed <= -TREND_VS_FPM) return ' ▼';
  return '';
}

export function createGeoJSON(
  position: PlanePosition | null,
  altitudeCues = true
): GeoJSON.FeatureCollection {
  if (!position) return { type: 'FeatureCollection', features: [] };
  const here: [number, number] = [position.lng, position.lat];
  const features: GeoJSON.Feature[] = [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: here },
      properties: {
        kind: 'aircraft',
        heading: position.heading,
        altitude: Math.round(position.altitude),
        flightLevel: Math.round(position.altitude / 100),
        groundspeed: Math.round(position.groundspeed),
        trend: verticalArrow(position.verticalSpeed),
        label: position.tailNumber || position.icaoType,
      },
    },
  ];
  if (altitudeCues && position.altitudeAGL >= AIRBORNE_AGL_FT) {
    const offset = Math.min(position.altitudeAGL * FT_TO_M * SHADOW_SLOPE, SHADOW_MAX_M);
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: destinationPoint(position.lat, position.lng, offset, SHADOW_BEARING),
      },
      properties: { kind: 'shadow', heading: position.heading },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Which symbol, type, size and colours the layer was built with, so a change in any rebuilds it. */
const builtMemo = new WeakMap<maplibregl.Map, string>();

function buildKey(position: PlanePosition | null, style: OwnshipStyle): string {
  return `${iconKind(position)}|${shapeOf(position) ?? ''}|${style.size}|${style.color}|${style.altitudeCues ? 1 : 0}`;
}

/** Shape images requested per map, so a sprite is fetched and rasterised once. */
const requestedShapes = new WeakMap<maplibregl.Map, Set<string>>();

/**
 * Fetch and register one silhouette sprite. Fire and forget: the symbol
 * layer's `coalesce` picks the image up as soon as it is added.
 */
function requestShape(
  map: maplibregl.Map,
  shape: string,
  imageId: string,
  render: (
    svg: string
  ) => Promise<({ pixelRatio: number } & Parameters<typeof map.addImage>[1]) | null>
): void {
  if (typeof document === 'undefined' || map.hasImage(imageId)) return;
  let requested = requestedShapes.get(map);
  if (!requested) {
    requested = new Set();
    requestedShapes.set(map, requested);
  }
  if (requested.has(imageId)) return;
  requested.add(imageId);
  void (async () => {
    const svg = await fetchAircraftShapeSvg(shape);
    const image = svg ? await render(svg) : null;
    if (!image) {
      requested.delete(imageId); // a missing shape: coalesce falls through to the next symbol
      return;
    }
    if (!map.getStyle() || map.hasImage(imageId)) return;
    map.addImage(imageId, image, { pixelRatio: image.pixelRatio });
  })();
}

/**
 * The symbol to draw, most specific first: the type's silhouette, the
 * generic airplane silhouette for an airplane, then the placeholder drawn
 * in code. Each falls through while its sprite is still loading or missing.
 */
function iconImageExpression(
  map: maplibregl.Map,
  position: PlanePosition | null,
  kind: OwnshipIconKind,
  style: OwnshipStyle,
  shadow: boolean
): maplibregl.ExpressionSpecification {
  const colors = ownshipColors(style.color);
  const candidates: string[] = [];
  const shape = shapeOf(position);
  const shapes = kind === 'airplane' ? [shape, GENERIC_SHAPE] : [shape];
  for (const s of shapes) {
    if (!s) continue;
    const id = shadow ? ownshipShapeShadowId(s) : ownshipShapeIconId(s, style.color);
    requestShape(map, s, id, (svg) =>
      shadow ? createOwnshipShapeShadow(svg) : createOwnshipShapeIcon(svg, colors)
    );
    candidates.push(id);
  }
  candidates.push(shadow ? ensureShadow(map, kind) : ensureIcon(map, kind, style));
  return ['coalesce', ...candidates.map((id): maplibregl.ExpressionSpecification => ['image', id])];
}

function ensureIcon(map: maplibregl.Map, kind: OwnshipIconKind, style: OwnshipStyle): string {
  const id = ownshipIconId(kind, style.color);
  if (!map.hasImage(id)) {
    const icon = createOwnshipIcon(kind, style.color);
    map.addImage(id, icon, { pixelRatio: icon.pixelRatio });
  }
  return id;
}

function ensureShadow(map: maplibregl.Map, kind: OwnshipIconKind): string {
  const id = ownshipShadowId(kind);
  if (!map.hasImage(id)) {
    const icon = createOwnshipShadow(kind);
    map.addImage(id, icon, { pixelRatio: icon.pixelRatio });
  }
  return id;
}

const isKind = (kind: string): maplibregl.FilterSpecification => ['==', ['get', 'kind'], kind];

export function addPlaneLayer(
  map: maplibregl.Map,
  position: PlanePosition | null,
  style: OwnshipStyle = DEFAULT_OWNSHIP_STYLE
): void {
  if (!map.getStyle()) return;
  removePlaneLayer(map);

  const kind = iconKind(position);
  const iconImage = iconImageExpression(map, position, kind, style, false);
  const accent = ownshipColors(style.color).accent;
  builtMemo.set(map, buildKey(position, style));

  safeAddGeoJSONSource(map, SOURCE_ID, createGeoJSON(position, style.altitudeCues));

  if (style.altitudeCues) {
    const shadowImage = iconImageExpression(map, position, kind, style, true);
    map.addLayer({
      id: SHADOW_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      filter: isKind('shadow'),
      layout: {
        'icon-image': shadowImage,
        'icon-size': iconSize(style) * 0.9,
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: { 'icon-opacity': 0.35 },
    });
  }

  map.addLayer({
    id: LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    filter: isKind('aircraft'),
    layout: {
      'icon-image': iconImage,
      'icon-size': iconSize(style),
      'icon-rotate': ['get', 'heading'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });

  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    filter: isKind('aircraft'),
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
          ['get', 'trend'],
          '  ',
          ['to-string', ['get', 'groundspeed']],
          ' kt',
        ],
        { 'font-scale': 0.8 },
      ],
      'text-font': labelFont(map, 'semibold'),
      'text-size': ['interpolate', ['linear'], ['zoom'], 7, 10, 12, 12],
      'text-offset': [1.6, 0],
      'text-anchor': 'left',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': accent,
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
    builtMemo.delete(map);
  } catch {
    // Map might be in invalid state during unmount
  }
}

export function updatePlaneLayer(
  map: maplibregl.Map | null | undefined,
  position: PlanePosition | null,
  style: OwnshipStyle = DEFAULT_OWNSHIP_STYLE
): void {
  if (!map || !map.getStyle()) return;
  try {
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      if (position) addPlaneLayer(map, position, style);
      return;
    }
    if (builtMemo.get(map) !== buildKey(position, style)) {
      addPlaneLayer(map, position, style);
      return;
    }
    source.setData(createGeoJSON(position, style.altitudeCues));
  } catch {
    // Map might be in invalid state
  }
}

export function bringPlaneLayerToTop(map: maplibregl.Map | null | undefined): void {
  if (!map) return;
  try {
    // Runs on every position snapshot, so it must no-op when already on top —
    // an unconditional moveLayer would force label placement 10x a second.
    moveLayersToTop(map, ALL_LAYER_IDS);
  } catch {
    // Map might be in invalid state
  }
}
