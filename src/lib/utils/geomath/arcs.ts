/**
 * Arc Interpolation Utilities
 * Functions for generating curved geometry for aviation procedures:
 * - RF (Radius to Fix) arcs
 * - Holding patterns (racetrack shapes)
 * - Procedure turns (45/180 pattern)
 */
import type { LonLat } from '@/types/geo';

export type TurnDirection = 'L' | 'R';

const EARTH_RADIUS_M = 6371000;
const METERS_PER_NM = 1852;

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculate bearing from point A to point B
 * @returns Bearing in degrees (0-360)
 */
function bearing(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
  const φ1 = toRadians(fromLat);
  const φ2 = toRadians(toLat);
  const Δλ = toRadians(toLon - fromLon);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Calculate destination point given start, distance, and bearing
 * @param lat Start latitude
 * @param lon Start longitude
 * @param distanceMeters Distance in meters
 * @param bearingDegrees Bearing in degrees
 * @returns [lon, lat] as LonLat
 */
function destinationPoint(
  lat: number,
  lon: number,
  distanceMeters: number,
  bearingDegrees: number
): LonLat {
  const φ1 = toRadians(lat);
  const λ1 = toRadians(lon);
  const θ = toRadians(bearingDegrees);
  const δ = distanceMeters / EARTH_RADIUS_M;

  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));

  return [toDegrees(λ2), toDegrees(φ2)];
}

/**
 * Normalize angle to 0-360 range
 */
function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/**
 * Calculate angular sweep for arc based on turn direction
 */
function calculateSweep(
  startAngle: number,
  endAngle: number,
  turnDirection: TurnDirection
): number {
  const start = normalizeAngle(startAngle);
  const end = normalizeAngle(endAngle);

  if (turnDirection === 'R') {
    // Right turn: clockwise sweep (increasing angles)
    if (end >= start) {
      return end - start;
    } else {
      return 360 - start + end;
    }
  } else {
    // Left turn: counter-clockwise sweep (decreasing angles)
    if (start >= end) {
      return start - end;
    } else {
      return start + 360 - end;
    }
  }
}

/**
 * Interpolate RF (Radius to Fix) arc
 *
 * @param start - Start position [lon, lat]
 * @param end - End position [lon, lat]
 * @param centerBearing - Bearing FROM start TO arc center (degrees)
 * @param radiusNm - Arc radius in nautical miles
 * @param turnDirection - 'L' (left/counter-clockwise) or 'R' (right/clockwise)
 * @param numPoints - Number of interpolation points (default 32)
 * @returns Array of [lon, lat] points along the arc
 */
export function interpolateRFArc(
  start: LonLat,
  end: LonLat,
  centerBearing: number,
  radiusNm: number,
  turnDirection: TurnDirection,
  numPoints = 32
): LonLat[] {
  const radiusMeters = radiusNm * METERS_PER_NM;
  const [startLon, startLat] = start;
  const [endLon, endLat] = end;

  // Calculate arc center from start point using centerBearing and radius
  const center = destinationPoint(startLat, startLon, radiusMeters, centerBearing);
  const [centerLon, centerLat] = center;

  // Calculate angles from center to start and end points
  const startAngle = bearing(centerLat, centerLon, startLat, startLon);
  const endAngle = bearing(centerLat, centerLon, endLat, endLon);

  // Calculate sweep angle based on turn direction
  const sweepDegrees = calculateSweep(startAngle, endAngle, turnDirection);

  const points: LonLat[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints;
    let currentAngle: number;

    if (turnDirection === 'R') {
      // Right turn: increase angle
      currentAngle = normalizeAngle(startAngle + sweepDegrees * fraction);
    } else {
      // Left turn: decrease angle
      currentAngle = normalizeAngle(startAngle - sweepDegrees * fraction);
    }

    const point = destinationPoint(centerLat, centerLon, radiusMeters, currentAngle);
    points.push(point);
  }

  return points;
}

/**
 * Create holding pattern racetrack geometry
 *
 * A holding pattern consists of:
 * - Inbound leg: flying toward the fix on a specified course
 * - Outbound leg: flying away from the fix on the reciprocal course
 * - Two 180-degree turns connecting the legs
 *
 * @param holdFix - Fix position [lon, lat]
 * @param inboundCourse - Inbound magnetic course in degrees (course TO the fix)
 * @param legDistanceNm - Leg length in nautical miles (default 1nm)
 * @param turnDirection - 'L' (left turns) or 'R' (right turns)
 * @param turnRadiusNm - Turn radius in nm (default 0.5nm for standard rate)
 * @returns Array of [lon, lat] points forming the racetrack shape
 */
