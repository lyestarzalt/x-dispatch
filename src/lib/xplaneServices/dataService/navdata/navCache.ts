/**
 * Navigation Data Cache
 * SQLite caching for parsed navigation data (navaids, waypoints, airways, airspaces).
 * Tracks file modification times to invalidate cache when data files change.
 */
import { eq, sql } from 'drizzle-orm';
import * as fs from 'fs';
import { airspaces, airways, getDb, navFileMeta, navaids, saveDb, waypoints } from '@/lib/db';
import logger from '@/lib/utils/logger';
import type { Coordinates } from '@/types/geo';
import type {
  Airspace,
  AirspaceClass,
  AirwayDirection,
  AirwaySegment,
  CoordResolver,
  FixTypeCode,
  Navaid,
  Waypoint,
} from '@/types/navigation';
import { FixTypeNumber } from '@/types/navigation';

// ============================================================================
// Types
// ============================================================================

export type NavDataType = 'navaids' | 'waypoints' | 'airways' | 'airspaces';
export type NavSourceType = 'navigraph' | 'xplane-default' | 'unknown';

export interface NavFileInfo {
  path: string;
  mtime: number;
  dataType: NavDataType;
  sourceType: NavSourceType;
}

export interface NavCacheCheckResult {
  needsReload: boolean;
  reason?: string;
}

/**
 * Detect source type from file path
 * Custom Data/ = Navigraph, Resources/default data/ = X-Plane default
 */
export function detectSourceType(filePath: string): NavSourceType {
  if (filePath.includes('Custom Data')) {
    return 'navigraph';
  }
  if (filePath.includes('Resources') && filePath.includes('default data')) {
    return 'xplane-default';
  }
  return 'unknown';
}

// ============================================================================
// File Metadata Operations
// ============================================================================

/**
 * Get file modification time in milliseconds
 */
export function getFileMtime(filePath: string): number | null {
  try {
    const stat = fs.statSync(filePath);
    return Math.floor(stat.mtimeMs);
  } catch {
    return null;
  }
}

/**
 * Get stored file metadata for a specific data type
 */
export function getStoredNavFileMeta(
  dataType: NavDataType
): { path: string; mtime: number; sourceType: NavSourceType } | null {
  const db = getDb();
  const stored = db.select().from(navFileMeta).where(eq(navFileMeta.dataType, dataType)).get();

  return stored
    ? {
        path: stored.path,
        mtime: stored.mtime,
        sourceType: (stored.sourceType as NavSourceType) || 'unknown',
      }
    : null;
}

/**
 * Check if cache needs to be reloaded for a specific data type
 * Validates: path, mtime, and source type (Navigraph vs X-Plane)
 */
export function checkNavCacheValidity(
  currentPath: string,
  dataType: NavDataType
): NavCacheCheckResult {
  const stored = getStoredNavFileMeta(dataType);

  if (!stored) {
    return { needsReload: true, reason: 'No cached data' };
  }

  // Check if source changed (Navigraph ↔ X-Plane)
  const currentSource = detectSourceType(currentPath);
  if (stored.sourceType !== currentSource) {
    return {
      needsReload: true,
      reason: `Source changed: ${stored.sourceType} → ${currentSource}`,
    };
  }

  // Check if path changed (handles file location changes within same source)
  if (stored.path !== currentPath) {
    return { needsReload: true, reason: 'File path changed' };
  }

  // Check if file exists
  const currentMtime = getFileMtime(currentPath);
  if (currentMtime === null) {
    return { needsReload: true, reason: 'File not found' };
  }

  // Check if file was modified
  if (stored.mtime !== currentMtime) {
    return { needsReload: true, reason: 'File modified' };
  }

  return { needsReload: false };
}

/**
 * Update stored file metadata after successful load
 */
export function updateNavFileMeta(
  filePath: string,
  dataType: NavDataType,
  recordCount: number
): void {
  const db = getDb();
  const mtime = getFileMtime(filePath);
  if (mtime === null) return;

  const sourceType = detectSourceType(filePath);

  // Delete existing entry for this data type
  db.delete(navFileMeta).where(eq(navFileMeta.dataType, dataType)).run();

  // Insert new entry with source type
  db.insert(navFileMeta)
    .values({
      path: filePath,
      mtime,
      recordCount,
      dataType,
      sourceType,
    })
    .run();

  logger.data.debug(
    `Updated ${dataType} cache: ${recordCount} records from ${sourceType} (${filePath})`
  );
}

// ============================================================================
// Navaids Database Operations
// ============================================================================

