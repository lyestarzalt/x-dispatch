import { describe, expect, it } from 'vitest';
import { sanitizeEvent } from './events';

describe('sanitizeEvent', () => {
  it('accepts a valid event and strips unknown properties', () => {
    expect(sanitizeEvent('feature_opened', { feature: 'logbook', path: 'C:\\Users\\bob' })).toEqual(
      {
        event: 'feature_opened',
        properties: { feature: 'logbook' },
      }
    );
  });

  it('drops unknown events and values outside the allowlist', () => {
    expect(sanitizeEvent('secret_event', {})).toBeNull();
    expect(sanitizeEvent('feature_opened', { feature: 'secret_panel' })).toBeNull();
    expect(sanitizeEvent('layer_enabled', {})).toBeNull();
    expect(sanitizeEvent('__proto__', {})).toBeNull();
  });

  it('normalizes airport and aircraft codes and rejects free text', () => {
    expect(sanitizeEvent('airport_selected', { airport: ' egll ' })).toEqual({
      event: 'airport_selected',
      properties: { airport: 'EGLL' },
    });
    expect(sanitizeEvent('airport_selected', { airport: 'Heathrow Airport' })).toBeNull();
  });

  it('validates flight launches and allows an unknown aircraft type', () => {
    const launch = {
      mode: 'cold_start',
      airport: 'LFPG',
      aircraft_type: '',
      helicopter: false,
      start_type: 'ramp',
      success: true,
      error_code: null,
      companion_apps_launched: 1,
      weather_mode: 'preset',
      weather_preset: 'stormy',
      cloud_layers: 0,
      wind_layers: 0,
      fuel_custom: true,
      payload_custom: false,
      time_mode: 'custom',
      cold_and_dark: true,
      livery_default: false,
      aircraft_default: false,
      aircraft_favorite: true,
      start_variant: 'standard',
      livery: 'HB-ZQG',
    };
    expect(sanitizeEvent('flight_launched', launch)?.properties).toEqual({
      mode: 'cold_start',
      airport: 'LFPG',
      aircraft_type: null,
      helicopter: false,
      start_type: 'ramp',
      success: true,
      error_code: null,
      companion_apps_launched: 1,
      weather_mode: 'preset',
      weather_preset: 'stormy',
      cloud_layers: 0,
      wind_layers: 0,
      fuel_custom: true,
      payload_custom: false,
      time_mode: 'custom',
      cold_and_dark: true,
      livery_default: false,
      aircraft_default: false,
      aircraft_favorite: true,
      start_variant: 'standard',
    });
    expect(
      sanitizeEvent('flight_launched', { ...launch, weather_mode: 'real', weather_preset: null })
        ?.properties.weather_preset
    ).toBeNull();
    expect(sanitizeEvent('flight_launched', { ...launch, weather_preset: 'my_preset' })).toBeNull();
    expect(sanitizeEvent('flight_launched', { ...launch, success: 'yes' })).toBeNull();
  });

  it('validates Explore tabs and selections', () => {
    expect(sanitizeEvent('explore_tab_opened', { tab: 'vatsim' })?.properties).toEqual({
      tab: 'vatsim',
    });
    expect(sanitizeEvent('explore_item_selected', { tab: 'routes' })?.properties).toEqual({
      tab: 'routes',
    });
    expect(sanitizeEvent('explore_tab_opened', { tab: 'secret' })).toBeNull();
  });

  it('validates layer switch-offs, donate clicks and the support prompt', () => {
    expect(sanitizeEvent('layer_disabled', { layer: 'vatsim' })?.properties).toEqual({
      layer: 'vatsim',
    });
    expect(sanitizeEvent('donate_clicked', { source: 'support_prompt' })?.properties).toEqual({
      source: 'support_prompt',
    });
    expect(sanitizeEvent('donate_clicked', { source: 'https://ko-fi.com' })).toBeNull();
    expect(sanitizeEvent('support_prompt_shown', {})).toEqual({
      event: 'support_prompt_shown',
      properties: {},
    });
    expect(sanitizeEvent('support_prompt_dismissed', { forever: true })?.properties).toEqual({
      forever: true,
    });
  });

  it('validates update events', () => {
    expect(sanitizeEvent('update_found', { method: 'auto' })?.properties).toEqual({
      method: 'auto',
    });
    expect(sanitizeEvent('update_found', { method: 'store' })).toBeNull();
    expect(sanitizeEvent('update_downloaded', {})).not.toBeNull();
    expect(sanitizeEvent('update_notice_clicked', {})).not.toBeNull();
  });

  it('accepts events without properties', () => {
    expect(sanitizeEvent('simbrief_imported', undefined)).toEqual({
      event: 'simbrief_imported',
      properties: {},
    });
  });
});

describe('classifyCompanionApp', () => {
  it('reports known tools by id from the file name only', async () => {
    const { classifyCompanionApp } = await import('./companionApps');
    expect(classifyCompanionApp('C:\\Users\\jane.doe\\AppData\\Local\\xPilot\\xPilot.exe')).toBe(
      'xpilot'
    );
    expect(classifyCompanionApp('/Applications/Little Navmap.app')).toBe('little_navmap');
    expect(classifyCompanionApp('/opt/XPlaneMapEnhancement/xplane-map-enhancement')).toBe('xpme');
    expect(classifyCompanionApp('C:\\Users\\jane.doe\\tools\\my-script.bat')).toBe('other');
  });
});

