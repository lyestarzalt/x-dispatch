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
  createProcedureCoordResolver,
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
  AirwaySegment,
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
import { isInBoundingBox } from './utils';

export type { Airport, AirportSourceBreakdown, DataLoadStatus } from './types';
export type { AirwaySegmentWithCoords } from '@/types/navigation';

export class XPlaneDataManager {
  private xplanePath: string | null = null;

  // In-memory data stores
  private navaids: Navaid[] = [];
  private waypoints: Waypoint[] = [];
  private airspaces: Airspace[] = [];
  private airways: AirwaySegment[] = [];

  // New data stores
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
    this.navaids = result.data;
    this.loadStatus.navaids = result.loaded;
  }

  private async loadWaypointsInternal(xplanePath: string): Promise<void> {
    const result = await loadWaypoints(xplanePath);
    this.waypoints = result.data;
    this.loadStatus.waypoints = result.loaded;
  }

  private async loadAirspacesInternal(xplanePath: string): Promise<void> {
    const result = await loadAirspaces(xplanePath);
    this.airspaces = result.data;
    this.loadStatus.airspaces = result.loaded;
  }

  private async loadAirwaysInternal(xplanePath: string): Promise<void> {
    const result = await loadAirways(xplanePath);
    this.airways = result.data;
    this.loadStatus.airways = result.loaded;
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

      // Create resolver with global waypoint and navaid data + airport location
      const resolver = createProcedureCoordResolver(this.waypoints, this.navaids, {
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
   * Get navaids within radius
   */
  getNavaidsInRadius(lat: number, lon: number, radiusNm: number, types?: NavaidType[]): Navaid[] {
    let filtered = this.navaids;

    if (types && types.length > 0) {
      filtered = filtered.filter((n) => types.includes(n.type));
    }

    return filtered.filter((n) => {
      if (!isInBoundingBox(n.latitude, n.longitude, lat, lon, radiusNm)) return false;
      return distanceNm(lat, lon, n.latitude, n.longitude) <= radiusNm;
    });
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
   * Get approach navaids by airport
   */
  getApproachNavaidsByAirport(airportIcao: string): Navaid[] {
    const approachTypes: NavaidType[] = [
      'ILS',
      'LOC',
      'GS',
      'OM',
      'MM',
      'IM',
      'FPAP',
      'GLS',
      'LTP',
      'FTP',
    ];
    return this.navaids.filter(
      (n) => approachTypes.includes(n.type) && n.associatedAirport === airportIcao
    );
  }

  /**
   * Get approach navaids by runway
   */
  getApproachNavaidsByRunway(airportIcao: string, runway: string): Navaid[] {
    const approachTypes: NavaidType[] = [
      'ILS',
      'LOC',
      'GS',
      'OM',
      'MM',
      'IM',
      'FPAP',
      'GLS',
      'LTP',
      'FTP',
    ];
    return this.navaids.filter(
      (n) =>
        approachTypes.includes(n.type) &&
        n.associatedAirport === airportIcao &&
        n.associatedRunway === runway
    );
  }

  /**
   * Get waypoints within radius
   */
  getWaypointsInRadius(lat: number, lon: number, radiusNm: number): Waypoint[] {
    return this.waypoints.filter((w) => {
      if (!isInBoundingBox(w.latitude, w.longitude, lat, lon, radiusNm)) return false;
      return distanceNm(lat, lon, w.latitude, w.longitude) <= radiusNm;
    });
  }

  /**
   * Get all airspaces
   */
  getAllAirspaces(): Airspace[] {
    return this.airspaces;
  }

  /**
   * Get airspaces near a point
   */
  getAirspacesNearPoint(lat: number, lon: number, radiusNm = 50): Airspace[] {
    const degRange = radiusNm / 60;
    return this.airspaces.filter((a) =>
      a.coordinates.some(
        ([aLon, aLat]) => Math.abs(aLat - lat) <= degRange && Math.abs(aLon - lon) <= degRange
      )
    );
  }

  /**
   * Get all airways
   */
  getAllAirways(): AirwaySegment[] {
    return this.airways;
  }

  /**
   * Get airways within radius with resolved coordinates
   */
  getAirwaysInRadius(
    lat: number,
    lon: number,
    radiusNm: number,
    limit: number = 3000
  ): AirwaySegmentWithCoords[] {
    const fixCoords = this.buildFixLookupMap();
    const results: AirwaySegmentWithCoords[] = [];

    for (const segment of this.airways) {
      if (results.length >= limit) break;

      const fromKey1 = `${segment.fromFix}:${segment.fromRegion}`;
      const toKey1 = `${segment.toFix}:${segment.toRegion}`;

      const fromCoords = fixCoords.get(fromKey1) || fixCoords.get(segment.fromFix);
      const toCoords = fixCoords.get(toKey1) || fixCoords.get(segment.toFix);

      if (!fromCoords || !toCoords) continue;

      const fromInRange =
        isInBoundingBox(fromCoords.lat, fromCoords.lon, lat, lon, radiusNm) &&
        distanceNm(lat, lon, fromCoords.lat, fromCoords.lon) <= radiusNm;
      const toInRange =
        isInBoundingBox(toCoords.lat, toCoords.lon, lat, lon, radiusNm) &&
        distanceNm(lat, lon, toCoords.lat, toCoords.lon) <= radiusNm;

      if (fromInRange || toInRange) {
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
    }

    return results;
  }

  /**
   * Get ALL airways with resolved coordinates (no radius filter)
   */
  getAllAirwaysWithCoords(limit: number = 50000): AirwaySegmentWithCoords[] {
    const fixCoords = this.buildFixLookupMap();
    const results: AirwaySegmentWithCoords[] = [];

    for (const segment of this.airways) {
      if (results.length >= limit) break;

      const fromKey1 = `${segment.fromFix}:${segment.fromRegion}`;
      const toKey1 = `${segment.toFix}:${segment.toRegion}`;

      const fromCoords = fixCoords.get(fromKey1) || fixCoords.get(segment.fromFix);
      const toCoords = fixCoords.get(toKey1) || fixCoords.get(segment.toFix);

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
   * Build fix lookup map from waypoints and navaids
   */
  private buildFixLookupMap(): Map<string, { lat: number; lon: number }> {
    const fixCoords = new Map<string, { lat: number; lon: number }>();

    for (const wp of this.waypoints) {
      fixCoords.set(`${wp.id}:${wp.region}`, { lat: wp.latitude, lon: wp.longitude });
      if (!fixCoords.has(wp.id)) {
        fixCoords.set(wp.id, { lat: wp.latitude, lon: wp.longitude });
      }
    }

    for (const nav of this.navaids) {
      fixCoords.set(`${nav.id}:${nav.region}`, { lat: nav.latitude, lon: nav.longitude });
      if (!fixCoords.has(nav.id)) {
        fixCoords.set(nav.id, { lat: nav.latitude, lon: nav.longitude });
      }
    }

    return fixCoords;
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
   */
  getAllHoldingPatternsWithCoords(): (HoldingPattern & { latitude: number; longitude: number })[] {
    const result: (HoldingPattern & { latitude: number; longitude: number })[] = [];
    const fixCoords = this.buildFixLookupMap();

    for (const hold of this.holdingPatterns) {
      const key = `${hold.fixId}:${hold.fixRegion}`;
      const coords = fixCoords.get(key) || fixCoords.get(hold.fixId);
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
   * Search navaids by ID/name
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
    const upperQuery = query.toUpperCase();
    const results: Array<{
      type: string;
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      frequency?: number;
    }> = [];

    // Search navaids
    for (const nav of this.navaids) {
      if (results.length >= limit) break;
      if (
        nav.id.toUpperCase().includes(upperQuery) ||
        nav.name.toUpperCase().includes(upperQuery)
      ) {
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
    }

    // Search waypoints if needed
    if (results.length < limit) {
      for (const wp of this.waypoints) {
        if (results.length >= limit) break;
        if (wp.id.toUpperCase().includes(upperQuery)) {
          results.push({
            type: 'WAYPOINT',
            id: wp.id,
            name: wp.description || wp.id,
            latitude: wp.latitude,
            longitude: wp.longitude,
          });
        }
      }
    }

    return results;
  }

  /**
   * Get navaid counts by type
   */
  getNavaidCountsByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const navaid of this.navaids) {
      counts[navaid.type] = (counts[navaid.type] || 0) + 1;
    }
    return counts;
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
        count: this.navaids.length,
        byType: this.getNavaidCountsByType(),
        source: xp ? getNavDataPath(xp) : null,
      },
      waypoints: {
        loaded: this.loadStatus.waypoints,
        count: this.waypoints.length,
        source: xp ? getFixDataPath(xp) : null,
      },
      airspaces: {
        loaded: this.loadStatus.airspaces,
        count: this.airspaces.length,
        source: xp ? getAirspaceDataPath(xp) : null,
      },
      airways: {
        loaded: this.loadStatus.airways,
        count: this.airways.length,
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
    this.navaids = [];
    this.waypoints = [];
    this.airspaces = [];
    this.airways = [];
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

    const db = getDb();
    db.delete(airports).run();
    db.delete(aptFileMeta).run();
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