/**
 * Clear all navaids from database
 */
export function clearNavaids(): void {
  const db = getDb();
  db.delete(navaids).run();
}

/**
 * Batch insert navaids into database
 */
export function insertNavaids(navaidList: Navaid[]): void {
  const db = getDb();

  const navaidArray = navaidList.map((n) => ({
    navaidId: n.id,
    name: n.name,
    type: n.type,
    lat: n.latitude,
    lon: n.longitude,
    elevation: n.elevation,
    frequency: n.frequency,
    range: n.range,
    magneticVariation: n.magneticVariation,
    region: n.region,
    country: n.country,
    bearing: n.bearing,
    associatedAirport: n.associatedAirport,
    associatedRunway: n.associatedRunway,
    glidepathAngle: n.glidepathAngle,
    course: n.course,
    lengthOffset: n.lengthOffset,
    thresholdCrossingHeight: n.thresholdCrossingHeight,
    refPathIdentifier: n.refPathIdentifier,
    approachPerformance: n.approachPerformance,
  }));

  // Batch insert in chunks
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < navaidArray.length; i += CHUNK_SIZE) {
    const chunk = navaidArray.slice(i, i + CHUNK_SIZE);
    db.insert(navaids).values(chunk).run();
  }
}

/**
 * Get all navaids from database
 */
export function getAllNavaidsFromDb(): Navaid[] {
  const db = getDb();
  const results = db.select().from(navaids).all();

  return results.map((r) => ({
    id: r.navaidId,
    name: r.name,
    type: r.type as Navaid['type'],
    latitude: r.lat,
    longitude: r.lon,
    elevation: r.elevation ?? 0,
    frequency: r.frequency ?? 0,
    range: r.range ?? 0,
    magneticVariation: r.magneticVariation ?? 0,
    region: r.region ?? '',
    country: r.country ?? '',
    bearing: r.bearing ?? undefined,
    associatedAirport: r.associatedAirport ?? undefined,
    associatedRunway: r.associatedRunway ?? undefined,
    glidepathAngle: r.glidepathAngle ?? undefined,
    course: r.course ?? undefined,
    lengthOffset: r.lengthOffset ?? undefined,
    thresholdCrossingHeight: r.thresholdCrossingHeight ?? undefined,
    refPathIdentifier: r.refPathIdentifier ?? undefined,
    approachPerformance: r.approachPerformance as Navaid['approachPerformance'],
  }));
}

/**
 * Get navaid count from database
 */
export function getNavaidCount(): number {
  const db = getDb();
  const results = db.select().from(navaids).all();
  return results.length;
}

// ============================================================================
// Navaid Query Functions (Efficient SQLite Queries)
// ============================================================================

/**
 * Get a navaid by ID and region (exact match)
 * Uses composite index for fast lookup
 */
export function getNavaidByIdRegion(
  navaidId: string,
  region: string
): { id: string; latitude: number; longitude: number; type: string; region: string } | null {
  const db = getDb();
  const result = db
    .select({
      navaidId: navaids.navaidId,
      lat: navaids.lat,
      lon: navaids.lon,
      type: navaids.type,
      region: navaids.region,
    })
    .from(navaids)
    .where(
      sql`${navaids.navaidId} = ${navaidId.toUpperCase()} AND ${navaids.region} = ${region.toUpperCase()}`
    )
    .get();

  return result
    ? {
        id: result.navaidId,
        latitude: result.lat,
        longitude: result.lon,
        type: result.type,
        region: result.region ?? '',
      }
    : null;
}

/**
 * Get the nearest navaid by ID within a max distance from a point
 * Used as fallback when region doesn't match
 */
