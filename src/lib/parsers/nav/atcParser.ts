/**
 * ATC Data Parser
 * Parses Navigraph atc.dat file containing ATC controller information
 *
 * File format example:
 * CONTROLLER
 * NAME ALGIERS
 * FACILITY_ID DAAA
 * ROLE ctr
 * FREQ 12045
 * AIRSPACE_POLYGON_BEGIN 0 60000
 * POINT 39.000000 4.666667
 * ...
 * AIRSPACE_POLYGON_END
 */
import { LonLatPath } from '@/types/geo';
import type { ATCController, ATCRole } from '@/types/navigation';

interface ParsedAirspace {
  minAlt: number;
  maxAlt: number;
  polygon: LonLatPath;
}

/**
 * Parse ATC data content into ATCController array
 */
export function parseATCData(content: string): ATCController[] {
  const controllers: ATCController[] = [];
  const lines = content.split('\n');

  let currentController: Partial<ATCController> | null = null;
  let currentAirspace: ParsedAirspace | null = null;
  let inPolygon = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    // Start of a new controller
    if (line === 'CONTROLLER') {
      // Save previous controller if exists
      if (
        currentController &&
        currentController.name &&
        currentController.facilityId &&
        currentController.role
      ) {
        controllers.push({
          name: currentController.name,
          facilityId: currentController.facilityId,
          role: currentController.role,
          frequencies: currentController.frequencies || [],
          airspace: currentAirspace || undefined,
        });
      }

      currentController = {
        frequencies: [],
      };
      currentAirspace = null;
      inPolygon = false;
      continue;
    }

    if (!currentController) {
      continue;
    }

    // Parse controller properties
    if (line.startsWith('NAME ')) {
      currentController.name = line.substring(5).trim();
      continue;
    }

    if (line.startsWith('FACILITY_ID ')) {
      currentController.facilityId = line.substring(12).trim();
      continue;
    }

    if (line.startsWith('ROLE ')) {
      const role = line.substring(5).trim().toLowerCase();
      if (isValidATCRole(role)) {
        currentController.role = role;
      }
      continue;
    }

    if (line.startsWith('FREQ ')) {
      const freqStr = line.substring(5).trim();
      const freq = parseInt(freqStr, 10);
      if (!isNaN(freq)) {
        // Convert from integer format (12045) to MHz (120.45)
        const freqMHz = freq / 100;
        if (!currentController.frequencies) {
          currentController.frequencies = [];
        }
        currentController.frequencies.push(freqMHz);
      }
      continue;
    }

    // Parse airspace polygon
    if (line.startsWith('AIRSPACE_POLYGON_BEGIN')) {
      const parts = line.split(/\s+/);
      const minAlt = parts[1] ? parseInt(parts[1], 10) : 0;
      const maxAlt = parts[2] ? parseInt(parts[2], 10) : 99999;

      currentAirspace = {
        minAlt: isNaN(minAlt) ? 0 : minAlt,
        maxAlt: isNaN(maxAlt) ? 99999 : maxAlt,
        polygon: [],
      };
      inPolygon = true;
      continue;
    }

    if (line === 'AIRSPACE_POLYGON_END') {
      inPolygon = false;
      continue;
    }

    if (inPolygon && line.startsWith('POINT ') && currentAirspace) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const lat = parseFloat(parts[1]);
        const lon = parseFloat(parts[2]);
        if (!isNaN(lat) && !isNaN(lon)) {
          currentAirspace.polygon.push([lon, lat]);
        }
      }
      continue;
    }
  }

  // Don't forget the last controller
  if (
    currentController &&
    currentController.name &&
    currentController.facilityId &&
    currentController.role
  ) {
    controllers.push({
      name: currentController.name,
      facilityId: currentController.facilityId,
      role: currentController.role,
      frequencies: currentController.frequencies || [],
      airspace: currentAirspace || undefined,
    });
  }

  return controllers;
}

/**
 * Type guard for ATCRole
 */
function isValidATCRole(role: string): role is ATCRole {
  return ['ctr', 'app', 'twr', 'gnd', 'del'].includes(role);
}

/**
 * Get controllers by role
 */
function filterControllersByRole(controllers: ATCController[], role: ATCRole): ATCController[] {
  return controllers.filter((c) => c.role === role);
}

/**
 * Get controller by facility ID
 */
function getControllerByFacility(
  controllers: ATCController[],
  facilityId: string
): ATCController | null {
  return controllers.find((c) => c.facilityId.toUpperCase() === facilityId.toUpperCase()) || null;
}

/**
 * Search controllers by name or facility ID
 */
function searchControllers(controllers: ATCController[], query: string): ATCController[] {
  const upperQuery = query.toUpperCase();
  return controllers.filter(
    (c) =>
      c.name.toUpperCase().includes(upperQuery) || c.facilityId.toUpperCase().includes(upperQuery)
  );
}
