/**
 * SQL-backed Flight Plan Resolver
 * Uses SQLite queries for fix resolution and airway expansion.
 */
import { eq } from 'drizzle-orm';
import { airports, airways, getDb } from '@/lib/db';
// ============================================================================
// Synchronous Resolver for Main Process
// ============================================================================

import {
  getNavaidNearestById,
  getWaypointNearestById,
} from '@/lib/xplaneServices/dataService/navdata/navCache';
import type { Coordinates } from '@/types/geo';
import type { FixResolver } from './routeResolver';

// Types for IPC communication

export interface SqlResolverDeps {
  resolveWaypointCoords: (
    waypointId: string,
    region?: string,
    airportLat?: number,
    airportLon?: number
  ) => Promise<{ latitude: number; longitude: number } | null>;
  resolveNavaidCoords: (
    navaidId: string,
    region?: string,
    airportLat?: number,
    airportLon?: number
  ) => Promise<{ latitude: number; longitude: number; type: string } | null>;
  getAirportCoordinates: (icao: string) => Promise<{ lat: number; lon: number } | null>;
  getAirwaySegments: (
    airwayName: string
  ) => Promise<Array<{ fromFix: string; toFix: string; fromRegion: string; toRegion: string }>>;
}

// ============================================================================

// ============================================================================

/**
 * Create a synchronous fix resolver that directly queries SQLite
 * For use in the main Electron process
 */
export function createSqlFixResolver(): FixResolver {
  return {
    resolveWaypoint(id: string, nearLat?: number, nearLon?: number): Coordinates | null {
      // Try exact match first (no region = use nearest)
      if (nearLat !== undefined && nearLon !== undefined) {
        const nearest = getWaypointNearestById(id, nearLat, nearLon, 500);
        if (nearest) {
          return { latitude: nearest.latitude, longitude: nearest.longitude };
        }
      }

      // Fallback: try any waypoint with this ID
      const any = getWaypointNearestById(id, 0, 0, 99999);
      if (any) {
        return { latitude: any.latitude, longitude: any.longitude };
      }

      return null;
    },

    resolveNavaid(id: string, nearLat?: number, nearLon?: number): Coordinates | null {
      if (nearLat !== undefined && nearLon !== undefined) {
        const nearest = getNavaidNearestById(id, nearLat, nearLon, 500);
        if (nearest) {
          return { latitude: nearest.latitude, longitude: nearest.longitude };
        }
      }

      const any = getNavaidNearestById(id, 0, 0, 99999);
      if (any) {
        return { latitude: any.latitude, longitude: any.longitude };
      }

      return null;
    },

    resolveAirport(icao: string): Coordinates | null {
      const db = getDb();
      const result = db
        .select({ lat: airports.lat, lon: airports.lon })
        .from(airports)
        .where(eq(airports.icao, icao.toUpperCase()))
        .get();

      if (result) {
        return { latitude: result.lat, longitude: result.lon };
      }
      return null;
    },

    expandAirway(
      airwayName: string,
      fromFix: string,
      toFix: string
    ): Array<{ fixId: string; latitude: number; longitude: number }> | null {
      const db = getDb();

      // Get all segments for this airway
      const segments = db
        .select({
          fromFix: airways.fromFix,
          toFix: airways.toFix,
          fromRegion: airways.fromRegion,
          toRegion: airways.toRegion,
        })
        .from(airways)
        .where(eq(airways.name, airwayName.toUpperCase()))
        .all();

      if (segments.length === 0) return null;

      // Build adjacency map for route finding
      const adjacency = new Map<string, Set<string>>();
      const segmentMap = new Map<string, (typeof segments)[0]>();

      for (const seg of segments) {
        const fromKey = seg.fromFix.toUpperCase();
        const toKey = seg.toFix.toUpperCase();

        if (!adjacency.has(fromKey)) adjacency.set(fromKey, new Set());
        if (!adjacency.has(toKey)) adjacency.set(toKey, new Set());

        adjacency.get(fromKey)!.add(toKey);
        adjacency.get(toKey)!.add(fromKey); // Airways are bidirectional for path finding

        segmentMap.set(`${fromKey}-${toKey}`, seg);
        segmentMap.set(`${toKey}-${fromKey}`, seg);
      }

      // BFS to find path from fromFix to toFix
      const startFix = fromFix.toUpperCase();
      const endFix = toFix.toUpperCase();

      if (!adjacency.has(startFix) || !adjacency.has(endFix)) {
        return null;
      }

      const queue: string[][] = [[startFix]];
      const visited = new Set<string>([startFix]);

      while (queue.length > 0) {
        const path = queue.shift()!;
        const current = path[path.length - 1]!;

        if (current === endFix) {
          // Found path, resolve coordinates
          const result: Array<{ fixId: string; latitude: number; longitude: number }> = [];

          for (const fixId of path) {
            // Try to get coords from waypoints or navaids
            const wpCoords = getWaypointNearestById(fixId, 0, 0, 99999);
            if (wpCoords) {
              result.push({
                fixId,
                latitude: wpCoords.latitude,
                longitude: wpCoords.longitude,
              });
              continue;
            }

            const navCoords = getNavaidNearestById(fixId, 0, 0, 99999);
            if (navCoords) {
              result.push({
                fixId,
                latitude: navCoords.latitude,
                longitude: navCoords.longitude,
              });
            }
          }

          return result.length >= 2 ? result : null;
        }

        const neighbors = adjacency.get(current);
        if (neighbors) {
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push([...path, neighbor]);
            }
          }
        }
      }

      return null; // No path found
    },
  };
}
