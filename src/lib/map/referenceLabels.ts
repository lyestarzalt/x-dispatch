import type * as maplibregl from 'maplibre-gl';
import { localizeTextField, tileLanguageFor } from './basemapLabels';
import { landOnlyFilter } from './maritimeBoundaries';
import {
  DEFAULT_REFERENCE_LABEL_SETTINGS,
  type ReferenceLabelSettings,
  referenceLabelCategory,
} from './referenceLabelSettings';

/**
 * Raster basemaps (satellite imagery, custom tile URLs) carry no labels or
 * borders. The OpenFreeMap dark style's boundary and place layers are laid over them
 * with their own text restyled: the style's gray-on-black labels vanish on imagery, so
 * they become white with a solid dark halo, at the brightness and size the user chose.
 * The tiles carry the same per-language names the vector basemaps use.
 */

export const REFERENCE_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
/** Dropped by preserveCustomStyle on every style switch, so a vector basemap never doubles up. */
export const REFERENCE_SOURCE_ID = 'ref-basemap';
const REFERENCE_LAYER_PREFIX = 'ref-';
const BOUNDARY_COLOR = 'rgba(255, 255, 255, 0.55)';
const LABEL_HALO = {
  'text-halo-color': 'rgba(0, 0, 0, 0.85)',
  'text-halo-width': 1.6,
  'text-halo-blur': 0.4,
} as const;
/** Water names keep a light blue cast; the fractions are that tint at full brightness. */
const WATER_TINT = [0.81, 0.9, 1] as const;
const BOLD_LAYER_PATTERN = /^place_(country|state|city_large)/;
const BOLD_FONT = ['Noto Sans Bold'];
/**
 * The reference style lets the tiles decide when a place appears, which on imagery
 * means every region and town the tile carries shows at once. Staged like other maps:
 * countries first, then regions and cities, towns and roads only close in.
 */
const MIN_ZOOM: Record<string, number> = {
  place_state: 4,
  place_city: 5,
  place_town: 8,
  place_village: 10,
  place_suburb: 11,
  place_other: 11,
  water_name: 5,
  highway_name_motorway: 8,
  highway_name_other: 11,
};

export interface ReferenceStyle {
  glyphs?: string;
  sources: Record<string, maplibregl.SourceSpecification>;
  layers: maplibregl.LayerSpecification[];
}

function withoutIconProperties<T extends object | undefined>(props: T): T {
  if (!props) return props;
  return Object.fromEntries(Object.entries(props).filter(([key]) => !key.startsWith('icon-'))) as T;
}

