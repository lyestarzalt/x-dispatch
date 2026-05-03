/**
 * Planet-level airports layer — renders all 35,000 X-Plane airports as
 * dots/pins on the world view (distinct from `layers/airport/*`, which
 * draws a single airport's runways/taxiways/gates when zoomed in).
 *
 * Five MapLibre layers backed by one geojson source:
 *   - airports-custom    Gold pin marker for user-added scenery airports
 *   - airports-glow      Soft halo behind the default dot
 *   - airports           The dot itself (default airports)
 *   - airport-labels     ICAO labels at zoom ≥ 6
 *   - airports-hitbox    Invisible large circle for easier click-targeting
 */
import type maplibregl from 'maplibre-gl';
import type { Airport } from '@/lib/xplaneServices/dataService';

const COLOR_DEFAULT = '#4a90d9';

// Clean pin marker for custom airports — uses --warning amber token (#d4a017)
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="28" viewBox="0 0 20 28">
    <path d="M10 0C4.5 0 0 4.5 0 10c0 7 10 18 10 18s10-11 10-18C20 4.5 15.5 0 10 0z"
          fill="#d4a017" stroke="rgba(255,255,255,0.8)" stroke-width="1.2"/>
    <circle cx="10" cy="10" r="2.5" fill="#fff" opacity="0.95"/>
  </svg>`;

export function setupAirportsLayer(map: maplibregl.Map, airports: Airport[]): void {
  const pinImage = new Image();
  pinImage.onload = () => {
    if (!map.hasImage('custom-pin')) {
      map.addImage('custom-pin', pinImage, { sdf: false });
    }
  };
  pinImage.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(PIN_SVG);

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

  // Custom airports — gold pin marker
  map.addLayer({
    id: 'airports-custom',
    type: 'symbol',
    source: 'airports',
    filter: filterCustom,
    layout: {
      'icon-image': 'custom-pin',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.35, 4, 0.5, 8, 0.7, 12, 0.85],
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
    },
  });

  // Default airports — soft glow behind the dot
  map.addLayer({
    id: 'airports-glow',
    type: 'circle',
    source: 'airports',
    filter: filterDefault,
    paint: {
      'circle-color': COLOR_DEFAULT,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 5, 4, 8, 6, 12, 8],
      'circle-blur': 0.6,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.05, 5, 0.1, 8, 0.2],
    },
  });

  // Default airports — the dot
  map.addLayer({
    id: 'airports',
    type: 'circle',
    source: 'airports',
    filter: filterDefault,
    paint: {
      'circle-color': COLOR_DEFAULT,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 3, 1, 6, 3, 10, 5, 14, 6],
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 0, 4, 0.5, 8, 1],
      'circle-stroke-color': '#ffffff',
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
      'text-color': ['case', ['==', ['get', 'isCustom'], 1], '#e8c36a', '#cccccc'],
      'text-halo-color': '#000000',
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
