/**
 * North Atlantic tracks on the map: every track of the sets shown as a muted dashed line,
 * tracks of an upcoming message dotted and dimmer, the one filed in the route solid in the
 * track colour, each labelled once with its letter and level band. A wide transparent line
 * on top takes clicks and hover; the hover popup is built from the feature's properties.
 */
import i18n from 'i18next';
import type * as maplibregl from 'maplibre-gl';
import { greatCircleNm } from '@/lib/flightplan/builder/geometry';
import { validityLabel } from '@/lib/flightplan/builder/trackChoice';
import type { OceanicTrackInfo } from '@/lib/flightplan/builder/types';
import { zoomScaledTextSize } from '../labelSize';
import { safeAddGeoJSONSource } from '../types';
import { legLabelPlacement } from './FlightPlanLayer';
import { ROUTE_KIND_COLORS } from './routeStyle';

const SOURCE_ID = 'nat-tracks-source';
const LINE_ID = 'nat-tracks-line';
const UPCOMING_LINE_ID = 'nat-tracks-upcoming-line';
const SELECTED_LINE_ID = 'nat-tracks-selected-line';
const HIT_ID = 'nat-tracks-hit';
const LABELS_ID = 'nat-tracks-labels';

/** The layer that receives clicks and hover; its feature `name` is the track designator. */
export const NAT_TRACKS_HIT_LAYER_ID = HIT_ID;
export const NAT_TRACKS_LAYER_IDS = [
  LINE_ID,
  UPCOMING_LINE_ID,
  SELECTED_LINE_ID,
  HIT_ID,
  LABELS_ID,
];

const COLORS = {
  other: '#94A3B8', // Muted slate, reads on both basemaps under the dark halo
  selected: ROUTE_KIND_COLORS.track,
  labelText: '#FFFFFF',
  labelHalo: '#1F2937',
};

/** A track to draw and whether it comes from the message published for later. */
export interface TrackDrawItem {
  track: OceanicTrackInfo;
  upcoming: boolean;
}

/** Flight levels are feet by convention, so the band is not unit-aware. */
function levelBand(levels: number[]): string {
  if (levels.length === 0) return '';
  return `FL${Math.min(...levels)}–FL${Math.max(...levels)}`;
}

/** Everything the popup needs, carried on the feature so the hook stays data-free. */
function trackProperties(track: OceanicTrackInfo, upcoming: boolean, selected: string | null) {
  return {
    name: track.name,
    id: track.id,
    selected: track.name === selected,
    upcoming,
    eastbound: track.eastbound,
    levels: track.levels.join(' '),
    validFrom: track.validFrom,
    validTo: track.validTo,
    nars: track.nars.join(' '),
    feederFixes: track.feederFixes.join(' '),
    pbcs: track.pbcs,
  };
}

/**
 * One LineString per track plus one label Point on its longest leg, turned along it. A line
 * placed label would repeat per map tile on these long lines; a point is drawn once.
 * `selected` marks the track filed in the route.
 */
export function natTracksGeoJSON(
  items: TrackDrawItem[],
  selected: string | null
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const { track, upcoming } of items) {
    const properties = trackProperties(track, upcoming, selected);
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: track.points.map((p) => [p.longitude, p.latitude]),
      },
      properties,
    });
    if (track.points.length < 2) continue;
    let best = 0;
    for (let i = 1; i + 1 < track.points.length; i++) {
      if (
        greatCircleNm(track.points[i]!, track.points[i + 1]!) >
        greatCircleNm(track.points[best]!, track.points[best + 1]!)
      ) {
        best = i;
      }
    }
    const band = levelBand(track.levels);
    const { lon, lat, rotate } = legLabelPlacement(track.points[best]!, track.points[best + 1]!);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: { ...properties, label: band ? `${track.id}  ${band}` : track.id, rotate },
    });
  }
  return { type: 'FeatureCollection', features };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The hover card for a track: designator, direction, status, levels, window, NARs, feeders. */