function labelColor(brightness: number, tint: readonly [number, number, number]): string {
  const [r, g, b] = tint.map((f) => Math.round(255 * f * brightness));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * The style's sizes are numbers or zoom curves. A curve cannot be wrapped in an
 * arithmetic expression, since MapLibre only allows "zoom" at the top of a "step"
 * or "interpolate", so its output stops are scaled in place instead.
 */
function scaledSize(size: unknown, scale: number): unknown {
  if (scale === 1 || size === undefined) return size;
  if (typeof size === 'number') return size * scale;
  if (!Array.isArray(size)) return size;
  const [op] = size;
  // interpolate: [op, kind, input, stop, value, stop, value...]; step: [op, input, value, stop, value...]
  const firstOutput = op === 'interpolate' ? 4 : op === 'step' ? 2 : -1;
  if (firstOutput < 0) return size;
  return size.map((item, i) =>
    i >= firstOutput && (i - firstOutput) % 2 === 0 && typeof item === 'number'
      ? item * scale
      : item
  );
}

/** The overlay layers of the reference style, renamed onto the reference source and localized. */
export function buildReferenceLayers(
  style: ReferenceStyle,
  appLanguage: string,
  settings: ReferenceLabelSettings = DEFAULT_REFERENCE_LABEL_SETTINGS
): maplibregl.LayerSpecification[] {
  const lang = tileLanguageFor(appLanguage);
  const out: maplibregl.LayerSpecification[] = [];
  for (const layer of style.layers) {
    const category = referenceLabelCategory(layer.id);
    if (!category || !settings.show[category]) continue;
    if (layer.type !== 'symbol' && layer.type !== 'line') continue;
    // Icons need the style's sprite, which a raster style lacks: text-only
    // layers keep their text, pure dot layers go.
    if (layer.type === 'symbol' && layer.layout?.['text-field'] === undefined) continue;

    const copy = structuredClone(layer) as maplibregl.LayerSpecification & { source?: string };
    copy.id = `${REFERENCE_LAYER_PREFIX}${layer.id}`;
    copy.source = REFERENCE_SOURCE_ID;
    const minZoom = MIN_ZOOM[layer.id];
    if (minZoom !== undefined) copy.minzoom = Math.max(copy.minzoom ?? 0, minZoom);
    if (copy.type === 'line') {
      copy.paint = { ...copy.paint, 'line-color': BOUNDARY_COLOR };
      copy.filter = landOnlyFilter(copy.filter);
    } else {
      const symbol = copy as maplibregl.SymbolLayerSpecification;
      const tint = category === 'water' ? WATER_TINT : ([1, 1, 1] as const);
      symbol.paint = {
        ...withoutIconProperties(symbol.paint),
        ...LABEL_HALO,
        'text-color': labelColor(settings.brightness, tint),
      };
      const layout = withoutIconProperties(symbol.layout) ?? {};
      const textField = layout['text-field'];
      symbol.layout = {
        ...layout,
        ...(BOLD_LAYER_PATTERN.test(layer.id) && { 'text-font': BOLD_FONT }),
        ...(layout['text-size'] !== undefined && {
          'text-size': scaledSize(
            layout['text-size'],
            settings.sizeScale
          ) as maplibregl.DataDrivenPropertyValueSpecification<number>,
        }),
        ...(lang &&
          textField !== undefined && {
            'text-field': localizeTextField(
              textField,
              lang
            ) as maplibregl.DataDrivenPropertyValueSpecification<string>,
          }),
      };
    }
    out.push(copy);
  }
  return out;
}

let referenceStylePromise: Promise<ReferenceStyle> | null = null;

export function fetchReferenceStyle(): Promise<ReferenceStyle> {
  referenceStylePromise ??= fetch(REFERENCE_STYLE_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`Reference style ${r.status}`);
      return r.json() as Promise<ReferenceStyle>;
    })
    .catch((err) => {
      referenceStylePromise = null;
      throw err;
    });
  return referenceStylePromise;
}

/**
 * Lays borders and place names over a raster basemap. The layers are rebuilt on
 * every call so a changed setting applies without a style reload; the source stays.
 */
export async function addReferenceLabels(
  map: maplibregl.Map,
  appLanguage: string,
  settings: ReferenceLabelSettings = DEFAULT_REFERENCE_LABEL_SETTINGS
): Promise<void> {
  if (!map.getStyle()) return;
  const style = await fetchReferenceStyle();
  if (!map.getStyle()) return;

  if (!map.getSource(REFERENCE_SOURCE_ID)) {
    const source = Object.values(style.sources).find((s) => s.type === 'vector');
    if (!source) return;
    if (style.glyphs && !map.getStyle().glyphs) map.setGlyphs(style.glyphs);
    map.addSource(REFERENCE_SOURCE_ID, source);
  }
  for (const layer of map.getStyle().layers) {
    if (isReferenceLayerId(layer.id)) map.removeLayer(layer.id);
  }
  for (const layer of buildReferenceLayers(style, appLanguage, settings)) {
    map.addLayer(layer);
  }
}

export function isReferenceLayerId(id: string): boolean {
  return id.startsWith(REFERENCE_LAYER_PREFIX);
}
