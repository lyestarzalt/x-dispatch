import { APP_ACTION_KINDS } from '../nativeShell/appUrl';
import { ANALYTICS_COMPANION_APPS } from './companionApps';

/**
 * Allowlist shared by main and renderer. Every event and property sent to
 * PostHog is declared here; anything else is dropped before it leaves the app.
 * The consent text and the website privacy page describe kinds of data, not
 * events: update them only when an event adds a new kind of data (typed text,
 * locations, identifiers), never for another enum, boolean or count.
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

/** Map widgets, reported when opened; the measure line and profile strip count when first shown. */
export const ANALYTICS_WIDGETS = [
  'nav_info',
  'replay',
  'landing_report',
  'measure',
  'profile',
] as const;

/** Actions of the map's right-click menu. */
export const ANALYTICS_CONTEXT_MENU_ACTIONS = [
  'start_here',
  'copy_coordinates',
  'measure',
  'clear_measurement',
  'center_map',
] as const;

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

/** Up to 2.17.0, everything past 10 s was one `over_10s` bucket. */
export const ANALYTICS_STARTUP_BUCKETS = [
  'under_2s',
  '2_5s',
  '5_10s',
  '10_30s',
  '30_60s',
  'over_60s',
] as const;
export const ANALYTICS_WIDTH_BUCKETS = [
  'under_1280',
  '1280_1599',
  '1600_1919',
  '1920_2559',
  '2560_plus',
] as const;
export const ANALYTICS_SCALE_BUCKETS = ['1', '1.25', '1.5', '1.75', '2', 'other'] as const;
/** Menu items and their accelerators; `focus_search` is Find Airport. */
export const ANALYTICS_SHORTCUTS = [
  'open_flight_plan',
  'import_simbrief',
  'launch_x_plane',
  'focus_search',
  'zoom_in',
  'zoom_out',
  'zoom_reset',
  'toggle_sidebar',
  'flight_strip_window',
  'flight_strip_lock',
  'keyboard_shortcuts',
  'close_window',
  'open_logs',
] as const;
/** Where an xdispatch:// link said it came from; 'none' when it did not say. */
export const ANALYTICS_DEEP_LINK_SOURCES = ['website', 'discord', 'manual', 'none'] as const;

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
/**
 * Why a launch failed, one step finer than `ANALYTICS_LAUNCH_ERRORS`: the
 * launcher's codes for a cold start, and what went wrong with a flight change
 * (our validation, the connection, X-Plane's HTTP answer, or its refusal).
 */
export const ANALYTICS_LAUNCH_FAILURE_REASONS = [
  'already_running',
  'path_not_configured',
  'invalid_config',
  'exe_not_found',
  'needs_admin',
  'access_blocked',
  'spawn_failed',
  'invalid_payload',
  'connection_lost',
  'http_error',
  'invalid_response',
  'xplane_rejected',
  'exception',
  // The launch never got as far as X-Plane: preparing it threw.
  'prepare_failed',
  'unknown',
] as const;
/** Whether the start airport comes from a Custom Scenery pack or X-Plane's own airports. */
export const ANALYTICS_AIRPORT_SOURCES = ['custom', 'default', 'unknown'] as const;
/** Who held X-Plane's web API port when a cold start found X-Plane already running. */
export const ANALYTICS_PORT_HOLDERS = ['xplane', 'other', 'none'] as const;
/** X-Plane's own error codes for a refused flight, plus a bucket for new ones. */
export const ANALYTICS_FLIGHT_REJECTIONS = [
  'json_invalid',
  'missing_aircraft',
  'missing_livery',
  'missing_airport',
  'missing_ramp',
  'missing_runway',
  'other',
] as const;
export const ANALYTICS_DIALOG_TIME_BUCKETS = ['under_10s', '10_60s', '1_5m', 'over_5m'] as const;

/** Add-on types the installer recognises. */
export const ANALYTICS_ADDON_TYPES = [
  'aircraft',
  'scenery_library',
  'scenery',
  'navdata',
  'plugin',
  'livery',
  'lua_script',
] as const;

/** What was dropped on the installer, by extension only; never the name or path. */
export const ANALYTICS_ADDON_SOURCES = ['zip', '7z', 'rar', 'folder', 'other'] as const;

