import * as maplibregl from 'maplibre-gl';
import { SURFACE_TYPES, getSurfaceColor } from '@/config/mapStyles/surfaceColors';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { labelFont } from '@/lib/map/labelFonts';
import type { ParsedAirport } from '@/types/apt';
import {
  createRunwayGeoJSON,
  createRunwayOverrunGeoJSON,
  createRunwayShoulderGeoJSON,
} from '../../utils/geoJsonFactory';
import { safeAddGeoJSONSource } from '../types';
import { BaseLayerRenderer } from './BaseLayerRenderer';

const OVERRUN_PATTERN_ID = 'runway-overrun-hatch';
/** Diagonal cross hatch over the surface colour marks overruns and blast pads. */
const OVERRUN_HATCH_COLOR = 'rgb(180, 180, 0)';
const OVERRUN_PATTERN_SIZE = 8;

/** Builds the 8 px diagonal-cross tile once per map; later airports reuse it. */
function ensureOverrunPattern(map: maplibregl.Map): boolean {
  if (map.hasImage(OVERRUN_PATTERN_ID)) return true;
  const canvas = document.createElement('canvas');
  canvas.width = OVERRUN_PATTERN_SIZE;
  canvas.height = OVERRUN_PATTERN_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.strokeStyle = OVERRUN_HATCH_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(OVERRUN_PATTERN_SIZE, OVERRUN_PATTERN_SIZE);
  ctx.moveTo(OVERRUN_PATTERN_SIZE, 0);
  ctx.lineTo(0, OVERRUN_PATTERN_SIZE);
  ctx.stroke();
  map.addImage(
    OVERRUN_PATTERN_ID,
    ctx.getImageData(0, 0, OVERRUN_PATTERN_SIZE, OVERRUN_PATTERN_SIZE),
    { pixelRatio: 1 }
  );
  return true;
}

export class RunwayLayer extends BaseLayerRenderer {
  layerId = 'airport-runways';
  sourceId = 'airport-runways';
  additionalLayerIds = [
    'airport-runway-shoulders',
    'airport-runway-overruns',
    'airport-runway-overruns-hatch',
    'airport-runway-centerlines',
    'airport-runway-labels',
  ];
  additionalSourceIds = ['airport-runway-shoulders', 'airport-runway-overruns'];
  private shoulderSourceId = 'airport-runway-shoulders';
  private overrunSourceId = 'airport-runway-overruns';

  hasData(airport: ParsedAirport): boolean {
    return airport.runways.length > 0 || (airport.waterRunways?.length ?? 0) > 0;
  }

  protected performRemove(map: maplibregl.Map): void {
    super.performRemove(map);
    for (const id of [this.shoulderSourceId, this.overrunSourceId]) {
      if (map.getSource(id)) map.removeSource(id);
    }
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    // Overruns and blast pads sit beyond the ends, under the runway fill.
    const overrunGeoJSON = createRunwayOverrunGeoJSON(airport.runways);
    if (overrunGeoJSON.features.length > 0) {
      safeAddGeoJSONSource(map, this.overrunSourceId, overrunGeoJSON);

      this.addLayer(map, {
        id: 'airport-runway-overruns',
        type: 'fill',
        source: this.overrunSourceId,
        minzoom: ZOOM_BEHAVIORS.runways.minZoom,
        paint: {
          'fill-color': this.buildSurfaceColorExpression(),
          'fill-opacity': 1,
        },
      });

      if (ensureOverrunPattern(map)) {
        this.addLayer(map, {
          id: 'airport-runway-overruns-hatch',
          type: 'fill',
          source: this.overrunSourceId,
          minzoom: ZOOM_BEHAVIORS.runways.minZoom + 2,
          paint: {
            'fill-pattern': OVERRUN_PATTERN_ID,
            'fill-opacity': 0.9,
          },
        });
      }
    }

    // Create and add shoulder source/layer first (renders below runway)
    const shoulderGeoJSON = createRunwayShoulderGeoJSON(airport.runways);
    if (shoulderGeoJSON.features.length > 0) {
      safeAddGeoJSONSource(map, this.shoulderSourceId, shoulderGeoJSON);

      this.addLayer(map, {
        id: 'airport-runway-shoulders',
        type: 'fill',
        source: this.shoulderSourceId,
        minzoom: ZOOM_BEHAVIORS.runways.minZoom,
        paint: {
          'fill-color': this.buildSurfaceColorExpression(),
          'fill-opacity': 1,
        },
      });
    }

    const geoJSON = createRunwayGeoJSON(airport.runways, airport.waterRunways ?? []);
    this.addSource(map, geoJSON);

    const colorExpression = this.buildSurfaceColorExpression();

    this.addLayer(map, {
      id: this.layerId,
      type: 'fill',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.runways.minZoom,
      paint: {
        'fill-color': colorExpression,
        'fill-opacity': 1,
      },
    });

    // Water lanes carry no painted centerline.
    this.addLayer(map, {
      id: 'airport-runway-centerlines',
      type: 'line',
      source: this.sourceId,
      filter: ['!', ['get', 'water']],
      minzoom: ZOOM_BEHAVIORS.runways.minZoom + 2,
      paint: {
        'line-color': '#FFFFFF',
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 3, 20, 5],
        'line-dasharray': [10, 10],
        'line-opacity': 0.9,
      },
    });

    this.addLayer(map, {
      id: 'airport-runway-labels',
      type: 'symbol',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.labels.minZoom,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 12, 18, 18],
        'text-font': labelFont(map, 'bold'),
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#000000',
        'text-halo-width': 2,
      },
    });
  }

  private buildSurfaceColorExpression(): maplibregl.ExpressionSpecification {
    const matchExpression: unknown[] = ['match', ['get', 'surface']];

    for (const type of SURFACE_TYPES) {
      matchExpression.push(type, getSurfaceColor(type));
    }

    matchExpression.push('#787878'); // fallback (default runway color - dark asphalt)
    return matchExpression as maplibregl.ExpressionSpecification;
  }
}
