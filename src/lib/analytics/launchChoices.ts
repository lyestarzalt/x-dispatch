import type { StartFlightFailure } from '@/lib/xplaneServices/client/restClient';
import type { LaunchErrorCode, LaunchFailure } from '@/lib/xplaneServices/launch';
import type { StartPosition } from '@/types/position';
import type {
  AnalyticsEventProps,
  AnalyticsFlightRejection,
  AnalyticsLaunchError,
  AnalyticsLaunchFailureReason,
  AnalyticsStartVariant,
  AnalyticsWeatherPreset,
} from './events';
import {
  ANALYTICS_FLIGHT_REJECTIONS,
  ANALYTICS_LAUNCH_ERRORS,
  ANALYTICS_LAUNCH_FAILURE_REASONS,
  ANALYTICS_WEATHER_PRESETS,
} from './events';

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

/** The launcher's error code as reported, e.g. NEEDS_ADMIN → needs_admin. */
export function launchErrorCode(
  code: LaunchErrorCode | 'CHANGE_FLIGHT_FAILED' | undefined
): AnalyticsLaunchError {
  const reported = code?.toLowerCase();
  return (ANALYTICS_LAUNCH_ERRORS as readonly string[]).includes(reported ?? '')
    ? (reported as AnalyticsLaunchError)
    : 'unknown';
}

/** The failure fields of `flight_launched`. All null on a successful launch. */
export type LaunchFailureProps = Pick<
  AnalyticsEventProps<'flight_launched'>,
  'error_code' | 'failure_reason' | 'xplane_error_code' | 'http_status' | 'port_holder'
>;

export const NO_LAUNCH_FAILURE: LaunchFailureProps = {
  error_code: null,
  failure_reason: null,
  xplane_error_code: null,
  http_status: null,
  port_holder: null,
};

function failureReason(reason: string | undefined): AnalyticsLaunchFailureReason {
  return (ANALYTICS_LAUNCH_FAILURE_REASONS as readonly string[]).includes(reason ?? '')
    ? (reason as AnalyticsLaunchFailureReason)
    : 'unknown';
}

/** A cold start the launcher refused or could not spawn. */
export function coldStartFailureProps(
  failure: Pick<LaunchFailure, 'code' | 'portHolder'>
): LaunchFailureProps {
  const holder = failure.portHolder;
  return {
    ...NO_LAUNCH_FAILURE,
    error_code: launchErrorCode(failure.code),
    failure_reason: failureReason(failure.code?.toLowerCase()),
    port_holder:
      failure.code === 'ALREADY_RUNNING'
        ? holder?.isXPlane
          ? 'xplane'
          : holder
            ? 'other'
            : 'none'
        : null,
  };
}

/**
 * A flight change that failed. `error_code` stays `change_flight_failed` so
 * older charts keep counting; `failure_reason` says which failure it was.
 */
export function changeFlightFailureProps(
  failure: Pick<StartFlightFailure, 'reason' | 'code' | 'httpStatus'>
): LaunchFailureProps {
  const status = failure.httpStatus;
  return {
    ...NO_LAUNCH_FAILURE,
    error_code: 'change_flight_failed',
    failure_reason: failureReason(failure.reason),
    xplane_error_code:
      failure.reason !== 'xplane_rejected'
        ? null
        : (ANALYTICS_FLIGHT_REJECTIONS as readonly string[]).includes(failure.code ?? '')
          ? (failure.code as AnalyticsFlightRejection)
          : 'other',
    http_status:
      status !== undefined && Number.isInteger(status) && status >= 0 && status <= 1000
        ? status
        : null,
  };
}
