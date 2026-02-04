import { Runway, ShoulderSurfaceType } from './types';

const EARTH_RADIUS = 6371e3; // meters

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
export function getRunwayPolygon(runway: Runway): [number, number][] {
  const end1 = runway.ends[0];
  const end2 = runway.ends[1];
  const halfWidth = runway.width / 2;

  // Get runway heading from number (e.g., "08" -> 80 degrees)
  const heading1 = parseInt(end1.name.replace(/[LCR]$/, '')) * 10;
  const heading2 = (heading1 + 180) % 360;

  // Calculate corners - in correct order for a rectangle
  const corner1 = calculateVertex(end1.latitude, end1.longitude, halfWidth, (heading1 - 90) % 360); // Left side
  const corner2 = calculateVertex(end1.latitude, end1.longitude, halfWidth, (heading1 + 90) % 360); // Right side
  const corner3 = calculateVertex(end2.latitude, end2.longitude, halfWidth, (heading2 - 90) % 360); // Right side
  const corner4 = calculateVertex(end2.latitude, end2.longitude, halfWidth, (heading2 + 90) % 360); // Left side

  // Log corner coordinates

  // Return polygon coordinates in clockwise order
  // GeoJSON uses [longitude, latitude]
  return [
    [corner1[1], corner1[0]], // Start at first end, left corner
    [corner2[1], corner2[0]], // First end, right corner
    [corner3[1], corner3[0]], // Second end, right corner
    [corner4[1], corner4[0]], // Second end, left corner
    [corner1[1], corner1[0]], // Back to start to close polygon
  ];
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

  const end1 = runway.ends[0];
  const end2 = runway.ends[1];

  // Use explicit width if set, otherwise calculate default based on runway width
  const shoulderWidth =
    runway.shoulder_width > 0 ? runway.shoulder_width : getDefaultShoulderWidth(runway.width);

  // Total half width = runway half width + shoulder width
  const totalHalfWidth = runway.width / 2 + shoulderWidth;

  // Get runway heading from number (e.g., "08" -> 80 degrees)
  const heading1 = parseInt(end1.name.replace(/[LCR]$/, '')) * 10;
  const heading2 = (heading1 + 180) % 360;

  // Calculate corners at the outer edge (including shoulder)
  const corner1 = calculateVertex(
    end1.latitude,
    end1.longitude,
    totalHalfWidth,
    (heading1 - 90) % 360
  );
  const corner2 = calculateVertex(
    end1.latitude,
    end1.longitude,
    totalHalfWidth,
    (heading1 + 90) % 360
  );
  const corner3 = calculateVertex(
    end2.latitude,
    end2.longitude,
    totalHalfWidth,
    (heading2 - 90) % 360
  );
  const corner4 = calculateVertex(
    end2.latitude,
    end2.longitude,
    totalHalfWidth,
    (heading2 + 90) % 360
  );

  // Return polygon coordinates in clockwise order
  // GeoJSON uses [longitude, latitude]
  return [
    [corner1[1], corner1[0]],
    [corner2[1], corner2[0]],
    [corner3[1], corner3[0]],
    [corner4[1], corner4[0]],
    [corner1[1], corner1[0]], // Close polygon
  ];
}