export function getNavaidNearestById(
  navaidId: string,
  lat: number,
  lon: number,
  maxDistNm: number
): { id: string; latitude: number; longitude: number; type: string; region: string } | null {
  const db = getDb();

  // Approximate bounding box (1 degree ≈ 60nm)
  const degBuffer = maxDistNm / 60;
  const minLat = lat - degBuffer;
  const maxLat = lat + degBuffer;
  const minLon = lon - degBuffer;
  const maxLon = lon + degBuffer;

  const results = db
    .select({
      navaidId: navaids.navaidId,
      lat: navaids.lat,
      lon: navaids.lon,
      type: navaids.type,
      region: navaids.region,
    })
    .from(navaids)
    .where(
      sql`${navaids.navaidId} = ${navaidId.toUpperCase()}
          AND ${navaids.lat} BETWEEN ${minLat} AND ${maxLat}
          AND ${navaids.lon} BETWEEN ${minLon} AND ${maxLon}`
    )
    .all();

  if (results.length === 0) return null;

  // Find nearest (simple distance calculation)
  let nearest = results[0];
  let nearestDist = Infinity;

  for (const r of results) {
    const dLat = (r.lat - lat) * 60;
    const dLon = (r.lon - lon) * 60 * Math.cos((lat * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = r;
    }
  }

  if (!nearest || nearestDist > maxDistNm) return null;

  return {
    id: nearest.navaidId,
    latitude: nearest.lat,
    longitude: nearest.lon,
    type: nearest.type,
    region: nearest.region ?? '',
  };
}

/**
 * Get the nearest navaid by ID with full enriched data (name, frequency)
 * Used for flight plan waypoint enrichment
 */
export function getNavaidEnrichedById(
  navaidId: string,
  lat: number,
  lon: number,
  maxDistNm: number
): {
  id: string;
  name: string;
  type: string;
  frequency: number;
  region: string;
  latitude: number;
  longitude: number;
} | null {
  const db = getDb();

  // Approximate bounding box (1 degree ≈ 60nm)
  const degBuffer = maxDistNm / 60;
  const minLat = lat - degBuffer;
  const maxLat = lat + degBuffer;
  const minLon = lon - degBuffer;
  const maxLon = lon + degBuffer;

  const results = db
    .select({
      navaidId: navaids.navaidId,
      name: navaids.name,
      lat: navaids.lat,
      lon: navaids.lon,
      type: navaids.type,
      frequency: navaids.frequency,
      region: navaids.region,
    })
    .from(navaids)
    .where(
      sql`${navaids.navaidId} = ${navaidId.toUpperCase()}
          AND ${navaids.lat} BETWEEN ${minLat} AND ${maxLat}
          AND ${navaids.lon} BETWEEN ${minLon} AND ${maxLon}`
    )
    .all();

  if (results.length === 0) return null;

  // Find nearest (simple distance calculation)
  let nearest = results[0];
  let nearestDist = Infinity;

  for (const r of results) {
    const dLat = (r.lat - lat) * 60;
    const dLon = (r.lon - lon) * 60 * Math.cos((lat * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = r;
    }
  }

  if (!nearest || nearestDist > maxDistNm) return null;

  return {
    id: nearest.navaidId,
    name: nearest.name,
    type: nearest.type,
    frequency: nearest.frequency ?? 0,
    region: nearest.region ?? '',
    latitude: nearest.lat,
    longitude: nearest.lon,
  };
}

/**
 * Get navaids within geographic bounds (for viewport display)
 * Optionally filter by type (VOR, NDB, DME, etc.)
 */
export function getNavaidsInBounds(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  types?: string[],
  limit: number = 5000
): Navaid[] {
  const db = getDb();

  const query = db
    .select()
    .from(navaids)
    .where(
      types && types.length > 0
        ? sql`${navaids.lat} BETWEEN ${minLat} AND ${maxLat}
              AND ${navaids.lon} BETWEEN ${minLon} AND ${maxLon}
              AND ${navaids.type} IN (${sql.join(
                types.map((t) => sql`${t}`),
                sql`, `
              )})`
        : sql`${navaids.lat} BETWEEN ${minLat} AND ${maxLat}
              AND ${navaids.lon} BETWEEN ${minLon} AND ${maxLon}`
    )
    .limit(limit);

  const results = query.all();

  return results.map((r) => ({
    id: r.navaidId,
    name: r.name,
    type: r.type as Navaid['type'],
    latitude: r.lat,
    longitude: r.lon,
    elevation: r.elevation ?? 0,
    frequency: r.frequency ?? 0,
    range: r.range ?? 0,
    magneticVariation: r.magneticVariation ?? 0,
    region: r.region ?? '',
    country: r.country ?? '',
    bearing: r.bearing ?? undefined,
    associatedAirport: r.associatedAirport ?? undefined,
    associatedRunway: r.associatedRunway ?? undefined,
    glidepathAngle: r.glidepathAngle ?? undefined,
    course: r.course ?? undefined,
    lengthOffset: r.lengthOffset ?? undefined,
    thresholdCrossingHeight: r.thresholdCrossingHeight ?? undefined,
    refPathIdentifier: r.refPathIdentifier ?? undefined,
    approachPerformance: r.approachPerformance as Navaid['approachPerformance'],
  }));
}

/**
 * Get approach navaids by associated airport (ILS, LOC, GS, markers, etc.)
 */
export function getNavaidsByAirport(airportIcao: string): Navaid[] {
  const db = getDb();
  const results = db
    .select()
    .from(navaids)
    .where(sql`${navaids.associatedAirport} = ${airportIcao.toUpperCase()}`)
    .all();

  return results.map((r) => ({
    id: r.navaidId,
    name: r.name,
    type: r.type as Navaid['type'],
    latitude: r.lat,
    longitude: r.lon,
    elevation: r.elevation ?? 0,
    frequency: r.frequency ?? 0,
    range: r.range ?? 0,
    magneticVariation: r.magneticVariation ?? 0,
    region: r.region ?? '',
    country: r.country ?? '',
    bearing: r.bearing ?? undefined,
    associatedAirport: r.associatedAirport ?? undefined,
    associatedRunway: r.associatedRunway ?? undefined,
    glidepathAngle: r.glidepathAngle ?? undefined,
    course: r.course ?? undefined,
    lengthOffset: r.lengthOffset ?? undefined,
    thresholdCrossingHeight: r.thresholdCrossingHeight ?? undefined,
    refPathIdentifier: r.refPathIdentifier ?? undefined,
    approachPerformance: r.approachPerformance as Navaid['approachPerformance'],
  }));
}

/**
 * Get approach navaids by associated airport and runway
 */
export function getNavaidsByAirportRunway(airportIcao: string, runway: string): Navaid[] {
  const db = getDb();
  const results = db
    .select()
    .from(navaids)
    .where(
      sql`${navaids.associatedAirport} = ${airportIcao.toUpperCase()}
          AND ${navaids.associatedRunway} = ${runway.toUpperCase()}`
    )
    .all();

  return results.map((r) => ({
    id: r.navaidId,
    name: r.name,
    type: r.type as Navaid['type'],
    latitude: r.lat,
    longitude: r.lon,
    elevation: r.elevation ?? 0,
    frequency: r.frequency ?? 0,
    range: r.range ?? 0,
    magneticVariation: r.magneticVariation ?? 0,
    region: r.region ?? '',
    country: r.country ?? '',
    bearing: r.bearing ?? undefined,
    associatedAirport: r.associatedAirport ?? undefined,
    associatedRunway: r.associatedRunway ?? undefined,
    glidepathAngle: r.glidepathAngle ?? undefined,
    course: r.course ?? undefined,
    lengthOffset: r.lengthOffset ?? undefined,
    thresholdCrossingHeight: r.thresholdCrossingHeight ?? undefined,
    refPathIdentifier: r.refPathIdentifier ?? undefined,
    approachPerformance: r.approachPerformance as Navaid['approachPerformance'],
  }));
}

/**
 * Search navaids by ID or name (with limit)
 */
export function searchNavaidsDb(query: string, limit: number = 20): Navaid[] {
  const db = getDb();
  const upperQuery = `%${query.toUpperCase()}%`;
  const results = db
    .select()
    .from(navaids)
    .where(sql`${navaids.navaidId} LIKE ${upperQuery} OR ${navaids.name} LIKE ${upperQuery}`)
    .limit(limit)
    .all();

  return results.map((r) => ({
    id: r.navaidId,
    name: r.name,
    type: r.type as Navaid['type'],
    latitude: r.lat,
    longitude: r.lon,
    elevation: r.elevation ?? 0,
    frequency: r.frequency ?? 0,
    range: r.range ?? 0,
    magneticVariation: r.magneticVariation ?? 0,
    region: r.region ?? '',
    country: r.country ?? '',
    bearing: r.bearing ?? undefined,
    associatedAirport: r.associatedAirport ?? undefined,
    associatedRunway: r.associatedRunway ?? undefined,
    glidepathAngle: r.glidepathAngle ?? undefined,
    course: r.course ?? undefined,
    lengthOffset: r.lengthOffset ?? undefined,
    thresholdCrossingHeight: r.thresholdCrossingHeight ?? undefined,
    refPathIdentifier: r.refPathIdentifier ?? undefined,
    approachPerformance: r.approachPerformance as Navaid['approachPerformance'],
  }));
}

/**
 * Search waypoints by ID (with limit)
 */
export function searchWaypointsDb(query: string, limit: number = 20): Waypoint[] {
  const db = getDb();
  const upperQuery = `%${query.toUpperCase()}%`;
  const results = db
    .select()
    .from(waypoints)
    .where(sql`${waypoints.waypointId} LIKE ${upperQuery}`)
    .limit(limit)
    .all();

  return results.map((r) => ({
    id: r.waypointId,
    latitude: r.lat,
    longitude: r.lon,
    region: r.region,
    areaCode: r.areaCode,
    description: r.description ?? '',
  }));
}

/**
 * Get navaid counts grouped by type
 */
export function getNavaidCountsByType(): Record<string, number> {
  const db = getDb();
  const results = db.select({ type: navaids.type }).from(navaids).all();

  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.type] = (counts[r.type] || 0) + 1;
  }
  return counts;
}

