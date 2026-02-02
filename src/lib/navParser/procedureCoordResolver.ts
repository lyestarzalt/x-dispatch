/**
 * Procedure Coordinate Resolver
 * Resolves waypoint coordinates for CIFP procedures by looking up
 * fixes in the waypoint and navaid databases.
 */
import { Coordinates } from '@/types/geo';
import { AirportProcedures, Procedure, ProcedureWaypoint } from './cifpParser';
import { Navaid, Waypoint } from './types';

/**
 * Extended waypoint with resolved coordinates
 */
interface ResolvedProcedureWaypoint extends ProcedureWaypoint {
  latitude?: number;
  longitude?: number;
  resolved: boolean;
}

/**
 * Procedure with resolved waypoint coordinates
 */
export interface ResolvedProcedure extends Omit<Procedure, 'waypoints'> {
  waypoints: ResolvedProcedureWaypoint[];
}

/**
 * Airport procedures with resolved coordinates
 */
export interface ResolvedAirportProcedures {
  icao: string;
  sids: ResolvedProcedure[];
  stars: ResolvedProcedure[];
  approaches: ResolvedProcedure[];
}

/**
 * Coordinate resolver function type
 * @param fixId - The fix identifier
 * @param region - The ICAO region code
 * @param type - Fix type (E=waypoint, V=VOR, N=NDB, A=Airport, etc.)
 */
export type CoordResolver = (fixId: string, region: string, type: string) => Coordinates | null;

/**
 * Calculate distance between two points in nautical miles (approximate)
 */
function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * 60;
  const dLon = (lon2 - lon1) * 60 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

/**
 * Options for creating a procedure coordinate resolver
 */
export interface ResolverOptions {
  /** Airport coordinates for proximity-based fallback */
  airportLat?: number;
  airportLon?: number;
  /** Maximum distance in nm for fallback matching (default: 500nm) */
  maxFallbackDistanceNm?: number;
}

/**
 * Create a procedure coordinate resolver from waypoint and navaid data
 *
 * IMPORTANT: The resolver prioritizes region-matched lookups to avoid
 * matching waypoints with the same name on different continents.
 */