export function createHoldingPattern(
  holdFix: LonLat,
  inboundCourse: number,
  legDistanceNm = 1.0,
  turnDirection: TurnDirection = 'R',
  turnRadiusNm = 0.5
): LonLat[] {
  const legDistanceMeters = legDistanceNm * METERS_PER_NM;
  const turnRadiusMeters = turnRadiusNm * METERS_PER_NM;
  const [fixLon, fixLat] = holdFix;

  // Outbound course is reciprocal of inbound
  const outboundCourse = normalizeAngle(inboundCourse + 180);

  // Calculate offset direction for the turns based on turn direction
  const offsetAngle = turnDirection === 'R' ? inboundCourse + 90 : inboundCourse - 90;

  // Calculate the four corner points of the racetrack
  // Point 1: Hold fix (end of inbound leg)
  const point1: LonLat = holdFix;

  // Point 2: Start of outbound leg (after first turn)
  const turnOffset = destinationPoint(fixLat, fixLon, turnRadiusMeters * 2, offsetAngle);
  const point2: LonLat = turnOffset;

  // Point 3: End of outbound leg
  const point3 = destinationPoint(turnOffset[1], turnOffset[0], legDistanceMeters, outboundCourse);

  // Point 4: Start of inbound leg (after second turn)
  const point4 = destinationPoint(fixLat, fixLon, legDistanceMeters, outboundCourse);

  const points: LonLat[] = [];
  const turnPoints = 16; // Points per 180-degree turn

  // Start at hold fix (point 1)
  points.push(point1);

  // First turn (at hold fix) - 180 degree turn
  const turn1Center = destinationPoint(fixLat, fixLon, turnRadiusMeters, offsetAngle);
  for (let i = 1; i <= turnPoints; i++) {
    const fraction = i / turnPoints;
    const turnAngle = turnDirection === 'R' ? 180 * fraction : -180 * fraction;
    const currentAngle = normalizeAngle(inboundCourse + 180 + turnAngle);
    const point = destinationPoint(turn1Center[1], turn1Center[0], turnRadiusMeters, currentAngle);
    points.push(point);
  }

  // Outbound leg to point 3
  points.push(point3);

  // Second turn (at far end) - 180 degree turn
  const turn2Center = destinationPoint(point4[1], point4[0], turnRadiusMeters, offsetAngle);
  for (let i = 1; i <= turnPoints; i++) {
    const fraction = i / turnPoints;
    const turnAngle = turnDirection === 'R' ? 180 * fraction : -180 * fraction;
    const currentAngle = normalizeAngle(outboundCourse + 180 + turnAngle);
    const point = destinationPoint(turn2Center[1], turn2Center[0], turnRadiusMeters, currentAngle);
    points.push(point);
  }

  // Return to hold fix (close the loop)
  points.push(point1);

  return points;
}

/**
 * Create procedure turn (45/180 pattern) geometry
 *
 * A procedure turn consists of:
 * 1. Fly outbound on specified course
 * 2. Turn 45 degrees (in turn direction)
 * 3. Fly for a distance
 * 4. Turn 180 degrees (opposite direction) to intercept inbound
 *
 * @param fixPoint - Starting fix position [lon, lat]
 * @param outboundCourse - Outbound course in degrees
 * @param turnDirection - 'L' (left turn) or 'R' (right turn) for initial 45-degree turn
 * @param outboundDistanceNm - Distance to fly outbound before 45-degree turn (default 2nm)
 * @param legDistanceNm - Distance to fly on 45-degree leg (default 1nm)
 * @returns Array of [lon, lat] points forming the procedure turn
 */
export function createProcedureTurn(
  fixPoint: LonLat,
  outboundCourse: number,
  turnDirection: TurnDirection = 'L',
  outboundDistanceNm = 2.0,
  legDistanceNm = 1.0
): LonLat[] {
  const outboundDistanceMeters = outboundDistanceNm * METERS_PER_NM;
  const legDistanceMeters = legDistanceNm * METERS_PER_NM;
  const [fixLon, fixLat] = fixPoint;

  const points: LonLat[] = [];

  // Point 1: Fix point (start)
  points.push(fixPoint);

  // Point 2: End of outbound leg (before 45-degree turn)
  const outboundEnd = destinationPoint(fixLat, fixLon, outboundDistanceMeters, outboundCourse);
  points.push(outboundEnd);

  // Calculate 45-degree turn direction
  const turn45Angle = turnDirection === 'L' ? outboundCourse - 45 : outboundCourse + 45;

  // Point 3: End of 45-degree leg
  const leg45End = destinationPoint(outboundEnd[1], outboundEnd[0], legDistanceMeters, turn45Angle);
  points.push(leg45End);

  // Calculate 180-degree turn (intercept inbound course)
  const inboundCourse = normalizeAngle(outboundCourse + 180);
  const interceptCourse =
    turnDirection === 'L'
      ? normalizeAngle(turn45Angle + 180) // 180-degree turn back
      : normalizeAngle(turn45Angle + 180);

  // Point 4: After 180-degree turn, heading toward fix
  const afterTurn = destinationPoint(leg45End[1], leg45End[0], legDistanceMeters, interceptCourse);
  points.push(afterTurn);

  // Point 5: Back toward the fix (on inbound course)
  // We don't necessarily return to the exact fix, just show the pattern
  const returnPoint = destinationPoint(
    afterTurn[1],
    afterTurn[0],
    outboundDistanceMeters,
    inboundCourse
  );
  points.push(returnPoint);

  return points;
}