describe('airport and route events', () => {
  it('accepts the airport panel, taxi route and flight plan actions', () => {
    expect(sanitizeEvent('airport_tab_opened', { tab: 'proc' })).not.toBeNull();
    expect(
      sanitizeEvent('start_position_selected', { start_type: 'ramp', helipad: false })
    ).not.toBeNull();
    expect(sanitizeEvent('procedure_selected', { type: 'star', source: 'manual' })).not.toBeNull();
    expect(sanitizeEvent('frequency_tuned', {})).not.toBeNull();
    expect(sanitizeEvent('taxi_route_built', { method: 'auto' })).not.toBeNull();
    expect(sanitizeEvent('taxi_route_auto_failed', {})).not.toBeNull();
    expect(sanitizeEvent('taxi_route_exported', {})).not.toBeNull();
    expect(sanitizeEvent('flight_plan_auto_routed', { success: false })).not.toBeNull();
    expect(sanitizeEvent('flight_plan_saved', {})).not.toBeNull();
    expect(
      sanitizeEvent('explore_filter_selected', { tab: 'featured', filter: 'scenic' })
    ).not.toBeNull();
    expect(
      sanitizeEvent('explore_filter_selected', { tab: 'weather', filter: 'fog' })
    ).not.toBeNull();
  });

  it('never accepts a gate or procedure name in place of its type', () => {
    expect(
      sanitizeEvent('start_position_selected', { start_type: 'A12', helipad: false })
    ).toBeNull();
    expect(sanitizeEvent('procedure_selected', { type: 'LAM3A' })).toBeNull();
    expect(sanitizeEvent('taxi_route_built', { method: 'A, B, K' })).toBeNull();
  });
});

describe('session events', () => {
  it('accepts X-Plane connecting during a session', () => {
    expect(sanitizeEvent('xplane_connected', {})).not.toBeNull();
  });
});

describe('search, flight plan file and add-on install events', () => {
  it('accepts the outcome of each', () => {
    expect(sanitizeEvent('search_used', { found: false, picked: false })).not.toBeNull();
    expect(sanitizeEvent('flight_plan_file_loaded', { success: false })).not.toBeNull();
    expect(
      sanitizeEvent('addon_detected', {
        result: 'unrecognized',
        reason: 'no_addon_found',
        source: 'zip',
        files: 1,
      })
    ).not.toBeNull();
    expect(
      sanitizeEvent('addon_installed', {
        type: 'scenery_library',
        success: true,
        error_code: null,
      })
    ).not.toBeNull();
    expect(
      sanitizeEvent('addon_installed', {
        type: 'aircraft',
        success: false,
        error_code: 'permission_denied',
      })
    ).not.toBeNull();
  });

  it('never accepts a typed query, file name or add-on name', () => {
    expect(sanitizeEvent('addon_installed', { type: 'Toliss A321', success: true })).toBeNull();
    expect(sanitizeEvent('addon_detected', { result: 'EGLL_scenery.zip' })).toBeNull();
    expect(
      sanitizeEvent('addon_detected', {
        result: 'error',
        reason: 'EACCES: permission denied, open C:\\X-Plane 12\\Aircraft',
        source: 'zip',
        files: 1,
      })
    ).toBeNull();
    expect(
      sanitizeEvent('addon_detected', {
        result: 'error',
        reason: 'unknown',
        source: 'EGLL_scenery.zip',
        files: 1,
      })
    ).toBeNull();
  });

  it('accepts right-click menu actions and procedure picks with their source', () => {
    expect(sanitizeEvent('context_menu_used', { action: 'measure' })).toEqual({
      event: 'context_menu_used',
      properties: { action: 'measure' },
    });
    expect(sanitizeEvent('context_menu_used', { action: 'open_devtools' })).toBeNull();
    expect(sanitizeEvent('procedure_selected', { type: 'sid', source: 'auto' })).toEqual({
      event: 'procedure_selected',
      properties: { type: 'sid', source: 'auto' },
    });
    expect(sanitizeEvent('procedure_selected', { type: 'sid' })).toBeNull();
  });

  it('reports every unit choice in the preferences snapshot', () => {
    const prefs = {
      theme: 'dark',
      map_style: 'carto-dark',
      app_language: 'en',
      weight_unit: 'kg',
      distance_unit: 'km',
      altitude_unit: 'm',
      speed_unit: 'kmh',
      vertical_speed_unit: 'ms',
      coordinate_format: 'dms',
      course_mode: 'both',
      font_size: 'medium',
      clock_mode: 'zulu',
      dynamic_sky: true,
      city_lights: false,
      idle_orbit: false,
      simbrief_linked: false,
      fms_export_targets: 0,
      custom_map_styles: 0,
      companion_apps: 0,
    };
    expect(sanitizeEvent('preferences', prefs)?.properties).toEqual(prefs);
    expect(sanitizeEvent('preferences', { ...prefs, distance_unit: 'furlongs' })).toBeNull();
  });
});

describe('tablet access events', () => {
  it('accepts the tablet settings tab and the tablet events', () => {
    expect(sanitizeEvent('settings_tab_opened', { tab: 'tablet' })).toEqual({
      event: 'settings_tab_opened',
      properties: { tab: 'tablet' },
    });
    expect(sanitizeEvent('tablet_access_toggled', { enabled: true })).toEqual({
      event: 'tablet_access_toggled',
      properties: { enabled: true },
    });
    expect(sanitizeEvent('tablet_connected', { devices: 2 })).toEqual({
      event: 'tablet_connected',
      properties: { devices: 2 },
    });
  });
});
