/**
 * FlightInit JSON — everything that goes into the payload X-Plane consumes
 * via REST API or cold launch.
 *
 *   builder.ts    — top-level assembly: spreads each section into the JSON
 *   types.ts      — public params + FlightInit type aliases
 *   float.ts      — Float brand + float() constructor (compile-time guard)
 *   sections/     — one file per JSON section. Every helper returns
 *                   `Pick<FlightInit, 'X'>` so the builder is a single
 *                   spread expression.
 *     aircraft.ts → { aircraft }
 *     weight.ts   → { weight }   (also: lbs→kg input transforms)
 *     engine.ts   → { engine_status }
 *     start.ts    → exactly one of ramp_start | runway_start | lle_* | boat_start
 *     time.ts     → { use_system_time } or { local_time }
 *     weather.ts  → { weather }
 */
export { buildFlightInit } from './builder';
export { float } from './float';
export type { Float } from './float';
export type { BuildFlightInitParams, WeatherDefinition } from './types';
export { calculateFuelTankWeightsKg, calculatePayloadWeightsKg } from './sections/weight';
export { resolveLaunchTime } from './sections/time';
// Section helpers exported for tests; production code uses buildFlightInit.
export { buildAircraftSection } from './sections/aircraft';
export { buildEngineSection } from './sections/engine';
export { buildStartSection } from './sections/start';
export { buildTimeSection } from './sections/time';
export {
  buildWeatherSection,
  buildWeatherValue,
  getPresetWeatherDefinition,
} from './sections/weather';
export { buildWeightSection } from './sections/weight';
