import type * as maplibregl from 'maplibre-gl';
import { finalBearing, greatCircleArc } from '@/lib/measure/geodesic';
import type { MeasureLine } from '@/stores/measureStore';
import { removeLayersAndSource, safeAddGeoJSONSource } from '../types';

const SOURCE_ID = 'measure-source';
const LINE_LAYER_ID = 'measure-line';
const HITBOX_LAYER_ID = 'measure-hitbox';
const VERTEX_HITBOX_LAYER_ID = 'measure-vertex-hitbox';
const START_LAYER_ID = 'measure-start';
const VERTEX_LAYER_ID = 'measure-vertex';
const END_LAYER_ID = 'measure-end';
const ARROW_IMAGE_ID = 'measure-arrow';

export const MEASURE_HITBOX_LAYER_ID = HITBOX_LAYER_ID;
export const MEASURE_VERTEX_HITBOX_LAYER_ID = VERTEX_HITBOX_LAYER_ID;
export const MEASURE_LAYER_IDS = [
  HITBOX_LAYER_ID,
  LINE_LAYER_ID,
  VERTEX_HITBOX_LAYER_ID,
  START_LAYER_ID,
  VERTEX_LAYER_ID,
  END_LAYER_ID,
];

/** `--primary` from src/index.css; layers take hex, not CSS variables. */
const MEASURE_COLOR = '#1DA0F2';
const LINE_WIDTH = 3;
const ARC_POINTS = 100;

// Arrowhead pointing up (north); MapLibre rotates it to the final bearing.
const ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
  <polygon points="10,1 18,19 10,14 2,19" fill="${MEASURE_COLOR}"/>
</svg>`;

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function toGeoJSON(line: MeasureLine | null): GeoJSON.FeatureCollection {
  if (!line || line.points.length < 2) return EMPTY;
  const pairs = line.points.map((p): [number, number] => [p.longitude, p.latitude]);
  const coordinates: [number, number][] = [];
  for (let i = 1; i < pairs.length; i++) {
    const from = pairs[i - 1];
    const to = pairs[i];
    if (!from || !to) continue;
    const arc = greatCircleArc(from, to, ARC_POINTS);
    coordinates.push(...(i === 1 ? arc : arc.slice(1)));
  }
  const last = line.points.length - 1;
  const prev = line.points[last - 1];
  const end = line.points[last];
  const bearing =
    prev && end ? finalBearing(prev.latitude, prev.longitude, end.latitude, end.longitude) : 0;

  const vertices: GeoJSON.Feature[] = pairs.map((coord, index) => ({
    type: 'Feature',
    properties: {
      part: index === 0 ? 'start' : index === last ? 'end' : 'vertex',
      index,
      bearing: index === last ? bearing : 0,
    },
    geometry: { type: 'Point', coordinates: coord },
  }));

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { part: 'line' },
        geometry: { type: 'LineString', coordinates },
      },
      ...vertices,
    ],
  };
}

function ensureArrowImage(map: maplibregl.Map): Promise<void> {
  if (map.hasImage(ARROW_IMAGE_ID)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (!map.hasImage(ARROW_IMAGE_ID)) map.addImage(ARROW_IMAGE_ID, img);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = `data:image/svg+xml;base64,${btoa(ARROW_SVG)}`;
  });
}

const isPart = (part: string): maplibregl.FilterSpecification => ['==', ['get', 'part'], part];
const isVertex: maplibregl.FilterSpecification = ['!=', ['get', 'part'], 'line'];

/** Adds the source and layers once; safe to call again after a style reload. */
export async function addMeasureLayer(
  map: maplibregl.Map,
  line: MeasureLine | null
): Promise<void> {
  if (!map.getStyle()) return;
  await ensureArrowImage(map);
  if (!map.getStyle()) return;
  safeAddGeoJSONSource(map, SOURCE_ID, toGeoJSON(line));

  if (!map.getLayer(HITBOX_LAYER_ID)) {
    map.addLayer({
      id: HITBOX_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      filter: isPart('line'),
      paint: { 'line-width': 14, 'line-opacity': 0 },
    });
  }
  if (!map.getLayer(LINE_LAYER_ID)) {
    map.addLayer({
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      filter: isPart('line'),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': MEASURE_COLOR, 'line-width': LINE_WIDTH },
    });
  }
  if (!map.getLayer(VERTEX_HITBOX_LAYER_ID)) {
    map.addLayer({
      id: VERTEX_HITBOX_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: isVertex,
      paint: { 'circle-radius': 12, 'circle-opacity': 0 },
    });
  }
  if (!map.getLayer(START_LAYER_ID)) {
    map.addLayer({
      id: START_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: isPart('start'),
      paint: {
        'circle-radius': 5,
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': MEASURE_COLOR,
        'circle-stroke-width': 1.5,
        'circle-pitch-alignment': 'map',
      },
    });
  }
  if (!map.getLayer(VERTEX_LAYER_ID)) {
    map.addLayer({
      id: VERTEX_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: isPart('vertex'),
      paint: { 'circle-radius': 4, 'circle-color': MEASURE_COLOR, 'circle-pitch-alignment': 'map' },
    });
  }
  if (!map.getLayer(END_LAYER_ID)) {
    map.addLayer({
      id: END_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      filter: isPart('end'),
      layout: {
        'icon-image': ARROW_IMAGE_ID,
        'icon-size': 0.8,
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  }
}

export function updateMeasureLine(map: maplibregl.Map, line: MeasureLine | null): void {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (source) source.setData(toGeoJSON(line));
}

export function removeMeasureLayer(map: maplibregl.Map): void {
  if (!map.getStyle()) return;
  removeLayersAndSource(map, LINE_LAYER_ID, SOURCE_ID, [
    HITBOX_LAYER_ID,
    VERTEX_HITBOX_LAYER_ID,
    START_LAYER_ID,
    VERTEX_LAYER_ID,
    END_LAYER_ID,
  ]);
}
