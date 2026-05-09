/**
 * Planet-level airports layer — renders all 35,000 X-Plane airports as
 * dots/pins on the world view (distinct from `layers/airport/*`, which
 * draws a single airport's runways/taxiways/gates when zoomed in).
 *
 * Six MapLibre layers backed by one geojson source:
 *   - airports-custom    Pin marker for user-added scenery airports
 *   - airports-glow      Soft cyan glow (ambient depth)
 *   - airports-halo      White ring around each default dot — provides
 *                        contrast against dark/forest/ocean terrain
 *   - airports           The colored dot itself + dark hairline stroke —
 *                        the stroke provides contrast against white/snow
 *                        terrain so the symbol survives any basemap
 *   - airport-labels     ICAO labels at zoom ≥ 6
 *   - airports-hitbox    Invisible large circle for easier click-targeting
 *
 * Only labels and pins swap colors per basemap theme — see
 * `lib/map/basemapTheme.ts`. The dot/halo combination is theme-agnostic
 * because no single hue contrasts well with all of satellite imagery
 * (snow, forest, desert, ocean simultaneously).
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

const PIN_IMAGE_ID = 'custom-pin';

function pinSvg(bodyColor: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="28" viewBox="0 0 20 28">
    <path d="M10 0C4.5 0 0 4.5 0 10c0 7 10 18 10 18s10-11 10-18C20 4.5 15.5 0 10 0z"
          fill="${bodyColor}" stroke="rgba(255,255,255,0.8)" stroke-width="1.2"/>
    <circle cx="10" cy="10" r="2.5" fill="#fff" opacity="0.95"/>
  </svg>`;
}

function loadPinImage(map: maplibregl.Map, bodyColor: string): void {
  const img = new Image();
  img.onload = () => {
    if (map.hasImage(PIN_IMAGE_ID)) map.removeImage(PIN_IMAGE_ID);
    map.addImage(PIN_IMAGE_ID, img, { sdf: false });
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pinSvg(bodyColor));
}

// Radius interpolations — kept as named expressions so the halo can offset
// from the dot by a consistent margin at every zoom.
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

// Halo = dot + 1.5px at every breakpoint. Wider on mid/high zoom where the
// halo carries the most contrast; almost flush at planet zoom where the dot
// itself is sub-pixel.
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

export function setupAirportsLayer(
  map: maplibregl.Map,
  airports: Airport[],
  theme: BasemapTheme
): void {
  const colors = AIRPORT_THEME_COLORS[theme];
  loadPinImage(map, colors.pinBodyColor);

  const features = airports.map((airport) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [airport.lon, airport.lat] },
    properties: {
      icao: airport.icao,
      name: airport.name,
      isCustom: airport.isCustom ? 1 : 0,
      type: airport.type,
      surfaceType: airport.surfaceType,
      runwayCount: airport.runwayCount,
      elevation: airport.elevation,
      country: airport.country ?? '',
    },
  }));

  map.addSource('airports', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  });

  const filterCustom: maplibregl.FilterSpecification = ['==', ['get', 'isCustom'], 1];
  const filterDefault: maplibregl.FilterSpecification = ['==', ['get', 'isCustom'], 0];

  // Custom airports — pin marker
  map.addLayer({
    id: 'airports-custom',
    type: 'symbol',
    source: 'airports',
    filter: filterCustom,
    layout: {
      'icon-image': PIN_IMAGE_ID,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.35, 4, 0.5, 8, 0.7, 12, 0.85],
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
    },
  });

  // Default airports — soft ambient glow (depth, not contrast)
  map.addLayer({
    id: 'airports-glow',
    type: 'circle',
    source: 'airports',
    filter: filterDefault,
    paint: {
      'circle-color': AIRPORT_DOT_FILL,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 5, 4, 8, 6, 12, 8],
      'circle-blur': 0.6,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.05, 5, 0.1, 8, 0.18],
    },
  });

  // Default airports — sharp white halo ring (carries contrast on dark/photo terrain)
  map.addLayer({
    id: 'airports-halo',
    type: 'circle',
    source: 'airports',
    filter: filterDefault,
    paint: {
      'circle-color': AIRPORT_HALO_FILL,
      'circle-radius': HALO_RADIUS,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 4, 0.85, 8, 0.95],
    },
  });

  // Default airports — colored dot with dark hairline stroke
  // (stroke carries contrast on white/snow terrain)
  map.addLayer({
    id: 'airports',
    type: 'circle',
    source: 'airports',
    filter: filterDefault,
    paint: {
      'circle-color': AIRPORT_DOT_FILL,
      'circle-radius': DOT_RADIUS,
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 0, 4, 0.5, 8, 1],
      'circle-stroke-color': AIRPORT_DOT_STROKE,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 4, 0.6, 6, 0.9, 8, 1],
    },
  });

  // ICAO labels — appear at zoom ≥ 6
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

  // Invisible hitbox layer — bigger click target across all zooms
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
}

/**
 * Recolor the airport overlay to match a new basemap theme. Call after the
 * basemap style finishes loading. Only labels and the custom-pin image
 * change per theme; the dot/halo combination is theme-agnostic.
 */
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

  // Pin image is recolored by removing and re-adding under the same ID.
  loadPinImage(map, colors.pinBodyColor);
}
