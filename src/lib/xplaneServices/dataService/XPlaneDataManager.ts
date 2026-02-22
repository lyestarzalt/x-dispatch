/**
 * X-Plane Data Manager
 * Unified manager for all X-Plane navigation and airport data
 */
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import { airports, aptFileMeta, closeDb, getDb } from '@/lib/db';
import { parseCIFP } from '@/lib/parsers/nav/cifpParser';
import {
  ResolvedAirportProcedures,
  enrichProceduresWithCoordinates,
} from '@/lib/parsers/nav/procedureCoordResolver';
import { distanceNm } from '@/lib/utils/geomath';
import logger from '@/lib/utils/logger';
import type { AirwaySegmentWithCoords } from '@/types/navigation';
import type {
  ATCController,
  ATCRole,
  AirportMetadata,
  Airspace,
  HoldingPattern,
  Navaid,
  NavaidType,
  Waypoint,
} from '@/types/navigation';
import {
  getAllAirports as getAllAirportsFromDb,
  getCustomSceneryAptFiles,
  loadAirports,
} from './airports';
import { getXPlanePath, setXPlanePath } from './config';
import { NavDataSources, detectAllDataSources } from './cycleInfo';
import {
  loadATCData,
  loadAirportMetadata,
  loadAirspaces,
  loadAirways,
  loadHoldingPatterns,
  loadNavaids,
  loadWaypoints,
} from './navdata';
import {
  createSqlCoordResolver,
  getAirspaceCount,
  getAirspacesNearPoint as getAirspacesNearPointSql,
  getAirwayCount,
  getAirwaysByName,
  getAllAirspacesFromDb,
  getNavaidByIdRegion,
  getNavaidCount,
  getNavaidCountsByType,
  getNavaidNearestById,
  getNavaidsByAirport,
  getNavaidsByAirportRunway,
  getNavaidsInBounds,
  getWaypointByIdRegion,
  getWaypointCount,
  getWaypointNearestById,
  getWaypointsInBounds,
  searchNavaidsDb,
  searchWaypointsDb,
} from './navdata/navCache';
import {
  detectXPlanePaths,
  getAirspaceDataPath,
  getAirwayDataPath,
  getAptDataPath,
  getAptMetaDataPath,
  getAtcDataPath,
  getCifpPath,
  getFixDataPath,
  getHoldDataPath,
  getNavDataPath,
  validateXPlanePath,
} from './paths';
import type { Airport, AirportSourceBreakdown, DataLoadStatus, LoadStatusFlags } from './types';

export type { Airport, AirportSourceBreakdown, DataLoadStatus } from './types';
export type { AirwaySegmentWithCoords } from '@/types/navigation';

export class XPlaneDataManager {
  private xplanePath: string | null = null;

  // In-memory data stores (small datasets that need complex filtering)
  // NOTE: navaids, waypoints, airspaces, and airways are now queried directly from SQLite
  private atcControllers: ATCController[] = [];
  private holdingPatterns: HoldingPattern[] = [];
  private airportMetadata: Map<string, AirportMetadata> = new Map();

  // Data sources info
  private dataSources: NavDataSources | null = null;

  private loadStatus: LoadStatusFlags = {
    airports: false,
    navaids: false,
    waypoints: false,
    airspaces: false,
    airways: false,
    atc: false,
    holds: false,
    aptMeta: false,
  };

  // Track airport source breakdown
  private airportSourceCounts: AirportSourceBreakdown = {
    globalAirports: 0,
    customScenery: 0,
    customSceneryPacks: 0,
  };

  constructor() {
    getDb();
  }