// ============================================================================
// Waypoints Database Operations
// ============================================================================

/**
 * Clear all waypoints from database
 */
export function clearWaypoints(): void {
  const db = getDb();
  db.delete(waypoints).run();
}

/**
 * Batch insert waypoints into database
 */
export function insertWaypoints(waypointList: Waypoint[]): void {
  const db = getDb();

  const waypointArray = waypointList.map((w) => ({
    waypointId: w.id,
    lat: w.latitude,
    lon: w.longitude,
    region: w.region,
    areaCode: w.areaCode,
    description: w.description,
  }));

  // Batch insert in chunks
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < waypointArray.length; i += CHUNK_SIZE) {
    const chunk = waypointArray.slice(i, i + CHUNK_SIZE);
    db.insert(waypoints).values(chunk).run();
  }
}

/**
 * Get all waypoints from database
 */
export function getAllWaypointsFromDb(): Waypoint[] {
  const db = getDb();
  const results = db.select().from(waypoints).all();

  return results.map((r) => ({
    id: r.waypointId,
    latitude: r.lat,
    longitude: r.lon,
    region: r.region,
    areaCode: r.areaCode,
    description: r.description ?? '',
  }));
}

/**
 * Get waypoint count from database
 */
export function getWaypointCount(): number {
  const db = getDb();
  const results = db.select().from(waypoints).all();
  return results.length;
}

