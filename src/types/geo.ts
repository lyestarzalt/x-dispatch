export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type LatLng = Coordinates;

export interface Position extends Coordinates {
  heading?: number;
}

export interface NamedPosition extends Position {
  name: string;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeoPoint extends Coordinates {
  elevation?: number;
}
//LonLat → single coordinate
export type LonLat = [number, number];
//LonLatPath → taxiway lines, boundaries, airspace polygons
export type LonLatPath = LonLat[];
//LonLatPolygon → pavements with cutouts (holes in concrete)
export type LonLatPolygon = LonLat[][];

export function coords(latitude: number, longitude: number): Coordinates {
  return { latitude, longitude };
}

export function distanceNm(from: Coordinates, to: Coordinates): number {
  const R = 3440.065;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
