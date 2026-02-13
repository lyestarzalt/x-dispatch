import type { Coordinates } from './geo';

/**
 * A start position for flight (runway threshold or ramp/gate)
 */
export interface StartPosition extends Coordinates {
  type: 'runway' | 'ramp';
  name: string;
  airport: string;
  /** Index in airport's startupLocations/runways array - required for Freeflight.prf */
  index: number;
}