// ============================================================================
// Waypoint Query Functions (Efficient SQLite Queries)
// ============================================================================

/**
 * Get a waypoint by ID and region (exact match)
 * Uses composite index for fast lookup
 */
export function getWaypointByIdRegion(
  waypointId: string,
  region: string
): { id: string; latitude: number; longitude: number; region: string } | null {
  const db = getDb();
  const result = db
    .select({
      waypointId: waypoints.waypointId,
      lat: waypoints.lat,
      lon: waypoints.lon,
      region: waypoints.region,
    })
    .from(waypoints)
    .where(
      sql`${waypoints.waypointId} = ${waypointId.toUpperCase()} AND ${waypoints.region} = ${region.toUpperCase()}`
    )
    .get();

  return result
    ? { id: result.waypointId, latitude: result.lat, longitude: result.lon, region: result.region }
    : null;
}

/**
 * Get the nearest waypoint by ID within a max distance from a point
 * Used as fallback when region doesn't match
 */
export function getWaypointNearestById(
  waypointId: string,
  lat: number,
  lon: number,
  maxDistNm: number
): { id: string; latitude: number; longitude: number; region: string } | null {
  const db = getDb();

  // Approximate bounding box (1 degree ≈ 60nm)
  const degBuffer = maxDistNm / 60;
  const minLat = lat - degBuffer;
  const maxLat = lat + degBuffer;
  const minLon = lon - degBuffer;
  const maxLon = lon + degBuffer;

  const results = db
    .select({
      waypointId: waypoints.waypointId,
      lat: waypoints.lat,
      lon: waypoints.lon,
      region: waypoints.region,
    })
    .from(waypoints)
    .where(
      sql`${waypoints.waypointId} = ${waypointId.toUpperCase()}
          AND ${waypoints.lat} BETWEEN ${minLat} AND ${maxLat}
          AND ${waypoints.lon} BETWEEN ${minLon} AND ${maxLon}`
    )
    .all();

  if (results.length === 0) return null;

  // Find nearest (simple distance calculation)
  let nearest = results[0];
  let nearestDist = Infinity;

  for (const r of results) {
    const dLat = (r.lat - lat) * 60;
    const dLon = (r.lon - lon) * 60 * Math.cos((lat * Math.PI) / 180);
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = r;
    }
  }

  if (!nearest || nearestDist > maxDistNm) return null;

  return {
    id: nearest.waypointId,
    latitude: nearest.lat,
    longitude: nearest.lon,
    region: nearest.region,
  };
}

/**
 * Get waypoints within geographic bounds (for viewport display)
 */
