import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import { buildAircraft } from './sections/aircraft';
import { buildBoat, buildLleAir, buildLleGround, buildRamp, buildRunway } from './sections/start';
import { buildWeatherPayload } from './sections/weather';
import type { BuildFlightInitParams } from './types';

/**
 * Build the full FlightInit payload from a launch configuration.
 *
 * NOTE on ramp_start: it doesn't disambiguate gates with duplicate names.
 * lle_ground_start gives exact lat/lon/heading but X-Plane offsets the spawn
 * forward by a few metres, so we use ramp_start as a workaround.
 */
export function buildFlightInit(params: BuildFlightInitParams): FlightInit {
  const payload: FlightInit = {
    aircraft: buildAircraft(params.aircraft, params.livery),
    weight: {
      fueltank_weight_in_kilograms: params.fuelTanksKg,
      payload_weight_in_kilograms: params.payloadKg,
    },
    engine_status: {
      all_engines: { running: params.enginesRunning },
    },
  };

  const pos = params.startPosition;

  if (pos.type === 'custom') {
    const mode = pos.customStartMode ?? 'ground';
    if (mode === 'air') {
      payload.lle_air_start = buildLleAir(pos);
    } else if (mode === 'carrier' || mode === 'frigate') {
      payload.boat_start = buildBoat(pos, mode);
    } else {
      payload.lle_ground_start = buildLleGround(pos);
    }
  } else if (pos.type === 'ramp') {
    payload.ramp_start = buildRamp(pos);
  } else {
    payload.runway_start = buildRunway(pos);
  }

  if (params.useRealWorldTime) {
    payload.use_system_time = true;
  } else {
    payload.local_time = {
      day_of_year: params.dayOfYear,
      time_in_24_hours: params.timeOfDay,
    };
  }

  payload.weather = buildWeatherPayload(params.weatherConfig, pos);

  return payload;
}
