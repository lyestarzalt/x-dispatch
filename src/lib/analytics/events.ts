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
  'weight_balance',
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

export const ANALYTICS_DONATE_SOURCES = [
  'support_prompt',
  'settings_about',
  'settings_support',
] as const;

/** Start detail: runway/ramp as-is, helipad, final approach, glider tow, or a custom pin mode. */
export const ANALYTICS_START_VARIANTS = [
  'standard',
  'helipad',
  'approach',
  'tow_tug',
  'tow_winch',
  'ground',
  'air',
  'carrier',
  'frigate',
] as const;

export const ANALYTICS_STARTUP_BUCKETS = ['under_2s', '2_5s', '5_10s', 'over_10s'] as const;
export const ANALYTICS_WIDTH_BUCKETS = [
  'under_1280',
  '1280_1599',
  '1600_1919',
  '1920_2559',
  '2560_plus',
] as const;
export const ANALYTICS_SCALE_BUCKETS = ['1', '1.25', '1.5', '1.75', '2', 'other'] as const;
export const ANALYTICS_SHORTCUTS = ['focus_search'] as const;

/** Why a launch failed: the launcher's error codes, or a flight change X-Plane refused. */
export const ANALYTICS_LAUNCH_ERRORS = [
  'already_running',
  'path_not_configured',
  'invalid_config',
  'exe_not_found',
  'needs_admin',
  'access_blocked',
  'spawn_failed',
  'change_flight_failed',
  'unknown',
] as const;
export const ANALYTICS_DIALOG_TIME_BUCKETS = ['under_10s', '10_60s', '1_5m', 'over_5m'] as const;

/** Where an error toast was shown; the message itself is never sent. */
export const ANALYTICS_ERROR_AREAS = [
  'taxi_route',
  'radio_tune',
  'landing_report',
  'flight_plan',
  'support_report',
  'companion_apps',
  'logs',
  'logbook',
  'fms_export',
  'addon_manager',
] as const;

export const ANALYTICS_EXPLORE_TABS = ['featured', 'routes', 'vatsim', 'weather'] as const;
/** Category chips inside Explore: Featured airports and the live Weather scan. */
export const ANALYTICS_EXPLORE_FILTERS = [
  'all',
  'challenging',
  'scenic',
  'unique',
  'historic',
  'snow',
  'freezing',
  'fog',
  'lowVisibility',
  'lowCeiling',
  'heavyPrecipitation',
  'thunderstorm',
  'severe',
  'dustSand',
  'strongWind',
  'clear',
] as const;

/** Built-in weather presets (WEATHER_OPTIONS without "real"). */
export const ANALYTICS_WEATHER_PRESETS = [
  'clear',
  'cloudy',
  'rainy',
  'stormy',
  'snowy',
  'foggy',
] as const;

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
export type AnalyticsStartVariant = (typeof ANALYTICS_START_VARIANTS)[number];
export type AnalyticsLaunchError = (typeof ANALYTICS_LAUNCH_ERRORS)[number];
export type AnalyticsDialogTimeBucket = (typeof ANALYTICS_DIALOG_TIME_BUCKETS)[number];
export type AnalyticsStartupBucket = (typeof ANALYTICS_STARTUP_BUCKETS)[number];
export type AnalyticsWidthBucket = (typeof ANALYTICS_WIDTH_BUCKETS)[number];
export type AnalyticsScaleBucket = (typeof ANALYTICS_SCALE_BUCKETS)[number];
export type AnalyticsErrorArea = (typeof ANALYTICS_ERROR_AREAS)[number];
export type AnalyticsExploreTab = (typeof ANALYTICS_EXPLORE_TABS)[number];
export type AnalyticsWeatherPreset = (typeof ANALYTICS_WEATHER_PRESETS)[number];

/** Airport idents and aircraft type designators: 2-7 uppercase letters/digits, e.g. EGLL, A320. */
const CODE_PATTERN = /^[A-Z0-9]{2,7}$/;

type Rule =
  | { kind: 'enum'; values: readonly string[]; optional?: boolean }
  | { kind: 'code'; optional?: boolean }
  | { kind: 'boolean' }
  | { kind: 'count' };

const oneOf = (values: readonly string[]): Rule => ({ kind: 'enum', values });
const optionalOneOf = (values: readonly string[]) =>
  ({ kind: 'enum', values, optional: true }) as const;

