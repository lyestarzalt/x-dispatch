import type { Degrees } from '@/types/units';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Position extends Coordinates {
  heading?: Degrees;
}

export interface NamedPosition extends Position {
  name: string;
  /** Array index in source data (e.g., startupLocations index) */
  index?: number;
  /** X-Plane index - for ramps: number (sorted position); for runways: "row_end" string format */
  xplaneIndex?: number | string;
}

export type LonLat = [number, number];
export type LonLatPath = LonLat[];
export type LonLatPolygon = LonLat[][];
