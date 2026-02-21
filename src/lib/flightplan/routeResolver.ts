/**
 * Flight Plan Route Resolver
 * Parses and resolves flight plan routes to coordinates.
 * Handles: airports, waypoints, navaids, and airway expansion.
 *
 * Example input: "KJFK BETTE J75 BRIGS KORD"
 * Output: Array of resolved waypoints with coordinates
 */
import type { Coordinates } from '@/types/geo';
import type { AltitudeConstraint } from '@/types/navigation';

// ============================================================================
// Types
// ============================================================================

export type RouteSegmentType =
  | 'AIRPORT'
  | 'WAYPOINT'
  | 'NAVAID'
  | 'AIRWAY'
  | 'SID'
  | 'STAR'
  | 'DIRECT';

export interface ResolvedRoutePoint {
  /** Original fix identifier */
  fixId: string;
  /** Resolved coordinates */
  latitude: number;
  longitude: number;
  /** Type of point */
  type: RouteSegmentType;
  /** Was this successfully resolved? */
  resolved: true;
  /** Altitude constraint if any */
  altitude?: AltitudeConstraint;
  /** Speed constraint in knots if any */
  speed?: number;
  /** Airway name if part of an airway segment */
  airway?: string;
  /** Is this a flyover waypoint? */
  flyover?: boolean;
}

export interface UnresolvedRoutePoint {
  fixId: string;
  type: RouteSegmentType;
  resolved: false;
  error: string;
}

export type RoutePoint = ResolvedRoutePoint | UnresolvedRoutePoint;

export interface ParsedRoute {
  /** All resolved and unresolved points in order */
  points: RoutePoint[];
  /** Departure airport ICAO */
  departure?: string;
  /** Arrival airport ICAO */
  arrival?: string;
  /** SID name if specified */
  sid?: string;
  /** STAR name if specified */
  star?: string;
  /** Approach name if specified */
  approach?: string;
  /** Parsing warnings */
  warnings: string[];
  /** Resolution stats */
  stats: {
    total: number;
    resolved: number;
    unresolved: number;
  };
}

export interface RouteResolverOptions {
  /** Departure airport ICAO (for proximity-based resolution) */
  departureIcao?: string;
  /** Arrival airport ICAO (for proximity-based resolution) */
  arrivalIcao?: string;
  /** Expand airways to constituent fixes */
  expandAirways?: boolean;
}

// ============================================================================
// Resolver Interface (injected for testability)
// ============================================================================

export interface FixResolver {
  resolveWaypoint(id: string, nearLat?: number, nearLon?: number): Coordinates | null;
  resolveNavaid(id: string, nearLat?: number, nearLon?: number): Coordinates | null;
  resolveAirport(icao: string): Coordinates | null;
  expandAirway(
    airwayName: string,
    fromFix: string,
    toFix: string
  ): Array<{ fixId: string; latitude: number; longitude: number }> | null;
}

// ============================================================================
// Route Parser
// ============================================================================

/**
 * Parse a route string into tokens
 * Handles: ICAO codes, airways, SID/STAR names, direct routes
 */
export function tokenizeRoute(routeString: string): string[] {
  // Normalize: uppercase, replace multiple spaces, trim
  const normalized = routeString.toUpperCase().replace(/\s+/g, ' ').trim();

  // Split by spaces, filter empty
  return normalized.split(' ').filter((t) => t.length > 0);
}

/**
 * Identify token type based on pattern
 */
function identifyTokenType(token: string, index: number, tokens: string[]): RouteSegmentType {
  // First token is typically departure airport
  if (index === 0 && /^[A-Z]{4}$/.test(token)) {
    return 'AIRPORT';
  }

  // Last token is typically arrival airport
  if (index === tokens.length - 1 && /^[A-Z]{4}$/.test(token)) {
    return 'AIRPORT';
  }

  // Airways: J/V/Q/T/A/B/G/R + numbers (J75, V23, Q4, UL975, etc.)
  if (/^[JVQTABGRUL]{1,2}\d+$/.test(token)) {
    return 'AIRWAY';
  }

  // Direct route indicator
  if (token === 'DCT' || token === 'DIRECT') {
    return 'DIRECT';
  }

  // 5-letter waypoints (most common)
  if (/^[A-Z]{5}$/.test(token)) {
    return 'WAYPOINT';
  }

  // 3-letter navaids (VOR, NDB)
  if (/^[A-Z]{3}$/.test(token)) {
    return 'NAVAID';
  }

  // 4-letter could be airport or waypoint
  if (/^[A-Z]{4}$/.test(token)) {
    // Try to identify based on context
    return 'WAYPOINT';
  }

  // 2-3 letter codes are likely navaids
  if (/^[A-Z]{2,3}$/.test(token)) {
    return 'NAVAID';
  }

  // Default to waypoint
  return 'WAYPOINT';
}

/**
 * Resolve a complete flight plan route
 */
