/**
 * Navigation Data Cache
 * SQLite caching for parsed navigation data (navaids, waypoints, airways, airspaces).
 * Tracks file modification times to invalidate cache when data files change.
 */
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import { airspaces, airways, getDb, navFileMeta, navaids, saveDb, waypoints } from '@/lib/db';
import logger from '@/lib/utils/logger';
import type { Airspace, AirwaySegment, Navaid, Waypoint } from '@/types/navigation';

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
    fromNavaidType: r.fromNavaidType,
    toFix: r.toFix,
    toRegion: r.toRegion,
    toNavaidType: r.toNavaidType,
    isHigh: r.isHigh,
    baseFl: r.baseFl,
    topFl: r.topFl,
    direction: r.direction,
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
 * Batch insert airspaces into database
 */
export function insertAirspaces(airspaceList: Airspace[]): void {
  const db = getDb();

  const airspaceArray = airspaceList.map((a) => ({
    name: a.name,
    airspaceClass: a.class,
    upperLimit: a.upperLimit,
    lowerLimit: a.lowerLimit,
    coordinates: JSON.stringify(a.coordinates),
  }));

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
    class: r.airspaceClass,
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
