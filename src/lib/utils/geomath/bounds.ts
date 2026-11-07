/**
 * Geographic bounding boxes for radius queries.
 */

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * The bounding box that fully contains a circle of `radiusNm` around a point.
 *
 * A degree of latitude is always ~60 NM, but a degree of longitude shrinks by
 * cos(lat) — at 63°N it is only ~27 NM, so the longitude buffer must widen by
 * 1/cos(lat) or the box clips the circle east–west. Near the poles the
 * parallel collapses entirely and the box covers every longitude.
 *
 * Callers still filter the result by true distance; the box only has to be
 * a superset of the circle.
 */
export function boundsAroundPoint(lat: number, lon: number, radiusNm: number): GeoBounds {
  const latBuffer = radiusNm / 60;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lonBuffer = cosLat > 1e-6 ? Math.min(180, latBuffer / cosLat) : 180;

  return {
    minLat: Math.max(-90, lat - latBuffer),
    maxLat: Math.min(90, lat + latBuffer),
    minLon: Math.max(-180, lon - lonBuffer),
    maxLon: Math.min(180, lon + lonBuffer),
  };
}