  /**
   * Initialize from SQLite cache (call on app start when setup is complete)
   * All nav data is now queried directly from SQLite
   */
  initFromCache(): void {
    const xplanePath = this.getXPlanePath();

    // Detect data sources (Navigraph vs X-Plane default)
    // This is needed even when loading from cache to show correct source in settings
    if (xplanePath) {
      this.dataSources = detectAllDataSources(xplanePath);
      logger.data.info(
        `Data sources: ${this.dataSources.global.source}${this.dataSources.global.cycle ? ` (AIRAC ${this.dataSources.global.cycle})` : ''}`
      );
    }

    // Check cache status for load flags (all data queried from SQLite on-demand)
    const airspaceCount = getAirspaceCount();
    if (airspaceCount > 0) {
      this.loadStatus.airspaces = true;
    }

    const airwayCount = getAirwayCount();
    if (airwayCount > 0) {
      this.loadStatus.airways = true;
    }

    logger.data.info(
      `Cache status: ${airspaceCount} airspaces, ${airwayCount} airways (queried from SQLite)`
    );
  }

  /**
   * Get or auto-detect X-Plane path
   */
  getXPlanePath(): string | null {
    if (this.xplanePath) return this.xplanePath;

    const configPath = getXPlanePath();
    if (configPath) {
      this.xplanePath = configPath;
    }

    return this.xplanePath;
  }

  /**
   * Set X-Plane installation path
   */
  setXPlanePath(xplanePath: string): { success: boolean; errors: string[] } {
    const result = setXPlanePath(xplanePath);
    if (result.success) {
      this.xplanePath = xplanePath;
    }
    return result;
  }

  /**
   * Validate X-Plane path
   */
  validatePath(xplanePath: string): { valid: boolean; errors: string[] } {
    return validateXPlanePath(xplanePath);
  }

  /**
   * Auto-detect X-Plane installations
   */
  detectInstallations(): string[] {
    return detectXPlanePaths();
  }

  /**
   * Detect and store data sources (Navigraph vs X-Plane default)
   */
  detectDataSources(xplanePath: string): void {
    this.xplanePath = xplanePath;
    this.dataSources = detectAllDataSources(xplanePath);
  }

