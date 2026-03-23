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

  // ── Custom pin start mode (type === 'custom') ──
  /** Custom start sub-mode: ground (default), air, carrier, or frigate */
  customStartMode?: 'ground' | 'air' | 'carrier' | 'frigate';
  /** Air start: altitude MSL in meters */
  airAltitudeM?: number;
  /** Air start: speed preset (mutually exclusive with airSpeedMs) */
  airSpeedEnum?: 'short_field_approach' | 'normal_approach' | 'cruise';
  /** Air start: speed in m/s (mutually exclusive with airSpeedEnum) */
  airSpeedMs?: number;
  /** Boat start: deck position (mutually exclusive with boatApproachNm) */
  boatPosition?: 'catapult_1' | 'catapult_2' | 'catapult_3' | 'catapult_4' | 'deck';
  /** Boat start: final approach distance in nm (mutually exclusive with boatPosition) */
  boatApproachNm?: number;
}