export function getWaypointsInBounds(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  limit: number = 5000
): Waypoint[] {
  const db = getDb();
  const results = db
    .select()
    .from(waypoints)
    .where(
      sql`${waypoints.lat} BETWEEN ${minLat} AND ${maxLat}
          AND ${waypoints.lon} BETWEEN ${minLon} AND ${maxLon}`
    )
    .limit(limit)
    .all();

  return results.map((r) => ({
    id: r.waypointId,
    latitude: r.lat,
    longitude: r.lon,
    region: r.region,
    areaCode: r.areaCode,
    description: r.description ?? '',
  }));
}

// ============================================================================
// Airways Database Operations
// ============================================================================

/**
 * Clear all airways from database
 */
export function clearAirways(): void {
  const db = getDb();
  db.delete(airways).run();
}

/**
 * Batch insert airways into database
 */
export function insertAirways(airwayList: AirwaySegment[]): void {
  const db = getDb();

  const airwayArray = airwayList.map((a) => ({
    name: a.name,
    fromFix: a.fromFix,
    fromRegion: a.fromRegion,
    fromNavaidType: a.fromNavaidType,
    toFix: a.toFix,
    toRegion: a.toRegion,
    toNavaidType: a.toNavaidType,
    isHigh: a.isHigh,
    baseFl: a.baseFl,
    topFl: a.topFl,
    direction: a.direction,
  }));

  // Batch insert in chunks
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < airwayArray.length; i += CHUNK_SIZE) {
    const chunk = airwayArray.slice(i, i + CHUNK_SIZE);
    db.insert(airways).values(chunk).run();
  }
}

/**
 * Get all airways from database
 */
export function getAllAirwaysFromDb(): AirwaySegment[] {
  const db = getDb();
  const results = db.select().from(airways).all();

  return results.map((r) => ({
    name: r.name,
    fromFix: r.fromFix,
    fromRegion: r.fromRegion,
    fromNavaidType: r.fromNavaidType as FixTypeNumber,
    toFix: r.toFix,
    toRegion: r.toRegion,
    toNavaidType: r.toNavaidType as FixTypeNumber,
    isHigh: r.isHigh,
    baseFl: r.baseFl,
    topFl: r.topFl,
    direction: r.direction as AirwayDirection,
  }));
}

/**
 * Get airway count from database
 */
export function getAirwayCount(): number {
  const db = getDb();
  const results = db.select().from(airways).all();
  return results.length;
}

/**
 * Get airway segments by name (for flight plan route expansion)
 * Returns all segments of a specific airway
 */
export function getAirwaysByName(airwayName: string): AirwaySegment[] {
  const db = getDb();
  const results = db
    .select()
    .from(airways)
    .where(sql`${airways.name} = ${airwayName.toUpperCase()}`)
    .all();

  return results.map((r) => ({
    name: r.name,
    fromFix: r.fromFix,
    fromRegion: r.fromRegion,
    fromNavaidType: r.fromNavaidType as FixTypeNumber,
    toFix: r.toFix,
    toRegion: r.toRegion,
    toNavaidType: r.toNavaidType as FixTypeNumber,
    isHigh: r.isHigh,
    baseFl: r.baseFl,
    topFl: r.topFl,
    direction: r.direction as AirwayDirection,
  }));
}

// ============================================================================
// Airspaces Database Operations
// ============================================================================

/**
 * Clear all airspaces from database
 */
export function clearAirspaces(): void {
  const db = getDb();
  db.delete(airspaces).run();
}

/**
 * Calculate bounding box for airspace coordinates
 */
function calculateAirspaceBounds(
  coordinates: [number, number][]
): { minLat: number; maxLat: number; minLon: number; maxLon: number } | null {
  if (coordinates.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const [lon, lat] of coordinates) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }

  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Batch insert airspaces into database
 * Calculates and stores bounding box for efficient spatial queries
 */
export function insertAirspaces(airspaceList: Airspace[]): void {
  const db = getDb();

  const airspaceArray = airspaceList.map((a) => {
    const bounds = calculateAirspaceBounds(a.coordinates);
    return {
      name: a.name,
      airspaceClass: a.class,
      upperLimit: a.upperLimit,
      lowerLimit: a.lowerLimit,
      coordinates: JSON.stringify(a.coordinates),
      minLat: bounds?.minLat,
      maxLat: bounds?.maxLat,
      minLon: bounds?.minLon,
      maxLon: bounds?.maxLon,
    };
  });

  // Batch insert in chunks
  const CHUNK_SIZE = 500;
  for (let i = 0; i < airspaceArray.length; i += CHUNK_SIZE) {
    const chunk = airspaceArray.slice(i, i + CHUNK_SIZE);
    db.insert(airspaces).values(chunk).run();
  }
}

