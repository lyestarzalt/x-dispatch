/**
 * Style building blocks for the night-side city lights.
 *
 * Two regimes share one look:
 *  - Globe zooms draw a bundled list of populated places as glowing points.
 *    Each point carries its own night factor, so only the dark half of the
 *    planet lights up.
 *  - Regional zooms restyle the basemap's own residential, road and building
 *    features. A view that small has one night factor, taken at its centre.
 *
 * MapLibre only accepts zoom as the input of the outermost interpolate, so
 * the night factor is folded into the numeric stops instead of multiplied
 * on top of the expression.
 */
import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { nightFactor, sunAltitudeEvaluator } from './solarPosition';

/** [longitude, latitude, tier] as written by scripts/build-populated-places.mjs. */
export type PopulatedPlace = readonly [number, number, number];

export interface PlaceLightProperties {
  /** Size tier 0 to 3. */
  t: number;
  /** Night factor 0 to 1, quantised. */
  n: number;
}

export type PlaceLightCollection = GeoJSON.FeatureCollection<GeoJSON.Point, PlaceLightProperties>;

export const CITY_LIGHTS_PLACES_SOURCE_ID = 'city-lights-places';
export const CITY_LIGHTS_PLACES_GLOW_LAYER_ID = 'city-lights-places-glow';
export const CITY_LIGHTS_PLACES_CORE_LAYER_ID = 'city-lights-places-core';
export const CITY_LIGHTS_RESIDENTIAL_LAYER_ID = 'city-lights-residential';
export const CITY_LIGHTS_BUILDINGS_LAYER_ID = 'city-lights-buildings';
export const CITY_LIGHTS_ROADS_GLOW_LAYER_ID = 'city-lights-roads-glow';
export const CITY_LIGHTS_ROADS_MAJOR_LAYER_ID = 'city-lights-roads-major';
export const CITY_LIGHTS_ROADS_MINOR_LAYER_ID = 'city-lights-roads-minor';

/** Bottom to top. */
export const CITY_LIGHTS_PLACE_LAYER_IDS = [
  CITY_LIGHTS_PLACES_GLOW_LAYER_ID,
  CITY_LIGHTS_PLACES_CORE_LAYER_ID,
] as const;

/** Bottom to top. */
export const CITY_LIGHTS_BASEMAP_LAYER_IDS = [
  CITY_LIGHTS_RESIDENTIAL_LAYER_ID,
  CITY_LIGHTS_BUILDINGS_LAYER_ID,
  CITY_LIGHTS_ROADS_GLOW_LAYER_ID,
  CITY_LIGHTS_ROADS_MAJOR_LAYER_ID,
  CITY_LIGHTS_ROADS_MINOR_LAYER_ID,
] as const;

/** Where the place points hand over to the basemap features. */
const PLACES_FADE_START_ZOOM = 6;
const PLACES_MAX_ZOOM = 8;
const BASEMAP_MIN_ZOOM = 6;

const GLOW_COLOR = '#ffb347';
const CORE_COLOR = '#fff1c8';
const BUILDING_COLOR = '#ffc46b';

/**
 * Basemap vector sources known to follow the OpenMapTiles schema, which is
 * what the regional layers filter on.
 */
const OPENMAPTILES_SOURCE_IDS: ReadonlySet<string> = new Set(['openmaptiles', 'carto']);

export function findOpenMapTilesSourceId(
  sources: Record<string, { type: string }> | undefined
): string | null {
  if (!sources) return null;
  for (const [id, source] of Object.entries(sources)) {
    if (source.type === 'vector' && OPENMAPTILES_SOURCE_IDS.has(id)) return id;
  }
  return null;
}

/** Quantised so a tick that barely moves the sun does not trigger repaints. */
export function quantizeNightFactor(value: number): number {
  return Math.round(value * 20) / 20;
}

/**
 * Places on the night side for the given instant, with their night factor.
 * Daylit places are left out entirely: fewer features to tile each tick.
 */
export function nightSidePlaces(
  places: readonly PopulatedPlace[],
  timeMs: number
): PlaceLightCollection {
  const evaluator = sunAltitudeEvaluator(timeMs);
  const features: PlaceLightCollection['features'] = [];
  for (const [lon, lat, tier] of places) {
    const n = quantizeNightFactor(nightFactor(evaluator.altitudeAt(lat, lon)));
    if (n <= 0) continue;
    features.push({
      type: 'Feature',
      properties: { t: tier, n },
      geometry: { type: 'Point', coordinates: [lon, lat] },
    });
  }
  return { type: 'FeatureCollection', features };
}

type ZoomStop = readonly [zoom: number, value: number];

/** Linear zoom interpolation with every stop scaled by `factor`. */
export function scaledZoomStops(
  stops: readonly ZoomStop[],
  factor: number
): ExpressionSpecification {
  const expression: unknown[] = ['interpolate', ['linear'], ['zoom']];
  for (const [zoom, value] of stops) {
    expression.push(zoom, Math.round(value * factor * 1000) / 1000);
  }
  return expression as ExpressionSpecification;
}

function tierRadius(base: number, perTier: number): ExpressionSpecification {
  return ['+', base, ['*', perTier, ['get', 't']]];
}

function placeOpacity(peak: number): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    PLACES_FADE_START_ZOOM,
    ['*', peak, ['get', 'n']],
    PLACES_MAX_ZOOM,
    0,
  ];
}

