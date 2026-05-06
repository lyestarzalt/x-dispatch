/**
 * Tests for the FlightInit JSON builder.
 *
 * Same payload goes out via two paths: REST API when XP is already running,
 * and cold launch when it isn't. The REST path surfaces XP's error codes
 * back to us in restClient's response; the cold-launch path doesn't return
 * anything at all, so getting the shape right here is the only line of
 * defence. Covers field names, mutex constraints, and the `ensureFloat`
 * discipline (XP rejects integers in float fields).
 */
import { describe, expect, it } from 'vitest';
import type {
  CustomWeatherState,
  WeatherConfig,
} from '@/components/dialogs/LaunchDialog/weatherTypes';
import type { Aircraft } from '@/types/aircraft';
import type { StartPosition } from '@/types/position';
import { buildFlightInit, buildWeatherValue, float, getPresetWeatherDefinition } from '.';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAircraft(overrides: Partial<Aircraft> & { path: string }): Aircraft {
  return {
    name: 'Test Aircraft',
    icao: 'TEST',
    description: '',
    manufacturer: '',
    studio: '',
    author: '',
    tailNumber: '',
    emptyWeight: 1000,
    maxWeight: 2000,
    maxFuel: 100,
    tankNames: [],
    tankRatios: [],
    tankIndices: [],
    payloadStations: [],
    isHelicopter: false,
    engineCount: 1,
    propCount: 1,
    vneKts: 200,
    vnoKts: 150,
    previewImage: null,
    thumbnailImage: null,
    liveries: [],
    ...overrides,
  };
}

function rampStart(overrides: Partial<StartPosition> = {}): StartPosition {
  return {
    type: 'ramp',
    name: 'A1',
    airport: 'KJFK',
    latitude: 40.6398,
    longitude: -73.7789,
    heading: 90,
    index: 0,
    ...overrides,
  };
}

function runwayStart(overrides: Partial<StartPosition> = {}): StartPosition {
  return {
    type: 'runway',
    name: '04L',
    airport: 'KJFK',
    latitude: 40.6398,
    longitude: -73.7789,
    heading: 40,
    index: 0,
    ...overrides,
  };
}

function customStart(overrides: Partial<StartPosition> = {}): StartPosition {
  return {
    type: 'custom',
    name: 'Pinpoint',
    airport: '',
    latitude: 51.5,
    longitude: -0.12,
    heading: 270,
    index: 0,
    ...overrides,
  };
}

const baseCustomWeather: CustomWeatherState = {
  visibility_km: 10,
  precipitation: 0,
  temperature_c: 15,
  altimeter_hpa: 1013.25,
  wind: [],
  clouds: [],
  thermal_fpm: 0,
  wave_height_m: 1,
  wave_direction_deg: 270,
  terrain_state: 'dry',
  variation_pct: 0,
  evolution: 'static',
};

function realWeather(): WeatherConfig {
  return { mode: 'real', preset: 'clear', custom: { ...baseCustomWeather } };
}

function presetWeather(preset = 'clear'): WeatherConfig {
  return { mode: 'preset', preset, custom: { ...baseCustomWeather } };
}

function customWeather(custom: Partial<CustomWeatherState> = {}): WeatherConfig {
  return { mode: 'custom', preset: 'clear', custom: { ...baseCustomWeather, ...custom } };
}

const baseParams = {
  aircraft: makeAircraft({ path: 'Aircraft/Laminar Research/Cessna 172 SP/Cessna_172SP.acf' }),
  livery: 'Default',
  startPosition: rampStart(),
  weatherConfig: realWeather(),
  useRealWorldTime: true,
  dayOfYear: 200,
  timeOfDay: 12,
  fuelTanksKg: [50, 50],
  payloadKg: [80, 80],
  enginesRunning: false,
};

// ---------------------------------------------------------------------------
// float
// ---------------------------------------------------------------------------

