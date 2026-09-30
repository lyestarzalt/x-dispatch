import { describe, expect, it } from 'vitest';
import { WEATHER_OPTIONS } from '@/components/dialogs/LaunchDialog/types';
import { ANALYTICS_WEATHER_PRESETS, sanitizeEvent } from './events';
import { type LaunchSetup, launchChoices, launchErrorCode } from './launchChoices';

const defaults: LaunchSetup = {
  weatherConfig: { mode: 'real', preset: 'real', custom: { clouds: [], wind: [{}] } },
  tankPercentages: [50, 50],
  payloadWeights: [0, 0, 0],
  useRealWorldTime: true,
  coldAndDark: false,
  livery: 'Default',
  aircraftPath: 'Aircraft/Laminar Research/Cessna 172 SP/Cessna_172SP.acf',
  favoriteAircraft: false,
  startPosition: { type: 'ramp' },
};

describe('launchChoices', () => {
  it('reports an untouched setup as defaults', () => {
    expect(launchChoices(defaults)).toEqual({
      weather_mode: 'real',
      weather_preset: null,
      cloud_layers: 0,
      wind_layers: 0,
      fuel_custom: false,
      payload_custom: false,
      time_mode: 'real_world',
      cold_and_dark: false,
      livery_default: true,
      aircraft_default: true,
      aircraft_favorite: false,
      start_variant: 'standard',
    });
  });

  it('flags changed fuel, payload, time, livery and cold and dark', () => {
    expect(
      launchChoices({
        ...defaults,
        tankPercentages: [50, 80],
        payloadWeights: [0, 120, 0],
        useRealWorldTime: false,
        coldAndDark: true,
        livery: 'HB-ZQG',
      })
    ).toMatchObject({
      fuel_custom: true,
      payload_custom: true,
      time_mode: 'custom',
      cold_and_dark: true,
      livery_default: false,
    });
  });

  it('names the preset only for preset weather, and counts layers only for custom weather', () => {
    expect(
      launchChoices({
        ...defaults,
        weatherConfig: { ...defaults.weatherConfig, mode: 'preset', preset: 'foggy' },
      })
    ).toMatchObject({ weather_mode: 'preset', weather_preset: 'foggy', cloud_layers: 0 });
    expect(
      launchChoices({
        ...defaults,
        weatherConfig: {
          mode: 'custom',
          preset: 'foggy',
          custom: { clouds: [{}, {}], wind: [{}, {}, {}] },
        },
      })
    ).toMatchObject({
      weather_mode: 'custom',
      weather_preset: null,
      cloud_layers: 2,
      wind_layers: 3,
    });
  });

  it('drops a preset outside the known list', () => {
    expect(
      launchChoices({
        ...defaults,
        weatherConfig: { ...defaults.weatherConfig, mode: 'preset', preset: 'volcanic' },
      }).weather_preset
    ).toBeNull();
  });

  it('tells add-on aircraft from the built-in Laminar Research fleet', () => {
    expect(
      launchChoices({
        ...defaults,
        aircraftPath: 'Aircraft/ToLiss A321/a321.acf',
        favoriteAircraft: true,
      })
    ).toMatchObject({ aircraft_default: false, aircraft_favorite: true });
  });

  it('describes the start variant', () => {
    const variant = (startPosition: LaunchSetup['startPosition']) =>
      launchChoices({ ...defaults, startPosition }).start_variant;
    expect(variant({ type: 'runway', isHelipad: true })).toBe('helipad');
    expect(variant({ type: 'runway', approachDistanceNm: 5 })).toBe('approach');
    expect(variant({ type: 'runway', towType: 'winch' })).toBe('tow_winch');
    expect(variant({ type: 'custom', customStartMode: 'air' })).toBe('air');
    expect(variant({ type: 'custom', customStartMode: 'carrier' })).toBe('carrier');
    expect(variant({ type: 'custom' })).toBe('ground');
  });

  it('keeps the weather preset allowlist in sync with the launch dialog', () => {
    expect([...ANALYTICS_WEATHER_PRESETS]).toEqual(WEATHER_OPTIONS.filter((o) => o !== 'real'));
  });

  it('produces properties that pass the event allowlist, including custom pin starts', () => {
    const launch = {
      mode: 'cold_start',
      airport: 'KSEA',
      aircraft_type: 'C172',
      helicopter: false,
      start_type: 'custom',
      success: true,
      companion_apps_launched: 0,
      ...launchChoices({ ...defaults, startPosition: { type: 'custom', customStartMode: 'air' } }),
    };
    expect(sanitizeEvent('flight_launched', launch)).not.toBeNull();
  });
});

describe('launchErrorCode', () => {
  it('reports the launcher code in lowercase, never the message', () => {
    expect(launchErrorCode('NEEDS_ADMIN')).toBe('needs_admin');
    expect(launchErrorCode('EXE_NOT_FOUND')).toBe('exe_not_found');
  });

  it('falls back to unknown when the launcher gave no code', () => {
    expect(launchErrorCode(undefined)).toBe('unknown');
  });

  it('produces values the flight_launched allowlist accepts', () => {
    const launch = {
      mode: 'cold_start',
      airport: 'EGLL',
      aircraft_type: 'A320',
      helicopter: false,
      start_type: 'ramp',
      success: false,
      companion_apps_launched: 0,
      ...launchChoices(defaults),
    };
    expect(
      sanitizeEvent('flight_launched', { ...launch, error_code: launchErrorCode('ACCESS_BLOCKED') })
        ?.properties.error_code
    ).toBe('access_blocked');
    expect(
      sanitizeEvent('flight_launched', { ...launch, success: true, error_code: null })?.properties
        .error_code
    ).toBeNull();
    expect(
      sanitizeEvent('flight_launched', { ...launch, error_code: 'EACCES: denied' })
    ).toBeNull();
  });
});
