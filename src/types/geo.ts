export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Position extends Coordinates {
  heading?: number;
}

export interface NamedPosition extends Position {
  name: string;
  /** Array index in source data (e.g., startupLocations index) */
  index?: number;
  /** X-Plane specific index - gates and non-gates are indexed separately */
  xplaneIndex?: number;
  /** Location type from apt.dat (e.g., 'gate', 'tie_down', 'misc', 'hangar') */
  locationType?: string;
}

export type LonLat = [number, number];
export type LonLatPath = LonLat[];
export type LonLatPolygon = LonLat[][];
