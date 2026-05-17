/**
 * Planet-level airports layer — renders every X-Plane airport as a dot,
 * pin, star, or home icon on the world view. Distinct from
 * `layers/airport/*`, which draws the runways/taxiways/gates of a single
 * selected airport at airport-detail zoom.
 *
 * One GeoJSON source feeds seven layers: custom-pin, glow, halo, dot,
 * starred (favourite + home), labels, hitbox. The dot/halo combination
 * is intentionally theme-agnostic — no single hue contrasts well with
 * snow, forest, desert, ocean all at once. Theme controls only pins and
 * labels (see `lib/map/basemapTheme.ts`).
 */
import type maplibregl from 'maplibre-gl';
import {
  AIRPORT_DOT_FILL,
  AIRPORT_DOT_STROKE,
  AIRPORT_HALO_FILL,
  AIRPORT_THEME_COLORS,
  type AirportThemeColors,
  type BasemapTheme,
} from '@/lib/map/basemapTheme';
import type { Airport } from '@/lib/xplaneServices/dataService';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite handles this ?raw import
import homeAirportSvg from '../../../../../assets/markers/home-airport.svg?raw';
import { safeAddGeoJSONSource } from '../types';

const PIN_IMAGE_ID = 'custom-pin';
const FAVORITE_STAR_IMAGE_ID = 'favorite-star';
const HOME_ICON_IMAGE_ID = 'home-airport';

