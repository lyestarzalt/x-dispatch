import type {
  Degrees,
  Feet,
  FeetPerMinute,
  Kilograms,
  Knots,
  Meters,
  Seconds,
} from '@/types/units';
import type { Coordinates } from './geo';

/**
 * How often the main process emits a plane state snapshot to the renderer.
 * The follow-camera ease uses the same length so motion between snapshots
 * is continuous.
 */
export const PLANE_STATE_INTERVAL_MS = 100;

export type WeatherPresetName =
  'real' | 'clear' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'foggy';

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
  altitudeMSL: Feet;
  altitudeAGL: Feet;
  heading: Degrees;
  pitch: Degrees;
  roll: Degrees;
  groundspeed: Knots;
  indicatedAirspeed: Knots;
  trueAirspeed: Knots;
  verticalSpeed: FeetPerMinute;
  mach: number;
  windDirection: Degrees;
  windSpeed: Knots;
  oat: number;
  throttle: number;
  flaps: number;
  gearDown: boolean;
  parkingBrake: number;
  speedBrake: number;
  gForceNormal: number;
  gForceAxial: number;
  gForceSide: number;
  /** Autopilot dial settings. Absent until the first sample arrives. */
  apAltitude?: Feet;
  apHeading?: Degrees;
  /** Knots, or Mach when apAirspeedIsMach is set. */
  apAirspeed?: number;
  apAirspeedIsMach?: boolean;
  apVerticalSpeed?: FeetPerMinute;
  /** NAV1 OBS course, degrees magnetic. */
  nav1Course?: Degrees;
  /** Ground track, degrees magnetic. */
  groundTrack?: Degrees;
  /** Heading in degrees magnetic, as the autopilot dial and the strip read it; `heading` stays true for the map. */
  magneticHeading?: Degrees;
  /** COM1 active and standby frequencies in kHz, so 118805 is 118.805 MHz. */
  com1Frequency?: number;
  com1StandbyFrequency?: number;
  /** Pilot-side altimeter setting, inches of mercury. */
  baroSettingInHg?: number;
  aircraftCategory: AircraftCategory | null;
  /** Simulator clock: seconds since midnight UTC. Absent until the first sample arrives. */
  simZuluTimeSec?: Seconds;
  /** Simulator clock: zero-based day of the year. */
  simDayOfYear?: number;
  /** Any wheel in contact with the ground. */
  onGround?: boolean;
  fuelKg?: Kilograms;
  /** ICAO type designator from the aircraft file, for example B77W. Empty when the author left it blank. */
  icaoType?: string;
  aircraftName?: string;
  tailNumber?: string;
  /** Full wingspan in metres, twice the model's half extent. */
  wingspanM?: Meters;
}

export interface PlanePosition {
  lat: number;
  lng: number;
  altitude: Feet;
  altitudeAGL: Feet;
  heading: Degrees;
  groundspeed: Knots;
  aircraftCategory: AircraftCategory | null;
  icaoType: string;
  tailNumber: string;
  wingspanM: Meters | null;
  /** Feet per minute, positive climbing. */
  verticalSpeed: FeetPerMinute;
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
  labelKey?: string;
  labelParams?: Record<string, string | number | boolean | null | undefined>;
}

/** Progress event for X-Plane data loading */
export interface LoadingProgress {
  step: string;
  status: 'pending' | 'loading' | 'complete' | 'error';
  message?: string;
  messageKey?: string;
  messageParams?: Record<string, string | number | boolean | null | undefined>;
  count?: number;
  error?: string;
  /** OS-specific hint for resolving the error */
  hint?: string;
  phase?: 'verifying' | 'loading';
  detail?: LoadingDetail;
}
