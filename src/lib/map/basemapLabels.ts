import type * as maplibregl from 'maplibre-gl';

/**
 * Basemap styles label countries, regions and large waters with the English
 * `name_en` field and switch to the local `name` when zoomed in. Both tile sets
 * the app ships (Carto, OpenFreeMap) carry `name:<lang>` for every UI language,
 * so the English references are swapped for the user's language with fallbacks.
 */

/** App locales whose tiles have no own column fall back to the untouched style. */
const TILE_LANGUAGES = new Set(['de', 'es', 'fr', 'it', 'pt', 'ru', 'pl', 'ja', 'zh']);

type Expr = unknown;

export function tileLanguageFor(appLanguage: string): string | null {
  const base = appLanguage.toLowerCase().split('-')[0] ?? '';
  return TILE_LANGUAGES.has(base) ? base : null;
}

function localizedName(lang: string): Expr[] {
  return [
    'coalesce',
    ['get', `name:${lang}`],
    ['get', 'name_en'],
    ['get', 'name:latin'],
    ['get', 'name'],
  ];
}

/** A coalesce produced by an earlier pass, for any language. */
function isLocalizedName(expr: Expr): boolean {
  if (!Array.isArray(expr) || expr[0] !== 'coalesce') return false;
  const first = expr[1];
  return (
    Array.isArray(first) &&
    first[0] === 'get' &&
    typeof first[1] === 'string' &&
    first[1].startsWith('name:') &&
    first[1] !== 'name:latin' &&
    first[1] !== 'name:nonlatin'
  );
}

function isEnglishGet(expr: Expr): boolean {
  return (
    Array.isArray(expr) && expr[0] === 'get' && (expr[1] === 'name_en' || expr[1] === 'name:en')
  );
}

function localizeString(value: string, lang: string): Expr {
  return value === '{name_en}' || value === '{name:en}' ? localizedName(lang) : value;
}

/**
 * Rewrites one `text-field` value for the language. Returns the input itself
 * when nothing refers to the English name, so callers can skip the update.
 */
export function localizeTextField(textField: Expr, lang: string): Expr {
  if (typeof textField === 'string') return localizeString(textField, lang);

  if (Array.isArray(textField)) {
    if (isLocalizedName(textField) || isEnglishGet(textField)) return localizedName(lang);
    let changed = false;
    const next = textField.map((item) => {
      const out = localizeTextField(item, lang);
      if (out !== item) changed = true;
      return out;
    });
    return changed ? next : textField;
  }

  // Legacy zoom function: {stops: [[8, "{name_en}"], [13, "{name}"]]}
  if (textField && typeof textField === 'object' && 'stops' in textField) {
    const stops = (textField as { stops: [number, Expr][] }).stops;
    if (!stops.some(([, out]) => typeof out === 'string' && localizeString(out, lang) !== out)) {
      return textField;
    }
    const [first, ...rest] = stops;
    if (!first) return textField;
    const step: Expr[] = ['step', ['zoom'], localizeTextField(first[1], lang)];
    for (const [zoom, out] of rest) step.push(zoom, localizeTextField(out, lang));
    return step;
  }

  return textField;
}

/** Applies the language to every symbol layer of the current style. */
export function localizeBasemapLabels(map: maplibregl.Map, appLanguage: string): void {
  const lang = tileLanguageFor(appLanguage);
  const style = map.getStyle();
  if (!lang || !style?.layers) return;

  for (const layer of style.layers) {
    if (layer.type !== 'symbol') continue;
    const textField = layer.layout?.['text-field'];
    if (textField === undefined) continue;
    const next = localizeTextField(textField, lang);
    if (next !== textField) {
      map.setLayoutProperty(
        layer.id,
        'text-field',
        next as maplibregl.DataDrivenPropertyValueSpecification<string>
      );
    }
  }
}
