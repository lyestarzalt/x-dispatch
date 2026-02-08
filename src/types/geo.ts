export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Position extends Coordinates {
  heading?: number;
}

export interface NamedPosition extends Position {
  name: string;
}

export type LonLat = [number, number];
export type LonLatPath = LonLat[];
export type LonLatPolygon = LonLat[][];