export function createProcedureCoordResolver(
  waypoints: Waypoint[],
  navaids: Navaid[],
  options?: ResolverOptions
): CoordResolver {
  const airportLat = options?.airportLat;
  const airportLon = options?.airportLon;
  const maxFallbackDistance = options?.maxFallbackDistanceNm ?? 500;

  // Build lookup maps - region-specific only
  const waypointByIdRegion = new Map<string, Waypoint>();
  // Store ALL waypoints by ID for proximity-based fallback
  const waypointsByIdAll = new Map<string, Waypoint[]>();

  for (const wp of waypoints) {
    const key = `${wp.id.toUpperCase()}:${wp.region.toUpperCase()}`;
    waypointByIdRegion.set(key, wp);

    // Collect all waypoints with same ID for proximity fallback
    const idKey = wp.id.toUpperCase();
    if (!waypointsByIdAll.has(idKey)) {
      waypointsByIdAll.set(idKey, []);
    }
    waypointsByIdAll.get(idKey)!.push(wp);
  }

  const navaidByIdRegion = new Map<string, Navaid>();
  const navaidsByIdAll = new Map<string, Navaid[]>();

  for (const nav of navaids) {
    const key = `${nav.id.toUpperCase()}:${nav.region.toUpperCase()}`;
    navaidByIdRegion.set(key, nav);

    const idKey = nav.id.toUpperCase();
    if (!navaidsByIdAll.has(idKey)) {
      navaidsByIdAll.set(idKey, []);
    }
    navaidsByIdAll.get(idKey)!.push(nav);
  }

  /**
   * Find the nearest waypoint with given ID that's within max distance of airport
   */
  function findNearestWaypoint(fixId: string): Waypoint | null {
    if (airportLat === undefined || airportLon === undefined) return null;

    const candidates = waypointsByIdAll.get(fixId);
    if (!candidates || candidates.length === 0) return null;

    let nearest: Waypoint | null = null;
    let nearestDist = Infinity;

    for (const wp of candidates) {
      const dist = distanceNm(airportLat, airportLon, wp.latitude, wp.longitude);
      if (dist < maxFallbackDistance && dist < nearestDist) {
        nearest = wp;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  /**
   * Find the nearest navaid with given ID that's within max distance of airport
   */
  function findNearestNavaid(fixId: string): Navaid | null {
    if (airportLat === undefined || airportLon === undefined) return null;

    const candidates = navaidsByIdAll.get(fixId);
    if (!candidates || candidates.length === 0) return null;

    let nearest: Navaid | null = null;
    let nearestDist = Infinity;

    for (const nav of candidates) {
      const dist = distanceNm(airportLat, airportLon, nav.latitude, nav.longitude);
      if (dist < maxFallbackDistance && dist < nearestDist) {
        nearest = nav;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  return (fixId: string, region: string, type: string): Coordinates | null => {
    const upperFixId = fixId.toUpperCase();
    const upperRegion = region.toUpperCase();
    const key = `${upperFixId}:${upperRegion}`;

    // Runway waypoints (RW09, RW27L, etc.) - these are pseudo-fixes
    // They should be derived from airport data, not global waypoint lookup
    // For now, skip them - they'll be unresolved but won't cause map jumps
    if (upperFixId.startsWith('RW') && /^RW\d{2}[LRC]?$/.test(upperFixId)) {
      // Runway waypoint - don't do global lookup, it's dangerous
      // These should ideally be resolved from airport runway data
      return null;
    }

    // Fix type determines where to look first
    // V = VOR, N = NDB, D = DME
    if (type === 'V' || type === 'N' || type === 'D') {
      // VOR, NDB, or DME - look in navaids first (region-matched)
      const nav = navaidByIdRegion.get(key);
      if (nav) {
        return { latitude: nav.latitude, longitude: nav.longitude };
      }

      // Proximity-based fallback for navaids
      const nearestNav = findNearestNavaid(upperFixId);
      if (nearestNav) {
        return { latitude: nearestNav.latitude, longitude: nearestNav.longitude };
      }
    }

    // Try waypoints with region match first
    const wp = waypointByIdRegion.get(key);
    if (wp) {
      return { latitude: wp.latitude, longitude: wp.longitude };
    }

    // Proximity-based fallback: find nearest waypoint within max distance
    const nearestWp = findNearestWaypoint(upperFixId);
    if (nearestWp) {
      return { latitude: nearestWp.latitude, longitude: nearestWp.longitude };
    }

    // Try navaids with region match
    const nav = navaidByIdRegion.get(key);
    if (nav) {
      return { latitude: nav.latitude, longitude: nav.longitude };
    }

    // Proximity-based fallback for navaids
    const nearestNav = findNearestNavaid(upperFixId);
    if (nearestNav) {
      return { latitude: nearestNav.latitude, longitude: nearestNav.longitude };
    }

    return null;
  };
}

/**
 * Resolve a single procedure waypoint
 */
function resolveWaypoint(
  wp: ProcedureWaypoint,
  resolver: CoordResolver
): ResolvedProcedureWaypoint {
  const coords = resolver(wp.fixId, wp.fixRegion, wp.fixType);

  return {
    ...wp,
    latitude: coords?.latitude,
    longitude: coords?.longitude,
    resolved: coords !== null,
  };
}

/**
 * Resolve all waypoints in a procedure
 */
function resolveProcedure(procedure: Procedure, resolver: CoordResolver): ResolvedProcedure {
  return {
    ...procedure,
    waypoints: procedure.waypoints.map((wp) => resolveWaypoint(wp, resolver)),
  };
}

/**
 * Enrich all procedures with resolved coordinates
 */
export function enrichProceduresWithCoordinates(
  procedures: AirportProcedures,
  resolver: CoordResolver
): ResolvedAirportProcedures {
  return {
    icao: procedures.icao,
    sids: procedures.sids.map((p) => resolveProcedure(p, resolver)),
    stars: procedures.stars.map((p) => resolveProcedure(p, resolver)),
    approaches: procedures.approaches.map((p) => resolveProcedure(p, resolver)),
  };
}

/**
 * Get resolution statistics for a set of procedures
 */
function getProcedureResolutionStats(procedures: ResolvedAirportProcedures): {
  totalWaypoints: number;
  resolvedWaypoints: number;
  unresolvedWaypoints: number;
  resolutionRate: number;
} {
  let total = 0;
  let resolved = 0;

  const countWaypoints = (procs: ResolvedProcedure[]) => {
    for (const proc of procs) {
      for (const wp of proc.waypoints) {
        total++;
        if (wp.resolved) resolved++;
      }
    }
  };

  countWaypoints(procedures.sids);
  countWaypoints(procedures.stars);
  countWaypoints(procedures.approaches);

  return {
    totalWaypoints: total,
    resolvedWaypoints: resolved,
    unresolvedWaypoints: total - resolved,
    resolutionRate: total > 0 ? resolved / total : 0,
  };
}

/**
 * Get list of unresolved waypoint IDs from procedures
 */
function getUnresolvedWaypoints(procedures: ResolvedAirportProcedures): string[] {
  const unresolved = new Set<string>();

  const collectUnresolved = (procs: ResolvedProcedure[]) => {
    for (const proc of procs) {
      for (const wp of proc.waypoints) {
        if (!wp.resolved) {
          unresolved.add(`${wp.fixId}:${wp.fixRegion}`);
        }
      }
    }
  };

  collectUnresolved(procedures.sids);
  collectUnresolved(procedures.stars);
  collectUnresolved(procedures.approaches);

  return Array.from(unresolved).sort();
}
