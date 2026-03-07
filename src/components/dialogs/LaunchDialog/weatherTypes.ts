// ─── Weather Configuration Types ─────────────────────────────────────────────

export interface WeatherConfig {
  mode: 'real' | 'preset' | 'custom';
  preset: string;
  custom: CustomWeatherState;
}

export interface WindLayer {
  altitude_ft: number; // 0–50000
  speed_kts: number; // 0–200
  direction_deg: number; // 0–360
  gust_kts: number; // 0–50
  shear_deg: number; // 0–180
  turbulence: number; // 0–1
}

export interface CustomWeatherState {
  visibility_km: number;
  precipitation: number;
  temperature_c: number; // absolute (was temperature_offset_c)
  altimeter_hpa: number; // default 1013.25
  terrain_state: 'dry' | 'wet' | 'snowy' | 'icy';
  wind: WindLayer[]; // max 13
  clouds: CloudLayer[];
}

export interface CloudLayer {
  type: 'cirrus' | 'stratus' | 'cumulus' | 'cumulonimbus';
  cover: number;
  base_ft: number;
  tops_ft: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const ISA_SEA_LEVEL_TEMP_C = 15;
export const STD_ALTIMETER_HPA = 1013.25;

export const DEFAULT_WIND_LAYER: WindLayer = {
  altitude_ft: 0,
  speed_kts: 10,
  direction_deg: 270,
  gust_kts: 0,
  shear_deg: 0,
  turbulence: 0,
};

export const DEFAULT_CLOUD_LAYER: CloudLayer = {
  type: 'stratus',
  cover: 0.5,
  base_ft: 3000,
  tops_ft: 8000,
};

// ─── Coverage Categories ────────────────────────────────────────────────────

export type CoverageCategory = 'few' | 'scattered' | 'broken' | 'overcast';

export const COVERAGE_CATEGORIES: {
  key: CoverageCategory;
  label: string;
  min: number;
  max: number;
}[] = [
  { key: 'few', label: 'Few', min: 0.05, max: 0.25 },
  { key: 'scattered', label: 'Sct', min: 0.25, max: 0.5 },
  { key: 'broken', label: 'Bkn', min: 0.5, max: 0.875 },
  { key: 'overcast', label: 'Ovc', min: 0.875, max: 1 },
];

export function getCoverageCategory(cover: number): CoverageCategory {
  if (cover < 0.25) return 'few';
  if (cover < 0.5) return 'scattered';
  if (cover < 0.875) return 'broken';
  return 'overcast';
}

export function getCategoryMidpoint(cat: CoverageCategory): number {
  const entry = COVERAGE_CATEGORIES.find((c) => c.key === cat);
  if (!entry) return 0.5;
  return (entry.min + entry.max) / 2;
}

// ─── Unit Conversion Helpers ────────────────────────────────────────────────

export function hpaToInHg(hpa: number): number {
  return hpa * 0.02953;
}

export function inHgToHpa(inHg: number): number {
  return inHg / 0.02953;
}

export function celsiusToFahrenheit(c: number): number {
  return c * 1.8 + 32;
}

export function fahrenheitToCelsius(f: number): number {
  return (f - 32) / 1.8;
}

export function kmToSM(km: number): number {
  return km * 0.621371;
}

export function smToKm(sm: number): number {
  return sm / 0.621371;
}

// ─── Visibility Stops (non-linear) ──────────────────────────────────────────

export const VISIBILITY_STOPS = [
  0.1, 0.25, 0.5, 1, 2, 3, 5, 8, 10, 15, 20, 30, 50, 80, 120, 160,
] as const;

// ─── Terrain State Mapping ──────────────────────────────────────────────────

export const TERRAIN_STATE_MAP = {
  dry: 'dry',
  wet: 'medium_wet',
  snowy: 'medium_snowy',
  icy: 'medium_icy',
} as const;

// ─── Cloud Type Labels ──────────────────────────────────────────────────────

export const CLOUD_TYPE_LABELS: Record<CloudLayer['type'], string> = {
  cirrus: 'Cirrus',
  stratus: 'Stratus',
  cumulus: 'Cumulus',
  cumulonimbus: 'Cb',
};

// ─── Preset Defaults ────────────────────────────────────────────────────────

export const PRESET_DEFAULTS: Record<string, CustomWeatherState> = {
  clear: {
    visibility_km: 50,
    precipitation: 0,
    temperature_c: 15,
    altimeter_hpa: 1013.25,
    terrain_state: 'dry',
    wind: [{ ...DEFAULT_WIND_LAYER, speed_kts: 5 }],
    clouds: [],
  },
  cloudy: {
    visibility_km: 15,
    precipitation: 0,
    temperature_c: 15,
    altimeter_hpa: 1013.25,
    terrain_state: 'dry',
    wind: [{ ...DEFAULT_WIND_LAYER, speed_kts: 12, direction_deg: 250 }],
    clouds: [{ type: 'stratus', cover: 0.85, base_ft: 4000, tops_ft: 10000 }],
  },
  rainy: {
    visibility_km: 6,
    precipitation: 0.5,
    temperature_c: 15,
    altimeter_hpa: 1005,
    terrain_state: 'wet',
    wind: [
      { ...DEFAULT_WIND_LAYER, speed_kts: 18, direction_deg: 200, gust_kts: 8 },
      { ...DEFAULT_WIND_LAYER, altitude_ft: 10000, speed_kts: 28, direction_deg: 210 },
    ],
    clouds: [
      { type: 'cumulus', cover: 0.9, base_ft: 2000, tops_ft: 15000 },
      { type: 'stratus', cover: 0.4, base_ft: 18000, tops_ft: 25000 },
    ],
  },
  stormy: {
    visibility_km: 3,
    precipitation: 0.8,
    temperature_c: 15,
    altimeter_hpa: 998,
    terrain_state: 'wet',
    wind: [
      { ...DEFAULT_WIND_LAYER, speed_kts: 28, direction_deg: 180, gust_kts: 18, turbulence: 0.6 },
      {
        ...DEFAULT_WIND_LAYER,
        altitude_ft: 10000,
        speed_kts: 45,
        direction_deg: 190,
        turbulence: 0.4,
      },
      { ...DEFAULT_WIND_LAYER, altitude_ft: 25000, speed_kts: 60, direction_deg: 200 },
    ],
    clouds: [
      { type: 'cumulonimbus', cover: 0.95, base_ft: 1500, tops_ft: 40000 },
      { type: 'cumulus', cover: 0.6, base_ft: 20000, tops_ft: 30000 },
    ],
  },
  snowy: {
    visibility_km: 4,
    precipitation: 0.4,
    temperature_c: 0,
    altimeter_hpa: 1008,
    terrain_state: 'snowy',
    wind: [{ ...DEFAULT_WIND_LAYER, speed_kts: 15, direction_deg: 320, gust_kts: 5 }],
    clouds: [{ type: 'stratus', cover: 0.95, base_ft: 2500, tops_ft: 12000 }],
  },
  foggy: {
    visibility_km: 0.4,
    precipitation: 0,
    temperature_c: 15,
    altimeter_hpa: 1013.25,
    terrain_state: 'dry',
    wind: [{ ...DEFAULT_WIND_LAYER, speed_kts: 3 }],
    clouds: [{ type: 'stratus', cover: 1, base_ft: 0, tops_ft: 800 }],
  },
};

// ─── Preset Definition Strings (for X-Plane API preset mode) ────────────────

export const PRESET_DEFINITION_STRINGS = {
  clear: 'vfr_few_clouds',
  cloudy: 'vfr_broken',
  rainy: 'ifr_non_precision',
  stormy: 'large_cell_thunderstorm',
  snowy: 'ifr_precision',
  foggy: 'ifr_precision',
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getPresetDefaults(preset: string): CustomWeatherState {
  return PRESET_DEFAULTS[preset] ?? PRESET_DEFAULTS.clear;
}

export function createDefaultWeatherConfig(): WeatherConfig {
  return {
    mode: 'preset',
    preset: 'clear',
    custom: {
      ...PRESET_DEFAULTS.clear,
      clouds: [],
      wind: [{ ...DEFAULT_WIND_LAYER, speed_kts: 5 }],
    },
  };
}

/** Find the closest visibility stop index for a given value */
export function findClosestVisibilityIndex(km: number): number {
  let closest = 0;
  let minDiff = Math.abs(VISIBILITY_STOPS[0] - km);
  for (let i = 1; i < VISIBILITY_STOPS.length; i++) {
    const diff = Math.abs(VISIBILITY_STOPS[i] - km);
    if (diff < minDiff) {
      minDiff = diff;
      closest = i;
    }
  }
  return closest;
}

/** Format visibility for display */
export function formatVisibility(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km} km`;
}

/** Format wind for display (uses first wind layer) */
export function formatWind(wind: WindLayer[]): string {
  if (wind.length === 0) return 'Calm';
  const w = wind[0];
  if (w.speed_kts === 0) return 'Calm';
  const dir = String(Math.round(w.direction_deg)).padStart(3, '0');
  if (w.gust_kts > 0) return `${dir}° @ ${w.speed_kts} G${w.speed_kts + w.gust_kts} kts`;
  return `${dir}° @ ${w.speed_kts} kts`;
}

/** Get a short summary string for the weather config */
export function getWeatherSummary(config: WeatherConfig): string {
  if (config.mode === 'real') return 'Real Weather';
  const c = config.custom;
  const vis = formatVisibility(c.visibility_km);
  const wind =
    c.wind.length === 0 || c.wind[0].speed_kts === 0 ? 'Calm' : `${c.wind[0].speed_kts} kts`;
  return `${vis} · ${wind}`;
}
