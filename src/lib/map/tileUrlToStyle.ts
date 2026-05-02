import type { StyleSpecification } from 'maplibre-gl';

// Tile schemes vary by provider on the order of x/y after z:
//   {z}/{x}/{y} — OSM, Carto, OFM raster tiles
//   {z}/{y}/{x} — Esri ArcGIS REST tile services
// Anchor on path separators (/ or .) between placeholders so a vector-style
// URL that *happens* to contain `{x}` or `{y}` literals (e.g. as part of a
// query parameter or template name) doesn't get misclassified as raster.
const TILE_PLACEHOLDER_RE = /\{z\}[./]\{[xy]\}[./]\{[xy]\}/;

export function isRasterTileUrl(url: string): boolean {
  return TILE_PLACEHOLDER_RE.test(url);
}

// Recognise URLs whose pathname looks like a MapLibre vector style endpoint:
//   .../style.json
//   .../styles/<name>          (OpenFreeMap, MapTiler v1)
//   .../styles/<name>/style.json
//   .../<style>.json           (caller-hosted style files)
const VECTOR_STYLE_PATH_RE = /(?:\/style(?:s\/[^/]+)?(?:\/style)?\.json|\/styles\/[^/]+)\/?$/;

export function isVectorStyleUrl(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return VECTOR_STYLE_PATH_RE.test(pathname);
  } catch {
    return false;
  }
}

/**
 * Validate that `url` is acceptable as a map style URL.
 * Returns `null` on success or a human-readable error message otherwise.
 *
 * Accepted shapes:
 *   - https + a recognised vector style path (`.../style.json`,
 *     `.../styles/<name>`, etc.)
 *   - https + a raster tile pattern with all three placeholders
 *
 * `http://localhost:*` is allowed for self-hosted dev (matches the dev CSP).
 * Other `http://` and non-http schemes are rejected.
 */
export function validateMapStyleUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return 'URL is required';

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'Not a valid URL';
  }

  const isHttps = parsed.protocol === 'https:';
  const isLocalhostHttp =
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
  if (!isHttps && !isLocalhostHttp) {
    return 'URL must use https:// (or http://localhost for dev)';
  }

  if (isVectorStyleUrl(trimmed) || isRasterTileUrl(trimmed)) return null;
  return 'URL must be a MapLibre style.json or a raster tile pattern with {z}/{x}/{y}';
}

/**
 * Map known tile-host substrings to the attribution string each provider
 * requires us to display. Falls back to a generic attribution for unknown
 * hosts (so user-pasted URLs still render *something* — just not vendor-
 * specific).
 */
const ATTRIBUTION_BY_HOST: ReadonlyArray<{ match: string; text: string }> = [
  {
    match: 'arcgisonline.com',
    text: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
  },
  { match: 'tile.openstreetmap.org', text: '&copy; OpenStreetMap contributors' },
  { match: 'basemaps.cartocdn.com', text: '&copy; OpenStreetMap contributors, &copy; CARTO' },
  { match: 'tiles.openfreemap.org', text: '&copy; OpenFreeMap, &copy; OpenMapTiles' },
];

export function attributionForUrl(url: string): string {
  for (const { match, text } of ATTRIBUTION_BY_HOST) {
    if (url.includes(match)) return text;
  }
  return '&copy; Map data contributors';
}

export function tileUrlToStyle(url: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      raster: {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        attribution: attributionForUrl(url),
      },
    },
    layers: [
      {
        id: 'raster',
        type: 'raster',
        source: 'raster',
      },
    ],
  };
}

/**
 * Normalize a user-facing map style identifier into the right argument shape
 * for MapLibre's `new Map({ style })` and `map.setStyle(...)`.
 *
 * - For a MapLibre vector style URL (e.g. `style.json`), pass through as-is —
 *   MapLibre fetches and parses it.
 * - For a raster tile pattern (e.g. `.../{z}/{x}/{y}.png` or Esri's
 *   `.../{z}/{y}/{x}`), wrap into a synthetic style spec via `tileUrlToStyle`
 *   so MapLibre treats it as a raster source instead of trying to JSON-parse
 *   the JPEG/PNG response.
 *
 * Centralizing the branch here means every setStyle call site uses the same
 * decision; previously it was duplicated and one site forgot to wrap.
 */
export function resolveMapStyleArg(url: string): StyleSpecification | string {
  return isRasterTileUrl(url) ? tileUrlToStyle(url) : url;
}
