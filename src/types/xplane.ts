import type { Coordinates } from './geo';

export type WeatherPresetName =
  | 'real'
  | 'clear'
  | 'cloudy'
  | 'rainy'
  | 'stormy'
  | 'snowy'
  | 'foggy';

export type AircraftCategory =
  | 'airliner'
  | 'cargo'
  | 'ga'
  | 'helicopter'
  | 'glider'
  | 'military'
  | 'ultralight'
  | 'seaplane'
  | 'vtol';

export interface PlaneState extends Coordinates {
  altitudeMSL: number;
  altitudeAGL: number;
  heading: number;
  pitch: number;
  roll: number;
  groundspeed: number;
  indicatedAirspeed: number;
  trueAirspeed: number;
  verticalSpeed: number;
  mach: number;
  windDirection: number;
  windSpeed: number;
  oat: number;
  throttle: number;
  flaps: number;
  gearDown: boolean;
  parkingBrake: number;
  speedBrake: number;
  gForceNormal: number;
  gForceAxial: number;
  gForceSide: number;
  apAltitude: number;
  apHeading: number;
  apAirspeed: number;
  apVerticalSpeed: number;
  aircraftCategory: AircraftCategory | null;
}

export interface PlanePosition {
  lat: number;
  lng: number;
  altitude: number;
  heading: number;
  groundspeed: number;
  aircraftCategory: AircraftCategory | null;
}

export interface XPlaneAPIResult {
  success: boolean;
  error?: string;
}

/** Granular sub-step info for loading progress */
export interface LoadingDetail {
  current: number;
  total?: number;
  label?: string;
}

/** Progress event for X-Plane data loading */
export interface LoadingProgress {
  step: string;
  status: 'pending' | 'loading' | 'complete' | 'error';
  message: string;
  count?: number;
  error?: string;
  /** OS-specific hint for resolving the error */
  hint?: string;
  phase?: 'verifying' | 'loading';
  detail?: LoadingDetail;
}
