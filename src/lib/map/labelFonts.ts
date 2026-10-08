import type * as maplibregl from 'maplibre-gl';

/**
 * Fonts for the labels our layers draw over the basemap. A style has one glyph server, and a
 * font that server does not carry is drawn locally by MapLibre instead, one warning per glyph
 * range. The two servers behind the bundled basemaps carry different families, so the stack is
 * picked per server; a custom style is read for the families it uses itself.
 */
export type LabelWeight = 'bold' | 'semibold' | 'regular';

type FontSet = Record<LabelWeight, string[]>;

/** OpenFreeMap: vector basemaps and the reference labels over raster imagery. No semibold. */
const OPENFREEMAP_FONTS: FontSet = {
  bold: ['Noto Sans Bold'],
  semibold: ['Noto Sans Bold'],
  regular: ['Noto Sans Regular'],
};

/** Carto basemaps. */
const CARTO_FONTS: FontSet = {
  bold: ['Open Sans Bold'],
  semibold: ['Open Sans Semibold'],
  regular: ['Open Sans Regular'],
};

const WEIGHT_PATTERN: Record<LabelWeight, RegExp> = {
  bold: /\bbold\b/i,
  semibold: /\b(semi ?bold|medium)\b/i,
  regular: /\bregular\b/i,
};

type StyleLike = Pick<maplibregl.StyleSpecification, 'glyphs' | 'layers'> | undefined;

/** The font stacks a style's own symbol layers use. */
function styleFontStacks(style: StyleLike): string[][] {
  const stacks: string[][] = [];
  for (const layer of style?.layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const font: unknown = layer.layout?.['text-font'];
    if (Array.isArray(font) && font.every((f): f is string => typeof f === 'string')) {
      stacks.push(font);
    }
  }
  return stacks;
}

/** A stack whose first family carries the weight, or the first of those the style uses. */
function fontFromStyle(style: StyleLike, weight: LabelWeight): string[] | null {
  const stacks = styleFontStacks(style);
  const named = stacks.find((s) => WEIGHT_PATTERN[weight].test(s[0] ?? ''));
  if (named) return [named[0] as string];
  if (weight === 'semibold') {
    const bold = stacks.find((s) => WEIGHT_PATTERN.bold.test(s[0] ?? ''));
    if (bold) return [bold[0] as string];
  }
  const first = stacks[0]?.[0];
  return first ? [first] : null;
}

/** Font stack for a label of the given weight on the style's glyph server. Exported for tests. */
export function labelFontForStyle(style: StyleLike, weight: LabelWeight): string[] {
  const glyphs = style?.glyphs ?? '';
  if (glyphs.includes('cartocdn.com')) return CARTO_FONTS[weight];
  // Raster basemaps start without a glyph URL and get OpenFreeMap's once the reference labels load.
  if (glyphs === '' || glyphs.includes('openfreemap.org')) return OPENFREEMAP_FONTS[weight];
  return fontFromStyle(style, weight) ?? OPENFREEMAP_FONTS[weight];
}

/** Font stack for a label of the given weight on the map's current basemap. */
export function labelFont(map: maplibregl.Map, weight: LabelWeight): string[] {
  return labelFontForStyle(map.getStyle() as StyleLike, weight);
}
