import { SolidPolygonLayer } from '@deck.gl/layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import maplibregl from 'maplibre-gl';
import { NAV_COLORS } from '@/config/navLayerConfig';
import { destinationPoint, nauticalMilesToMeters } from '@/lib/utils/geomath';
import { svgToDataUrl } from '@/lib/utils/helpers';
import type { Navaid } from '@/types/navigation';
import { setLayersVisibility } from '../types';
import { NavLayerRenderer } from './NavLayerRenderer';
import { type BeamKind, type BeamPolygon, buildBeamPolygons } from './ilsMeshes';

function createILSSymbolSVG(size: number = 36): string {
  const center = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <polygon points="${center},4 ${center - 8},${size - 4} ${center},${size - 12} ${center + 8},${size - 4}" fill="${NAV_COLORS.ils}" stroke="${NAV_COLORS.ils}" stroke-width="1"/>
    <line x1="${center}" y1="4" x2="${center}" y2="${size - 4}" stroke="#000" stroke-width="1.5"/>
  </svg>`;
}

function destinationPointNm(
  lat: number,
  lon: number,
  bearing: number,
  distanceNm: number
): [number, number] {
  return destinationPoint(lat, lon, nauticalMilesToMeters(distanceNm), bearing);
}

function createILSCourseGeoJSON(ilsList: Navaid[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const ils of ilsList) {
    if (ils.bearing === undefined) continue;
    const course = (ils.bearing + 180) % 360;
    const origin: [number, number] = [ils.longitude, ils.latitude];
    const endPoint = destinationPointNm(ils.latitude, ils.longitude, course, 12);
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [origin, endPoint] },
      properties: { id: ils.id, runway: ils.associatedRunway || '' },
    });
  }
  return { type: 'FeatureCollection', features };
}

// Parse "#RRGGBB" → [R, G, B]. deck.gl wants RGB arrays, not CSS strings.
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m || !m[1] || !m[2] || !m[3]) return [255, 136, 0];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

const ILS_BEAM_RGB = hexToRgb(NAV_COLORS.ils);

// Lower opacity on both walls — the wedge reads as a translucent beam volume
// rather than two opaque sheets.
const BEAM_ALPHA: Record<BeamKind, number> = {
  GS_LOWER: 51, // ~20%
  GS_UPPER: 51,
};

const DECK_LAYER_ID = 'nav-ils-deck-beams';

/**
 * ILS layer.
 *
 * Two-tier rendering:
 *
 *   - MapLibre native — the antenna symbol, frequency/runway label, and a
 *     2D dashed extended centerline (`nav-ils`, `nav-ils-labels`,
 *     `nav-ils-course`). These give the on-ground bearings of the LOC.
 *   - deck.gl `SolidPolygonLayer` via an interleaved `MapboxOverlay` — the
 *     GS wedge, drawn as two stacked tilted planes at ±0.7° around the
 *     glide path. Interleaved mode shares MapLibre's depth buffer so the
 *     wedge clips correctly behind 3D terrain.
 *
 * The LOC is intentionally NOT rendered as a separate fan: the GS wedge
 * occupies the same lateral footprint as the LOC course (its centerline
 * is the runway-extended centerline), so a flat LOC fan would just
 * visually duplicate the wedge's projected footprint without adding
 * information.
 *
 * LOC↔GS pairing in `ilsMeshes.ts` re-anchors the GS apex at the LOC
 * antenna position — physical GS antennas sit ~400 ft beside the runway,
 * which would otherwise put the wedge visibly off the extended centerline.
 */
export class ILSLayerRenderer extends NavLayerRenderer<Navaid> {
  readonly layerId = 'nav-ils';
  readonly sourceId = 'nav-ils-source';
  readonly additionalLayerIds = ['nav-ils-labels', 'nav-ils-course'];

  private readonly courseSourceId = 'nav-ils-course-source';

  private imagesLoaded = false;

  // Overlay is bound to a specific map instance — recreated if the map is
  // ever swapped (HMR / app-restart paths).
  private deckOverlay: MapboxOverlay | null = null;
  private deckMap: maplibregl.Map | null = null;
  private currentBeams: BeamPolygon[] = [];
  private beamsVisible = true;

  protected createGeoJSON(ilsList: Navaid[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: ilsList.map((ils) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [ils.longitude, ils.latitude] },
        properties: {
          id: ils.id,
          name: ils.name,
          frequency: ils.frequency,
          bearing: ils.bearing || 0,
          runway: ils.associatedRunway || '',
          freqDisplay: `${(ils.frequency / 100).toFixed(2)}`,
          rotation: ils.bearing !== undefined ? (ils.bearing + 180) % 360 : 0,
        },
      })),
    };
  }

  protected async loadImages(map: maplibregl.Map): Promise<boolean> {
    const id = 'ils-symbol';
    if (map.hasImage(id)) {
      this.imagesLoaded = true;
      return true;
    }
    try {
      const img = new Image();
      this.imagesLoaded = await new Promise<boolean>((resolve) => {
        img.onload = () => {
          if (!map.hasImage(id)) map.addImage(id, img, { sdf: false });
          resolve(true);
        };
        img.onerror = () => resolve(false);
        img.src = svgToDataUrl(createILSSymbolSVG(36));
      });
      return this.imagesLoaded;
    } catch {
      this.imagesLoaded = false;
      return false;
    }
  }

  protected addLayers(map: maplibregl.Map): void {
    const [labelsLayerId, courseLayerId] = this.additionalLayerIds;
    if (!labelsLayerId || !courseLayerId) return;

    map.addLayer({
      id: courseLayerId,
      type: 'line',
      source: this.courseSourceId,
      paint: {
        'line-color': NAV_COLORS.ils,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 2, 16, 3],
        'line-dasharray': [4, 2],
        'line-opacity': 0.8,
      },
    });

    if (this.imagesLoaded && map.hasImage('ils-symbol')) {
      map.addLayer({
        id: this.layerId,
        type: 'symbol',
        source: this.sourceId,
        layout: {
          'icon-image': 'ils-symbol',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 12, 0.7, 16, 1.0],
          'icon-rotate': ['get', 'rotation'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
        },
      });
    } else {
      map.addLayer({
        id: this.layerId,
        type: 'circle',
        source: this.sourceId,
        paint: {
          'circle-color': NAV_COLORS.ils,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 6, 16, 8],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
    }

    map.addLayer({
      id: labelsLayerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: 10,
      layout: {
        'text-field': [
          'concat',
          ['get', 'id'],
          ' ',
          ['get', 'runway'],
          '\n',
          ['get', 'freqDisplay'],
        ],
        'text-font': ['Open Sans Semibold'],
        'text-size': 9,
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': NAV_COLORS.ils,
        'text-halo-color': '#000000',
        'text-halo-width': 1.5,
      },
    });
  }

  /**
   * Eagerly attach the deck.gl overlay to the map. Call once on
   * `map.on('load')` from `useMapSetup`. Idempotent: a no-op if the same
   * overlay is already attached to this map. If `add()` ran before attach
   * (cold-start nav-data-arrived-first race), the pending state is flushed
   * here so the wedge appears as soon as the overlay is wired.
   */
  attachTo(map: maplibregl.Map): void {
    if (this.deckOverlay && this.deckMap === map) return;
    if (this.deckOverlay && this.deckMap && this.deckMap !== map) {
      try {
        this.deckMap.removeControl(this.deckOverlay);
      } catch {
        /* ignore: control may already be detached */
      }
      this.deckOverlay.finalize();
      this.deckOverlay = null;
    }
    const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
    map.addControl(overlay);
    this.deckOverlay = overlay;
    this.deckMap = map;
    // Flush any state populated before attach.
    overlay.setProps({ layers: this.buildDeckLayers() });
  }

  /** Detach on map teardown. */
  detachFrom(map: maplibregl.Map): void {
    if (!this.deckOverlay || this.deckMap !== map) return;
    try {
      map.removeControl(this.deckOverlay);
    } catch {
      /* ignore */
    }
    this.deckOverlay.finalize();
    this.deckOverlay = null;
    this.deckMap = null;
  }

  private buildDeckLayers(): SolidPolygonLayer[] {
    if (this.currentBeams.length === 0 || !this.beamsVisible) return [];

    const byKind: Record<BeamKind, BeamPolygon[]> = { GS_LOWER: [], GS_UPPER: [] };
    for (const beam of this.currentBeams) byKind[beam.kind].push(beam);

    const layers: SolidPolygonLayer[] = [];
    (Object.keys(byKind) as BeamKind[]).forEach((kind) => {
      const data = byKind[kind];
      if (data.length === 0) return;
      layers.push(
        new SolidPolygonLayer({
          id: `${DECK_LAYER_ID}-${kind.toLowerCase()}`,
          data,
          getPolygon: (d: BeamPolygon) => d.polygon,
          getFillColor: [...ILS_BEAM_RGB, BEAM_ALPHA[kind]],
          filled: true,
          extruded: false,
          stroked: false,
          pickable: false,
          // Tesselate on the largest-area plane of the tilted polygon
          // (otherwise earcut projects to XY and the wedge degenerates).
          _full3d: true,
          // Read depth (so terrain occludes the wedge), but DON'T write
          // depth. Two translucent stacked planes that both write depth
          // occlude each other based on draw order — visible artifact
          // where one wall "eats" the other.
          parameters: { depthMask: false },
        })
      );
    });
    return layers;
  }

  /**
   * Push current beam state to the overlay. No-op if not yet attached —
   * `attachTo()` will flush state when it runs.
   */
  private pushDeckLayers(): void {
    if (!this.deckOverlay) return;
    this.deckOverlay.setProps({ layers: this.buildDeckLayers() });
  }

  async add(map: maplibregl.Map, data: Navaid[]): Promise<void> {
    this.remove(map);
    if (data.length === 0) return;

    await this.loadImages(map);

    const locData = data.filter((n) => n.type !== 'GS');

    this.safeAddSource(map, this.courseSourceId, createILSCourseGeoJSON(locData));
    this.safeAddSource(map, this.sourceId, this.createGeoJSON(locData));
    this.ensureLayers(map);

    this.currentBeams = buildBeamPolygons(data);
    this.beamsVisible = true;
    this.pushDeckLayers();
  }

  async update(map: maplibregl.Map, data: Navaid[]): Promise<void> {
    const source = map.getSource(this.sourceId) as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      await this.add(map, data);
      return;
    }
    const locData = data.filter((n) => n.type !== 'GS');
    source.setData(this.createGeoJSON(locData));
    const courseSource = map.getSource(this.courseSourceId) as maplibregl.GeoJSONSource | undefined;
    if (courseSource) courseSource.setData(createILSCourseGeoJSON(locData));

    this.currentBeams = buildBeamPolygons(data);
    this.pushDeckLayers();
  }

  protected performRemove(map: maplibregl.Map): void {
    super.performRemove(map);
    if (map.getSource(this.courseSourceId)) map.removeSource(this.courseSourceId);

    this.currentBeams = [];
    if (this.deckOverlay && this.deckMap === map) {
      this.deckOverlay.setProps({ layers: [] });
    }
  }

  setVisibility(map: maplibregl.Map, visible: boolean): void {
    setLayersVisibility(map, [this.layerId, ...this.additionalLayerIds], visible);
    this.beamsVisible = visible;
    if (this.deckOverlay && this.deckMap === map) {
      this.deckOverlay.setProps({ layers: this.buildDeckLayers() });
    }
  }
}

export const ilsLayer = new ILSLayerRenderer();
export const ILS_LAYER_IDS = ilsLayer.getAllLayerIds();