  /**
   * Load all data from X-Plane installation
   */
  async loadAll(xplanePath?: string): Promise<DataLoadStatus> {
    const pathToUse = xplanePath || this.getXPlanePath();

    if (!pathToUse) {
      throw new Error('X-Plane path not configured. Use setXPlanePath() first.');
    }

    const validation = validateXPlanePath(pathToUse);
    if (!validation.valid) {
      throw new Error(`Invalid X-Plane path: ${validation.errors.join(', ')}`);
    }

    this.xplanePath = pathToUse;

    // Detect data sources first
    this.dataSources = detectAllDataSources(pathToUse);

    const startTime = Date.now();
    logger.data.info(`Loading X-Plane data from: ${pathToUse}`);

    // Load all data in parallel (core data)
    const results = await Promise.allSettled([
      this.loadAirportsInternal(pathToUse),
      this.loadNavaidsInternal(pathToUse),
      this.loadWaypointsInternal(pathToUse),
      this.loadAirspacesInternal(pathToUse),
      this.loadAirwaysInternal(pathToUse),
    ]);

    // Log any failures
    const names = ['airports', 'navaids', 'waypoints', 'airspaces', 'airways'];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.data.warn(`Failed to load ${names[index]}: ${result.reason}`);
      }
    });

    // Load optional/new data types (non-blocking)
    await Promise.allSettled([
      this.loadATCDataInternal(pathToUse),
      this.loadHoldingPatternsInternal(pathToUse),
      this.loadAirportMetadataInternal(pathToUse),
    ]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const status = this.getStatus();
    logger.data.info(
      `Loaded in ${elapsed}s: ${status.airports.count} airports, ${status.navaids.count} navaids, ${status.waypoints.count} waypoints`
    );

    return status;
  }

  // ==================== Internal Load Methods ====================

  private async loadAirportsInternal(xplanePath: string): Promise<void> {
    const result = await loadAirports(xplanePath);
    this.airportSourceCounts = result.breakdown;
    this.loadStatus.airports = true;
  }

  private async loadNavaidsInternal(xplanePath: string): Promise<void> {
    const result = await loadNavaids(xplanePath);
    // Data is stored in SQLite, no need to keep in memory
    this.loadStatus.navaids = result.loaded;
  }

  private async loadWaypointsInternal(xplanePath: string): Promise<void> {
    const result = await loadWaypoints(xplanePath);
    // Data is stored in SQLite, no need to keep in memory
    this.loadStatus.waypoints = result.loaded;
  }

  private async loadAirspacesInternal(xplanePath: string): Promise<void> {
    const result = await loadAirspaces(xplanePath);
    // Airspaces are stored in SQLite, queried directly (consistent with navaids/waypoints)
    this.loadStatus.airspaces = result.loaded;
    logger.data.info(`Loaded ${result.data.length} airspaces to SQLite`);
  }

  private async loadAirwaysInternal(xplanePath: string): Promise<void> {
    const result = await loadAirways(xplanePath);
    // Airways are stored in SQLite, queried on-demand for flight plans
    this.loadStatus.airways = result.loaded;
    logger.data.info(`Loaded ${result.data.length} airways to SQLite`);
  }

  private async loadATCDataInternal(xplanePath: string): Promise<void> {
    const result = await loadATCData(xplanePath);
    this.atcControllers = result.data;
    this.loadStatus.atc = result.loaded;
  }

  private async loadHoldingPatternsInternal(xplanePath: string): Promise<void> {
    const result = await loadHoldingPatterns(xplanePath);
    this.holdingPatterns = result.data;
    this.loadStatus.holds = result.loaded;
  }

  private async loadAirportMetadataInternal(xplanePath: string): Promise<void> {
    const result = await loadAirportMetadata(xplanePath);
    this.airportMetadata = result.data;
    this.loadStatus.aptMeta = result.loaded;
  }

  // ==================== Public Individual Load Methods ====================

  async loadAirportsOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadAirportsInternal(pathToUse);
  }

  async loadNavaidsOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadNavaidsInternal(pathToUse);
  }

  async loadWaypointsOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadWaypointsInternal(pathToUse);
  }

  async loadAirspacesOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadAirspacesInternal(pathToUse);
  }

  async loadAirwaysOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadAirwaysInternal(pathToUse);
  }

  async loadATCDataOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadATCDataInternal(pathToUse);
  }

  async loadHoldingPatternsOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadHoldingPatternsInternal(pathToUse);
  }

  async loadAirportMetadataOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadAirportMetadataInternal(pathToUse);
  }

  // ==================== Query Methods ====================

  /**
   * Get all airports using database
   */
  getAllAirports(): Airport[] {
    return getAllAirportsFromDb();
  }

  /**
   * Get airport data by ICAO
   */
  getAirportData(icao: string): string | null {
    const db = getDb();
    const result = db
      .select({ data: airports.data })
      .from(airports)
      .where(eq(airports.icao, icao))
      .get();

    return result?.data || null;
  }

  /**
   * Get airport coordinates by ICAO
   */
  getAirportCoordinates(icao: string): { lat: number; lon: number } | null {
    const db = getDb();
    const result = db
      .select({ lat: airports.lat, lon: airports.lon })
      .from(airports)
      .where(eq(airports.icao, icao.toUpperCase()))
      .get();

    return result ? { lat: result.lat, lon: result.lon } : null;
  }

  /**
   * Get airport procedures (CIFP) with resolved coordinates
   * Uses SQL-based coordinate resolver for memory efficiency
   */
  getAirportProcedures(icao: string): ResolvedAirportProcedures | null {
    const xplanePath = this.getXPlanePath();
    if (!xplanePath) return null;

    const cifpPath = getCifpPath(xplanePath, icao);
    if (!fs.existsSync(cifpPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(cifpPath, 'utf-8');
      const procedures = parseCIFP(content, icao);

      // Get airport coordinates for proximity-based fallback
      const airportCoords = this.getAirportCoordinates(icao);

      // Create SQL-based resolver (queries SQLite directly, no memory arrays)
      const resolver = createSqlCoordResolver({
        airportLat: airportCoords?.lat,
        airportLon: airportCoords?.lon,
        maxFallbackDistanceNm: 500,
      });

      // Enrich procedures with resolved coordinates
      const enriched = enrichProceduresWithCoordinates(procedures, resolver);

      // Log resolution stats for debugging
      let total = 0;
      let resolved = 0;
      const countProcs = (procs: typeof enriched.sids) => {
        for (const p of procs) {
          for (const wp of p.waypoints) {
            total++;
            if (wp.resolved) resolved++;
          }
        }
      };
      countProcs(enriched.sids);
      countProcs(enriched.stars);
      countProcs(enriched.approaches);

      if (total > 0) {
        logger.debug(
          `Procedures for ${icao}: ${resolved}/${total} waypoints resolved (${Math.round((100 * resolved) / total)}%)`
        );
      }

      return enriched;
    } catch (err) {
      logger.error(`Failed to load procedures for ${icao}`, err);
      return null;
    }
  }

  /**
   * Get navaids within radius (uses SQLite bounds query)
   */
  getNavaidsInRadius(lat: number, lon: number, radiusNm: number, types?: NavaidType[]): Navaid[] {
    // Convert radius to bounds (1 degree ≈ 60nm)
    const degBuffer = radiusNm / 60;
    const minLat = lat - degBuffer;
    const maxLat = lat + degBuffer;
    const minLon = lon - degBuffer;
    const maxLon = lon + degBuffer;

    // Query SQLite with bounds
    const results = getNavaidsInBounds(minLat, maxLat, minLon, maxLon, types);

    // Filter by actual distance (bounds is a square, we want a circle)
    return results.filter((n) => distanceNm(lat, lon, n.latitude, n.longitude) <= radiusNm);
  }

  /**
   * Get VORs within radius
   */
  getVORsInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['VOR', 'VORTAC', 'VOR-DME']);
  }

  /**
   * Get NDBs within radius
   */
  getNDBsInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['NDB']);
  }

  /**
   * Get DMEs within radius
   */
  getDMEsInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['DME', 'TACAN']);
  }

  /**
   * Get ILS/LOC within radius
   */
  getILSInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['ILS', 'LOC']);
  }

  /**
   * Get glideslopes within radius
   */
  getGlideSlopesInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['GS']);
  }

  /**
   * Get markers within radius
   */
  getMarkersInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['OM', 'MM', 'IM']);
  }

  /**
   * Get all ILS components within radius
   */
  getILSComponentsInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['ILS', 'LOC', 'GS', 'OM', 'MM', 'IM']);
  }

  /**
   * Get approach aids within radius
   */
  getApproachAidsInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['FPAP', 'GLS', 'LTP', 'FTP']);
  }

  /**
   * Get approach navaids by airport (uses SQLite query)
   */
  getApproachNavaidsByAirport(airportIcao: string): Navaid[] {
    return getNavaidsByAirport(airportIcao);
  }

  /**
   * Get approach navaids by runway (uses SQLite query)
   */
  getApproachNavaidsByRunway(airportIcao: string, runway: string): Navaid[] {
    return getNavaidsByAirportRunway(airportIcao, runway);
  }

  /**
   * Get waypoints within radius (uses SQLite bounds query)
   */
  getWaypointsInRadius(lat: number, lon: number, radiusNm: number): Waypoint[] {
    // Convert radius to bounds (1 degree ≈ 60nm)
    const degBuffer = radiusNm / 60;
    const minLat = lat - degBuffer;
    const maxLat = lat + degBuffer;
    const minLon = lon - degBuffer;
    const maxLon = lon + degBuffer;

    // Query SQLite with bounds
    const results = getWaypointsInBounds(minLat, maxLat, minLon, maxLon);

    // Filter by actual distance (bounds is a square, we want a circle)
    return results.filter((w) => distanceNm(lat, lon, w.latitude, w.longitude) <= radiusNm);
  }

  // ==========================================================================
  // Bounds-Based Queries (SQLite Direct - More Efficient)
  // ==========================================================================

  /**
   * Get navaids within geographic bounds (uses SQLite directly)
   * Much more efficient than loading all into memory
   */
  getNavaidsInBoundsSql(
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
    types?: string[],
    limit?: number
  ): Navaid[] {
    return getNavaidsInBounds(minLat, maxLat, minLon, maxLon, types, limit);
  }

  /**
   * Get waypoints within geographic bounds (uses SQLite directly)
   */
  getWaypointsInBoundsSql(
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
    limit?: number
  ): Waypoint[] {
    return getWaypointsInBounds(minLat, maxLat, minLon, maxLon, limit);
  }

  /**
   * Resolve a waypoint ID to coordinates using SQLite
   * For flight plan entry - no need to load all waypoints
   */
  resolveWaypointCoords(
    waypointId: string,
    region?: string,
    airportLat?: number,
    airportLon?: number
  ): { latitude: number; longitude: number } | null {
    // Try exact match with region if provided
    if (region) {
      const exact = getWaypointByIdRegion(waypointId, region);
      if (exact) return { latitude: exact.latitude, longitude: exact.longitude };
    }

    // Fallback: find nearest to airport if coords provided
    if (airportLat !== undefined && airportLon !== undefined) {
      const nearest = getWaypointNearestById(waypointId, airportLat, airportLon, 500);
      if (nearest) return { latitude: nearest.latitude, longitude: nearest.longitude };
    }

    return null;
  }

  /**
   * Resolve a navaid ID to coordinates using SQLite
   */
  resolveNavaidCoords(
    navaidId: string,
    region?: string,
    airportLat?: number,
    airportLon?: number
  ): { latitude: number; longitude: number; type: string } | null {
    // Try exact match with region if provided
    if (region) {
      const exact = getNavaidByIdRegion(navaidId, region);
      if (exact) return { latitude: exact.latitude, longitude: exact.longitude, type: exact.type };
    }

    // Fallback: find nearest to airport if coords provided
    if (airportLat !== undefined && airportLon !== undefined) {
      const nearest = getNavaidNearestById(navaidId, airportLat, airportLon, 500);
      if (nearest)
        return { latitude: nearest.latitude, longitude: nearest.longitude, type: nearest.type };
    }

    return null;
  }

  /**
   * Create a SQL-based procedure coord resolver
   * Use this instead of the in-memory resolver for better memory efficiency
   */
  createSqlCoordResolver(airportLat?: number, airportLon?: number) {
    return createSqlCoordResolver({ airportLat, airportLon, maxFallbackDistanceNm: 500 });
  }

  /**
   * Get all airspaces (uses SQLite query)
   */
  getAllAirspaces(): Airspace[] {
    return getAllAirspacesFromDb();
  }

  /**
   * Get airspaces near a point (uses SQLite bounds query)
   * Consistent with getNavaidsInRadius pattern
   */
  getAirspacesNearPoint(lat: number, lon: number, radiusNm = 50): Airspace[] {
    return getAirspacesNearPointSql(lat, lon, radiusNm);
  }

  /**
   * Get airway segments by name (for flight plan route expansion)
   * Queries SQLite directly, resolves coordinates for each segment
   */
  getAirwaySegments(airwayName: string): AirwaySegmentWithCoords[] {
    const segments = getAirwaysByName(airwayName);
    const results: AirwaySegmentWithCoords[] = [];

    for (const segment of segments) {
      const fromCoords = this.resolveFixCoordsSql(segment.fromFix, segment.fromRegion);
      const toCoords = this.resolveFixCoordsSql(segment.toFix, segment.toRegion);

      if (!fromCoords || !toCoords) continue;

      results.push({
        name: segment.name,
        fromFix: segment.fromFix,
        toFix: segment.toFix,
        fromLat: fromCoords.lat,
        fromLon: fromCoords.lon,
        toLat: toCoords.lat,
        toLon: toCoords.lon,
        isHigh: segment.isHigh,
        baseFl: segment.baseFl,
        topFl: segment.topFl,
      });
    }

    return results;
  }

  /**
   * Resolve a fix ID to coordinates using SQL queries
   * Used for airway and holding pattern coordinate resolution
   */
  private resolveFixCoordsSql(
    fixId: string,
    fixRegion: string
  ): { lat: number; lon: number } | null {
    // Try waypoint first (most fixes are waypoints)
    const wp = getWaypointByIdRegion(fixId, fixRegion);
    if (wp) return { lat: wp.latitude, lon: wp.longitude };

    // Try navaid
    const nav = getNavaidByIdRegion(fixId, fixRegion);
    if (nav) return { lat: nav.latitude, lon: nav.longitude };

    // Fallback: try without region (less specific)
    const wpAny = getWaypointNearestById(fixId, 0, 0, 99999);
    if (wpAny) return { lat: wpAny.latitude, lon: wpAny.longitude };

    const navAny = getNavaidNearestById(fixId, 0, 0, 99999);
    if (navAny) return { lat: navAny.latitude, lon: navAny.longitude };

    return null;
  }

  // ==================== ATC & Holdings Query Methods ====================

  /**
   * Get ATC controller by facility ID
   */
  getATCByFacility(facilityId: string): ATCController | null {
    return (
      this.atcControllers.find((c) => c.facilityId.toUpperCase() === facilityId.toUpperCase()) ||
      null
    );
  }

  /**
   * Get ATC controllers by role
   */
  getATCByRole(role: ATCRole): ATCController[] {
    return this.atcControllers.filter((c) => c.role === role);
  }

  /**
   * Get all ATC controllers
   */
  getAllATCControllers(): ATCController[] {
    return this.atcControllers;
  }

  /**
   * Search ATC controllers
   */
  searchATCControllers(query: string): ATCController[] {
    const upperQuery = query.toUpperCase();
    return this.atcControllers.filter(
      (c) =>
        c.name.toUpperCase().includes(upperQuery) || c.facilityId.toUpperCase().includes(upperQuery)
    );
  }

  /**
   * Get holding patterns for a fix
   */
  getHoldingPatternsForFix(fixId: string): HoldingPattern[] {
    const upperFixId = fixId.toUpperCase();
    return this.holdingPatterns.filter((p) => p.fixId.toUpperCase() === upperFixId);
  }

  /**
   * Get holding patterns for an airport
   */
  getHoldingPatternsForAirport(icao: string): HoldingPattern[] {
    const upperIcao = icao.toUpperCase();
    return this.holdingPatterns.filter((p) => p.airport.toUpperCase() === upperIcao);
  }

  /**
   * Get all holding patterns
   */
  getAllHoldingPatterns(): HoldingPattern[] {
    return this.holdingPatterns;
  }

  /**
   * Get holding patterns with resolved coordinates for map rendering
   * Uses SQL lookups for coordinate resolution
   */
  getAllHoldingPatternsWithCoords(): (HoldingPattern & { latitude: number; longitude: number })[] {
    const result: (HoldingPattern & { latitude: number; longitude: number })[] = [];

    for (const hold of this.holdingPatterns) {
      const coords = this.resolveFixCoordsSql(hold.fixId, hold.fixRegion);
      if (coords) {
        result.push({
          ...hold,
          latitude: coords.lat,
          longitude: coords.lon,
        });
      }
    }

    return result;
  }

  // ==================== Airport Metadata Query Methods ====================

  /**
   * Get airport metadata by ICAO
   */
  getAirportMetadata(icao: string): AirportMetadata | null {
    return this.airportMetadata.get(icao.toUpperCase()) || null;
  }

  /**
   * Get transition altitude for an airport
   */
  getTransitionAltitude(icao: string): number | null {
    const meta = this.airportMetadata.get(icao.toUpperCase());
    return meta?.transitionAlt || null;
  }

  /**
   * Get transition level for an airport
   */
  getTransitionLevel(icao: string): string | null {
    const meta = this.airportMetadata.get(icao.toUpperCase());
    return meta?.transitionLevel || null;
  }

  /**
   * Get data sources information
   */
  getDataSources(): NavDataSources | null {
    return this.dataSources;
  }

  // ==================== Search Methods ====================

  /**
   * Search navaids by ID/name (uses SQLite queries)
   */
  searchNavaids(
    query: string,
    limit = 20
  ): Array<{
    type: string;
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    frequency?: number;
  }> {
    const results: Array<{
      type: string;
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      frequency?: number;
    }> = [];

    // Search navaids using SQL
    const navaids = searchNavaidsDb(query, limit);
    for (const nav of navaids) {
      results.push({
        type: ['ILS', 'LOC', 'GS'].includes(nav.type)
          ? 'ILS'
          : nav.type === 'NDB'
            ? 'NDB'
            : ['DME', 'TACAN'].includes(nav.type)
              ? 'DME'
              : 'VOR',
        id: nav.id,
        name: nav.name,
        latitude: nav.latitude,
        longitude: nav.longitude,
        frequency: nav.frequency,
      });
    }

    // Search waypoints if needed
    if (results.length < limit) {
      const remaining = limit - results.length;
      const waypoints = searchWaypointsDb(query, remaining);
      for (const wp of waypoints) {
        results.push({
          type: 'WAYPOINT',
          id: wp.id,
          name: wp.description || wp.id,
          latitude: wp.latitude,
          longitude: wp.longitude,
        });
      }
    }

    return results;
  }

  /**
   * Get navaid counts by type (uses SQLite query)
   */
  getNavaidCountsByType(): Record<string, number> {
    return getNavaidCountsByType();
  }

  // ==================== Status Methods ====================

  /**
   * Get data load status
   */
  getStatus(): DataLoadStatus {
    let airportCount = 0;
    try {
      const db = getDb();
      const countResult = db.select({ count: airports.icao }).from(airports).all();
      airportCount = countResult.length;
    } catch {
      // Database not initialized yet
    }

    const xp = this.xplanePath;

    // Build airport source description
    let airportSource: string | null = null;
    if (xp) {
      const customCount = getCustomSceneryAptFiles(xp).length;
      const globalPath = getAptDataPath(xp);
      if (customCount > 0) {
        airportSource = `${globalPath} + ${customCount} Custom Scenery`;
      } else {
        airportSource = globalPath;
      }
    }

    return {
      xplanePath: xp,
      pathValid: xp ? validateXPlanePath(xp).valid : false,
      airports: {
        loaded: this.loadStatus.airports,
        count: airportCount,
        source: airportSource,
        breakdown: this.airportSourceCounts,
      },
      navaids: {
        loaded: this.loadStatus.navaids,
        count: getNavaidCount(),
        byType: this.getNavaidCountsByType(),
        source: xp ? getNavDataPath(xp) : null,
      },
      waypoints: {
        loaded: this.loadStatus.waypoints,
        count: getWaypointCount(),
        source: xp ? getFixDataPath(xp) : null,
      },
      airspaces: {
        loaded: this.loadStatus.airspaces,
        count: getAirspaceCount(),
        source: xp ? getAirspaceDataPath(xp) : null,
      },
      airways: {
        loaded: this.loadStatus.airways,
        count: getAirwayCount(),
        source: xp ? getAirwayDataPath(xp) : null,
      },
      atc: this.loadStatus.atc
        ? {
            loaded: true,
            count: this.atcControllers.length,
            source: xp ? getAtcDataPath(xp) : null,
          }
        : null,
      holds: this.loadStatus.holds
        ? {
            loaded: true,
            count: this.holdingPatterns.length,
            source: xp ? getHoldDataPath(xp) : null,
          }
        : null,
      aptMeta: this.loadStatus.aptMeta
        ? {
            loaded: true,
            count: this.airportMetadata.size,
            source: xp ? getAptMetaDataPath(xp) : null,
          }
        : null,
      sources: this.dataSources,
    };
  }

  /**
   * Clear all loaded data
   */
  clear(): void {
    // Clear in-memory data (small datasets only)
    this.atcControllers = [];
    this.holdingPatterns = [];
    this.airportMetadata = new Map();
    this.dataSources = null;
    this.loadStatus = {
      airports: false,
      navaids: false,
      waypoints: false,
      airspaces: false,
      airways: false,
      atc: false,
      holds: false,
      aptMeta: false,
    };

    // Clear database tables
    const db = getDb();
    db.delete(airports).run();
    db.delete(aptFileMeta).run();
    // Note: navaids/waypoints/airspaces/airways tables are cleared by navCache when reloading
  }

  /**
   * Close database connection
   */
  close(): void {
    closeDb();
  }
}

// Singleton instance
let instance: XPlaneDataManager | null = null;

export function getXPlaneDataManager(): XPlaneDataManager {
  if (!instance) {
    instance = new XPlaneDataManager();
  }
  return instance;
}