export function placeLightLayers(): LayerSpecification[] {
  return [
    {
      id: CITY_LIGHTS_PLACES_GLOW_LAYER_ID,
      type: 'circle',
      source: CITY_LIGHTS_PLACES_SOURCE_ID,
      maxzoom: PLACES_MAX_ZOOM,
      paint: {
        'circle-color': GLOW_COLOR,
        'circle-blur': 1,
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          1,
          tierRadius(1.5, 1.2),
          4,
          tierRadius(3, 3),
          7,
          tierRadius(8, 6),
        ],
        'circle-opacity': placeOpacity(0.45),
        'circle-pitch-alignment': 'map',
      },
    },
    {
      id: CITY_LIGHTS_PLACES_CORE_LAYER_ID,
      type: 'circle',
      source: CITY_LIGHTS_PLACES_SOURCE_ID,
      maxzoom: PLACES_MAX_ZOOM,
      paint: {
        'circle-color': CORE_COLOR,
        'circle-blur': 0.5,
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          1,
          tierRadius(0.5, 0.35),
          4,
          tierRadius(1, 0.8),
          7,
          tierRadius(2.5, 1.5),
        ],
        'circle-opacity': placeOpacity(0.9),
        'circle-pitch-alignment': 'map',
      },
    },
  ];
}

const RESIDENTIAL_OPACITY: ZoomStop[] = [
  [6, 0],
  [8, 0.2],
  [11, 0.3],
  [13, 0.2],
  [15, 0.08],
];
const BUILDINGS_OPACITY: ZoomStop[] = [
  [13, 0.12],
  [16, 0.28],
];
const ROADS_GLOW_OPACITY: ZoomStop[] = [
  [6, 0],
  [8, 0.22],
  [14, 0.3],
];
const ROADS_MAJOR_OPACITY: ZoomStop[] = [
  [6, 0],
  [8, 0.55],
  [14, 0.75],
];
const ROADS_MINOR_OPACITY: ZoomStop[] = [
  [12, 0],
  [13, 0.35],
  [16, 0.5],
];

interface OpacityBinding {
  layerId: string;
  property: 'fill-opacity' | 'line-opacity';
  stops: readonly ZoomStop[];
}

/** Everything that has to be re-set when the night factor changes. */
export const BASEMAP_OPACITY_BINDINGS: readonly OpacityBinding[] = [
  {
    layerId: CITY_LIGHTS_RESIDENTIAL_LAYER_ID,
    property: 'fill-opacity',
    stops: RESIDENTIAL_OPACITY,
  },
  { layerId: CITY_LIGHTS_BUILDINGS_LAYER_ID, property: 'fill-opacity', stops: BUILDINGS_OPACITY },
  { layerId: CITY_LIGHTS_ROADS_GLOW_LAYER_ID, property: 'line-opacity', stops: ROADS_GLOW_OPACITY },
  {
    layerId: CITY_LIGHTS_ROADS_MAJOR_LAYER_ID,
    property: 'line-opacity',
    stops: ROADS_MAJOR_OPACITY,
  },
  {
    layerId: CITY_LIGHTS_ROADS_MINOR_LAYER_ID,
    property: 'line-opacity',
    stops: ROADS_MINOR_OPACITY,
  },
];

const MAJOR_ROAD_FILTER: ExpressionSpecification = [
  'match',
  ['get', 'class'],
  ['motorway', 'trunk', 'primary', 'secondary'],
  true,
  false,
];
const MINOR_ROAD_FILTER: ExpressionSpecification = [
  'match',
  ['get', 'class'],
  ['tertiary', 'minor'],
  true,
  false,
];

export function basemapLightLayers(sourceId: string, night: number): LayerSpecification[] {
  const opacity = (stops: readonly ZoomStop[]) => scaledZoomStops(stops, night);
  return [
    {
      id: CITY_LIGHTS_RESIDENTIAL_LAYER_ID,
      type: 'fill',
      source: sourceId,
      'source-layer': 'landuse',
      minzoom: BASEMAP_MIN_ZOOM,
      filter: ['==', ['get', 'class'], 'residential'],
      paint: {
        'fill-color': GLOW_COLOR,
        'fill-antialias': false,
        'fill-opacity': opacity(RESIDENTIAL_OPACITY),
      },
    },
    {
      id: CITY_LIGHTS_BUILDINGS_LAYER_ID,
      type: 'fill',
      source: sourceId,
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-color': BUILDING_COLOR,
        'fill-antialias': false,
        'fill-opacity': opacity(BUILDINGS_OPACITY),
      },
    },
    {
      id: CITY_LIGHTS_ROADS_GLOW_LAYER_ID,
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      minzoom: BASEMAP_MIN_ZOOM,
      filter: MAJOR_ROAD_FILTER,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': GLOW_COLOR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 10, 4, 14, 12],
        'line-blur': ['interpolate', ['linear'], ['zoom'], 7, 2, 14, 8],
        'line-opacity': opacity(ROADS_GLOW_OPACITY),
      },
    },
    {
      id: CITY_LIGHTS_ROADS_MAJOR_LAYER_ID,
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      minzoom: BASEMAP_MIN_ZOOM,
      filter: MAJOR_ROAD_FILTER,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': CORE_COLOR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 12, 1.2, 15, 2.5],
        'line-opacity': opacity(ROADS_MAJOR_OPACITY),
      },
    },
    {
      id: CITY_LIGHTS_ROADS_MINOR_LAYER_ID,
      type: 'line',
      source: sourceId,
      'source-layer': 'transportation',
      minzoom: 12,
      filter: MINOR_ROAD_FILTER,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': CORE_COLOR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 16, 1.5],
        'line-opacity': opacity(ROADS_MINOR_OPACITY),
      },
    },
  ];
}