const EVENT_SCHEMA = {
  feature_opened: { feature: oneOf(ANALYTICS_FEATURES) },
  layer_enabled: { layer: oneOf(ANALYTICS_LAYERS) },
  layer_disabled: { layer: oneOf(ANALYTICS_LAYERS) },
  widget_opened: { widget: oneOf(ANALYTICS_WIDGETS) },
  airport_selected: { airport: { kind: 'code' } },
  flight_launched: {
    mode: oneOf(['cold_start', 'change_flight']),
    airport: { kind: 'code' },
    aircraft_type: { kind: 'code', optional: true },
    helicopter: { kind: 'boolean' },
    start_type: oneOf(['runway', 'ramp', 'custom']),
    start_variant: oneOf(ANALYTICS_START_VARIANTS),
    success: { kind: 'boolean' },
    /** Set only when the launch failed. */
    error_code: optionalOneOf(ANALYTICS_LAUNCH_ERRORS),
    companion_apps_launched: { kind: 'count' },
    // Setup choices: modes and "changed from default" flags only, never the values.
    weather_mode: oneOf(['real', 'preset', 'custom']),
    weather_preset: optionalOneOf(ANALYTICS_WEATHER_PRESETS),
    cloud_layers: { kind: 'count' },
    wind_layers: { kind: 'count' },
    fuel_custom: { kind: 'boolean' },
    payload_custom: { kind: 'boolean' },
    time_mode: oneOf(['real_world', 'custom']),
    cold_and_dark: { kind: 'boolean' },
    livery_default: { kind: 'boolean' },
    /** Built-in Laminar Research aircraft vs an add-on; never the aircraft name or path. */
    aircraft_default: { kind: 'boolean' },
    aircraft_favorite: { kind: 'boolean' },
  },
  /** The Launch dialog was closed without launching a flight. */
  launch_abandoned: {
    aircraft_selected: { kind: 'boolean' },
    /** A launch was tried and failed before the dialog was closed. */
    launch_failed: { kind: 'boolean' },
    time_open: oneOf(ANALYTICS_DIALOG_TIME_BUCKETS),
  },
  /** Airport panel tab switched to. */
  airport_tab_opened: { tab: oneOf(['info', 'start', 'proc']) },
  /** A start position picked on the map, in the airport panel or from the logbook. */
  start_position_selected: {
    start_type: oneOf(['runway', 'ramp', 'custom']),
    helipad: { kind: 'boolean' },
  },
  /** A SID, STAR or approach shown on the map; the procedure name is never sent. */
  procedure_selected: { type: oneOf(['sid', 'star', 'app']) },
  /** A frequency sent to an X-Plane radio from the airport panel. */
  frequency_tuned: {},
  /** A taxi route reached two points: routed from a runway pick, clicked node by node, or drawn. */
  taxi_route_built: { method: oneOf(['auto', 'click', 'freehand']) },
  /** A runway was picked but no taxi route to it was found. */
  taxi_route_auto_failed: {},
  /** Taxi route written for Follow the Greens. */
  taxi_route_exported: {},
  /** Flight plan builder: auto route between the airports, and whether it found one. */
  flight_plan_auto_routed: { success: { kind: 'boolean' } },
  /** Flight plan builder: plan saved to X-Plane. */
  flight_plan_saved: {},
  /** Where the Ko-fi link was clicked. */
  donate_clicked: { source: oneOf(ANALYTICS_DONATE_SOURCES) },
  /** The support toast shown after a few launches. */
  support_prompt_shown: {},
  support_prompt_dismissed: { forever: { kind: 'boolean' } },
  /** An update was found: installed in the background (Windows) or offered as a notice. */
  update_found: { method: oneOf(['auto', 'notice']) },
  /** Windows: the update finished downloading and will install on restart. */
  update_downloaded: {},
  /** macOS/Linux: the update notice's download button was clicked. */
  update_notice_clicked: {},
  /** Once per launch: how long until the map was ready, and whether data came from the cache. */
  app_ready: { startup: oneOf(ANALYTICS_STARTUP_BUCKETS), from_cache: { kind: 'boolean' } },
  /** Once per session, the first time X-Plane connects: the app is used alongside the sim. */
  xplane_connected: {},
  /** Once per launch: window size and display scaling, as buckets. */
  display: {
    window_width: oneOf(ANALYTICS_WIDTH_BUCKETS),
    scale: oneOf(ANALYTICS_SCALE_BUCKETS),
    maximized: { kind: 'boolean' },
    fullscreen: { kind: 'boolean' },
  },
  shortcut_used: { shortcut: oneOf(ANALYTICS_SHORTCUTS) },
  error_shown: { area: oneOf(ANALYTICS_ERROR_AREAS) },
  explore_tab_opened: { tab: oneOf(ANALYTICS_EXPLORE_TABS) },
  /** An airport, route or event picked in Explore; the tab only, never what was picked. */
  explore_item_selected: { tab: oneOf(ANALYTICS_EXPLORE_TABS) },
  explore_filter_selected: {
    tab: oneOf(['featured', 'weather']),
    filter: oneOf(ANALYTICS_EXPLORE_FILTERS),
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

type PropValue<R> = R extends { kind: 'enum'; values: readonly (infer V)[]; optional: true }
  ? V | null
  : R extends { kind: 'enum'; values: readonly (infer V)[] }
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
      if (rule.optional && (value === null || value === undefined)) {
        return { ok: true, value: null };
      }
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