/**
 * Get all airspaces from database
 */
export function getAllAirspacesFromDb(): Airspace[] {
  const db = getDb();
  const results = db.select().from(airspaces).all();

  return results.map((r) => ({
    name: r.name,
    class: r.airspaceClass as AirspaceClass,
    upperLimit: r.upperLimit ?? '',
    lowerLimit: r.lowerLimit ?? '',
    coordinates: JSON.parse(r.coordinates) as [number, number][],
  }));
}

/**
 * Get airspace count from database
 */
export function getAirspaceCount(): number {
  const db = getDb();
  const results = db.select().from(airspaces).all();
  return results.length;
}

/**
 * Get airspaces that intersect with a geographic bounding box
 * Uses stored bounding box for efficient SQLite query (consistent with navaids/waypoints)
 */
export function getAirspacesInBounds(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  limit: number = 1000
): Airspace[] {
  const db = getDb();

  // Query airspaces where bounding boxes overlap
  // An airspace's bbox overlaps query bbox if:
  // airspace.minLat <= query.maxLat AND airspace.maxLat >= query.minLat
  // AND airspace.minLon <= query.maxLon AND airspace.maxLon >= query.minLon
  const results = db
    .select()
    .from(airspaces)
    .where(
      sql`${airspaces.minLat} <= ${maxLat}
          AND ${airspaces.maxLat} >= ${minLat}
          AND ${airspaces.minLon} <= ${maxLon}
          AND ${airspaces.maxLon} >= ${minLon}`
    )
    .limit(limit)
    .all();

  return results.map((r) => ({
    name: r.name,
    class: r.airspaceClass as AirspaceClass,
    upperLimit: r.upperLimit ?? '',
    lowerLimit: r.lowerLimit ?? '',
    coordinates: JSON.parse(r.coordinates) as [number, number][],
  }));
}

/**
 * Get airspaces near a point (radius-based query using bounding box)
 * Consistent with getNavaidsInRadius pattern
 */
