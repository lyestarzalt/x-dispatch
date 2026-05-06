import type { WeatherConfig } from '@/components/dialogs/LaunchDialog/weatherTypes';
import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import type { StartPosition } from '@/types/position';
import type { WeatherDefinition } from '../types';

const FT_TO_M = 0.3048;

/**
 * Hardcoded preset weather definitions. These use X-Plane preset definition
 * strings known to work with --new_flight_json.
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

export function buildWeatherPayload(
  config: WeatherConfig,
  pos: StartPosition
): FlightInit['weather'] {
  if (config.mode === 'real') return 'use_real_weather';

  if (config.mode === 'preset') {
    return getPresetWeatherDefinition(config.preset);
  }

  const c = config.custom;

  // X-Plane spells cumulonimbus as 'cumulunimbus' in its enum.
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
      elevation_in_meters: (pos.elevationFt ?? 0) * FT_TO_M,
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
