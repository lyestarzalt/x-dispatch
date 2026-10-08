/**
 * North Atlantic tracks offered to the planner: every published track for the direction
 * flown as a muted dashed line, the one filed in the route solid in the track colour, each
 * labelled with its letter and level band. A wide transparent line on top takes the clicks.
 */
import type * as maplibregl from 'maplibre-gl';
import type { OceanicTrackInfo } from '@/lib/flightplan/builder/types';
import { zoomScaledTextSize } from '../labelSize';
import { safeAddGeoJSONSource } from '../types';
import { ROUTE_KIND_COLORS } from './routeStyle';

const SOURCE_ID = 'nat-tracks-source';
const LINE_ID = 'nat-tracks-line';
const SELECTED_LINE_ID = 'nat-tracks-selected-line';
const HIT_ID = 'nat-tracks-hit';
const LABELS_ID = 'nat-tracks-labels';

/** The layer that receives clicks and hover; its feature `name` is the track designator. */
export const NAT_TRACKS_HIT_LAYER_ID = HIT_ID;
export const NAT_TRACKS_LAYER_IDS = [LINE_ID, SELECTED_LINE_ID, HIT_ID, LABELS_ID];

const COLORS = {
  other: '#94A3B8', // Muted slate, reads on both basemaps under the dark halo
  selected: ROUTE_KIND_COLORS.track,
  labelText: '#FFFFFF',
  labelHalo: '#1F2937',
};

/** Flight levels are feet by convention, so the band is not unit-aware. */
function levelBand(levels: number[]): string {
  if (levels.length === 0) return '';
  return `FL${Math.min(...levels)}–FL${Math.max(...levels)}`;
}

/** One LineString per track; `selected` marks the track filed in the route. */
export function natTracksGeoJSON(
  tracks: OceanicTrackInfo[],
  selected: string | null
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: tracks.map((track) => {
      const band = levelBand(track.levels);
      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: track.points.map((p) => [p.longitude, p.latitude]),
        },
        properties: {
          name: track.name,
          id: track.id,
          selected: track.name === selected,
          label: band ? `${track.id}  ${band}` : track.id,
        },
      };
    }),
  };
}

/** Draws the tracks, or updates them in place when the layers are already there. */
export function addNatTracksLayer(
  map: maplibregl.Map,
  tracks: OceanicTrackInfo[],
  selected: string | null
): void {
  if (!map.getStyle()) return;
  safeAddGeoJSONSource(map, SOURCE_ID, natTracksGeoJSON(tracks, selected));
  if (map.getLayer(LINE_ID)) return;

  map.addLayer({
    id: LINE_ID,
    type: 'line',
    source: SOURCE_ID,
    filter: ['!=', ['get', 'selected'], true],
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: {
      'line-color': COLORS.other,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 6, 2.5],
      'line-opacity': 0.6,
      'line-dasharray': [3, 2],
    },
  });
  map.addLayer({
    id: SELECTED_LINE_ID,
    type: 'line',
    source: SOURCE_ID,
    filter: ['==', ['get', 'selected'], true],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': COLORS.selected,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2.5, 6, 4],
      'line-opacity': 0.9,
    },
  });
  // Wide and invisible: the click and hover target, far easier to hit than the line itself.
  map.addLayer({
    id: HIT_ID,
    type: 'line',
    source: SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': COLORS.other, 'line-width': 18, 'line-opacity': 0 },
  });
  map.addLayer({
    id: LABELS_ID,
    type: 'symbol',
    source: SOURCE_ID,
    layout: {
      'symbol-placement': 'line-center',
      'text-field': ['get', 'label'],
      'text-font': ['Open Sans Bold'],
      'text-size': zoomScaledTextSize(10),
      'text-letter-spacing': 0.05,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': COLORS.labelText,
      'text-halo-color': COLORS.labelHalo,
      'text-halo-width': 1.5,
    },
  });
}

export function removeNatTracksLayer(map: maplibregl.Map): void {
  if (!map.getStyle()) return;
  for (const id of [LABELS_ID, HIT_ID, SELECTED_LINE_ID, LINE_ID]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}