describe('float', () => {
  // X-Plane's JSON parser rejects integer fields where it expects floats. We
  // add 0.001 to force a decimal point. If this regresses, every integer
  // lat/lon/heading silently breaks the cold-launch flow.
  it('adds 0.001 to whole numbers so JSON.stringify emits a decimal', () => {
    expect(float(4)).toBe(4.001);
    expect(float(0)).toBe(0.001);
    expect(float(-90)).toBe(-89.999);
  });

  it('passes through non-integer floats unchanged', () => {
    expect(float(40.6398)).toBe(40.6398);
    expect(float(-73.7789)).toBe(-73.7789);
    expect(float(0.5)).toBe(0.5);
  });

  it('produces a value that JSON.stringify renders with a decimal point', () => {
    expect(JSON.stringify(float(4))).toContain('.');
    expect(JSON.stringify(float(0))).toContain('.');
  });
});

// ---------------------------------------------------------------------------
// buildFlightInit — aircraft block
// ---------------------------------------------------------------------------

describe('buildFlightInit aircraft block', () => {
  it('includes aircraft.path in the payload', () => {
    const out = buildFlightInit(baseParams);
    expect(out.aircraft?.path).toBe('Aircraft/Laminar Research/Cessna 172 SP/Cessna_172SP.acf');
  });

  // The "livery silently reverts on cold launch" bug came from sending an
  // empty/Default livery name. Production drops the field entirely instead.
  it('omits the livery field when livery is "Default"', () => {
    const out = buildFlightInit({ ...baseParams, livery: 'Default' });
    expect(out.aircraft).toBeDefined();
    expect((out.aircraft as { livery?: string }).livery).toBeUndefined();
  });

  it('includes livery name when not Default', () => {
    const out = buildFlightInit({ ...baseParams, livery: 'HB-ZQG' });
    expect((out.aircraft as { livery?: string }).livery).toBe('HB-ZQG');
  });
});

// ---------------------------------------------------------------------------
// buildFlightInit — weight + engine
// ---------------------------------------------------------------------------

describe('buildFlightInit weight & engine block', () => {
  it('passes fuel tank weights through unchanged', () => {
    const out = buildFlightInit({ ...baseParams, fuelTanksKg: [12.5, 7.25, 0, 0] });
    expect(out.weight?.fueltank_weight_in_kilograms).toEqual([12.5, 7.25, 0, 0]);
  });

  it('passes payload weights through unchanged', () => {
    const out = buildFlightInit({ ...baseParams, payloadKg: [80, 60, 20] });
    expect(out.weight?.payload_weight_in_kilograms).toEqual([80, 60, 20]);
  });

  it('reflects enginesRunning=true (warm start)', () => {
    const out = buildFlightInit({ ...baseParams, enginesRunning: true });
    expect(out.engine_status?.all_engines?.running).toBe(true);
  });

  it('reflects enginesRunning=false (cold and dark)', () => {
    const out = buildFlightInit({ ...baseParams, enginesRunning: false });
    expect(out.engine_status?.all_engines?.running).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildFlightInit — start position
// ---------------------------------------------------------------------------

describe('buildFlightInit start position: ramp', () => {
  it('produces ramp_start with airport_id and ramp name', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: rampStart({ name: 'B12', airport: 'EGLL' }),
    });
    expect(out.ramp_start).toEqual({ airport_id: 'EGLL', ramp: 'B12' });
  });

  it('does not produce runway_start, lle_*, or boat_start when ramp is selected', () => {
    const out = buildFlightInit({ ...baseParams, startPosition: rampStart() });
    expect(out.runway_start).toBeUndefined();
    expect(out.lle_ground_start).toBeUndefined();
    expect(out.lle_air_start).toBeUndefined();
    expect(out.boat_start).toBeUndefined();
  });
});

describe('buildFlightInit start position: runway', () => {
  it('produces runway_start with airport_id and runway name', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: runwayStart({ name: '27R', airport: 'EGLL' }),
    });
    expect(out.runway_start?.airport_id).toBe('EGLL');
    expect(out.runway_start?.runway).toBe('27R');
  });

  it('adds final_distance_in_nautical_miles when approachDistanceNm is set, with decimal', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: runwayStart({ approachDistanceNm: 10 }),
    });
    expect(out.runway_start?.final_distance_in_nautical_miles).toBe(10.001);
  });

  it('omits final_distance_in_nautical_miles when approachDistanceNm is unset', () => {
    const out = buildFlightInit({ ...baseParams, startPosition: runwayStart() });
    expect(out.runway_start?.final_distance_in_nautical_miles).toBeUndefined();
  });

  it('adds tow_type and tow_aircraft (Cessna 172) for tug glider tow', () => {
    const out = buildFlightInit({ ...baseParams, startPosition: runwayStart({ towType: 'tug' }) });
    expect(out.runway_start?.tow_type).toBe('tug');
    expect(out.runway_start?.tow_aircraft?.path).toContain('Cessna_172SP.acf');
  });

  it('adds tow_type but NOT tow_aircraft for winch glider tow', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: runwayStart({ towType: 'winch' }),
    });
    expect(out.runway_start?.tow_type).toBe('winch');
    expect(out.runway_start?.tow_aircraft).toBeUndefined();
  });
});

