export type WeatherPresetName =
  | 'real'
  | 'clear'
  | 'cloudy'
  | 'rainy'
  | 'stormy'
  | 'snowy'
  | 'foggy';

export interface PlaneState {
  latitude: number;
  longitude: number;
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
}

export interface PlanePosition {
  lat: number;
  lng: number;
  altitude: number;
  heading: number;
  groundspeed: number;
}

export interface XPlaneAPIResult {
  success: boolean;
  error?: string;
}

/** Progress event for X-Plane data loading */
export interface LoadingProgress {
  step: string;
  status: 'pending' | 'loading' | 'complete' | 'error';
  message: string;
  count?: number;
  error?: string;
}
