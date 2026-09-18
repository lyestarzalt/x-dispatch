import type * as maplibregl from 'maplibre-gl';
import { RATING_COLORS } from '@/lib/flightRecorder/landingCardImage';
import { EMPTY_TRAIL, type TrailFeatureCollection } from '@/lib/flightRecorder/trailGeometry';
import type { LandingRating } from '@/types/flightRecorder';
import { safeAddGeoJSONSource } from '../types';

const HISTORY_SOURCE = 'flight-trail-history';
const LIVE_SOURCE = 'flight-trail-live';
const TOUCHDOWN_SOURCE = 'flight-touchdown';
const REPLAY_SOURCE = 'flight-replay-source';

const HISTORY_LAYER = 'flight-trail-history';
const LIVE_LAYER = 'flight-trail-live';
const TOUCHDOWN_RING_LAYER = 'flight-touchdown-ring';
const TOUCHDOWN_DOT_LAYER = 'flight-touchdown-dot';
const REPLAY_LAYER = 'flight-replay-plane';
const REPLAY_ICON = 'flight-replay-icon';

export const FLIGHT_TRAIL_LAYER_IDS = [
  HISTORY_LAYER,
  LIVE_LAYER,
  TOUCHDOWN_RING_LAYER,
  TOUCHDOWN_DOT_LAYER,
  REPLAY_LAYER,
];

/** Cyan near the ground through violet to pink at airliner cruise levels. */
const ALTITUDE_COLOR: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['get', 'alt'],
  0,
  '#22d3ee',
  5000,
  '#38bdf8',
  15000,
  '#818cf8',
  30000,
  '#c084fc',
  45000,
  '#f472b6',
];

const LINE_WIDTH: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  3,
  1.2,
  8,
  2.5,
  14,
  4,
];

const RATING_COLOR: maplibregl.ExpressionSpecification = [
  'match',
  ['get', 'rating'],
  'butter',
  RATING_COLORS.butter,
  'great',
  RATING_COLORS.great,
  'acceptable',
  RATING_COLORS.acceptable,
  'hard',
  RATING_COLORS.hard,
  'severe',
  RATING_COLORS.severe,
  '#ffffff',
];

const EMPTY_POINTS: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function beforePlane(map: maplibregl.Map): string | undefined {
  return map.getLayer('player-plane') ? 'player-plane' : undefined;
}

export function ensureFlightTrailLayers(map: maplibregl.Map): void {
  if (!map.getStyle()) return;

  if (!map.getSource(HISTORY_SOURCE)) safeAddGeoJSONSource(map, HISTORY_SOURCE, EMPTY_TRAIL);
  if (!map.getSource(LIVE_SOURCE)) safeAddGeoJSONSource(map, LIVE_SOURCE, EMPTY_TRAIL);
  if (!map.getSource(TOUCHDOWN_SOURCE)) safeAddGeoJSONSource(map, TOUCHDOWN_SOURCE, EMPTY_POINTS);
  if (!map.getSource(REPLAY_SOURCE)) safeAddGeoJSONSource(map, REPLAY_SOURCE, EMPTY_POINTS);

  const before = beforePlane(map);
  if (!map.getLayer(HISTORY_LAYER)) {
    map.addLayer(
      {
        id: HISTORY_LAYER,
        type: 'line',
        source: HISTORY_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ALTITUDE_COLOR,
          'line-width': LINE_WIDTH,
          'line-opacity': ['interpolate', ['linear'], ['get', 'age'], 0, 0.9, 90, 0.4],
        },
      },
      before
    );
  }
  if (!map.getLayer(LIVE_LAYER)) {
    map.addLayer(
      {
        id: LIVE_LAYER,
        type: 'line',
        source: LIVE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ALTITUDE_COLOR, 'line-width': LINE_WIDTH, 'line-opacity': 0.95 },
      },
      before
    );
  }
  if (!map.getLayer(TOUCHDOWN_RING_LAYER)) {
    map.addLayer(
      {
        id: TOUCHDOWN_RING_LAYER,
        type: 'circle',
        source: TOUCHDOWN_SOURCE,
        minzoom: 9,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 6, 15, 18],
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-stroke-color': RATING_COLOR,
          'circle-stroke-width': 2,
          'circle-stroke-opacity': 0.9,
        },
      },
      before
    );
  }
  if (!map.getLayer(TOUCHDOWN_DOT_LAYER)) {
    map.addLayer(
      {
        id: TOUCHDOWN_DOT_LAYER,
        type: 'circle',
        source: TOUCHDOWN_SOURCE,
        minzoom: 9,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 15, 5],
          'circle-color': RATING_COLOR,
        },
      },
      before
    );
  }
  if (!map.hasImage(REPLAY_ICON)) {
    map.addImage(REPLAY_ICON, replayIcon(), { pixelRatio: 2 });
  }
  if (!map.getLayer(REPLAY_LAYER)) {
    map.addLayer(
      {
        id: REPLAY_LAYER,
        type: 'symbol',
        source: REPLAY_SOURCE,
        layout: {
          'icon-image': REPLAY_ICON,
          'icon-size': 1,
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      },
      before
    );
  }
}

function setSourceData(map: maplibregl.Map, id: string, data: GeoJSON.GeoJSON): void {
  const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (source) source.setData(data);
}

export function setFlightTrailHistory(map: maplibregl.Map, data: TrailFeatureCollection): void {
  setSourceData(map, HISTORY_SOURCE, data);
}

export function setFlightTrailLive(map: maplibregl.Map, data: TrailFeatureCollection): void {
  setSourceData(map, LIVE_SOURCE, data);
}

export interface TouchdownMarker {
  lat: number;
  lon: number;
  rating: LandingRating;
}

export function setTouchdownMarkers(map: maplibregl.Map, markers: TouchdownMarker[]): void {
  setSourceData(map, TOUCHDOWN_SOURCE, {
    type: 'FeatureCollection',
    features: markers.map((m) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [m.lon, m.lat] },
      properties: { rating: m.rating },
    })),
  });
}

export function setReplayPlane(
  map: maplibregl.Map,
  position: { lat: number; lon: number; heading: number } | null
): void {
  setSourceData(
    map,
    REPLAY_SOURCE,
    position
      ? {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [position.lon, position.lat] },
              properties: { heading: position.heading },
            },
          ],
        }
      : EMPTY_POINTS
  );
}

export function clearFlightTrail(map: maplibregl.Map): void {
  setFlightTrailHistory(map, EMPTY_TRAIL);
  setFlightTrailLive(map, EMPTY_TRAIL);
  setTouchdownMarkers(map, []);
  setReplayPlane(map, null);
}

export function removeFlightTrailLayers(map: maplibregl.Map | null | undefined): void {
  if (!map || !map.getStyle()) return;
  try {
    for (const id of FLIGHT_TRAIL_LAYER_IDS) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of [HISTORY_SOURCE, LIVE_SOURCE, TOUCHDOWN_SOURCE, REPLAY_SOURCE]) {
      if (map.getSource(id)) map.removeSource(id);
    }
  } catch {
    // Map may be tearing down.
  }
}

/** Amber arrowhead so the replayed aircraft is never mistaken for the live one. */
function replayIcon(): ImageData {
  const size = 40;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(size / 2, size / 2);
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(11, 13);
  ctx.lineTo(0, 7);
  ctx.lineTo(-11, 13);
  ctx.closePath();
  ctx.fillStyle = '#fbbf24';
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}
