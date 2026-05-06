/**
 * FlightInit JSON — everything that goes into the payload X-Plane consumes
 * via REST API or `--new_flight_json`.
 *
 *   builder.ts    — top-level assembly entry: glues sections into the JSON
 *   types.ts      — public params + FlightInit type aliases
 *   float.ts      — Float brand + float() constructor (compile-time guard)
 *   sections/     — one file per JSON section that needs assembly logic
 *     aircraft.ts — aircraft + livery rule
 *     start.ts    — ramp_start / runway_start / lle_* / boat_start
 *     weather.ts  — weather (real / preset / custom)
 *     time.ts     — local_time resolution from airport timezone
 *     weights.ts  — lbs → kg arrays for fuel + payload
 *
 * Trivial sections (`engine_status`, `weight` wrapping) live inline in
 * builder.ts because their JSON shape is one line each.
 */
export { buildFlightInit } from './builder';
export { float } from './float';
export type { Float } from './float';
export type { BuildFlightInitParams, WeatherDefinition } from './types';
export { buildAircraft } from './sections/aircraft';
export { buildBoat, buildLleAir, buildLleGround, buildRamp, buildRunway } from './sections/start';
export { buildWeatherPayload, getPresetWeatherDefinition } from './sections/weather';
export { resolveLaunchTime } from './sections/time';
export { calculateFuelTankWeightsKg, calculatePayloadWeightsKg } from './sections/weights';