describe('buildFlightInit start position: custom (ground default)', () => {
  it('produces lle_ground_start with lat/lon/heading when no customStartMode is set', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({ latitude: 51.5, longitude: -0.12, heading: 90 }),
    });
    expect(out.lle_ground_start).toBeDefined();
    expect(out.lle_ground_start?.latitude).toBe(51.5);
    expect(out.lle_ground_start?.longitude).toBe(-0.12);
    expect(out.lle_ground_start?.heading_true).toBe(90.001); // float
  });

  it('produces lle_ground_start when customStartMode is explicitly "ground"', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({ customStartMode: 'ground' }),
    });
    expect(out.lle_ground_start).toBeDefined();
  });
});

describe('buildFlightInit start position: custom air', () => {
  it('produces lle_air_start with all required fields', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({
        customStartMode: 'air',
        latitude: 51.5,
        longitude: -0.12,
        heading: 90,
        airAltitudeM: 1500,
        airSpeedMs: 80,
      }),
    });
    expect(out.lle_air_start?.latitude).toBe(51.5);
    expect(out.lle_air_start?.longitude).toBe(-0.12);
    expect(out.lle_air_start?.elevation_in_meters).toBe(1500.001);
    expect(out.lle_air_start?.heading_true).toBe(90.001);
    expect(out.lle_air_start?.speed_in_meters_per_second).toBe(80.001);
  });

  it('uses airSpeedEnum when airSpeedMs is null', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({
        customStartMode: 'air',
        airSpeedMs: null as unknown as undefined,
        airSpeedEnum: 'cruise',
      }),
    });
    expect(out.lle_air_start?.speed_enum).toBe('cruise');
    expect(out.lle_air_start?.speed_in_meters_per_second).toBeUndefined();
  });

  it('falls back to "normal_approach" when neither airSpeedMs nor airSpeedEnum is provided', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({ customStartMode: 'air' }),
    });
    expect(out.lle_air_start?.speed_enum).toBe('normal_approach');
  });

  it('defaults airAltitudeM to 1000m when missing', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({ customStartMode: 'air' }),
    });
    expect(out.lle_air_start?.elevation_in_meters).toBe(1000.001);
  });
});

describe('buildFlightInit start position: boat (carrier/frigate)', () => {
  it('produces boat_start with the correct boat_name for carrier', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({ customStartMode: 'carrier' }),
    });
    expect(out.boat_start?.boat_name).toBe('carrier');
  });

  it('produces boat_start with the correct boat_name for frigate', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({ customStartMode: 'frigate' }),
    });
    expect(out.boat_start?.boat_name).toBe('frigate');
  });

  it('uses start_position when boatPosition is set (and final_distance is dropped)', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({
        customStartMode: 'carrier',
        boatPosition: 'catapult_2',
        boatApproachNm: 5, // should be ignored when boatPosition is set
      }),
    });
    expect(out.boat_start?.start_position).toBe('catapult_2');
    expect(out.boat_start?.final_distance_in_nautical_miles).toBeUndefined();
  });

  it('uses final_distance when boatApproachNm is set without boatPosition', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({ customStartMode: 'carrier', boatApproachNm: 5 }),
    });
    expect(out.boat_start?.final_distance_in_nautical_miles).toBe(5.001);
  });
});

// ---------------------------------------------------------------------------
// buildFlightInit — time
// ---------------------------------------------------------------------------

