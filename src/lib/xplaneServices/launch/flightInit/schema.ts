import { z } from 'zod';

// Source: Flight Initialization API, updated July 28, 2026.
// https://developer.x-plane.com/article/flight-initialization-api/
// JSON numbers may be integral or fractional. Do not coerce or change values.
const number = z.number();
const text = z.string().refine((value) => value.trim().length > 0, 'Must not be empty');
const latitude = number.min(-90).max(90);
const longitude = number.min(-180).max(180);
const heading = number.min(0).max(360);
const ratio = number.min(0).max(1);
const aircraft = z.strictObject({
  path: text.refine(
    (value) =>
      !/^(?:[a-z]:|[/\\])/i.test(value) &&
      !value.split(/[/\\]/).includes('..') &&
      /\.acf$/i.test(value),
    'Must be an .acf path relative to the X-Plane installation'
  ),
  livery: text.optional(),
});
const ground = { latitude, longitude, heading_true: heading };
const time = z.strictObject({
  day_of_year: number.int().min(0).max(365),
  time_in_24_hours: number.min(0).lt(24),
});

const runway = z
  .strictObject({
    airport_id: text,
    runway: text,
    final_distance_in_nautical_miles: number.optional(),
    tow_type: z.enum(['tug', 'winch', 'none']).optional(),
    tow_aircraft: aircraft.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.final_distance_in_nautical_miles !== undefined && value.tow_type !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['tow_type'],
        message: 'Cannot combine tow_type with final_distance_in_nautical_miles',
      });
    }
    if (value.tow_type === 'tug' && !value.tow_aircraft) {
      ctx.addIssue({
        code: 'custom',
        path: ['tow_aircraft'],
        message: 'Required when tow_type is tug',
      });
    }
  });

const air = z
  .strictObject({
    ...ground,
    elevation_in_meters: number,
    speed_in_meters_per_second: number.optional(),
    speed_enum: z.enum(['short_field_approach', 'normal_approach', 'cruise']).optional(),
    pitch_in_degrees: number.optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.speed_in_meters_per_second !== undefined) === (value.speed_enum !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['speed_in_meters_per_second'],
        message: 'Provide exactly one of speed_in_meters_per_second or speed_enum',
      });
    }
  });

const boat = z
  .strictObject({
    boat_name: z.enum(['carrier', 'frigate']),
    boat_location: z.strictObject({ latitude, longitude }).optional(),
    start_position: z
      .enum(['catapult_1', 'catapult_2', 'catapult_3', 'catapult_4', 'deck'])
      .optional(),
    final_distance_in_nautical_miles: number.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.start_position !== undefined &&
      value.final_distance_in_nautical_miles !== undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['start_position'],
        message: 'Cannot combine start_position with final_distance_in_nautical_miles',
      });
    }
    if (
      value.boat_name === 'carrier' &&
      value.final_distance_in_nautical_miles === undefined &&
      value.start_position === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['start_position'],
        message: 'Required for a carrier deck start',
      });
    }
  });

const weatherDefinition = z.union([
  z.enum([
    'vfr_few_clouds',
    'vfr_scattered',
    'vfr_broken',
    'marginal_vfr_overcast',
    'ifr_non_precision',
    'ifr_precision',
    'convective',
    'large_cell_thunderstorm',
  ]),
  z.strictObject({
    latitude_in_degrees: latitude,
    longitude_in_degrees: longitude,
    elevation_in_meters: number,
    visibility_in_kilometers: number,
    temperature_in_degrees_celsius: number.optional(),
    altimeter_setting_in_hpa: number.optional(),
    precipitation_ratio: ratio.optional(),
    clouds: z
      .array(
        z.strictObject({
          type: z.enum(['cirrus', 'stratus', 'cumulus', 'cumulunimbus']),
          cover_ratio: ratio,
          bases_in_feet_msl: number,
          tops_in_feet_msl: number,
        })
      )
      .max(3)
      .optional(),
    wind: z
      .array(
        z.strictObject({
          altitude_in_feet_msl: number,
          speed_in_knots: number,
          direction_in_degrees_true: heading,
          gust_increase_in_knots: number.optional(),
          shear_in_degrees: number.optional(),
          turbulence_ratio: ratio.optional(),
        })
      )
      .max(13)
      .optional(),
  }),
]);
const weather = z.union([
  z.literal('use_real_weather'),
  z.strictObject({
    definition: weatherDefinition,
    vertical_speed_in_thermal_in_feet_per_minute: number,
    wave_height_in_meters: number,
    wave_direction_in_degrees: heading,
    terrain_state: z.enum([
      'dry',
      'lightly_wet',
      'medium_wet',
      'very_wet',
      'lightly_puddly',
      'medium_puddly',
      'very_puddly',
      'lightly_snowy',
      'medium_snowy',
      'very_snowy',
      'lightly_icy',
      'medium_icy',
      'very_icy',
      'lightly_snowy_and_icy',
      'medium_snowy_and_icy',
      'very_snowy_and_icy',
    ]),
    variation_across_region_percentage: number,
    evolution_over_time_enum: z.enum([
      'rapidly_improving',
      'improving',
      'gradually_improving',
      'static',
      'gradually_deteriorating',
      'deteriorating',
      'rapidly_deteriorating',
    ]),
  }),
]);

