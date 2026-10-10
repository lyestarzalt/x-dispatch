import { calculateBearing } from '@/lib/utils/geomath';
import type { Runway, WaterRunway } from '@/types/apt';
import { ShoulderSurfaceType } from '@/types/apt';
import type { LonLat } from '@/types/geo';

const EARTH_RADIUS = 6371e3; // meters

/** Width of a transverse threshold bar, the same stripe width as the threshold marking. */
export const THRESHOLD_BAR_WIDTH_M = 1.8;

/** True bearing from end 1 to end 2, from the end coordinates rather than the runway number. */
export function getRunwayTrueHeading(runway: Runway | WaterRunway): number {
  const [end1, end2] = runway.ends;
  return calculateBearing(end1.latitude, end1.longitude, end2.latitude, end2.longitude);
}

/** Closed rectangle around the line between two ends, `halfWidth` metres to each side. */
function lanePolygon(runway: Runway | WaterRunway, halfWidth: number): [number, number][] {
  const [end1, end2] = runway.ends;
  const heading1 = getRunwayTrueHeading(runway);
  const heading2 = (heading1 + 180) % 360;
  const corner1 = calculateVertex(end1.latitude, end1.longitude, halfWidth, (heading1 - 90) % 360);
  const corner2 = calculateVertex(end1.latitude, end1.longitude, halfWidth, (heading1 + 90) % 360);
  const corner3 = calculateVertex(end2.latitude, end2.longitude, halfWidth, (heading2 - 90) % 360);
  const corner4 = calculateVertex(end2.latitude, end2.longitude, halfWidth, (heading2 + 90) % 360);
  // GeoJSON uses [longitude, latitude]
  return [
    [corner1[1], corner1[0]],
    [corner2[1], corner2[0]],
    [corner3[1], corner3[0]],
    [corner4[1], corner4[0]],
    [corner1[1], corner1[0]],
  ];
}

/** Water runways have no shoulders or markings: just the lane itself. */
export function getWaterRunwayPolygon(runway: WaterRunway): [number, number][] {
  return lanePolygon(runway, runway.width / 2);
}

function calculateVertex(
  lat: number,
  lon: number,
  distance: number,
  bearing: number
): [number, number] {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const bearingRad = (bearing * Math.PI) / 180;
  const dRad = distance / EARTH_RADIUS;

  const latNewRad = Math.asin(
    Math.sin(latRad) * Math.cos(dRad) + Math.cos(latRad) * Math.sin(dRad) * Math.cos(bearingRad)
  );

  const lonNewRad =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(dRad) * Math.cos(latRad),
      Math.cos(dRad) - Math.sin(latRad) * Math.sin(latNewRad)
    );

  return [(latNewRad * 180) / Math.PI, (lonNewRad * 180) / Math.PI];
}
/** The runway strip, cut perpendicular to the true line between the ends. */
export function getRunwayPolygon(runway: Runway): [number, number][] {
  return lanePolygon(runway, runway.width / 2);
}

/**
 * Calculate default shoulder width based on runway width.
 * Per X-Plane spec: "width is same as X-Plane 11, scaling with runway type and width, some 3-5 meters"
 * Typical values:
 * - Narrow runways (< 30m): 3m shoulders
 * - Medium runways (30-45m): 4m shoulders
 * - Wide runways (> 45m): 5m shoulders
 */
function getDefaultShoulderWidth(runwayWidth: number): number {
  if (runwayWidth < 30) return 3;
  if (runwayWidth <= 45) return 4;
  return 5;
}

export function getRunwayShoulderPolygon(runway: Runway): [number, number][] | null {
  // No shoulder if surface type is NONE (0)
  if (runway.shoulder_surface_type === ShoulderSurfaceType.NONE) {
    return null;
  }

  // Use explicit width if set, otherwise calculate default based on runway width
  const shoulderWidth =
    runway.shoulder_width > 0 ? runway.shoulder_width : getDefaultShoulderWidth(runway.width);

  // Total half width = runway half width + shoulder width
  return lanePolygon(runway, runway.width / 2 + shoulderWidth);
}

/** [lon, lat] a given distance and bearing from a point. */
function offset(lat: number, lon: number, distance: number, bearing: number): LonLat {
  const [newLat, newLon] = calculateVertex(lat, lon, distance, bearing);
  return [newLon, newLat];
}

