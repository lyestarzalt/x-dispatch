import { ANALYTICS_COMPANION_APPS } from './companionApps';

/**
 * Allowlist shared by main and renderer. Every event and property sent to
 * PostHog is declared here; anything else is dropped before it leaves the app.
 * Adding one is a deliberate change that must also update the consent text
 * and the website privacy page.
 */
export const ANALYTICS_FEATURES = [
  'launch',
  'flight_plan_builder',
  'addon_manager',
  'logbook',
  'simbrief',
  'settings',
  'weather',
] as const;

/** Map layers and overlays, reported when switched on. */
export const ANALYTICS_LAYERS = [
  'vatsim',
  'ivao',
  'sim_traffic',
  'weather_radar',
  'clouds',
  'flight_trail',
  'range_rings',
  'terrain_3d',
  'terrain_shading',
  'plane_tracker',
  'follow_plane',
  'night_mode',
  'navaids',
  'ils',
  'airspaces',
  'airways',
] as const;

export const ANALYTICS_WIDGETS = ['explore', 'nav_info', 'replay', 'landing_report'] as const;

export const ANALYTICS_SETTINGS_TABS = [
  'xplane',
  'data',
  'appearance',
  'graphics',
  'flights',
  'airports',
  'simbrief',
  'companion-apps',
  'logs',
  'support',
  'about',
] as const;

/** Built-in basemap ids; user-added styles are reported as "custom", never by URL. */
export const ANALYTICS_MAP_STYLES = [
  'carto-dark',
  'ofm-liberty',
  'carto-positron',
  'esri-satellite',
  'custom',
] as const;

export const ANALYTICS_LANGUAGES = [
  'en',
  'pirate',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ru',
  'pl',
  'ja',
  'zh',
] as const;

export type AnalyticsFeature = (typeof ANALYTICS_FEATURES)[number];
export type AnalyticsLayer = (typeof ANALYTICS_LAYERS)[number];
export type AnalyticsWidget = (typeof ANALYTICS_WIDGETS)[number];

/** Airport idents and aircraft type designators: 2-7 uppercase letters/digits, e.g. EGLL, A320. */
const CODE_PATTERN = /^[A-Z0-9]{2,7}$/;

type Rule =
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'code'; optional?: boolean }
  | { kind: 'boolean' }
  | { kind: 'count' };

const oneOf = (values: readonly string[]): Rule => ({ kind: 'enum', values });

const EVENT_SCHEMA = {
  feature_opened: { feature: oneOf(ANALYTICS_FEATURES) },
  layer_enabled: { layer: oneOf(ANALYTICS_LAYERS) },
  widget_opened: { widget: oneOf(ANALYTICS_WIDGETS) },
  airport_selected: { airport: { kind: 'code' } },
  flight_launched: {
    mode: oneOf(['cold_start', 'change_flight']),
    airport: { kind: 'code' },
    aircraft_type: { kind: 'code', optional: true },
    helicopter: { kind: 'boolean' },
    start_type: oneOf(['runway', 'ramp']),
    success: { kind: 'boolean' },
    companion_apps_launched: { kind: 'count' },
  },
  simbrief_imported: {},
  fms_exported: {},
  settings_tab_opened: { tab: oneOf(ANALYTICS_SETTINGS_TABS) },
  /** One per configured companion app at session start, by known tool id only. */
  companion_app_configured: {
    app: oneOf(ANALYTICS_COMPANION_APPS),
    auto_launch: { kind: 'boolean' },
  },
  /** Sent once per session: how the app is set up, never any paths, IDs or URLs. */
  preferences: {
    theme: oneOf(['light', 'dark', 'system']),
    map_style: oneOf(ANALYTICS_MAP_STYLES),
    app_language: oneOf(ANALYTICS_LANGUAGES),
    weight_unit: oneOf(['lbs', 'kg']),
    font_size: oneOf(['small', 'medium', 'large']),
    clock_mode: oneOf(['zulu', 'local']),
    surface_detail: oneOf(['low', 'medium', 'high']),
    dynamic_sky: { kind: 'boolean' },
    city_lights: { kind: 'boolean' },
    idle_orbit: { kind: 'boolean' },
    simbrief_linked: { kind: 'boolean' },
    fms_export_targets: { kind: 'count' },
    custom_map_styles: { kind: 'count' },
    companion_apps: { kind: 'count' },
  },
} as const satisfies Record<string, Record<string, Rule>>;

export type AnalyticsEventName = keyof typeof EVENT_SCHEMA;

type PropValue<R> = R extends { kind: 'enum'; values: readonly (infer V)[] }
  ? V
  : R extends { kind: 'boolean' }
    ? boolean
    : R extends { kind: 'count' }
      ? number
      : R extends { optional: true }
        ? string | null
        : string;

export type AnalyticsEventProps<E extends AnalyticsEventName> = {
  -readonly [K in keyof (typeof EVENT_SCHEMA)[E]]: PropValue<(typeof EVENT_SCHEMA)[E][K]>;
};

export type SanitizedEvent = {
  event: AnalyticsEventName;
  properties: Record<string, string | number | boolean | null>;
};

function checkValue(
  rule: Rule,
  value: unknown
): { ok: boolean; value: string | number | boolean | null } {
  switch (rule.kind) {
    case 'enum':
      return {
        ok: typeof value === 'string' && rule.values.includes(value),
        value: value as string,
      };
    case 'boolean':
      return { ok: typeof value === 'boolean', value: value as boolean };
    case 'count':
      return {
        ok: Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 1000,
        value: value as number,
      };
    case 'code': {
      if (rule.optional && (value === null || value === undefined || value === '')) {
        return { ok: true, value: null };
      }
      if (typeof value !== 'string') return { ok: false, value: null };
      const code = value.trim().toUpperCase();
      return { ok: CODE_PATTERN.test(code), value: code };
    }
  }
}

/**
 * Validates an event from any source against the schema. Returns null (drop)
 * for unknown events, missing or invalid values; unknown properties are removed.
 */
export function sanitizeEvent(event: unknown, properties: unknown): SanitizedEvent | null {
  if (typeof event !== 'string' || !Object.hasOwn(EVENT_SCHEMA, event)) return null;
  const schema = EVENT_SCHEMA[event as AnalyticsEventName] as Record<string, Rule>;
  const input = (properties && typeof properties === 'object' ? properties : {}) as Record<
    string,
    unknown
  >;
  const out: SanitizedEvent['properties'] = {};
  for (const [key, rule] of Object.entries(schema)) {
    const result = checkValue(rule, input[key]);
    if (!result.ok) return null;
    out[key] = result.value;
  }
  return { event: event as AnalyticsEventName, properties: out };
}

export type AnalyticsConsent = 'granted' | 'denied';

export interface AnalyticsConsentState {
  consent: AnalyticsConsent | null;
  /** True when the first-launch consent dialog should be shown. */
  shouldPrompt: boolean;
}
