/**
 * The one Content-Security-Policy. Main sends it as a header on every response,
 * and the renderer Vite build writes it into index.html's meta tag (the tablet
 * browser only sees the meta). Both being enforced means the stricter one wins,
 * so two hand-kept copies would drift silently.
 *
 * Imported by vite.renderer.config.mts: keep it free of `@/` aliases.
 */

const TILE_HOSTS = [
  'https://*.tile.openstreetmap.org',
  'https://basemaps.cartocdn.com',
  'https://*.basemaps.cartocdn.com',
  'https://*.arcgisonline.com',
  'https://s3.amazonaws.com',
  'https://tiles.mapterhorn.com',
  'https://*.rainviewer.com',
  'https://gibs.earthdata.nasa.gov',
  'https://view.eumetsat.int',
];

const DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    ...TILE_HOSTS,
    'https://*.openstreetmap.org',
    'https://server.arcgisonline.com',
  ],
  'font-src': ["'self'", 'data:'],
  'connect-src': [
    "'self'",
    'ws://localhost:*',
    'http://localhost:*',
    'https://avwx.rest',
    'https://gateway.x-plane.com',
    'https://api.maptiler.com',
    'https://tiles.openfreemap.org',
    ...TILE_HOSTS,
  ],
  'worker-src': ["'self'", 'blob:'],
};

export const CONTENT_SECURITY_POLICY = Object.entries(DIRECTIVES)
  .map(([name, sources]) => `${name} ${sources.join(' ')}`)
  .join('; ');

/** Token in index.html that the renderer build replaces with the policy. */
export const CSP_META_PLACEHOLDER = '%X_DISPATCH_CSP%';
