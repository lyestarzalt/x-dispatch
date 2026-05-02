/**
 * Builds the FlightInit JSON payload sent to X-Plane.
 *
 * Same payload is used in two paths:
 *   - REST API "Change Flight" when X-Plane is already running
 *   - --new_flight_json command-line flag when X-Plane is launching cold
 *
 * Extracted from LaunchDialog so it can be unit-tested directly. The functions
 * here are pure: they only consult their parameters, never component state.
 */
import type { WeatherConfig } from '@/components/dialogs/LaunchDialog/weatherTypes';
import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import type { Aircraft } from '@/types/aircraft';
import type { StartPosition } from '@/types/position';

/**
 * X-Plane's JSON parser requires float fields to actually contain a decimal
 * point. `JSON.stringify(4)` produces "4" which X-Plane rejects with a parse
 * error; `JSON.stringify(4.001)` produces "4.001" which it accepts. We add
 * 0.001 to whole numbers to force the decimal without meaningfully shifting
 * the value (sub-millimetre on lat/lon, sub-degree on heading, etc.).
 */
export function ensureFloat(n: number): number {
  return Number.isInteger(n) ? n + 0.001 : n;
}

type WeatherDefinition = NonNullable<Exclude<FlightInit['weather'], 'use_real_weather'>>;

/**
 * Hardcoded preset weather definitions - identical to the working values from
 * commit 03b81ff. These use X-Plane preset definition strings which are
 * known to work with --new_flight_json.
 */
export function getPresetWeatherDefinition(preset: string): WeatherDefinition {
  const definitions: Record<string, WeatherDefinition> = {
    clear: {
      definition: 'vfr_few_clouds',
      vertical_speed_in_thermal_in_feet_per_minute: 0,
      wave_height_in_meters: 1,
      wave_direction_in_degrees: 270,
      terrain_state: 'dry',
      variation_across_region_percentage: 0,
      evolution_over_time_enum: 'static',
    },
    cloudy: {
      definition: 'vfr_broken',
      vertical_speed_in_thermal_in_feet_per_minute: 0,
      wave_height_in_meters: 2,
      wave_direction_in_degrees: 270,
      terrain_state: 'dry',
      variation_across_region_percentage: 50,
      evolution_over_time_enum: 'static',
    },
    rainy: {
      definition: 'ifr_non_precision',
      vertical_speed_in_thermal_in_feet_per_minute: 0,
      wave_height_in_meters: 4,
      wave_direction_in_degrees: 200,
      terrain_state: 'medium_wet',
      variation_across_region_percentage: 50,
      evolution_over_time_enum: 'gradually_deteriorating',
    },
    stormy: {
      definition: 'large_cell_thunderstorm',
      vertical_speed_in_thermal_in_feet_per_minute: 500,
      wave_height_in_meters: 8,
      wave_direction_in_degrees: 180,
      terrain_state: 'very_wet',
      variation_across_region_percentage: 100,
      evolution_over_time_enum: 'rapidly_deteriorating',
    },
    snowy: {
      definition: 'ifr_precision',
      vertical_speed_in_thermal_in_feet_per_minute: 0,
      wave_height_in_meters: 2,
      wave_direction_in_degrees: 320,
      terrain_state: 'medium_snowy',
      variation_across_region_percentage: 30,
      evolution_over_time_enum: 'static',
    },
    foggy: {
      definition: 'ifr_precision',
      vertical_speed_in_thermal_in_feet_per_minute: 0,
      wave_height_in_meters: 1,
      wave_direction_in_degrees: 270,
      terrain_state: 'lightly_wet',
      variation_across_region_percentage: 0,
      evolution_over_time_enum: 'static',
    },
  };

  return definitions[preset] ?? definitions['clear']!;
}

/**
 * Build the weather block of the FlightInit payload. Three modes:
 *   - 'real': use_real_weather sentinel (X-Plane fetches live data)
 *   - 'preset': map the named preset to a hardcoded definition
 *   - 'custom': build a full WeatherDefinition from the user's settings
 */