/** Why a drop on the installer gave no add-on. */
export const ANALYTICS_ADDON_DETECT_REASONS = [
  'not_archive',
  'no_addon_found',
  'password_required',
  'invalid_password',
  'unsupported_format',
  'extraction_failed',
  'missing_volume',
  'path_traversal',
  'size_exceeded',
  'suspicious_ratio',
  'xplane_not_set',
  'unknown',
] as const;

/** Why an install failed: the installer's code or the file system error class. */
export const ANALYTICS_ADDON_INSTALL_ERRORS = [
  'extraction_failed',
  'verify_failed',
  'missing_volume',
  'password_required',
  'invalid_password',
  'unsupported_format',
  'path_traversal',
  'disk_space',
  'permission_denied',
  'disk_full',
  'file_locked',
  'not_found',
  'path_too_long',
  'xplane_not_set',
  'unknown',
] as const;

/**
 * What the app was doing when it showed an error. Required on every error
 * shown, so "errors in flight plans" splits into loading, saving and routing.
 */
export const ANALYTICS_ERROR_ACTIONS = [
  'export_taxi_route',
  'tune_radio',
  'copy_image',
  'send_support_report',
  'launch_companion_app',
  'open_xplane_log',
  'export_fms',
  // Flight plans
  'load_plan_file',
  'import_plan_link',
  'import_plan_file',
  'auto_route',
  'save_plan',
  // Logbook
  'save_logbook_entry',
  'export_logbook',
  'import_logbook',
  // Add-ons
  'gateway_install',
  'gateway_remove',
  'scenery_toggle',
  'scenery_save_order',
  'scenery_auto_sort',
  'scenery_delete',
  'scenery_restore',
  'aircraft_delete',
  'plugin_delete',
  'livery_delete',
  'script_delete',
] as const;

/**
 * Why it failed, when the app knows: the code the failing operation already
 * returns, lowercased. `other` means a cause was given that is not listed here;
 * the property is null when the call site had none to give.
 */
export const ANALYTICS_ERROR_CODES = [
  // Companion apps (needs_admin, file_not_executable and batch_not_supported up to 2.17)
  'needs_admin',
  'file_missing',
  'file_not_executable',
  'batch_not_supported',
  'access_denied',
  'cancelled',
  'timed_out',
  'spawn_failed',
  // Files and folders
  'not_found',
  'folder_not_found',
  'aircraft_not_found',
  'not_installed',
  'eacces',
  'eperm',
  'enoent',
  'enospc',
  'exdev',
  'disk_space',
  'write_failed',
  'delete_failed',
  'backup_failed',
  'toggle_failed',
  'scan_failed',
  'browse_failed',
  'invalid_input',
  'path_traversal',
  'conflict',
  // Scenery list
  'ini_not_found',
  'ini_parse_error',
  'dsf_invalid',
  'dsf_compressed',
  'missing_libraries',
  // Installing
  'install_failed',
  'download_failed',
  'extraction_failed',
  'verify_failed',
  'verify_markers',
  'bad_package',
  'not_archive',
  'nested_archive',
  'unsupported_format',
  'missing_volume',
  'password_required',
  'invalid_password',
  'size_exceeded',
  'suspicious_ratio',
  'large_addon',
  'flywithlua_missing',
  'unknown_navdata_provider',
  // Flight plans and files
  'fetch_failed',
  'read_failed',
  'unreadable',
  'no_route',
  // X-Plane log
  'no_log',
  'no_path',
  // Talking to X-Plane or a server
  'request_failed',
  'other',
] as const;

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

export const ANALYTICS_EXPLORE_TABS = ['random', 'routes', 'weather', 'online', 'logbook'] as const;

/** How the planner's final route came about. */
export const ANALYTICS_PLAN_ROUTES = [
  'none',
  'direct',
  'typed',
  'auto',
  'track',
  'restored',
] as const;

