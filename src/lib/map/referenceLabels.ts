import type * as maplibregl from 'maplibre-gl';
import { localizeTextField, tileLanguageFor } from './basemapLabels';

/**
 * Raster basemaps (satellite imagery, custom tile URLs) carry no labels or
 * borders. The Carto dark style's boundary and place layers are laid over them:
 * light text with a dark halo reads well on imagery, and the tiles carry the
 * same per-language names the vector basemaps use.
 */

export const REFERENCE_STYLE_URL =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
/** Dropped by preserveCustomStyle on every style switch, so a vector basemap never doubles up. */
export const REFERENCE_SOURCE_ID = 'ref-carto';
const REFERENCE_LAYER_PREFIX = 'ref-';
const REFERENCE_LAYER_PATTERN = /^(boundary_|place_|watername_|waterway_label)/;
const BOUNDARY_COLOR = 'rgba(255, 255, 255, 0.55)';

export interface ReferenceStyle {
  glyphs?: string;
  sources: Record<string, maplibregl.SourceSpecification>;
  layers: maplibregl.LayerSpecification[];
}

/** The overlay layers of a Carto style, renamed onto the reference source and localized. */
export function buildReferenceLayers(
  style: ReferenceStyle,
  appLanguage: string
): maplibregl.LayerSpecification[] {
  const lang = tileLanguageFor(appLanguage);
  const out: maplibregl.LayerSpecification[] = [];
  for (const layer of style.layers) {
    if (!REFERENCE_LAYER_PATTERN.test(layer.id)) continue;
    if (layer.type !== 'symbol' && layer.type !== 'line') continue;
    // City dots need the style's sprite; the text layers cover those places anyway.
    if (layer.layout && 'icon-image' in layer.layout) continue;

    const copy = structuredClone(layer) as maplibregl.LayerSpecification & { source?: string };
    copy.id = `${REFERENCE_LAYER_PREFIX}${layer.id}`;
    copy.source = REFERENCE_SOURCE_ID;
    if (copy.type === 'line') {
      copy.paint = { ...copy.paint, 'line-color': BOUNDARY_COLOR };
    } else if (lang) {
      const symbol = copy as maplibregl.SymbolLayerSpecification;
      const textField = symbol.layout?.['text-field'];
      if (textField !== undefined) {
        symbol.layout = {
          ...symbol.layout,
          'text-field': localizeTextField(
            textField,
            lang
          ) as maplibregl.DataDrivenPropertyValueSpecification<string>,
        };
      }
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

/** Adds borders and place names over a raster basemap once; a no-op when present. */
export async function addReferenceLabels(map: maplibregl.Map, appLanguage: string): Promise<void> {
  if (!map.getStyle() || map.getSource(REFERENCE_SOURCE_ID)) return;
  const style = await fetchReferenceStyle();
  if (!map.getStyle() || map.getSource(REFERENCE_SOURCE_ID)) return;

  const source = Object.values(style.sources).find((s) => s.type === 'vector');
  if (!source) return;

  if (style.glyphs && !map.getStyle().glyphs) map.setGlyphs(style.glyphs);
  map.addSource(REFERENCE_SOURCE_ID, source);
  for (const layer of buildReferenceLayers(style, appLanguage)) {
    if (!map.getLayer(layer.id)) map.addLayer(layer);
  }
}

export function isReferenceLayerId(id: string): boolean {
  return id.startsWith(REFERENCE_LAYER_PREFIX);
}