export function natTrackPopupHtml(track: OceanicTrackInfo, upcoming: boolean): string {
  // Before i18n is ready (tests) the key itself stands in for the text.
  const t = (key: string) => String(i18n.t(key) ?? key);
  const rows: string[] = [];
  rows.push(
    `<div class="flex items-center gap-2"><span class="font-mono font-bold text-sm" style="color:${COLORS.selected}">${escapeHtml(track.name)}</span><span class="text-muted-foreground text-xs">${escapeHtml(t(track.eastbound ? 'planBuilder.tracks.eastbound' : 'planBuilder.tracks.westbound'))}</span>${upcoming ? `<span class="text-info text-[10px] uppercase tracking-wider">${escapeHtml(t('planBuilder.tracks.upcoming'))}</span>` : ''}${track.pbcs ? `<span class="text-muted-foreground text-[10px] uppercase tracking-wider">${escapeHtml(t('planBuilder.tracks.pbcs'))}</span>` : ''}</div>`
  );
  rows.push(
    `<div class="font-mono text-xs">${escapeHtml(validityLabel(track.validFrom, track.validTo))}</div>`
  );
  // Flight levels, NAR and EUR RTS are ICAO notation, the same in every language.
  if (track.levels.length > 0) {
    rows.push(`<div class="font-mono text-xs">FL ${escapeHtml(track.levels.join(' '))}</div>`);
  }
  rows.push(
    `<div class="font-mono text-[11px] text-muted-foreground">${escapeHtml(track.points.map((p) => p.id).join(' '))}</div>`
  );
  const routes = [
    track.nars.length > 0 ? `NAR ${track.nars.join(' ')}` : '',
    track.feederFixes.length > 0 ? `EUR RTS ${track.feederFixes.join(' ')}` : '',
  ].filter(Boolean);
  if (routes.length > 0) {
    rows.push(
      `<div class="font-mono text-[11px] text-muted-foreground">${escapeHtml(routes.join(' · '))}</div>`
    );
  }
  return `<div class="bg-card text-foreground border border-border rounded-lg px-3 py-2 space-y-1 max-w-[340px]">${rows.join('')}</div>`;
}

/** The track behind a hit-layer feature, rebuilt from its properties for the popup. */
export function trackFromFeature(properties: Record<string, unknown>): {
  track: OceanicTrackInfo;
  upcoming: boolean;
} | null {
  if (typeof properties.name !== 'string' || typeof properties.id !== 'string') return null;
  const words = (v: unknown) => (typeof v === 'string' && v !== '' ? v.split(' ') : []);
  return {
    upcoming: properties.upcoming === true,
    track: {
      id: properties.id,
      name: properties.name,
      eastbound: properties.eastbound === true,
      levels: words(properties.levels).map(Number),
      validFrom: typeof properties.validFrom === 'string' ? properties.validFrom : '',
      validTo: typeof properties.validTo === 'string' ? properties.validTo : '',
      points: [],
      nars: words(properties.nars),
      feederFixes: words(properties.feederFixes),
      pbcs: properties.pbcs === true,
    },
  };
}

/** Draws the tracks, or updates them in place when the layers are already there. */
export function addNatTracksLayer(
  map: maplibregl.Map,
  items: TrackDrawItem[],
  selected: string | null
): void {
  if (!map.getStyle()) return;
  safeAddGeoJSONSource(map, SOURCE_ID, natTracksGeoJSON(items, selected));
  if (map.getLayer(LINE_ID)) return;

  const isLine: maplibregl.ExpressionSpecification = ['==', ['geometry-type'], 'LineString'];
  const notSelected: maplibregl.ExpressionSpecification = ['!=', ['get', 'selected'], true];
  map.addLayer({
    id: LINE_ID,
    type: 'line',
    source: SOURCE_ID,
    filter: ['all', isLine, notSelected, ['!=', ['get', 'upcoming'], true]],
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: {
      'line-color': COLORS.other,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 6, 2.5],
      'line-opacity': 0.6,
      'line-dasharray': [3, 2],
    },
  });
  // Published for later: dotted and dimmer, so the current set reads first.
  map.addLayer({
    id: UPCOMING_LINE_ID,
    type: 'line',
    source: SOURCE_ID,
    filter: ['all', isLine, notSelected, ['==', ['get', 'upcoming'], true]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': COLORS.other,
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 6, 2.5],
      'line-opacity': 0.35,
      'line-dasharray': [0.5, 2],
    },
  });
  map.addLayer({
    id: SELECTED_LINE_ID,
    type: 'line',
    source: SOURCE_ID,
    filter: ['all', isLine, ['==', ['get', 'selected'], true]],
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
    filter: isLine,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': COLORS.other, 'line-width': 18, 'line-opacity': 0 },
  });
  map.addLayer({
    id: LABELS_ID,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Point'],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Open Sans Bold'],
      'text-size': zoomScaledTextSize(10),
      'text-letter-spacing': 0.05,
      'text-rotate': ['get', 'rotate'],
      'text-rotation-alignment': 'map',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': COLORS.labelText,
      'text-opacity': ['case', ['==', ['get', 'upcoming'], true], 0.6, 1],
      'text-halo-color': COLORS.labelHalo,
      'text-halo-width': 1.5,
    },
  });
}

export function removeNatTracksLayer(map: maplibregl.Map): void {
  if (!map.getStyle()) return;
  for (const id of [LABELS_ID, HIT_ID, SELECTED_LINE_ID, UPCOMING_LINE_ID, LINE_ID]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}
