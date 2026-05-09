/**
 * Classifies a basemap URL into a visual theme so map overlays (airport labels,
 * pins) can pick contrast-friendly colors. Custom user-added styles default to
 * `light` — most user styles are positron-likes, and white text on a light
 * basemap is unreadable, so we err toward dark text.
 *
 * The default-airport DOT is intentionally NOT theme-keyed: a single brand
 * cyan plus a white halo ring + dark hairline stroke gives a contrasting
 * symbol that survives any basemap (snow, forest, ocean, beige). The
 * per-theme palette only governs the label and the custom-airport pin.
 */
export type BasemapTheme = 'dark' | 'light' | 'satellite' | 'custom';

const DARK_URLS: ReadonlySet<string> = new Set([
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
]);

const LIGHT_URLS: ReadonlySet<string> = new Set([
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  'https://tiles.openfreemap.org/styles/liberty',
]);

const SATELLITE_URLS: ReadonlySet<string> = new Set([
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
]);

export function getBasemapTheme(url: string): BasemapTheme {
  if (DARK_URLS.has(url)) return 'dark';
  if (LIGHT_URLS.has(url)) return 'light';
  if (SATELLITE_URLS.has(url)) return 'satellite';
  return 'custom';
}

/** Brand cyan = `--info`. Used for the airport dot fill across every theme. */
export const AIRPORT_DOT_FILL = '#1DA0F2';
/** Dark hairline drawn around the dot — provides contrast on white/snow/cloud terrain. */
export const AIRPORT_DOT_STROKE = '#0d1a26';
/** White halo ring rendered beneath the dot — provides contrast on dark/forest/ocean terrain. */
export const AIRPORT_HALO_FILL = '#ffffff';

export interface AirportThemeColors {
  pinBodyColor: string;
  labelDefault: string;
  labelCustom: string;
  labelHalo: string;
}

const DARK_COLORS: AirportThemeColors = {
  pinBodyColor: '#d4a017', // --warning
  labelDefault: '#cccccc',
  labelCustom: '#e8c36a',
  labelHalo: '#000000',
};

const LIGHT_COLORS: AirportThemeColors = {
  pinBodyColor: '#d4a017', // --warning
  labelDefault: '#1a1a1a',
  labelCustom: '#a8520a',
  labelHalo: '#ffffff',
};

const SATELLITE_COLORS: AirportThemeColors = {
  pinBodyColor: '#d4a017', // --warning
  labelDefault: '#ffffff',
  labelCustom: '#e8c36a',
  labelHalo: '#000000',
};

export const AIRPORT_THEME_COLORS: Record<BasemapTheme, AirportThemeColors> = {
  dark: DARK_COLORS,
  light: LIGHT_COLORS,
  satellite: SATELLITE_COLORS,
  custom: LIGHT_COLORS,
};