export function getAirspacesNearPoint(
  lat: number,
  lon: number,
  radiusNm: number = 50,
  limit: number = 1000
): Airspace[] {
  // Convert radius to bounding box (1 degree ≈ 60nm)
  const degBuffer = radiusNm / 60;
  const minLat = lat - degBuffer;
  const maxLat = lat + degBuffer;
  const minLon = lon - degBuffer;
  const maxLon = lon + degBuffer;

  return getAirspacesInBounds(minLat, maxLat, minLon, maxLon, limit);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Save database to disk
 */
export function persistNavDatabase(): void {
  saveDb();
}

/**
 * Clear all nav data from database
 */
export function clearAllNavData(): void {
  const db = getDb();
  db.delete(navaids).run();
  db.delete(waypoints).run();
  db.delete(airways).run();
  db.delete(airspaces).run();
  db.delete(navFileMeta).run();
}

/**
 * Log cache status for debugging
 */
export function logNavCacheStatus(): void {
  logger.data.info(
    `Nav cache status: ${getNavaidCount()} navaids, ${getWaypointCount()} waypoints, ${getAirwayCount()} airways, ${getAirspaceCount()} airspaces`
  );
}

// ============================================================================
// SQL-Based Procedure Coordinate Resolver
// ============================================================================

/**
 * Runway end data for resolving runway waypoints (RW09, RW27L, etc.)
 */
export interface RunwayEndData {
  name: string;
  latitude: number;
  longitude: number;
}

export interface SqlResolverOptions {
  /** Airport coordinates for proximity-based fallback */
  airportLat?: number;
  airportLon?: number;
  /** Maximum distance in nm for fallback matching (default: 500nm) */
  maxFallbackDistanceNm?: number;
  /** Runway ends for resolving runway waypoints (RW09, RW27L, etc.) */
  runwayEnds?: RunwayEndData[];
}

/**
 * Create a procedure coordinate resolver that queries SQLite directly
 * instead of building in-memory maps. Much more memory efficient for
 * large datasets (200k+ waypoints, 50k+ navaids).
 *
 * @param options - Optional airport location for proximity fallback
 * @returns CoordResolver function that queries SQLite on each call
 */
export function createSqlCoordResolver(options?: SqlResolverOptions): CoordResolver {
  const airportLat = options?.airportLat;
  const airportLon = options?.airportLon;
  const maxFallbackDistance = options?.maxFallbackDistanceNm ?? 500;
  const runwayEnds = options?.runwayEnds;

  // Build runway end lookup map if runway data provided
  const runwayEndMap = new Map<string, RunwayEndData>();
  if (runwayEnds) {
    for (const end of runwayEnds) {
      // Store both with and without leading zeros for flexibility
      // RW09, RW9, RW09L, RW9L all map to the same end
      runwayEndMap.set(end.name.toUpperCase(), end);
    }
  }

  /**
   * Resolve runway waypoint from airport runway data
   * Handles formats like RW09, RW27L, RW09R, RW27C
   */
  function resolveRunwayWaypoint(fixId: string): Coordinates | null {
    if (runwayEnds === undefined || runwayEnds.length === 0) return null;

    // Parse runway waypoint: RW + 2 digits + optional L/C/R
    const match = fixId.match(/^RW(\d{2})([LCR])?$/i);
    if (!match) return null;

    const runwayNumber = match[1];
    const suffix = match[2]?.toUpperCase() || '';
    const searchName = `${runwayNumber}${suffix}`;

    // Try exact match first
    const exactMatch = runwayEndMap.get(searchName);
    if (exactMatch) {
      return { latitude: exactMatch.latitude, longitude: exactMatch.longitude };
    }

    // Try without leading zero (e.g., "9" instead of "09")
    const noLeadingZero = runwayNumber.replace(/^0/, '') + suffix;
    const noZeroMatch = runwayEndMap.get(noLeadingZero);
    if (noZeroMatch) {
      return { latitude: noZeroMatch.latitude, longitude: noZeroMatch.longitude };
    }

    return null;
  }

  return (fixId: string, region: string, type: FixTypeCode): Coordinates | null => {
    const upperFixId = fixId.toUpperCase();
    const upperRegion = region.toUpperCase();

    // Runway waypoints (RW09, RW27L, etc.) - resolve from airport runway data
    if (upperFixId.startsWith('RW') && /^RW\d{2}[LRC]?$/.test(upperFixId)) {
      return resolveRunwayWaypoint(upperFixId);
    }

    // Fix type determines where to look first
    // V = VOR, N = NDB, D = DME
    if (type === 'V' || type === 'N' || type === 'D') {
      // VOR, NDB, or DME - look in navaids first (region-matched)
      const nav = getNavaidByIdRegion(upperFixId, upperRegion);
      if (nav) {
        return { latitude: nav.latitude, longitude: nav.longitude };
      }

      // Proximity-based fallback for navaids
      if (airportLat !== undefined && airportLon !== undefined) {
        const nearestNav = getNavaidNearestById(
          upperFixId,
          airportLat,
          airportLon,
          maxFallbackDistance
        );
        if (nearestNav) {
          return { latitude: nearestNav.latitude, longitude: nearestNav.longitude };
        }
      }
    }

    // Try waypoints with region match first
    const wp = getWaypointByIdRegion(upperFixId, upperRegion);
    if (wp) {
      return { latitude: wp.latitude, longitude: wp.longitude };
    }

    // Proximity-based fallback: find nearest waypoint within max distance
    if (airportLat !== undefined && airportLon !== undefined) {
      const nearestWp = getWaypointNearestById(
        upperFixId,
        airportLat,
        airportLon,
        maxFallbackDistance
      );
      if (nearestWp) {
        return { latitude: nearestWp.latitude, longitude: nearestWp.longitude };
      }
    }

    // Try navaids with region match
    const nav = getNavaidByIdRegion(upperFixId, upperRegion);
    if (nav) {
      return { latitude: nav.latitude, longitude: nav.longitude };
    }

    // Proximity-based fallback for navaids
    if (airportLat !== undefined && airportLon !== undefined) {
      const nearestNav = getNavaidNearestById(
        upperFixId,
        airportLat,
        airportLon,
        maxFallbackDistance
      );
      if (nearestNav) {
        return { latitude: nearestNav.latitude, longitude: nearestNav.longitude };
      }
    }

    return null;
  };
}

/**
 * Resolve a single fix ID to coordinates using SQLite queries
 * Convenience function for one-off lookups (flight plan entry, etc.)
 */
export function resolveFixCoordinates(
  fixId: string,
  region: string,
  type: FixTypeCode,
  airportLat?: number,
  airportLon?: number
): Coordinates | null {
  const resolver = createSqlCoordResolver({
    airportLat,
    airportLon,
    maxFallbackDistanceNm: 500,
  });
  return resolver(fixId, region, type);
}
