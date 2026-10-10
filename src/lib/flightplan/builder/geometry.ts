import type { RangeRingCategory } from '@/types/layers';
import { RANGE_RING_SPEEDS } from '@/types/layers';

const EARTH_RADIUS_NM = 3440.065;

export interface LatLon {
  latitude: number;
  longitude: number;
}

export function greatCircleNm(a: LatLon, b: LatLon): number {
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δφ = φ2 - φ1;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial true bearing from a to b, 0 to 360. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point reached from p after travelling the distance along a true bearing. */
export function destinationPoint(p: LatLon, bearing: number, distanceNm: number): LatLon {
  const δ = distanceNm / EARTH_RADIUS_NM;
  const θ = (bearing * Math.PI) / 180;
  const φ1 = (p.latitude * Math.PI) / 180;
  const λ1 = (p.longitude * Math.PI) / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return {
    latitude: (φ2 * 180) / Math.PI,
    longitude: (((λ2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

export function pathDistanceNm(points: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += greatCircleNm(points[i - 1] as LatLon, points[i] as LatLon);
  }
  return total;
}

/** Cruise leg only; climb and descent are folded into a flat allowance per class. */
const TERMINAL_MINUTES: Record<RangeRingCategory, number> = { jet: 20, turboprop: 15, prop: 8 };

export function estimateMinutes(distanceNm: number, category: RangeRingCategory): number {
  if (distanceNm <= 0) return 0;
  return Math.round((distanceNm / RANGE_RING_SPEEDS[category]) * 60 + TERMINAL_MINUTES[category]);
}

/** The leg length a block time allows: the inverse of estimateMinutes. */
export function minutesToNm(minutes: number, category: RangeRingCategory): number {
  return Math.max(0, ((minutes - TERMINAL_MINUTES[category]) / 60) * RANGE_RING_SPEEDS[category]);
}

/** Typical block burn per class, kg per hour: a narrow-body jet, a regional turboprop, a light piston. */
const BURN_KG_PER_HOUR: Record<RangeRingCategory, number> = { jet: 2500, turboprop: 600, prop: 30 };
const RESERVE_MINUTES = 45;
const CONTINGENCY = 0.05;

/** Trip fuel plus five percent contingency and a 45 minute reserve, rounded to 10 kg. */
export function estimateFuelKg(distanceNm: number, category: RangeRingCategory): number {
  if (distanceNm <= 0) return 0;
  const perMinute = BURN_KG_PER_HOUR[category] / 60;
  const trip = estimateMinutes(distanceNm, category) * perMinute;
  const block = trip * (1 + CONTINGENCY) + RESERVE_MINUTES * perMinute;
  return Math.round(block / 10) * 10;
}

/**
 * Rule-of-thumb cruise: climb as high as the leg allows, capped per class, rounded
 * to a thousand and nudged onto the hemispheric level for eastbound tracks.
 */
export function suggestCruiseAltitudeFt(
  distanceNm: number,
  category: RangeRingCategory,
  eastbound: boolean
): number {
  const cap = category === 'jet' ? 41000 : category === 'turboprop' ? 27000 : 11000;
  const perNm = category === 'jet' ? 150 : category === 'turboprop' ? 110 : 60;
  const floor = category === 'prop' ? 3000 : 6000;
  const alt = Math.min(cap, Math.max(floor, Math.round((distanceNm * perNm) / 1000) * 1000));
  const thousands = alt / 1000;
  const wantOdd = eastbound;
  const isOdd = thousands % 2 === 1;
  return isOdd === wantOdd ? alt : Math.max(floor - 1000, alt - 1000);
}

/**
 * Points along the great circle from `a` to `b`, `count` of them including both ends, by
 * spherical interpolation. Used to bound a search by where a long leg really goes: a flight
 * from New York to Hong Kong passes over the Arctic, far north of either airport.
 */
export function greatCirclePoints(a: LatLon, b: LatLon, count: number): LatLon[] {
  if (count < 2) return [a];
  const toRad = Math.PI / 180;
  const lat1 = a.latitude * toRad;
  const lon1 = a.longitude * toRad;
  const lat2 = b.latitude * toRad;
  const lon2 = b.longitude * toRad;
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
      )
    );
  if (d < 1e-12) return [a, b];
  const out: LatLon[] = [a];
  for (let i = 1; i < count - 1; i++) {
    const f = i / (count - 1);
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    out.push({
      latitude: Math.atan2(z, Math.sqrt(x * x + y * y)) / toRad,
      longitude: Math.atan2(y, x) / toRad,
    });
  }
  out.push(b);
  return out;
}

/** Degrees east from one longitude to another, the short way round: -180 to 180. */
export function lonDeltaDeg(fromLon: number, toLon: number): number {
  return ((toLon - fromLon + 540) % 360) - 180;
}

/**
 * `lon` shifted by whole turns so it sits within 180 degrees of `previousLon`. A line drawn
 * through unwrapped longitudes crosses the antimeridian the short way instead of circling
 * the globe; MapLibre accepts longitudes past 180 for exactly this.
 */
export function unwrapLongitude(previousLon: number, lon: number): number {
  const diff = lon - previousLon;
  if (diff > 180) return lon - 360;
  if (diff < -180) return lon + 360;
  return lon;
}

const NM_PER_DEG_LAT = 60;
const TURN_SAMPLES = 8;
/** Turns shallower than this are drawn as a plain corner. */
const MIN_TURN_DEG = 3;

/**
 * Fly-by turns: replaces each interior corner with an arc of the given radius,
 * tangent to both legs, so a drawn route looks like something an FMS would
 * actually fly. Works in a local flat frame around each corner, which is
 * accurate for turn radii of a few miles.
 */
export function smoothRoutePath(points: LatLon[], radiusNm: number): LatLon[] {
  if (points.length < 3 || radiusNm <= 0) return points;
  const out: LatLon[] = [points[0] as LatLon];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1] as LatLon;
    const corner = points[i] as LatLon;
    const next = points[i + 1] as LatLon;
    const kx = NM_PER_DEG_LAT * Math.cos((corner.latitude * Math.PI) / 180);
    const toLocal = (p: LatLon) => ({
      x: (p.longitude - corner.longitude) * kx,
      y: (p.latitude - corner.latitude) * NM_PER_DEG_LAT,
    });
    const toGeo = (x: number, y: number): LatLon => ({
      latitude: corner.latitude + y / NM_PER_DEG_LAT,
      longitude: corner.longitude + x / kx,
    });

    const a = toLocal(prev);
    const b = toLocal(next);
    const lenA = Math.hypot(a.x, a.y);
    const lenB = Math.hypot(b.x, b.y);
    if (lenA === 0 || lenB === 0) {
      out.push(corner);
      continue;
    }
    const ua = { x: a.x / lenA, y: a.y / lenA };
    const ub = { x: b.x / lenB, y: b.y / lenB };
    const cosTurn = Math.max(-1, Math.min(1, -(ua.x * ub.x + ua.y * ub.y)));
    const turn = Math.acos(cosTurn);
    if (turn < (MIN_TURN_DEG * Math.PI) / 180 || Math.PI - turn < 1e-3) {
      out.push(corner);
      continue;
    }

    // Tangent length, capped so the arc never eats more than 45% of a leg.
    const wanted = radiusNm * Math.tan(turn / 2);
    const tangent = Math.min(wanted, lenA * 0.45, lenB * 0.45);
    const radius = tangent / Math.tan(turn / 2);
    const start = { x: ua.x * tangent, y: ua.y * tangent };
    const end = { x: ub.x * tangent, y: ub.y * tangent };
    const bisector = { x: ua.x + ub.x, y: ua.y + ub.y };
    const bisLen = Math.hypot(bisector.x, bisector.y);
    // The centre sits on the bisector, radius / sin(half the interior angle) from the corner.
    const centerDist = radius / Math.cos(turn / 2);
    const center = {
      x: (bisector.x / bisLen) * centerDist,
      y: (bisector.y / bisLen) * centerDist,
    };

    const angleStart = Math.atan2(start.y - center.y, start.x - center.x);
    const angleEnd = Math.atan2(end.y - center.y, end.x - center.x);
    let sweep = angleEnd - angleStart;
    if (sweep > Math.PI) sweep -= 2 * Math.PI;
    if (sweep < -Math.PI) sweep += 2 * Math.PI;

    for (let s = 0; s <= TURN_SAMPLES; s++) {
      const ang = angleStart + (sweep * s) / TURN_SAMPLES;
      out.push(toGeo(center.x + radius * Math.cos(ang), center.y + radius * Math.sin(ang)));
    }
  }

  out.push(points[points.length - 1] as LatLon);
  return out;
}

export function isEastbound(from: LatLon, to: LatLon): boolean {
  const Δλ = ((((to.longitude - from.longitude) % 360) + 540) % 360) - 180;
  return Δλ >= 0;
}