export function buildWeatherPayload(
  config: WeatherConfig,
  pos: StartPosition
): FlightInit['weather'] {
  if (config.mode === 'real') return 'use_real_weather';

  if (config.mode === 'preset') {
    return getPresetWeatherDefinition(config.preset);
  }

  const c = config.custom;

  // X-Plane spells cumulonimbus as 'cumulunimbus' in its enum
  const clouds = c.clouds.map((layer) => ({
    type: (layer.type === 'cumulonimbus' ? 'cumulunimbus' : layer.type) as
      | 'cirrus'
      | 'stratus'
      | 'cumulus'
      | 'cumulunimbus',
    cover_ratio: layer.cover,
    bases_in_feet_msl: layer.base_ft,
    tops_in_feet_msl: layer.tops_ft,
  }));

  const wind = c.wind.map((w) => ({
    altitude_in_feet_msl: w.altitude_ft,
    speed_in_knots: w.speed_kts,
    direction_in_degrees_true: w.direction_deg,
    ...(w.gust_kts > 0 && { gust_increase_in_knots: w.gust_kts }),
    ...(w.shear_deg > 0 && { shear_in_degrees: w.shear_deg }),
    ...(w.turbulence > 0 && { turbulence_ratio: w.turbulence }),
  }));

  return {
    definition: {
      latitude_in_degrees: pos.latitude,
      longitude_in_degrees: pos.longitude,
      elevation_in_meters: (pos.elevationFt ?? 0) * 0.3048,
      visibility_in_kilometers: c.visibility_km,
      precipitation_ratio: c.precipitation,
      temperature_in_degrees_celsius: c.temperature_c,
      altimeter_setting_in_hpa: c.altimeter_hpa,
      ...(clouds.length > 0 && { clouds }),
      ...(wind.length > 0 && { wind }),
    },
    vertical_speed_in_thermal_in_feet_per_minute: c.thermal_fpm,
    wave_height_in_meters: c.wave_height_m,
    wave_direction_in_degrees: c.wave_direction_deg,
    terrain_state: c.terrain_state,
    variation_across_region_percentage: c.variation_pct,
    evolution_over_time_enum: c.evolution,
  } satisfies WeatherDefinition;
}

export interface BuildFlightInitParams {
  aircraft: Aircraft;
  livery: string;
  startPosition: StartPosition;
  weatherConfig: WeatherConfig;
  useRealWorldTime: boolean;
  dayOfYear: number;
  timeOfDay: number;
  fuelTanksKg: number[];
  payloadKg: number[];
  enginesRunning: boolean;
}

/**
 * Build the full FlightInit payload from a launch configuration.
 *
 * NOTE on ramp_start: it doesn't disambiguate gates with duplicate names.
 * lle_ground_start gives exact lat/lon/heading but X-Plane offsets the spawn
 * forward by a few metres, so we use ramp_start as a workaround.
 */
export function buildFlightInit(params: BuildFlightInitParams): FlightInit {
  const payload: FlightInit = {
    aircraft: {
      path: params.aircraft.path,
      ...(params.livery !== 'Default' && { livery: params.livery }),
    },
    weight: {
      fueltank_weight_in_kilograms: params.fuelTanksKg,
      payload_weight_in_kilograms: params.payloadKg,
    },
    engine_status: {
      all_engines: { running: params.enginesRunning },
    },
  };

  if (params.startPosition.type === 'custom') {
    const mode = params.startPosition.customStartMode ?? 'ground';
    if (mode === 'air') {
      payload.lle_air_start = {
        latitude: ensureFloat(params.startPosition.latitude),
        longitude: ensureFloat(params.startPosition.longitude),
        elevation_in_meters: ensureFloat(params.startPosition.airAltitudeM ?? 1000),
        heading_true: ensureFloat(params.startPosition.heading),
        ...(params.startPosition.airSpeedMs != null
          ? { speed_in_meters_per_second: ensureFloat(params.startPosition.airSpeedMs) }
          : params.startPosition.airSpeedEnum
            ? { speed_enum: params.startPosition.airSpeedEnum }
            : { speed_enum: 'normal_approach' }),
      };
    } else if (mode === 'carrier' || mode === 'frigate') {
      payload.boat_start = {
        boat_name: mode,
        boat_location: {
          latitude: ensureFloat(params.startPosition.latitude),
          longitude: ensureFloat(params.startPosition.longitude),
        },
        ...(params.startPosition.boatPosition && {
          start_position: params.startPosition.boatPosition,
        }),
        ...(params.startPosition.boatApproachNm != null &&
          !params.startPosition.boatPosition && {
            final_distance_in_nautical_miles: ensureFloat(params.startPosition.boatApproachNm),
          }),
      };
    } else {
      payload.lle_ground_start = {
        latitude: ensureFloat(params.startPosition.latitude),
        longitude: ensureFloat(params.startPosition.longitude),
        heading_true: ensureFloat(params.startPosition.heading),
      };
    }
  } else if (params.startPosition.type === 'ramp') {
    payload.ramp_start = {
      airport_id: params.startPosition.airport,
      ramp: params.startPosition.name,
    };
  } else {
    payload.runway_start = {
      airport_id: params.startPosition.airport,
      runway: params.startPosition.name,
      ...(params.startPosition.approachDistanceNm != null && {
        final_distance_in_nautical_miles: ensureFloat(params.startPosition.approachDistanceNm),
      }),
      ...(params.startPosition.towType && {
        tow_type: params.startPosition.towType,
        ...(params.startPosition.towType === 'tug' && {
          tow_aircraft: { path: 'Aircraft/Laminar Research/Cessna 172 SP/Cessna_172SP.acf' },
        }),
      }),
    };
  }

  if (params.useRealWorldTime) {
    payload.use_system_time = true;
  } else {
    payload.local_time = {
      day_of_year: params.dayOfYear,
      time_in_24_hours: params.timeOfDay,
    };
  }

  payload.weather = buildWeatherPayload(params.weatherConfig, params.startPosition);

  return payload;
}