describe('buildFlightInit time block', () => {
  it('sets use_system_time when useRealWorldTime is true', () => {
    const out = buildFlightInit({ ...baseParams, useRealWorldTime: true });
    expect(out.use_system_time).toBe(true);
    expect(out.local_time).toBeUndefined();
  });

  it('sets local_time with day_of_year and time_in_24_hours when useRealWorldTime is false', () => {
    const out = buildFlightInit({
      ...baseParams,
      useRealWorldTime: false,
      dayOfYear: 200,
      timeOfDay: 14.5,
    });
    expect(out.local_time?.day_of_year).toBe(200);
    expect(out.local_time?.time_in_24_hours).toBe(14.5);
    expect(out.use_system_time).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildFlightInit — weather (top-level integration)
// ---------------------------------------------------------------------------

describe('buildFlightInit weather block', () => {
  it('uses the "use_real_weather" sentinel when mode=real', () => {
    const out = buildFlightInit({ ...baseParams, weatherConfig: realWeather() });
    expect(out.weather).toBe('use_real_weather');
  });

  it('expands preset mode into a hardcoded definition object', () => {
    const out = buildFlightInit({ ...baseParams, weatherConfig: presetWeather('clear') });
    expect(out.weather).toMatchObject({ definition: 'vfr_few_clouds' });
  });

  it('includes a definition object with custom mode', () => {
    const out = buildFlightInit({
      ...baseParams,
      weatherConfig: customWeather({ visibility_km: 5 }),
      startPosition: rampStart(),
    });
    expect(typeof out.weather).toBe('object');
    expect(
      (out.weather as { definition: { visibility_in_kilometers: number } }).definition
        .visibility_in_kilometers
    ).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// buildWeatherValue — focused tests (called by buildFlightInit)
// ---------------------------------------------------------------------------

describe('buildWeatherValue custom mode', () => {
  it('translates the cumulonimbus typo X-Plane uses ("cumulunimbus")', () => {
    // X-Plane's API misspells cumulonimbus as cumulunimbus. Production code
    // does the rewrite. If anyone "fixes" this typo, custom CB layers stop
    // working silently.
    const config = customWeather({
      clouds: [{ type: 'cumulonimbus', cover: 0.8, base_ft: 5000, tops_ft: 30000 }],
    });
    const result = buildWeatherValue(config, rampStart());
    expect(typeof result).toBe('object');
    const def = (result as { definition: { clouds?: Array<{ type: string }> } }).definition;
    expect(def.clouds?.[0]?.type).toBe('cumulunimbus');
  });

  it('passes through non-cumulonimbus cloud types unchanged', () => {
    const config = customWeather({
      clouds: [
        { type: 'cirrus', cover: 0.5, base_ft: 30000, tops_ft: 35000 },
        { type: 'cumulus', cover: 0.3, base_ft: 4000, tops_ft: 8000 },
      ],
    });
    const result = buildWeatherValue(config, rampStart());
    const clouds = (result as { definition: { clouds: Array<{ type: string }> } }).definition
      .clouds;
    expect(clouds[0]?.type).toBe('cirrus');
    expect(clouds[1]?.type).toBe('cumulus');
  });

  it('omits clouds field when no cloud layers are configured', () => {
    const config = customWeather({ clouds: [] });
    const result = buildWeatherValue(config, rampStart());
    const def = (result as { definition: { clouds?: unknown } }).definition;
    expect(def.clouds).toBeUndefined();
  });

  it('only includes wind layer optional fields when their value is > 0', () => {
    const config = customWeather({
      wind: [
        {
          altitude_ft: 0,
          speed_kts: 10,
          direction_deg: 270,
          gust_kts: 0,
          shear_deg: 0,
          turbulence: 0,
        },
        {
          altitude_ft: 5000,
          speed_kts: 20,
          direction_deg: 90,
          gust_kts: 8,
          shear_deg: 15,
          turbulence: 0.3,
        },
      ],
    });
    const result = buildWeatherValue(config, rampStart());
    const winds = (result as { definition: { wind: Array<Record<string, unknown>> } }).definition
      .wind;
    expect(winds[0]?.gust_increase_in_knots).toBeUndefined();
    expect(winds[0]?.shear_in_degrees).toBeUndefined();
    expect(winds[0]?.turbulence_ratio).toBeUndefined();
    expect(winds[1]?.gust_increase_in_knots).toBe(8);
    expect(winds[1]?.shear_in_degrees).toBe(15);
    expect(winds[1]?.turbulence_ratio).toBe(0.3);
  });

  it('converts elevation feet to meters for the definition (0.3048 factor)', () => {
    const result = buildWeatherValue(customWeather(), rampStart({ elevationFt: 1000 }));
    const elev = (result as { definition: { elevation_in_meters: number } }).definition
      .elevation_in_meters;
    expect(elev).toBeCloseTo(304.8, 4);
  });

  it('treats missing elevationFt as 0 metres (not NaN)', () => {
    const result = buildWeatherValue(customWeather(), rampStart({ elevationFt: undefined }));
    const elev = (result as { definition: { elevation_in_meters: number } }).definition
      .elevation_in_meters;
    expect(elev).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getPresetWeatherDefinition
// ---------------------------------------------------------------------------

describe('getPresetWeatherDefinition', () => {
  it('returns the named preset for known names', () => {
    expect(getPresetWeatherDefinition('clear').definition).toBe('vfr_few_clouds');
    expect(getPresetWeatherDefinition('cloudy').definition).toBe('vfr_broken');
    expect(getPresetWeatherDefinition('rainy').definition).toBe('ifr_non_precision');
    expect(getPresetWeatherDefinition('stormy').definition).toBe('large_cell_thunderstorm');
    expect(getPresetWeatherDefinition('snowy').definition).toBe('ifr_precision');
    expect(getPresetWeatherDefinition('foggy').definition).toBe('ifr_precision');
  });

  it('falls back to the "clear" preset for unknown names', () => {
    expect(getPresetWeatherDefinition('not-a-preset').definition).toBe('vfr_few_clouds');
  });

  it('preset definitions are valid objects with all required fields', () => {
    // Guard against a future refactor that drops a field. X-Plane's parser
    // is strict — missing fields silently break the cold launch.
    const required = [
      'definition',
      'vertical_speed_in_thermal_in_feet_per_minute',
      'wave_height_in_meters',
      'wave_direction_in_degrees',
      'terrain_state',
      'variation_across_region_percentage',
      'evolution_over_time_enum',
    ];
    for (const preset of ['clear', 'cloudy', 'rainy', 'stormy', 'snowy', 'foggy']) {
      const def = getPresetWeatherDefinition(preset) as Record<string, unknown>;
      for (const key of required) {
        expect(def).toHaveProperty(key);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// JSON serialisation — final integration check
// ---------------------------------------------------------------------------

describe('JSON serialisation', () => {
  it('produces a payload that JSON.stringify can serialise without errors', () => {
    const out = buildFlightInit({
      ...baseParams,
      livery: 'HB-ZQG',
      startPosition: runwayStart({ approachDistanceNm: 10 }),
      weatherConfig: customWeather({
        clouds: [{ type: 'cumulonimbus', cover: 0.5, base_ft: 5000, tops_ft: 30000 }],
        wind: [
          {
            altitude_ft: 0,
            speed_kts: 10,
            direction_deg: 270,
            gust_kts: 5,
            shear_deg: 0,
            turbulence: 0.2,
          },
        ],
      }),
      useRealWorldTime: false,
      dayOfYear: 100,
      timeOfDay: 14.5,
    });
    expect(() => JSON.stringify(out)).not.toThrow();
    const json = JSON.stringify(out);
    expect(json).toContain('"livery":"HB-ZQG"');
    expect(json).toContain('"runway_start"');
    expect(json).toContain('"final_distance_in_nautical_miles":10.001');
    expect(json).toContain('"cumulunimbus"');
    expect(json).toContain('"local_time"');
  });
});

// ---------------------------------------------------------------------------
// Spec-grounded structural tests
// ---------------------------------------------------------------------------

const ALL_START_KEYS = [
  'ramp_start',
  'runway_start',
  'lle_ground_start',
  'lle_air_start',
  'boat_start',
] as const;

function presentStartKeys(out: ReturnType<typeof buildFlightInit>): string[] {
  return ALL_START_KEYS.filter((k) => k in out);
}

describe('start-position mutual exclusivity (spec: exactly one start key)', () => {
  it('ramp produces only ramp_start', () => {
    const out = buildFlightInit({ ...baseParams, startPosition: rampStart() });
    expect(presentStartKeys(out)).toEqual(['ramp_start']);
  });

  it('runway produces only runway_start', () => {
    const out = buildFlightInit({ ...baseParams, startPosition: runwayStart() });
    expect(presentStartKeys(out)).toEqual(['runway_start']);
  });

  it('custom ground produces only lle_ground_start', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({ customStartMode: 'ground' }),
    });
    expect(presentStartKeys(out)).toEqual(['lle_ground_start']);
  });

  it('custom air produces only lle_air_start', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({ customStartMode: 'air', airAltitudeM: 1500 }),
    });
    expect(presentStartKeys(out)).toEqual(['lle_air_start']);
  });

  it('boat carrier produces only boat_start', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({ customStartMode: 'carrier' }),
    });
    expect(presentStartKeys(out)).toEqual(['boat_start']);
  });

  it('boat frigate produces only boat_start', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({ customStartMode: 'frigate' }),
    });
    expect(presentStartKeys(out)).toEqual(['boat_start']);
  });
});

// ---------------------------------------------------------------------------
// Required fields invariants
// ---------------------------------------------------------------------------

describe('required fields are always present regardless of start position', () => {
  const cases = [
    ['ramp', rampStart()],
    ['runway', runwayStart()],
    ['custom ground', customStart({ customStartMode: 'ground' })],
    ['custom air', customStart({ customStartMode: 'air', airAltitudeM: 1500 })],
    ['boat carrier', customStart({ customStartMode: 'carrier' })],
    ['boat frigate', customStart({ customStartMode: 'frigate' })],
  ] as const;

  it.each(cases)('aircraft.path is present (%s start)', (_label, pos) => {
    const out = buildFlightInit({ ...baseParams, startPosition: pos });
    expect(out.aircraft?.path).toBeTruthy();
  });

  it.each(cases)('weight arrays are present (%s start)', (_label, pos) => {
    const out = buildFlightInit({ ...baseParams, startPosition: pos });
    expect(Array.isArray(out.weight?.fueltank_weight_in_kilograms)).toBe(true);
    expect(Array.isArray(out.weight?.payload_weight_in_kilograms)).toBe(true);
    // Spec: fueltank length 1-9, payload up to 9.
    const fuelLen = out.weight!.fueltank_weight_in_kilograms!.length;
    const payloadLen = out.weight!.payload_weight_in_kilograms!.length;
    expect(fuelLen).toBeGreaterThanOrEqual(1);
    expect(fuelLen).toBeLessThanOrEqual(9);
    expect(payloadLen).toBeLessThanOrEqual(9);
  });

  it.each(cases)('engine_status.all_engines.running is a boolean (%s start)', (_label, pos) => {
    const out = buildFlightInit({ ...baseParams, startPosition: pos });
    expect(typeof out.engine_status?.all_engines?.running).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Float-render guards (XP rejects integers in float fields)
// ---------------------------------------------------------------------------

function jsonHasDecimal(json: string, key: string): boolean {
  // Match `"key":<digits>.<digits>` (positive or negative).
  const re = new RegExp(`"${key}":-?\\d+\\.\\d+`);
  return re.test(json);
}

function jsonHasIntegerOnly(json: string, key: string): boolean {
  // Catches a regression: `"key":<digits>` with no decimal point.
  const re = new RegExp(`"${key}":-?\\d+(?!\\.\\d)(?=[,}])`);
  return re.test(json);
}

describe('numeric float fields render with decimal points (XP parser requirement)', () => {
  it('lle_ground_start lat/lon/heading have decimals even for integer inputs', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({
        customStartMode: 'ground',
        latitude: 50,
        longitude: 0,
        heading: 270,
      }),
    });
    const json = JSON.stringify(out);
    expect(jsonHasDecimal(json, 'latitude')).toBe(true);
    expect(jsonHasDecimal(json, 'longitude')).toBe(true);
    expect(jsonHasDecimal(json, 'heading_true')).toBe(true);
    expect(jsonHasIntegerOnly(json, 'latitude')).toBe(false);
    expect(jsonHasIntegerOnly(json, 'longitude')).toBe(false);
    expect(jsonHasIntegerOnly(json, 'heading_true')).toBe(false);
  });

  it('lle_air_start altitude/speed have decimals even for integer inputs', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({
        customStartMode: 'air',
        latitude: 40,
        longitude: -70,
        heading: 90,
        airAltitudeM: 3000,
        airSpeedMs: 100,
      }),
    });
    const json = JSON.stringify(out);
    expect(jsonHasDecimal(json, 'elevation_in_meters')).toBe(true);
    expect(jsonHasDecimal(json, 'speed_in_meters_per_second')).toBe(true);
    expect(jsonHasIntegerOnly(json, 'elevation_in_meters')).toBe(false);
    expect(jsonHasIntegerOnly(json, 'speed_in_meters_per_second')).toBe(false);
  });

  it('runway approach final_distance has decimals for integer NM inputs', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: runwayStart({ approachDistanceNm: 5 }),
    });
    const json = JSON.stringify(out);
    expect(jsonHasDecimal(json, 'final_distance_in_nautical_miles')).toBe(true);
  });

  it('boat_start lat/lon and final_distance have decimals', () => {
    const out = buildFlightInit({
      ...baseParams,
      startPosition: customStart({
        customStartMode: 'carrier',
        latitude: 30,
        longitude: -70,
        boatApproachNm: 2,
      }),
    });
    const json = JSON.stringify(out);
    expect(jsonHasDecimal(json, 'latitude')).toBe(true);
    expect(jsonHasDecimal(json, 'longitude')).toBe(true);
    expect(jsonHasDecimal(json, 'final_distance_in_nautical_miles')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Custom weather — additional edge cases
// ---------------------------------------------------------------------------

describe('buildWeatherValue custom mode — additional edge cases', () => {
  it('preserves multiple cloud layers (spec allows up to 3)', () => {
    const out = buildWeatherValue(
      customWeather({
        clouds: [
          { type: 'cirrus', cover: 0.2, base_ft: 25000, tops_ft: 30000 },
          { type: 'stratus', cover: 0.5, base_ft: 3000, tops_ft: 5000 },
          { type: 'cumulus', cover: 0.4, base_ft: 7000, tops_ft: 10000 },
        ],
      }),
      rampStart()
    );
    expect(typeof out).not.toBe('string');
    const definition = (out as { definition: { clouds?: unknown[] } }).definition;
    expect(definition.clouds).toHaveLength(3);
  });

  it('preserves multiple wind layers with mixed optional fields', () => {
    const out = buildWeatherValue(
      customWeather({
        wind: [
          {
            altitude_ft: 0,
            speed_kts: 10,
            direction_deg: 270,
            gust_kts: 0,
            shear_deg: 0,
            turbulence: 0,
          },
          {
            altitude_ft: 5000,
            speed_kts: 25,
            direction_deg: 290,
            gust_kts: 5,
            shear_deg: 0,
            turbulence: 0.3,
          },
          {
            altitude_ft: 20000,
            speed_kts: 80,
            direction_deg: 310,
            gust_kts: 0,
            shear_deg: 15,
            turbulence: 0,
          },
        ],
      }),
      rampStart()
    );
    const definition = (out as { definition: { wind: Array<Record<string, unknown>> } }).definition;
    expect(definition.wind).toHaveLength(3);
    // Layer 1 has no optionals
    expect(definition.wind[0]!.gust_increase_in_knots).toBeUndefined();
    expect(definition.wind[0]!.shear_in_degrees).toBeUndefined();
    expect(definition.wind[0]!.turbulence_ratio).toBeUndefined();
    // Layer 2 has gust + turbulence (no shear)
    expect(definition.wind[1]!.gust_increase_in_knots).toBe(5);
    expect(definition.wind[1]!.turbulence_ratio).toBe(0.3);
    expect(definition.wind[1]!.shear_in_degrees).toBeUndefined();
    // Layer 3 has shear only
    expect(definition.wind[2]!.shear_in_degrees).toBe(15);
    expect(definition.wind[2]!.gust_increase_in_knots).toBeUndefined();
  });

  it('passes negative temperature through unchanged (e.g. winter ops)', () => {
    const out = buildWeatherValue(customWeather({ temperature_c: -25 }), rampStart());
    const definition = (out as { definition: { temperature_in_degrees_celsius: number } })
      .definition;
    expect(definition.temperature_in_degrees_celsius).toBe(-25);
  });

  it('omits the wind field entirely when wind array is empty', () => {
    const out = buildWeatherValue(customWeather({ wind: [] }), rampStart());
    const definition = (out as { definition: Record<string, unknown> }).definition;
    expect('wind' in definition).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Shape tests against the official X-Plane spec examples
// ---------------------------------------------------------------------------

describe('payload shape matches X-Plane spec examples', () => {
  it('minimal new-flight payload (ramp start + system time + real weather)', () => {
    const out = buildFlightInit({
      ...baseParams,
      aircraft: makeAircraft({
        path: 'Aircraft/Laminar Research/Boeing 737-800/b738.acf',
      }),
      livery: 'Default',
      startPosition: rampStart({ airport: 'KPDX', name: 'A1' }),
      useRealWorldTime: true,
      weatherConfig: realWeather(),
      enginesRunning: false,
    });

    expect(out.aircraft?.path).toBe('Aircraft/Laminar Research/Boeing 737-800/b738.acf');
    expect((out.aircraft as { livery?: string }).livery).toBeUndefined();
    expect(out.ramp_start?.airport_id).toBe('KPDX');
    expect(out.ramp_start?.ramp).toBe('A1');
    expect(out.use_system_time).toBe(true);
    expect(out.weather).toBe('use_real_weather');
    expect(out.engine_status?.all_engines?.running).toBe(false);
    // Mutually exclusive: no other start key, no local_time, no gmt_time.
    expect(presentStartKeys(out)).toEqual(['ramp_start']);
    expect(out.local_time).toBeUndefined();
    expect(out.gmt_time).toBeUndefined();
  });

  it('complex payload (runway start + warm engines + local time + preset weather)', () => {
    const out = buildFlightInit({
      ...baseParams,
      aircraft: makeAircraft({
        path: 'Aircraft/Laminar Research/Cessna 172SP/Cessna_172SP.acf',
      }),
      livery: 'Default',
      startPosition: runwayStart({ airport: 'KBOS', name: '22L' }),
      payloadKg: [80, 80, 0, 0, 0, 0, 0, 0, 0],
      fuelTanksKg: [50, 50, 0, 0, 0, 0, 0, 0, 0],
      enginesRunning: true,
      useRealWorldTime: false,
      dayOfYear: 150,
      timeOfDay: 14.5,
      weatherConfig: presetWeather('cloudy'),
    });

    expect(out.runway_start?.airport_id).toBe('KBOS');
    expect(out.runway_start?.runway).toBe('22L');
    expect(out.weight?.payload_weight_in_kilograms).toEqual([80, 80, 0, 0, 0, 0, 0, 0, 0]);
    expect(out.weight?.fueltank_weight_in_kilograms).toEqual([50, 50, 0, 0, 0, 0, 0, 0, 0]);
    expect(out.engine_status?.all_engines?.running).toBe(true);
    expect(out.local_time?.day_of_year).toBe(150);
    expect(out.local_time?.time_in_24_hours).toBe(14.5);
    expect(out.use_system_time).toBeUndefined();
    // Preset cloudy resolves to vfr_broken per buildFlightInit.
    expect(typeof out.weather).not.toBe('string');
    expect((out.weather as { definition: string }).definition).toBe('vfr_broken');
  });
});

// ---------------------------------------------------------------------------
// Known spec violations (todo until prod is fixed)
// ---------------------------------------------------------------------------

describe('runway_start: spec invariants', () => {
  it.todo(
    'should drop tow_type when final_distance is set (or vice versa) — spec says they are mutually exclusive'
  );
});