export function resolveRoute(
  routeString: string,
  resolver: FixResolver,
  options: RouteResolverOptions = {}
): ParsedRoute {
  const tokens = tokenizeRoute(routeString);
  const points: RoutePoint[] = [];
  const warnings: string[] = [];

  let lastResolvedCoords: Coordinates | null = null;
  let currentAirway: string | null = null;
  let airwayEntryFix: string | null = null;

  // Resolve departure airport for proximity reference
  let departureCoords: Coordinates | null = null;
  if (options.departureIcao) {
    departureCoords = resolver.resolveAirport(options.departureIcao);
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const tokenType = identifyTokenType(token, i, tokens);

    // Handle DCT (direct) - just skip it, next waypoint connects directly
    if (tokenType === 'DIRECT') {
      currentAirway = null;
      airwayEntryFix = null;
      continue;
    }

    // Handle airway
    if (tokenType === 'AIRWAY') {
      currentAirway = token;
      // The previous point is the airway entry
      if (points.length > 0) {
        const lastPoint = points[points.length - 1];
        if (lastPoint?.resolved) {
          airwayEntryFix = lastPoint.fixId;
        }
      }
      continue;
    }

    // Try to resolve the fix
    let coords: Coordinates | null = null;
    let resolvedType = tokenType;

    // Use last known position or departure for proximity
    const nearLat = lastResolvedCoords?.latitude ?? departureCoords?.latitude;
    const nearLon = lastResolvedCoords?.longitude ?? departureCoords?.longitude;

    if (tokenType === 'AIRPORT') {
      coords = resolver.resolveAirport(token);
    } else if (tokenType === 'NAVAID') {
      coords = resolver.resolveNavaid(token, nearLat, nearLon);
      if (!coords) {
        // Try as waypoint fallback
        coords = resolver.resolveWaypoint(token, nearLat, nearLon);
        if (coords) resolvedType = 'WAYPOINT';
      }
    } else {
      // WAYPOINT
      coords = resolver.resolveWaypoint(token, nearLat, nearLon);
      if (!coords) {
        // Try as navaid fallback
        coords = resolver.resolveNavaid(token, nearLat, nearLon);
        if (coords) resolvedType = 'NAVAID';
      }
    }

    // If we're on an airway and have the exit fix, expand the airway
    if (currentAirway && airwayEntryFix && coords && options.expandAirways !== false) {
      const airwayFixes = resolver.expandAirway(currentAirway, airwayEntryFix, token);

      if (airwayFixes && airwayFixes.length > 0) {
        // Add intermediate airway fixes (skip first as it's already in points)
        for (let j = 1; j < airwayFixes.length - 1; j++) {
          const fix = airwayFixes[j]!;
          points.push({
            fixId: fix.fixId,
            latitude: fix.latitude,
            longitude: fix.longitude,
            type: 'WAYPOINT',
            resolved: true,
            airway: currentAirway,
          });
          lastResolvedCoords = { latitude: fix.latitude, longitude: fix.longitude };
        }
      } else {
        warnings.push(
          `Could not expand airway ${currentAirway} from ${airwayEntryFix} to ${token}`
        );
      }

      currentAirway = null;
      airwayEntryFix = null;
    }

    // Add the current point
    if (coords) {
      points.push({
        fixId: token,
        latitude: coords.latitude,
        longitude: coords.longitude,
        type: resolvedType,
        resolved: true,
        airway: currentAirway ?? undefined,
      });
      lastResolvedCoords = coords;
    } else {
      points.push({
        fixId: token,
        type: tokenType,
        resolved: false,
        error: `Could not resolve ${tokenType.toLowerCase()} "${token}"`,
      });
      warnings.push(`Unresolved: ${token}`);
    }
  }

  // Extract departure/arrival from resolved points
  let departure: string | undefined;
  let arrival: string | undefined;

  if (points.length > 0) {
    const first = points[0];
    if (first?.resolved && first.type === 'AIRPORT') {
      departure = first.fixId;
    }
    const last = points[points.length - 1];
    if (last?.resolved && last.type === 'AIRPORT') {
      arrival = last.fixId;
    }
  }

  const resolved = points.filter((p) => p.resolved).length;

  return {
    points,
    departure,
    arrival,
    warnings,
    stats: {
      total: points.length,
      resolved,
      unresolved: points.length - resolved,
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get only resolved points from a parsed route
 */
export function getResolvedPoints(route: ParsedRoute): ResolvedRoutePoint[] {
  return route.points.filter((p): p is ResolvedRoutePoint => p.resolved);
}

/**
 * Get route as GeoJSON LineString
 */
export function routeToGeoJSON(route: ParsedRoute): GeoJSON.Feature<GeoJSON.LineString> | null {
  const resolved = getResolvedPoints(route);
  if (resolved.length < 2) return null;

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: resolved.map((p) => [p.longitude, p.latitude]),
    },
    properties: {
      departure: route.departure,
      arrival: route.arrival,
      pointCount: resolved.length,
    },
  };
}

/**
 * Get route waypoints as GeoJSON FeatureCollection
 */
export function routePointsToGeoJSON(route: ParsedRoute): GeoJSON.FeatureCollection {
  const resolved = getResolvedPoints(route);

  return {
    type: 'FeatureCollection',
    features: resolved.map((p, idx) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [p.longitude, p.latitude],
      },
      properties: {
        id: p.fixId,
        sequence: idx + 1,
        type: p.type,
        airway: p.airway,
        altitude: p.altitude ? `${p.altitude.descriptor}${p.altitude.altitude1 ?? ''}` : undefined,
        speed: p.speed,
      },
    })),
  };
}