/** SimBrief download keys from FMS_FORMATS; anything else is reported as "other". */
export const ANALYTICS_FMS_FORMATS = [
  'xpn',
  'xpe',
  'tfd',
  'zbo',
  'ffa',
  'ixg',
  'jar',
  'lvd',
  'psx',
  'inb',
  'mjc',
  'gtn',
  'vfp',
  'sfp',
  'pdf',
  'other',
] as const;
/** Category chips inside Explore's live Weather scan. */
export const ANALYTICS_EXPLORE_FILTERS = [
  'all',
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
  'launcher',
  'data',
  'appearance',
  'flight-strip',
  'units',
  'graphics',
  'flights',
  'airports',
  'simbrief',
  'companion-apps',
  'tablet',
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
export type AnalyticsContextMenuAction = (typeof ANALYTICS_CONTEXT_MENU_ACTIONS)[number];
export type AnalyticsStartVariant = (typeof ANALYTICS_START_VARIANTS)[number];
export type AnalyticsAddonType = (typeof ANALYTICS_ADDON_TYPES)[number];
export type AnalyticsAddonSource = (typeof ANALYTICS_ADDON_SOURCES)[number];
export type AnalyticsAddonDetectReason = (typeof ANALYTICS_ADDON_DETECT_REASONS)[number];
export type AnalyticsAddonInstallError = (typeof ANALYTICS_ADDON_INSTALL_ERRORS)[number];
export type AnalyticsLaunchError = (typeof ANALYTICS_LAUNCH_ERRORS)[number];
export type AnalyticsLaunchFailureReason = (typeof ANALYTICS_LAUNCH_FAILURE_REASONS)[number];
export type AnalyticsPortHolder = (typeof ANALYTICS_PORT_HOLDERS)[number];
export type AnalyticsFlightRejection = (typeof ANALYTICS_FLIGHT_REJECTIONS)[number];
export type AnalyticsDialogTimeBucket = (typeof ANALYTICS_DIALOG_TIME_BUCKETS)[number];
export type AnalyticsStartupBucket = (typeof ANALYTICS_STARTUP_BUCKETS)[number];
export type AnalyticsWidthBucket = (typeof ANALYTICS_WIDTH_BUCKETS)[number];
export type AnalyticsScaleBucket = (typeof ANALYTICS_SCALE_BUCKETS)[number];
export type AnalyticsErrorArea = (typeof ANALYTICS_ERROR_AREAS)[number];
export type AnalyticsErrorAction = (typeof ANALYTICS_ERROR_ACTIONS)[number];
export type AnalyticsErrorCode = (typeof ANALYTICS_ERROR_CODES)[number];
export type AnalyticsExploreTab = (typeof ANALYTICS_EXPLORE_TABS)[number];
export type AnalyticsFmsFormat = (typeof ANALYTICS_FMS_FORMATS)[number];
export type AnalyticsPlanRoute = (typeof ANALYTICS_PLAN_ROUTES)[number];
export type AnalyticsWeatherPreset = (typeof ANALYTICS_WEATHER_PRESETS)[number];

/** Airport idents and aircraft type designators: 2-7 uppercase letters/digits, e.g. EGLL, A320. */
const CODE_PATTERN = /^[A-Z0-9]{2,7}$/;

type Rule =
  | { kind: 'enum'; values: readonly string[]; optional?: boolean }
  | { kind: 'code'; optional?: boolean }
  | { kind: 'boolean' }
  | { kind: 'count'; optional?: boolean };

// Generic over the literal values, so a wrong value at a call site fails typecheck
// instead of being dropped at runtime.
const oneOf = <const V extends readonly string[]>(values: V) => ({ kind: 'enum', values }) as const;
const optionalOneOf = <const V extends readonly string[]>(values: V) =>
  ({ kind: 'enum', values, optional: true }) as const;

const EVENT_SCHEMA = {
  feature_opened: { feature: oneOf(ANALYTICS_FEATURES) },
  layer_enabled: { layer: oneOf(ANALYTICS_LAYERS) },
  layer_disabled: { layer: oneOf(ANALYTICS_LAYERS) },
  widget_opened: { widget: oneOf(ANALYTICS_WIDGETS) },
  airport_selected: { airport: { kind: 'code' } },
  /** X-Plane's flight API refused a payload we validated. */
  flight_rejected: {
    error_code: oneOf(ANALYTICS_FLIGHT_REJECTIONS),
    airport: { kind: 'code', optional: true },
    start_type: oneOf(['runway', 'ramp', 'custom']),
    airport_source: oneOf(ANALYTICS_AIRPORT_SOURCES),
    /** How many scenery packs declare the airport; 0 when none or not looked up. */
    airport_packs: { kind: 'count' },
    /** Whether the app and X-Plane read the airport from the same pack. */
    pack_match: oneOf(['same', 'different', 'unknown']),
  },
  flight_launched: {
    mode: oneOf(['cold_start', 'change_flight']),
    airport: { kind: 'code' },
    aircraft_type: { kind: 'code', optional: true },
    helicopter: { kind: 'boolean' },
    start_type: oneOf(['runway', 'ramp', 'custom']),
    start_variant: oneOf(ANALYTICS_START_VARIANTS),
    airport_source: oneOf(ANALYTICS_AIRPORT_SOURCES),
    /** Which try this was since the Launch dialog opened: 1 for the first. */
    attempt: { kind: 'count' },
    /** Cold start only: asked Steam to start X-Plane, or started it directly. */
    launch_method: optionalOneOf(['steam_url', 'direct']),
    /** Cold start with the user's own launch arguments or environment variables. */
    custom_args: { kind: 'boolean' },
    /** The flight change went through although the connection dropped while X-Plane loaded. */
    connection_recovered: { kind: 'boolean' },
    success: { kind: 'boolean' },
    /** Set only when the launch failed. */
    error_code: optionalOneOf(ANALYTICS_LAUNCH_ERRORS),
    /** Set only when the launch failed: the precise reason behind `error_code`. */
    failure_reason: optionalOneOf(ANALYTICS_LAUNCH_FAILURE_REASONS),
    /** X-Plane's own code when it refused a flight change. */
    xplane_error_code: optionalOneOf(ANALYTICS_FLIGHT_REJECTIONS),
    /** The HTTP status when X-Plane answered a flight change with an error. */
    http_status: { kind: 'count', optional: true },
    /** With `already_running`: who held the web API port. */
    port_holder: optionalOneOf(ANALYTICS_PORT_HOLDERS),
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
  /** A SID, STAR or approach chosen by the user or by the auto router; the name is never sent. */
  procedure_selected: { type: oneOf(['sid', 'star', 'app']), source: oneOf(['manual', 'auto']) },
  /** An item picked in the map's right-click menu. */
  context_menu_used: { action: oneOf(ANALYTICS_CONTEXT_MENU_ACTIONS) },
  /**
   * An FAA chart opened from the airport panel: its PDF in the browser, or laid over the map.
   * The chart's name is never sent. Since 2.19.
   */
  faa_chart_opened: {
    action: oneOf(['pdf', 'map']),
    group: oneOf(['airport', 'departures', 'arrivals', 'approaches', 'minimums']),
    airport: { kind: 'code' },
  },
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
  /**
   * One planner visit, sent when it closes: how far the plan got and how it was built.
   * Never the airports or the route itself.
   */
  flight_plan_closed: {
    has_departure: { kind: 'boolean' },
    has_arrival: { kind: 'boolean' },
    route: oneOf(ANALYTICS_PLAN_ROUTES),
    /** SID, STAR and approach chosen, 0 to 3. */
    procedures: { kind: 'count' },
    alternate: { kind: 'boolean' },
    aircraft_class: oneOf(['jet', 'turboprop', 'prop']),
    /** The arrival was taken from the random destination panel. */
    arrival_from_random: { kind: 'boolean' },
    saved: { kind: 'boolean' },
    start_set: { kind: 'boolean' },
    time_open: oneOf(ANALYTICS_DIALOG_TIME_BUCKETS),
  },
  /** Random destinations rolled in the planner panel; how many matched. */
  random_route_found: { results: { kind: 'count' } },
  /** An airport search, once: a result was picked, or the field was left without one. */
  search_used: { found: { kind: 'boolean' }, picked: { kind: 'boolean' } },
  /** A .fms file opened from the Flight Plan menu, and whether it could be read. */
  flight_plan_file_loaded: { success: { kind: 'boolean' } },
  /** A file dropped on the add-on installer: recognised, not recognised, or failed to read. */
  addon_detected: {
    result: oneOf(['recognized', 'unrecognized', 'error']),
    /** Set when nothing was recognized or analysis failed. */
    reason: optionalOneOf(ANALYTICS_ADDON_DETECT_REASONS),
    source: oneOf(ANALYTICS_ADDON_SOURCES),
    /** Files in the drop; only the first is analysed. */
    files: { kind: 'count' },
  },
  addon_installed: {
    type: oneOf(ANALYTICS_ADDON_TYPES),
    success: { kind: 'boolean' },
    /** Set only when the install failed. */
    error_code: optionalOneOf(ANALYTICS_ADDON_INSTALL_ERRORS),
  },
  /** Where the Ko-fi link was clicked. */
  donate_clicked: { source: oneOf(ANALYTICS_DONATE_SOURCES) },
  /** The support toast shown after a few launches. */
  support_prompt_shown: {},
  support_prompt_dismissed: { forever: { kind: 'boolean' } },
  /** An update was found: installed in the background (Windows) or offered as a notice. */
  update_found: { method: oneOf(['auto', 'notice']) },
  /** The update finished downloading (as deltas or the full package) and installs on restart or quit. */
  update_downloaded: {
    kind: oneOf(['delta', 'full']),
    size_mb: { kind: 'count' },
    /** Back to the full release after leaving the beta. */
    downgrade: { kind: 'boolean' },
  },
  /** The background updater failed to check or download; the cause, never the message. */
  update_failed: {
    stage: oneOf(['check', 'download']),
    reason: oneOf(['network', 'not_found', 'other']),
  },
  /** The user switched beta updates on or off in Settings > About. */
  beta_toggled: { enabled: { kind: 'boolean' } },
  /** A full release caught up with the user's beta, which ended their beta run. */
  beta_ended: {},
  /** macOS/Linux: the update notice's download button was clicked. */
  update_notice_clicked: {},
  /** Once per launch: how long until the map was ready, and whether data came from the cache. */
  app_ready: {
    startup: oneOf(ANALYTICS_STARTUP_BUCKETS),
    from_cache: { kind: 'boolean' },
    /** Main-process time from process start to the window showing; added in main, absent before 2.18. */
    window: optionalOneOf(ANALYTICS_STARTUP_BUCKETS),
  },
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
  /** An xdispatch:// link was followed: which action, and the source it declared. */
  deep_link_opened: { action: oneOf(APP_ACTION_KINDS), source: oneOf(ANALYTICS_DEEP_LINK_SOURCES) },
  error_shown: {
    area: oneOf(ANALYTICS_ERROR_AREAS),
    action: oneOf(ANALYTICS_ERROR_ACTIONS),
    /** Null when the call site had no cause to give. */
    code: optionalOneOf(ANALYTICS_ERROR_CODES),
  },
  explore_tab_opened: { tab: oneOf(ANALYTICS_EXPLORE_TABS) },
  /** An airport, route or event picked in Explore; the tab only, never what was picked. */
  explore_item_selected: { tab: oneOf(ANALYTICS_EXPLORE_TABS) },
  /** A network pilot's filed plan taken into the planner; the network only, never the route. */
  network_plan_used: { network: oneOf(['vatsim', 'ivao']) },
  explore_filter_selected: {
    tab: oneOf(['weather']),
    filter: oneOf(ANALYTICS_EXPLORE_FILTERS),
  },
  simbrief_imported: {},
  /** A SimBrief plan written to an FMS folder, by download format. */
  fms_exported: { format: oneOf(ANALYTICS_FMS_FORMATS) },
  settings_tab_opened: { tab: oneOf(ANALYTICS_SETTINGS_TABS) },
  /** Tablet access turned on or off in Settings. */
  tablet_access_toggled: { enabled: { kind: 'boolean' } },
  /** A device opened the UI over the network; `devices` is how many are connected now. */
  tablet_connected: { devices: { kind: 'count' } },
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
    distance_unit: oneOf(['nm', 'km', 'mi']),
    altitude_unit: oneOf(['ft', 'm']),
    speed_unit: oneOf(['kts', 'kmh', 'mph']),
    vertical_speed_unit: oneOf(['fpm', 'ms']),
    coordinate_format: oneOf(['decimal', 'dms', 'dm']),
    course_mode: oneOf(['magnetic', 'true', 'both']),
    font_size: oneOf(['small', 'medium', 'large']),
    clock_mode: oneOf(['zulu', 'local']),
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
      : R extends { kind: 'count'; optional: true }
        ? number | null
        : R extends { kind: 'count' }
          ? number
          : R extends { optional: true }
            ? string | null
            : string;

type OptionalKeys<S> = { [K in keyof S]: S[K] extends { optional: true } ? K : never }[keyof S];

/** A call site names every property; an optional one may be left out (or null). */
export type AnalyticsEventProps<E extends AnalyticsEventName> = {
  -readonly [
    K in Exclude<keyof (typeof EVENT_SCHEMA)[E], OptionalKeys<(typeof EVENT_SCHEMA)[E]>>
  ]: PropValue<(typeof EVENT_SCHEMA)[E][K]>;
} & {
  -readonly [K in OptionalKeys<(typeof EVENT_SCHEMA)[E]>]?: PropValue<(typeof EVENT_SCHEMA)[E][K]>;
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
      if (rule.optional && (value === null || value === undefined)) {
        return { ok: true, value: null };
      }
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