function pinSvg(bodyColor: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="28" viewBox="0 0 20 28">
    <path d="M10 0C4.5 0 0 4.5 0 10c0 7 10 18 10 18s10-11 10-18C20 4.5 15.5 0 10 0z"
          fill="${bodyColor}" stroke="rgba(255,255,255,0.8)" stroke-width="1.2"/>
    <circle cx="10" cy="10" r="2.5" fill="#fff" opacity="0.95"/>
  </svg>`;
}

const STAR_PATH =
  'M12 2 L14.85 9.05 L22 9.6 L16.5 14.3 L18.4 21 L12 17.1 L5.6 21 L7.5 14.3 L2 9.6 L9.15 9.05 Z';

// `--warning` from the design system — shared with the custom-scenery
// pin. The star's shape (not its colour) is what tells them apart.
const MARKER_FILL = '#fbbf24';
const MARKER_STROKE = '#0d1a26';

function favoriteStarSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24">
    <path d="${STAR_PATH}" fill="${MARKER_FILL}" stroke="${MARKER_STROKE}" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

function loadImageFromSvg(map: maplibregl.Map, id: string, svg: string): void {
  const img = new Image();
  img.onload = () => {
    if (map.hasImage(id)) map.removeImage(id);
    map.addImage(id, img, { sdf: false });
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function loadPinImage(map: maplibregl.Map, bodyColor: string): void {
  loadImageFromSvg(map, PIN_IMAGE_ID, pinSvg(bodyColor));
}

function loadStarImages(map: maplibregl.Map): void {
  loadImageFromSvg(map, FAVORITE_STAR_IMAGE_ID, favoriteStarSvg());
  loadImageFromSvg(map, HOME_ICON_IMAGE_ID, homeAirportSvg);
}

const DOT_RADIUS: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  0,
  0.5,
  3,
  1,
  6,
  3,
  10,
  5,
  14,
  6,
];

const HALO_RADIUS: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  0,
  1,
  3,
  2,
  6,
  4.5,
  10,
  6.5,
  14,
  7.5,
];

// Favourited/home airports render via the star layer only — these
// filters keep the dot and pin layers from also drawing them.
const FILTER_CUSTOM: maplibregl.FilterSpecification = [
  'all',
  ['==', ['get', 'isCustom'], 1],
  ['==', ['get', 'isFavorite'], 0],
];
const FILTER_DEFAULT: maplibregl.FilterSpecification = [
  'all',
  ['==', ['get', 'isCustom'], 0],
  ['==', ['get', 'isFavorite'], 0],
];
const FILTER_STARRED: maplibregl.FilterSpecification = ['==', ['get', 'isFavorite'], 1];

// Stored as [zoom, value] pairs so we can both flatten into an
// `interpolate` and append a per-feature `case` at the high-zoom stop.
// MapLibre disallows `["zoom"]` inside `case`, so the case has to live
// INSIDE the outer interpolate's last stop, never wrap it.
type OpacityStops = ReadonlyArray<readonly [number, number]>;

const GLOW_OPACITY_STOPS: OpacityStops = [
  [0, 0.05],
  [5, 0.1],
  [8, 0.18],
];
const HALO_OPACITY_STOPS: OpacityStops = [
  [0, 0.5],
  [4, 0.85],
  [8, 0.95],
];
const DOT_OPACITY_STOPS: OpacityStops = [
  [0, 0.4],
  [4, 0.6],
  [6, 0.9],
  [8, 1],
];
const FULL_OPACITY_STOPS: OpacityStops = [[0, 1]];

function stopsToInterpolate(stops: OpacityStops): maplibregl.ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    ...stops.flatMap(([z, v]) => [z, v]),
  ] as maplibregl.ExpressionSpecification;
}

// Roughly where the apt.dat detail layers light up — past this zoom the
// world marker is just noise floating over the airport drawing.
const SELECTED_FADE_LOW = 11;
const SELECTED_FADE_HIGH = 13;

export function buildOpacityExpression(
  stops: OpacityStops,
  selectedIcao: string | null
): maplibregl.ExpressionSpecification | number {
  if (!selectedIcao) {
    return stops.length === 1 && stops[0]![0] === 0 ? stops[0]![1] : stopsToInterpolate(stops);
  }
  const lastValue = stops[stops.length - 1]![1];
  const extended: Array<number | maplibregl.ExpressionSpecification> = stops.flatMap(([z, v]) => [
    z,
    v,
  ]);
  extended.push(SELECTED_FADE_LOW, lastValue);
  extended.push(SELECTED_FADE_HIGH, [
    'case',
    ['==', ['get', 'icao'], selectedIcao],
    0,
    lastValue,
  ] as maplibregl.ExpressionSpecification);
  return ['interpolate', ['linear'], ['zoom'], ...extended] as maplibregl.ExpressionSpecification;
}

type MarkerLayer = {
  id: string;
  property: 'circle-opacity' | 'icon-opacity';
  stops: OpacityStops;
};

const MARKER_LAYERS: ReadonlyArray<MarkerLayer> = [
  { id: 'airports-custom', property: 'icon-opacity', stops: FULL_OPACITY_STOPS },
  { id: 'airports-glow', property: 'circle-opacity', stops: GLOW_OPACITY_STOPS },
  { id: 'airports-halo', property: 'circle-opacity', stops: HALO_OPACITY_STOPS },
  { id: 'airports', property: 'circle-opacity', stops: DOT_OPACITY_STOPS },
  { id: 'airports-favorite', property: 'icon-opacity', stops: FULL_OPACITY_STOPS },
];

export function buildFeatures(
  airports: Airport[],
  favoriteIcaos: ReadonlySet<string>,
  homeIcao: string | null
): GeoJSON.Feature[] {
  return airports.map((airport) => {
    const isHome = homeIcao !== null && airport.icao === homeIcao;
    const isStarred = isHome || favoriteIcaos.has(airport.icao);
    return {
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [airport.lon, airport.lat] },
      properties: {
        icao: airport.icao,
        name: airport.name,
        isCustom: airport.isCustom ? 1 : 0,
        isFavorite: isStarred ? 1 : 0,
        isHome: isHome ? 1 : 0,
        type: airport.type,
        surfaceType: airport.surfaceType,
        runwayCount: airport.runwayCount,
        elevation: airport.elevation,
        country: airport.country ?? '',
      },
    };
  });
}

export function setupAirportsLayer(
  map: maplibregl.Map,
  airports: Airport[],
  theme: BasemapTheme,
  favoriteIcaos: ReadonlySet<string> = new Set(),
  homeIcao: string | null = null,
  selectedIcao: string | null = null
): void {
  const colors = AIRPORT_THEME_COLORS[theme];
  loadPinImage(map, colors.pinBodyColor);
  loadStarImages(map);

  const features = buildFeatures(airports, favoriteIcaos, homeIcao);

  safeAddGeoJSONSource(map, 'airports', { type: 'FeatureCollection', features });

  map.addLayer({
    id: 'airports-custom',
    type: 'symbol',
    source: 'airports',
    filter: FILTER_CUSTOM,
    layout: {
      'icon-image': PIN_IMAGE_ID,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.35, 4, 0.5, 8, 0.7, 12, 0.85],
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
    },
    // Initialise icon-opacity so `setPaintProperty` has something to
    // patch — MapLibre silently ignores patches against an undeclared
    // property.
    paint: {
      'icon-opacity': 1,
    },
  });

  map.addLayer({
    id: 'airports-glow',
    type: 'circle',
    source: 'airports',
    filter: FILTER_DEFAULT,
    paint: {
      'circle-color': AIRPORT_DOT_FILL,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 5, 4, 8, 6, 12, 8],
      'circle-blur': 0.6,
      'circle-opacity': stopsToInterpolate(GLOW_OPACITY_STOPS),
    },
  });

  map.addLayer({
    id: 'airports-halo',
    type: 'circle',
    source: 'airports',
    filter: FILTER_DEFAULT,
    paint: {
      'circle-color': AIRPORT_HALO_FILL,
      'circle-radius': HALO_RADIUS,
      'circle-opacity': stopsToInterpolate(HALO_OPACITY_STOPS),
    },
  });

  map.addLayer({
    id: 'airports',
    type: 'circle',
    source: 'airports',
    filter: FILTER_DEFAULT,
    paint: {
      'circle-color': AIRPORT_DOT_FILL,
      'circle-radius': DOT_RADIUS,
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 0, 4, 0.5, 8, 1],
      'circle-stroke-color': AIRPORT_DOT_STROKE,
      'circle-opacity': stopsToInterpolate(DOT_OPACITY_STOPS),
    },
  });

  map.addLayer({
    id: 'airports-favorite',
    type: 'symbol',
    source: 'airports',
    filter: FILTER_STARRED,
    layout: {
      'icon-image': [
        'case',
        ['==', ['get', 'isHome'], 1],
        HOME_ICON_IMAGE_ID,
        FAVORITE_STAR_IMAGE_ID,
      ],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.45, 4, 0.7, 8, 0.9, 12, 1],
      'icon-anchor': 'center',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-opacity': 1,
    },
  });

  map.addLayer({
    id: 'airport-labels',
    type: 'symbol',
    source: 'airports',
    minzoom: 6,
    layout: {
      'text-field': ['get', 'icao'],
      'text-font': ['Open Sans Bold'],
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-size': ['interpolate', ['linear'], ['zoom'], 6, 8, 10, 10, 14, 12],
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'isCustom'], 1],
        colors.labelCustom,
        colors.labelDefault,
      ],
      'text-halo-color': colors.labelHalo,
      'text-halo-width': 1,
    },
  });

  // Invisible — bigger click target than the visible dot.
  map.addLayer({
    id: 'airports-hitbox',
    type: 'circle',
    source: 'airports',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 6, 4, 10, 6, 14, 10, 18, 14, 22],
      'circle-color': 'transparent',
      'circle-opacity': 0,
    },
  });

  // Catch the case where `setSelectedAirportIcao` was called before
  // `map.on('load', ...)` fired — at that point the layers didn't exist
  // and `setPaintProperty` no-op'd.
  if (selectedIcao) {
    setSelectedAirportIcao(map, selectedIcao);
  }
}

/** Recolour labels + custom-pin for a new basemap theme. */
export function applyAirportTheme(map: maplibregl.Map, theme: BasemapTheme): void {
  const colors: AirportThemeColors = AIRPORT_THEME_COLORS[theme];

  if (map.getLayer('airport-labels')) {
    map.setPaintProperty('airport-labels', 'text-color', [
      'case',
      ['==', ['get', 'isCustom'], 1],
      colors.labelCustom,
      colors.labelDefault,
    ]);
    map.setPaintProperty('airport-labels', 'text-halo-color', colors.labelHalo);
  }

  loadPinImage(map, colors.pinBodyColor);
  loadStarImages(map);
}

/** Fade the planet-marker for the open airport between zoom 11 → 13. */
export function setSelectedAirportIcao(map: maplibregl.Map, selectedIcao: string | null): void {
  for (const { id, property, stops } of MARKER_LAYERS) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, property, buildOpacityExpression(stops, selectedIcao));
  }
}

/** Rebuild the GeoJSON source so favourite/home flags reflect the store. */
export function updateAirportFavoriteFlags(
  map: maplibregl.Map,
  airports: Airport[],
  favoriteIcaos: ReadonlySet<string>,
  homeIcao: string | null
): void {
  const source = map.getSource('airports') as maplibregl.GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: 'FeatureCollection',
    features: buildFeatures(airports, favoriteIcaos, homeIcao),
  });
}
