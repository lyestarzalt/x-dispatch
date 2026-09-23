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

export function isEastbound(from: LatLon, to: LatLon): boolean {
  const Δλ = ((((to.longitude - from.longitude) % 360) + 540) % 360) - 180;
  return Δλ >= 0;
}
