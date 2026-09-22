import { describe, expect, it } from 'vitest';
import { flightUpdateSchema, newFlightSchema, validateNewFlight } from './schema';

const aircraft = { path: 'Aircraft/Robin DR401/DR401_CDI155.acf', livery: 'F-BASK' };
const ramp = { aircraft, ramp_start: { airport_id: 'YRED', ramp: 'GA5' } };
const air = {
  latitude: 53.731140370135165,
  longitude: -1.9923688818435892,
  elevation_in_meters: 1219.2,
  heading_true: 281.001,
  speed_in_meters_per_second: 40,
};
const weather = {
  definition: 'vfr_few_clouds',
  vertical_speed_in_thermal_in_feet_per_minute: 0,
  wave_height_in_meters: 1,
  wave_direction_in_degrees: 270,
  terrain_state: 'dry',
  variation_across_region_percentage: 0,
  evolution_over_time_enum: 'static',
};

describe('Flight Initialization API runtime validation', () => {
  it('accepts the minimal native ramp start without changing its name', () => {
    expect(validateNewFlight(ramp)).toEqual(ramp);
    // Existence in a particular scenery is not a JSON schema rule.
    expect(
      validateNewFlight({ ...ramp, ramp_start: { airport_id: 'YRED', ramp: 'GA Parking 5' } })
        .ramp_start?.ramp
    ).toBe('GA Parking 5');
  });

  it('accepts the successful DR401 payload with integer or fractional numbers unchanged', () => {
    const payload = {
      aircraft,
      lle_air_start: air,
      weight: {
        fueltank_weight_in_kilograms: [46.367759767336544, 20.831892264164686, 0, 0, 0, 0, 0, 0, 0],
        payload_weight_in_kilograms: Array(9).fill(0),
      },
      engine_status: { all_engines: { running: true } },
      local_time: { day_of_year: 265, time_in_24_hours: 7.25 },
      weather,
    };
    expect(validateNewFlight(payload)).toEqual(payload);
  });

  it.each(['short_field_approach', 'normal_approach', 'cruise'])(
    'accepts documented speed preset %s independently of the UI workaround',
    (speed_enum) => {
      const { speed_in_meters_per_second: _, ...position } = air;
      expect(
        newFlightSchema.safeParse({ aircraft, lle_air_start: { ...position, speed_enum } }).success
      ).toBe(true);
    }
  );

  it.each([
    {},
    { aircraft },
    { ...ramp, lle_air_start: air },
    { ...ramp, aircraft: {} },
    { ...ramp, aircraft: { path: '/absolute/acf.acf' } },
    { ...ramp, aircraft: { path: '../acf.acf' } },
    { ...ramp, typo: true },
    { ...ramp, ramp_start: { airport_id: 'YRED', ramp: 'GA5', typo: true } },
    { aircraft, lle_air_start: { ...air, speed_in_meters_per_second: undefined } },
    { aircraft, lle_air_start: { ...air, speed_enum: 'normal_approach' } },
    { aircraft, lle_air_start: { ...air, speed_in_meters_per_second: '40' } },
    { aircraft, lle_air_start: { ...air, latitude: 91 } },
    { aircraft, lle_air_start: { ...air, longitude: -181 } },
    { aircraft, lle_air_start: { ...air, heading_true: 361 } },
    { aircraft, lle_air_start: { ...air, elevation_in_meters: NaN } },
    { aircraft, lle_air_start: { ...air, speed_in_meters_per_second: Infinity } },
    { ...ramp, weight: { fueltank_weight_in_kilograms: [], payload_weight_in_kilograms: [] } },
    {
      ...ramp,
      weight: { fueltank_weight_in_kilograms: [1], payload_weight_in_kilograms: Array(10).fill(0) },
    },
    { ...ramp, engine_status: { all_engines: { running: 1 } } },
    { ...ramp, local_time: { day_of_year: 366, time_in_24_hours: 12 } },
    { ...ramp, local_time: { day_of_year: 1.5, time_in_24_hours: 12 } },
    { ...ramp, local_time: { day_of_year: 1, time_in_24_hours: 24 } },
    { ...ramp, use_system_time: true, time_enum: 'day' },
    { ...ramp, weather: { ...weather, terrain_state: 'wet' } },
    { ...ramp, weather: { ...weather, wave_height_in_meters: undefined } },
  ])('rejects invalid payload %#', (payload) => {
    expect(() => validateNewFlight(payload)).toThrow('Invalid flight configuration:');
  });

  it('reports the failing field', () => {
    expect(() => validateNewFlight({ aircraft, lle_air_start: { ...air, latitude: 100 } })).toThrow(
      'lle_air_start.latitude'
    );
  });

  it('enforces runway tow and approach exclusivity and requires a tug aircraft', () => {
    const runway_start = { airport_id: 'EGNO', runway: '25', tow_type: 'tug' };
    expect(newFlightSchema.safeParse({ aircraft, runway_start }).success).toBe(false);
    const withTug = { ...runway_start, tow_aircraft: aircraft };
    expect(newFlightSchema.safeParse({ aircraft, runway_start: withTug }).success).toBe(true);
    expect(
      newFlightSchema.safeParse({
        aircraft,
        runway_start: { ...withTug, final_distance_in_nautical_miles: 3 },
      }).success
    ).toBe(false);
  });

  it('enforces boat deck versus approach configuration', () => {
    const boat_start = { boat_name: 'carrier' };
    expect(newFlightSchema.safeParse({ aircraft, boat_start }).success).toBe(false);
    expect(
      newFlightSchema.safeParse({ aircraft, boat_start: { ...boat_start, start_position: 'deck' } })
        .success
    ).toBe(true);
    expect(
      newFlightSchema.safeParse({
        aircraft,
        boat_start: { ...boat_start, final_distance_in_nautical_miles: 3 },
      }).success
    ).toBe(true);
    expect(
      newFlightSchema.safeParse({
        aircraft,
        boat_start: { ...boat_start, start_position: 'deck', final_distance_in_nautical_miles: 3 },
      }).success
    ).toBe(false);
  });

  it('validates custom weather limits', () => {
    const definition = {
      latitude_in_degrees: 42,
      longitude_in_degrees: -71,
      elevation_in_meters: 310,
      visibility_in_kilometers: 10,
    };
    const validate = (extra: object) =>
      newFlightSchema.safeParse({
        ...ramp,
        weather: { ...weather, definition: { ...definition, ...extra } },
      }).success;
    expect(validate({})).toBe(true);
    expect(validate({ precipitation_ratio: 1.1 })).toBe(false);
    const cloud = {
      type: 'cumulunimbus',
      cover_ratio: 0.5,
      bases_in_feet_msl: 3000,
      tops_in_feet_msl: 5000,
    };
    expect(validate({ clouds: Array(3).fill(cloud) })).toBe(true);
    expect(validate({ clouds: Array(4).fill(cloud) })).toBe(false);
    const wind = { altitude_in_feet_msl: 1000, speed_in_knots: 10, direction_in_degrees_true: 270 };
    expect(validate({ wind: Array(13).fill(wind) })).toBe(true);
    expect(validate({ wind: Array(14).fill(wind) })).toBe(false);
  });

  it('checks weapons, failures, AI, formation and incursion fields', () => {
    const payload = {
      ...ramp,
      weapons: [{ index: 0, filename: 'AIM7-Sparrow.wpn' }],
      failures: {
        operation_failures: [{ name: 'fuel_water', status: 'fail_at_speed_in_knots', value: 150 }],
      },
      ai_aircraft: [{ aircraft, mission: 'atc' }],
      formation_aircraft: aircraft,
      incursion: { aircraft, type: 'clear_incursion' },
    };
    expect(newFlightSchema.safeParse(payload).success).toBe(true);
    expect(
      newFlightSchema.safeParse({
        ...payload,
        failures: {
          operation_failures: [{ name: 'fuel_water', status: 'fail_at_speed_in_knots' }],
        },
      }).success
    ).toBe(false);
    expect(
      newFlightSchema.safeParse({ ...payload, ai_aircraft: [{ aircraft, mission: 'invalid' }] })
        .success
    ).toBe(false);
  });

  it('allows empty updates but rejects aircraft and start changes in updates', () => {
    expect(flightUpdateSchema.safeParse({}).success).toBe(true);
    expect(flightUpdateSchema.safeParse({ weather: 'use_real_weather' }).success).toBe(true);
    expect(flightUpdateSchema.safeParse({ aircraft }).success).toBe(false);
    expect(flightUpdateSchema.safeParse({ ramp_start: ramp.ramp_start }).success).toBe(false);
  });
});