const failure = z
  .strictObject({
    name: text,
    status: z.enum([
      'always_work',
      'fail_mean_time_in_hours',
      'fail_exact_time_in_hours',
      'fail_at_speed_in_knots',
      'fail_at_altitude_in_feet',
      'fail_at_command_trigger',
      'inoperative',
    ]),
    value: number.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      [
        'fail_mean_time_in_hours',
        'fail_exact_time_in_hours',
        'fail_at_speed_in_knots',
        'fail_at_altitude_in_feet',
      ].includes(value.status) &&
      value.value === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Required for time, speed, or altitude failures',
      });
    }
  });

const common = z.strictObject({
  weight: z
    .strictObject({
      payload_weight_in_kilograms: z.array(number).max(9),
      fueltank_weight_in_kilograms: z.array(number).min(1).max(9),
      jato_weight_in_kilograms: number.optional(),
      slung_load: z.strictObject({ path_to_obj: text, weight_in_kilograms: number }).optional(),
      jettisonable_weight_in_kilograms: number.optional(),
      shiftable_weight_in_kilograms: number.optional(),
      deice_holdover_time_in_minutes: number.optional(),
      oxygen_pressure_in_millibars: number.optional(),
      deice_fluid_in_liters: number.optional(),
      external_fueltank_weight_in_kilograms: z.array(number).optional(),
    })
    .optional(),
  engine_status: z
    .strictObject({ all_engines: z.strictObject({ running: z.boolean() }) })
    .optional(),
  weapons: z.array(z.strictObject({ index: number.int(), filename: text })).optional(),
  failures: z
    .strictObject({
      fix_everything: z.boolean().optional(),
      mean_time_between_failures_in_hours: number.optional(),
      operation_failures: z.array(failure).optional(),
    })
    .optional(),
  ai_aircraft: z
    .array(
      z.strictObject({
        aircraft,
        mission: z.enum([
          'atc',
          'combat_team_red',
          'combat_team_blue',
          'combat_team_green',
          'combat_team_gold',
        ]),
      })
    )
    .optional(),
  formation_aircraft: aircraft.optional(),
  incursion: z
    .strictObject({
      aircraft,
      type: z.enum([
        'flight_incursion',
        'runway_incursion_arm',
        'runway_incursion_execute',
        'clear_incursion',
      ]),
    })
    .optional(),
  use_system_time: z.boolean().optional(),
  local_time: time.optional(),
  gmt_time: time.optional(),
  time_enum: z.enum(['day', 'sunset', 'evening', 'night']).optional(),
  weather: weather.optional(),
});

function validateTime(value: z.infer<typeof common>, ctx: z.RefinementCtx) {
  const keys = ['use_system_time', 'local_time', 'gmt_time', 'time_enum'] as const;
  const present = keys.filter((key) => value[key] !== undefined);
  if (present.length > 1) {
    ctx.addIssue({
      code: 'custom',
      path: [present[1]!],
      message: 'Provide only one time configuration',
    });
  }
}

const startKeys = [
  'runway_start',
  'ramp_start',
  'lle_ground_start',
  'lle_air_start',
  'boat_start',
] as const;

export const newFlightSchema = common
  .extend({
    aircraft,
    runway_start: runway.optional(),
    ramp_start: z.strictObject({ airport_id: text, ramp: text }).optional(),
    lle_ground_start: z.strictObject(ground).optional(),
    lle_air_start: air.optional(),
    boat_start: boat.optional(),
  })
  .superRefine((value, ctx) => {
    validateTime(value, ctx);
    if (startKeys.filter((key) => value[key] !== undefined).length !== 1) {
      ctx.addIssue({ code: 'custom', path: [], message: 'Provide exactly one start location' });
    }
  });

// Updating an ongoing flight cannot change aircraft or start location.
export const flightUpdateSchema = common.superRefine(validateTime);

export class FlightInitValidationError extends Error {
  constructor(error: z.ZodError) {
    super(
      `Invalid flight configuration: ${error.issues.map((issue) => `${issue.path.join('.') || 'flight'}: ${issue.message}`).join('; ')}`
    );
    this.name = 'FlightInitValidationError';
  }
}

export function validateNewFlight(payload: unknown): z.infer<typeof newFlightSchema> {
  const result = newFlightSchema.safeParse(payload);
  if (!result.success) throw new FlightInitValidationError(result.error);
  return result.data;
}
