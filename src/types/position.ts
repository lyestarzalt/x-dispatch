import type { Coordinates } from './geo';

/**
 * A start position for flight (runway threshold or ramp/gate)
 */
export interface StartPosition extends Coordinates {
  type: 'runway' | 'ramp';
  name: string;
  airport: string;
  /** Index in airport's startupLocations/runways array - used for map selection state */
  index: number;
  /** X-Plane specific index - gates and non-gates are indexed separately */
  xplaneIndex?: number;
  /** Location type from apt.dat (e.g., 'gate', 'tie_down', 'misc', 'hangar') */
  locationType?: string;
}