/** Heading from the given end toward the opposite end. */
function headingFromEnd(runway: Runway, endIndex: 0 | 1): number {
  const heading1 = getRunwayTrueHeading(runway);
  return endIndex === 0 ? heading1 : (heading1 + 180) % 360;
}

/**
 * Where the usable threshold is: the runway end moved along the runway by
 * the displaced threshold length, or the end itself when nothing is displaced.
 */
export function getDisplacedThresholdPoint(runway: Runway, endIndex: 0 | 1): LonLat {
  const end = runway.ends[endIndex];
  if (end.dthr_length <= 0) return [end.longitude, end.latitude];
  return offset(end.latitude, end.longitude, end.dthr_length, headingFromEnd(runway, endIndex));
}

/** Rectangle spanning the runway width, from `start` for `length` metres along `heading`. */
function rectangleAlong(start: LonLat, heading: number, length: number, width: number): LonLat[] {
  const far = offset(start[1], start[0], length, heading);
  const half = width / 2;
  const c1 = offset(start[1], start[0], half, heading - 90);
  const c2 = offset(start[1], start[0], half, heading + 90);
  const c3 = offset(far[1], far[0], half, heading + 90);
  const c4 = offset(far[1], far[0], half, heading - 90);
  return [c1, c2, c3, c4, c1];
}

export interface RunwayOverrun {
  endName: string;
  polygon: LonLat[];
}

/**
 * Overrun and blast pad areas: a rectangle beyond each runway end, away
 * from the runway, by the apt.dat overrun length and the full runway width.
 */
export function getRunwayOverrunPolygons(runway: Runway): RunwayOverrun[] {
  const out: RunwayOverrun[] = [];
  for (const endIndex of [0, 1] as const) {
    const end = runway.ends[endIndex];
    if (end.overrun_length <= 0) continue;
    const outward = (headingFromEnd(runway, endIndex) + 180) % 360;
    out.push({
      endName: end.name,
      polygon: rectangleAlong(
        [end.longitude, end.latitude],
        outward,
        end.overrun_length,
        runway.width
      ),
    });
  }
  return out;
}

export interface DisplacedThresholdMarkings {
  /** Transverse bar across the runway at each displaced threshold. */
  bars: LonLat[][];
  /** Centerline from the runway end to the displaced threshold, drawn dashed. */
  centerlines: LonLat[][];
}

export function getDisplacedThresholdMarkings(runway: Runway): DisplacedThresholdMarkings {
  const bars: LonLat[][] = [];
  const centerlines: LonLat[][] = [];
  for (const endIndex of [0, 1] as const) {
    const end = runway.ends[endIndex];
    if (end.dthr_length <= 0) continue;
    const heading = headingFromEnd(runway, endIndex);
    const threshold = getDisplacedThresholdPoint(runway, endIndex);
    // Bar is centred on the threshold line: start half a bar short of it.
    const barStart = offset(threshold[1], threshold[0], THRESHOLD_BAR_WIDTH_M / 2, heading + 180);
    bars.push(rectangleAlong(barStart, heading, THRESHOLD_BAR_WIDTH_M, runway.width));
    centerlines.push([[end.longitude, end.latitude], threshold]);
  }
  return { bars, centerlines };
}

export interface MarkingProfile {
  thresholdStripes: boolean;
  aimingPoint: boolean;
  touchdownZone: boolean;
}

const NO_MARKINGS: MarkingProfile = {
  thresholdStripes: false,
  aimingPoint: false,
  touchdownZone: false,
};
const VISUAL_MARKINGS: MarkingProfile = {
  thresholdStripes: true,
  aimingPoint: false,
  touchdownZone: false,
};
const NON_PRECISION_MARKINGS: MarkingProfile = {
  thresholdStripes: true,
  aimingPoint: true,
  touchdownZone: false,
};
const PRECISION_MARKINGS: MarkingProfile = {
  thresholdStripes: true,
  aimingPoint: true,
  touchdownZone: true,
};

/**
 * Which painted markings an apt.dat runway-end marking code carries. UK (4, 5)
 * and EASA (6, 7) codes differ from FAA in placement, which the map does not
 * depict, so they map onto the same non-precision and precision profiles.
 */
export function getMarkingProfile(code: number): MarkingProfile {
  switch (code) {
    case 1:
      return VISUAL_MARKINGS;
    case 2:
    case 4:
    case 6:
      return NON_PRECISION_MARKINGS;
    case 3:
    case 5:
    case 7:
      return PRECISION_MARKINGS;
    default:
      return NO_MARKINGS;
  }
}
