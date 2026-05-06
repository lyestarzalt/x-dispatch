import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import { buildAircraftSection } from './sections/aircraft';
import { buildEngineSection } from './sections/engine';
import { buildStartSection } from './sections/start';
import { buildTimeSection } from './sections/time';
import { buildWeatherSection } from './sections/weather';
import { buildWeightSection } from './sections/weight';
import type { BuildFlightInitParams } from './types';

/**
 * Assemble the FlightInit payload by composing one section per JSON field.
 *
 * NOTE on ramp_start: it doesn't disambiguate gates with duplicate names.
 * lle_ground_start gives exact lat/lon/heading but X-Plane offsets the spawn
 * forward by a few metres, so we use ramp_start as a workaround (handled
 * inside buildStartSection).
 */
export function buildFlightInit(params: BuildFlightInitParams): FlightInit {
  const pos = params.startPosition;
  return {
    ...buildAircraftSection(params.aircraft, params.livery),
    ...buildWeightSection(params.fuelTanksKg, params.payloadKg),
    ...buildEngineSection(params.enginesRunning),
    ...buildStartSection(pos),
    ...buildTimeSection(params.useRealWorldTime, params.dayOfYear, params.timeOfDay),
    ...buildWeatherSection(params.weatherConfig, pos),
  };
}
