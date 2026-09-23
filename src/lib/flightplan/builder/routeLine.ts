/**
 * The line the map draws for a plan. Where a runway is known the line rolls
 * down it, climbs straight ahead a little before turning onto the first fix,
 * and on arrival joins a straight final onto the threshold. Without a runway
 * the airport datum stands in, as before.
 */
import type { RunwayEnd } from '@/types/fms';
import { type LatLon, destinationPoint } from './geometry';

/** Straight-ahead climb after the runway end before the first turn. */
const CLIMB_OUT_NM = 2;
/** Length of the straight final onto the threshold. */
const FINAL_NM = 6;

interface RoutePoint extends LatLon {
  via?: string;
}

export interface RunwayEnds {
  departure?: RunwayEnd;
  arrival?: RunwayEnd;
}

export function takeoffPath(end: RunwayEnd): LatLon[] {
  const threshold = { latitude: end.latitude, longitude: end.longitude };
  const farEnd = destinationPoint(threshold, end.headingDeg, end.lengthNm);
  return [threshold, farEnd, destinationPoint(farEnd, end.headingDeg, CLIMB_OUT_NM)];
}

export function finalApproachPath(end: RunwayEnd): LatLon[] {
  const threshold = { latitude: end.latitude, longitude: end.longitude };
  const reciprocal = (end.headingDeg + 180) % 360;
  return [destinationPoint(threshold, reciprocal, FINAL_NM), threshold];
}

export function routeLinePoints(waypoints: RoutePoint[], ends?: RunwayEnds): LatLon[] {
  const out: LatLon[] = [];
  for (const wp of waypoints) {
    if (wp.via === 'ADEP' && ends?.departure) {
      out.push(...takeoffPath(ends.departure));
    } else if (wp.via === 'ADES' && ends?.arrival) {
      out.push(...finalApproachPath(ends.arrival));
    } else {
      out.push({ latitude: wp.latitude, longitude: wp.longitude });
    }
  }
  return out;
}
