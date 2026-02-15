/**
 * Aircraft Types - Aircraft and launch configuration types
 * All types related to aircraft, liveries, launch configuration
 */
import type { Coordinates } from './geo';

// ============================================================================
// Aircraft Types
// ============================================================================

export interface Aircraft {
  path: string;
  name: string;
  icao: string;
  description: string;
  manufacturer: string;
  studio: string;
  author: string;
  tailNumber: string;
  emptyWeight: number;
  maxWeight: number;
  maxFuel: number;
  tankNames: string[];
  isHelicopter: boolean;
  engineCount: number;
  propCount: number;
  vneKts: number;
  vnoKts: number;
  previewImage: string | null;
  thumbnailImage: string | null;
  liveries: Livery[];
}

export interface Livery {
  name: string;
  displayName: string;
  previewImage: string | null;
}

// ============================================================================
// Fuel & Payload Configuration
// ============================================================================

export interface FuelConfig {
  percentage: number;
  tankWeights: number[];
}

export interface PayloadConfig {
  stationWeights: number[];
}

// ============================================================================
// Weather Types
// ============================================================================

export interface WeatherPreset {
  name: string;
  definition: string;
}

// ============================================================================
// Time Configuration
// ============================================================================

export interface TimeConfig extends Coordinates {
  dayOfYear: number;
  timeInHours: number;
}

// ============================================================================
// Launch Configuration
// ============================================================================

export interface LaunchStartPosition {
  type: 'runway' | 'ramp';
  airport: string;
  position: string;
  index: number;
  xplaneIndex?: number;
}

export interface LaunchConfig {
  aircraft: Aircraft;
  livery: string;
  fuel: FuelConfig;
  startPosition: LaunchStartPosition;
  time: TimeConfig;
  weather: WeatherPreset;
  startEngineRunning?: boolean;
}
