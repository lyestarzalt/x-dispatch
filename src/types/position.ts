import type { Coordinates } from './geo';

/**
 * A start position for flight (runway threshold, helipad, or ramp/gate)
 * Note: Helipads use type 'runway' since X-Plane treats them identically
 */
export interface StartPosition extends Coordinates {
  type: 'runway' | 'ramp' | 'custom';
  name: string;
  airport: string;
  /** Heading in degrees (0-360) */
  heading: number;
  /** Index in airport's startupLocations/runways/helipads array - used for map selection state */
  index: number;
  /** Airport elevation in feet MSL (from apt.dat) */
  elevationFt?: number;
  /** X-Plane index - for ramps: position in alphabetically sorted list; for runways/helipads: "row_end" format */
  xplaneIndex?: number | string;
  /** True if this is a helipad (uses type 'runway' but needs separate UI tracking) */
  isHelipad?: boolean;
  /** Final approach distance in nautical miles (runway start only, mutually exclusive with towType) */
  approachDistanceNm?: number;
  /** Tow type for glider launch (runway start only, mutually exclusive with approachDistanceNm) */
  towType?: 'tug' | 'winch';
}
