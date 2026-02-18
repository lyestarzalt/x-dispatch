import type { Coordinates } from './geo';

/**
 * A start position for flight (runway threshold, ramp/gate, or helipad)
 */
export interface StartPosition extends Coordinates {
  type: 'runway' | 'ramp' | 'helipad';
  name: string;
  airport: string;
  /** Index in airport's startupLocations/runways/helipads array - used for map selection state */
  index: number;
  /** X-Plane index - for ramps: position in alphabetically sorted list; for runways: "row_end" format */
  xplaneIndex?: number | string;
}
