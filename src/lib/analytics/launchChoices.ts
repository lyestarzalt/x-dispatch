import type { StartPosition } from '@/types/position';
import type { AnalyticsEventProps, AnalyticsStartVariant, AnalyticsWeatherPreset } from './events';
import { ANALYTICS_WEATHER_PRESETS } from './events';

/** Launch dialog defaults: every tank at 50%, every payload station empty. */
const DEFAULT_TANK_PERCENT = 50;
const DEFAULT_PAYLOAD = 0;
/** Folder of the aircraft that ship with X-Plane, e.g. Aircraft/Laminar Research/Cessna 172 SP. */
const BUILT_IN_AIRCRAFT_FOLDER = 'Laminar Research';

export interface LaunchSetup {
  weatherConfig: {
    mode: 'real' | 'preset' | 'custom';
    preset: string;
    custom: { clouds: readonly unknown[]; wind: readonly unknown[] };
  };
  tankPercentages: number[];
  payloadWeights: number[];
  useRealWorldTime: boolean;
  coldAndDark: boolean;
  livery: string;
  aircraftPath: string;
  favoriteAircraft: boolean;
  startPosition: Pick<
    StartPosition,
    'type' | 'isHelipad' | 'approachDistanceNm' | 'towType' | 'customStartMode'
  >;
}

type LaunchChoices = Pick<
  AnalyticsEventProps<'flight_launched'>,
  | 'weather_mode'
  | 'weather_preset'
  | 'cloud_layers'
  | 'wind_layers'
  | 'fuel_custom'
  | 'payload_custom'
  | 'time_mode'
  | 'cold_and_dark'
  | 'livery_default'
  | 'aircraft_default'
  | 'aircraft_favorite'
  | 'start_variant'
>;

function knownPreset(preset: string): AnalyticsWeatherPreset | null {
  return (ANALYTICS_WEATHER_PRESETS as readonly string[]).includes(preset)
    ? (preset as AnalyticsWeatherPreset)
    : null;
}

function startVariant(start: LaunchSetup['startPosition']): AnalyticsStartVariant {
  if (start.type === 'custom') return start.customStartMode ?? 'ground';
  if (start.isHelipad) return 'helipad';
  if (start.approachDistanceNm) return 'approach';
  if (start.towType) return start.towType === 'winch' ? 'tow_winch' : 'tow_tug';
  return 'standard';
}

/** How the flight was set up, as modes, counts and "changed from default" flags. */
export function launchChoices(setup: LaunchSetup): LaunchChoices {
  const { mode, preset, custom } = setup.weatherConfig;
  return {
    weather_mode: mode,
    weather_preset: mode === 'preset' ? knownPreset(preset) : null,
    cloud_layers: mode === 'custom' ? custom.clouds.length : 0,
    wind_layers: mode === 'custom' ? custom.wind.length : 0,
    fuel_custom: setup.tankPercentages.some((p) => p !== DEFAULT_TANK_PERCENT),
    payload_custom: setup.payloadWeights.some((w) => w !== DEFAULT_PAYLOAD),
    time_mode: setup.useRealWorldTime ? 'real_world' : 'custom',
    cold_and_dark: setup.coldAndDark,
    livery_default: setup.livery === 'Default',
    aircraft_default: setup.aircraftPath.split('/')[1] === BUILT_IN_AIRCRAFT_FOLDER,
    aircraft_favorite: setup.favoriteAircraft,
    start_variant: startVariant(setup.startPosition),
  };
}
