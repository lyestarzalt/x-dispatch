/**
 * Point-in-polygon tests for geographic rings.
 */

/**
 * Re-express each vertex longitude within 180° of the previous one, so a ring
 * that crosses the antimeridian (…, 179.9, -179.9, …) becomes one continuous
 * span (…, 179.9, 180.1, …) instead of a ring wrapping the whole planet.
 */
function unwrapLongitudes(ring: readonly [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let prevLon = ring[0]![0];
  for (const [lon, lat] of ring) {
    let l = lon;
    while (l - prevLon > 180) l -= 360;
    while (l - prevLon < -180) l += 360;
    out.push([l, lat]);
    prevLon = l;
  }
  return out;
}

function rayCast(x: number, y: number, ring: readonly [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * Ray-casting containment test for a simple (convex or concave) ring of
 * [lon, lat] vertices. The ring may be open (last vertex ≠ first) and may
 * cross the antimeridian: its longitudes are unwrapped into one continuous
 * span and the point is tried at lon and lon ± 360. Points on an edge may land
 * on either side — fine for sector lookups.
 */
export function isPointInPolygon(
  point: [number, number],
  ring: readonly [number, number][]
): boolean {
  if (ring.length < 3) return false;
  const [x, y] = point;
  const unwrapped = unwrapLongitudes(ring);
  return (
    rayCast(x, y, unwrapped) || rayCast(x + 360, y, unwrapped) || rayCast(x - 360, y, unwrapped)
  );
}
