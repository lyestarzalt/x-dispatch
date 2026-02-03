/**
 * X-Plane Data Manager
 * Unified manager for all X-Plane navigation and airport data
 */
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { airports, closeDb, getDb, getSqlite, saveDb } from '../../db';
import { distanceNm } from '../geo';
import logger from '../logger';
import { parseAirspaces } from '../navParser/airspaceParser';
import { parseAirways } from '../navParser/airwayParser';
import { parseAirportMetadata } from '../navParser/aptMetaParser';
import { parseATCData } from '../navParser/atcParser';
import { AirportProcedures, parseCIFP } from '../navParser/cifpParser';
import { parseHoldingPatterns } from '../navParser/holdParser';
import { parseNavaids } from '../navParser/navaidParser';
import {
  ResolvedAirportProcedures,
  createProcedureCoordResolver,
  enrichProceduresWithCoordinates,
} from '../navParser/procedureCoordResolver';
import {
  ATCController,
  ATCRole,
  AirportMetadata,
  Airspace,
  AirwaySegment,
  HoldingPattern,
  Navaid,
  NavaidType,
  Waypoint,
} from '../navParser/types';
import { parseWaypoints } from '../navParser/waypointParser';
import { getXPlanePath, setXPlanePath } from './config';
import { NavDataSources, detectAllDataSources } from './cycleInfo';
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

interface AirwaySegmentWithCoords {
  name: string;
  fromFix: string;
  toFix: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  isHigh: boolean;
  baseFl: number;
  topFl: number;
}

/**
 * Fast async file reader for large files
 */
class FastFileReader {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async *readLines(): AsyncGenerator<{ line: string; position: number }> {
    const fileStream = fs.createReadStream(this.filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let position = 0;
    for await (const line of rl) {
      position += Buffer.byteLength(line, 'utf-8') + 1; // +1 for newline
      yield { line, position };
    }
  }
}

export interface Airport {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  type: 'land' | 'seaplane' | 'heliport';
}

interface AirportSourceBreakdown {
  globalAirports: number;
  customScenery: number;
  customSceneryPacks: number;
}

interface DataLoadStatus {
  xplanePath: string | null;
  pathValid: boolean;
  airports: {
    loaded: boolean;
    count: number;
    source: string | null;
    breakdown: AirportSourceBreakdown;
  };
  navaids: {
    loaded: boolean;
    count: number;
    byType: Record<string, number>;
    source: string | null;
  };
  waypoints: { loaded: boolean; count: number; source: string | null };
  airspaces: { loaded: boolean; count: number; source: string | null };
  airways: { loaded: boolean; count: number; source: string | null };
  // New data types
  atc: { loaded: boolean; count: number; source: string | null } | null;
  holds: { loaded: boolean; count: number; source: string | null } | null;
  aptMeta: { loaded: boolean; count: number; source: string | null } | null;
  // Data sources info
  sources: NavDataSources | null;
}

/**
 * Quick bounding box check
 */
function isInBoundingBox(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  radiusNm: number
): boolean {
  const degPerNm = 1 / 60;
  const latRange = radiusNm * degPerNm;
  const lonRange = (radiusNm * degPerNm) / Math.cos((centerLat * Math.PI) / 180);
  return (
    lat >= centerLat - latRange &&
    lat <= centerLat + latRange &&
    lon >= centerLon - lonRange &&
    lon <= centerLon + lonRange
  );
}

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

  private loadStatus = {
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
  private airportSourceCounts = {
    globalAirports: 0,
    customScenery: 0,
    customSceneryPacks: 0,
  };

  constructor() {
    // Initialize Drizzle database (creates tables if needed)
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
      this.loadAirports(pathToUse),
      this.loadNavaids(pathToUse),
      this.loadWaypoints(pathToUse),
      this.loadAirspaces(pathToUse),
      this.loadAirways(pathToUse),
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
      this.loadATCData(pathToUse),
      this.loadHoldingPatterns(pathToUse),
      this.loadAirportMetadata(pathToUse),
    ]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const status = this.getStatus();
    logger.data.info(
      `Loaded in ${elapsed}s: ${status.airports.count} airports, ${status.navaids.count} navaids, ${status.waypoints.count} waypoints`
    );

    return status;
  }

  /**
   * Public methods for individual data loading (used for progress reporting)
   */
  async loadAirportsOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadAirports(pathToUse);
  }

  async loadNavaidsOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadNavaids(pathToUse);
  }

  async loadWaypointsOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadWaypoints(pathToUse);
  }

  async loadAirspacesOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadAirspaces(pathToUse);
  }

  async loadAirwaysOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadAirways(pathToUse);
  }

  async loadATCDataOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadATCData(pathToUse);
  }

  async loadHoldingPatternsOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadHoldingPatterns(pathToUse);
  }

  async loadAirportMetadataOnly(xplanePath?: string): Promise<void> {
    const pathToUse = xplanePath || this.xplanePath;
    if (!pathToUse) throw new Error('X-Plane path not set');
    this.xplanePath = pathToUse;
    await this.loadAirportMetadata(pathToUse);
  }

  /**
   * Find all Custom Scenery apt.dat files
   */
  private getCustomSceneryAptFiles(xplanePath: string): string[] {
    const customSceneryPath = path.join(xplanePath, 'Custom Scenery');
    const aptFiles: string[] = [];

    if (!fs.existsSync(customSceneryPath)) {
      return aptFiles;
    }

    try {
      const entries = fs.readdirSync(customSceneryPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const aptPath = path.join(customSceneryPath, entry.name, 'Earth nav data', 'apt.dat');
          if (fs.existsSync(aptPath)) {
            aptFiles.push(aptPath);
          }
        }
      }
    } catch (err) {
      logger.data.warn('Error scanning Custom Scenery:', err);
    }

    return aptFiles;
  }

  /**
   * Parse a single apt.dat file and return airport data
   */
  private async parseAptFile(aptPath: string): Promise<
    Map<
      string,
      {
        icao: string;
        name: string;
        lat: number;
        lon: number;
        type: 'land' | 'seaplane' | 'heliport';
        data: string;
      }
    >
  > {
    const airports = new Map<
      string,
      {
        icao: string;
        name: string;
        lat: number;
        lon: number;
        type: 'land' | 'seaplane' | 'heliport';
        data: string;
      }
    >();

    const reader = new FastFileReader(aptPath);

    let currentAirport: {
      icao: string;
      name: string;
      datumLat: number;
      datumLon: number;
      runwayLat: number;
      runwayLon: number;
      type: 'land' | 'seaplane' | 'heliport';
      data: string[];
    } | null = null;

    const finalizeAirport = () => {
      if (!currentAirport) return;

      // Prefer datum coordinates, fallback to runway/helipad coordinates
      const lat = currentAirport.datumLat || currentAirport.runwayLat;
      const lon = currentAirport.datumLon || currentAirport.runwayLon;

      if (lat && lon) {
        airports.set(currentAirport.icao, {
          icao: currentAirport.icao,
          name: currentAirport.name,
          lat,
          lon,
          type: currentAirport.type,
          data: currentAirport.data.join('\n'),
        });
      }
    };

    for await (const { line } of reader.readLines()) {
      if (line.trim() === '99') {
        finalizeAirport();
        break;
      }

      // Airport/Seaplane/Heliport header (row codes 1, 16, 17)
      if (line.match(/^(1|16|17)\s/)) {
        finalizeAirport();

        const parts = line.split(/\s+/);
        if (parts.length >= 5) {
          currentAirport = {
            icao: parts[4],
            name: parts.slice(5).join(' '),
            datumLat: 0,
            datumLon: 0,
            runwayLat: 0,
            runwayLon: 0,
            type: parts[0] === '1' ? 'land' : parts[0] === '16' ? 'seaplane' : 'heliport',
            data: [line],
          };
        }
        continue;
      }

      if (!currentAirport) continue;

      // Metadata with datum coordinates (row code 1302)
      if (line.startsWith('1302 ')) {
        const parts = line.split(/\s+/);
        if (parts[1] === 'datum_lat') {
          currentAirport.datumLat = parseFloat(parts[2]);
        } else if (parts[1] === 'datum_lon') {
          currentAirport.datumLon = parseFloat(parts[2]);
        }
      }

      // Runway (row code 100) - extract first runway end coordinates as fallback
      if (line.startsWith('100 ') && !currentAirport.runwayLat) {
        const parts = line.split(/\s+/);
        if (parts.length >= 10) {
          const lat = parseFloat(parts[9]);
          const lon = parseFloat(parts[10]);
          if (!isNaN(lat) && !isNaN(lon)) {
            currentAirport.runwayLat = lat;
            currentAirport.runwayLon = lon;
          }
        }
      }

      // Helipad (row code 102) - extract coordinates as fallback
      if (line.startsWith('102 ') && !currentAirport.runwayLat) {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          const lat = parseFloat(parts[2]);
          const lon = parseFloat(parts[3]);
          if (!isNaN(lat) && !isNaN(lon)) {
            currentAirport.runwayLat = lat;
            currentAirport.runwayLon = lon;
          }
        }
      }

      currentAirport.data.push(line);
    }

    return airports;
  }

  /**
   * Load airport data from Global Airports and Custom Scenery
   */
  private async loadAirports(xplanePath: string): Promise<void> {
    const globalAptPath = getAptDataPath(xplanePath);
    const customAptFiles = this.getCustomSceneryAptFiles(xplanePath);

    // Store all airports by ICAO (Custom Scenery will override Global)
    const allAirports = new Map<
      string,
      {
        icao: string;
        name: string;
        lat: number;
        lon: number;
        type: 'land' | 'seaplane' | 'heliport';
        data: string;
      }
    >();

    // Track which ICAOs came from Global vs Custom
    const globalIcaos = new Set<string>();
    const customIcaos = new Set<string>();

    // 1. Load Global Airports first
    if (fs.existsSync(globalAptPath)) {
      logger.data.info(`Loading Global Airports from: ${globalAptPath}`);
      const globalAirports = await this.parseAptFile(globalAptPath);
      for (const [icao, airport] of globalAirports) {
        allAirports.set(icao, airport);
        globalIcaos.add(icao);
      }
      logger.data.info(`Loaded ${globalAirports.size} airports from Global Airports`);
    } else {
      logger.data.warn(`Global apt.dat not found: ${globalAptPath}`);
    }

    // 2. Load Custom Scenery (overrides Global)
    if (customAptFiles.length > 0) {
      logger.data.info(`Found ${customAptFiles.length} Custom Scenery apt.dat files`);
      for (const aptFile of customAptFiles) {
        const customAirports = await this.parseAptFile(aptFile);
        for (const [icao, airport] of customAirports) {
          allAirports.set(icao, airport); // Override global
          customIcaos.add(icao);
        }
      }
    }

    // Calculate source breakdown
    // Custom scenery airports = those in customIcaos
    // Global airports = those in globalIcaos but NOT in customIcaos (not overridden)
    const customCount = customIcaos.size;
    const globalOnlyCount = [...globalIcaos].filter((icao) => !customIcaos.has(icao)).length;

    this.airportSourceCounts = {
      globalAirports: globalOnlyCount,
      customScenery: customCount,
      customSceneryPacks: customAptFiles.length,
    };

    logger.data.info(
      `Airport breakdown: ${globalOnlyCount} from Global, ${customCount} from Custom Scenery (${customAptFiles.length} packs)`
    );

    // 3. Insert all airports into database
    const sqlite = getSqlite();
    if (sqlite && allAirports.size > 0) {
      sqlite.run('DELETE FROM airports');

      for (const airport of allAirports.values()) {
        sqlite.run(
          'INSERT OR REPLACE INTO airports (icao, name, lat, lon, type, data) VALUES (?, ?, ?, ?, ?, ?)',
          [airport.icao, airport.name, airport.lat, airport.lon, airport.type, airport.data]
        );
      }

      saveDb();
      logger.data.info(`Stored ${allAirports.size} total airports (Global + Custom Scenery)`);
    }

    this.loadStatus.airports = true;
  }

  /**
   * Load navaids from earth_nav.dat
   */
  private async loadNavaids(xplanePath: string): Promise<void> {
    const navPath = getNavDataPath(xplanePath);

    if (!fs.existsSync(navPath)) {
      logger.data.warn(`earth_nav.dat not found: ${navPath}`);
      return;
    }

    const content = await fs.promises.readFile(navPath, 'utf-8');
    this.navaids = parseNavaids(content);
    this.loadStatus.navaids = true;
  }

  /**
   * Load waypoints from earth_fix.dat
   */
  private async loadWaypoints(xplanePath: string): Promise<void> {
    const fixPath = getFixDataPath(xplanePath);

    if (!fs.existsSync(fixPath)) {
      logger.data.warn(`earth_fix.dat not found: ${fixPath}`);
      return;
    }

    const content = await fs.promises.readFile(fixPath, 'utf-8');
    this.waypoints = parseWaypoints(content);
    this.loadStatus.waypoints = true;
  }

  /**
   * Load airspaces from airspace.txt
   */
  private async loadAirspaces(xplanePath: string): Promise<void> {
    const airspacePath = getAirspaceDataPath(xplanePath);

    if (!fs.existsSync(airspacePath)) {
      logger.data.warn(`airspace.txt not found: ${airspacePath}`);
      return;
    }

    const content = await fs.promises.readFile(airspacePath, 'utf-8');
    this.airspaces = parseAirspaces(content);
    this.loadStatus.airspaces = true;
  }

  /**
   * Load airways from earth_awy.dat
   */
  private async loadAirways(xplanePath: string): Promise<void> {
    const awyPath = getAirwayDataPath(xplanePath);

    if (!fs.existsSync(awyPath)) {
      logger.data.warn(`earth_awy.dat not found: ${awyPath}`);
      return;
    }

    const content = await fs.promises.readFile(awyPath, 'utf-8');
    this.airways = parseAirways(content);
    this.loadStatus.airways = true;
  }

  /**
   * Load ATC data from Navigraph atc.dat
   */
  private async loadATCData(xplanePath: string): Promise<void> {
    const atcPath = getAtcDataPath(xplanePath);

    if (!atcPath) {
      logger.data.debug('ATC data file not found (Navigraph-only feature)');
      return;
    }

    try {
      const content = await fs.promises.readFile(atcPath, 'utf-8');
      this.atcControllers = parseATCData(content);
      this.loadStatus.atc = true;
      logger.data.info(`Loaded ${this.atcControllers.length} ATC controllers`);
    } catch (error) {
      logger.data.warn('Failed to load ATC data:', error);
    }
  }

  /**
   * Load holding patterns from earth_hold.dat
   */
  private async loadHoldingPatterns(xplanePath: string): Promise<void> {
    const holdPath = getHoldDataPath(xplanePath);

    if (!fs.existsSync(holdPath)) {
      logger.data.debug(`earth_hold.dat not found: ${holdPath}`);
      return;
    }

    try {
      const content = await fs.promises.readFile(holdPath, 'utf-8');
      this.holdingPatterns = parseHoldingPatterns(content);
      this.loadStatus.holds = true;
      logger.data.info(`Loaded ${this.holdingPatterns.length} holding patterns`);
    } catch (error) {
      logger.data.warn('Failed to load holding patterns:', error);
    }
  }

  /**
   * Load airport metadata from earth_aptmeta.dat
   */
  private async loadAirportMetadata(xplanePath: string): Promise<void> {
    const aptMetaPath = getAptMetaDataPath(xplanePath);

    if (!fs.existsSync(aptMetaPath)) {
      logger.data.debug(`earth_aptmeta.dat not found: ${aptMetaPath}`);
      return;
    }

    try {
      const content = await fs.promises.readFile(aptMetaPath, 'utf-8');
      this.airportMetadata = parseAirportMetadata(content);
      this.loadStatus.aptMeta = true;
      logger.data.info(`Loaded ${this.airportMetadata.size} airport metadata entries`);
    } catch (error) {
      logger.data.warn('Failed to load airport metadata:', error);
    }
  }

  // ==================== Query Methods ====================

  /**
   * Get all airports using Drizzle
   */
  getAllAirports(): Airport[] {
    const db = getDb();
    const results = db
      .select({
        icao: airports.icao,
        name: airports.name,
        lat: airports.lat,
        lon: airports.lon,
        type: airports.type,
      })
      .from(airports)
      .all();

    return results as Airport[];
  }

  /**
   * Get airport data by ICAO using Drizzle
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
      // The airport location is used for proximity-based fallback when region match fails
      const resolver = createProcedureCoordResolver(this.waypoints, this.navaids, {
        airportLat: airportCoords?.lat,
        airportLon: airportCoords?.lon,
        maxFallbackDistanceNm: 500, // Only match waypoints within 500nm of airport
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
   * Builds a fix lookup map from waypoints + navaids, then resolves airway endpoints
   */
  getAirwaysInRadius(
    lat: number,
    lon: number,
    radiusNm: number,
    limit: number = 3000
  ): AirwaySegmentWithCoords[] {
    // Build fix lookup map: key = "fixId:region" or just "fixId"
    const fixCoords = new Map<string, { lat: number; lon: number }>();

    // Add waypoints to lookup
    for (const wp of this.waypoints) {
      // Key with region for specificity
      fixCoords.set(`${wp.id}:${wp.region}`, { lat: wp.latitude, lon: wp.longitude });
      // Also key without region as fallback
      if (!fixCoords.has(wp.id)) {
        fixCoords.set(wp.id, { lat: wp.latitude, lon: wp.longitude });
      }
    }

    // Add navaids to lookup (VOR, NDB, DME can be airway fixes)
    for (const nav of this.navaids) {
      fixCoords.set(`${nav.id}:${nav.region}`, { lat: nav.latitude, lon: nav.longitude });
      if (!fixCoords.has(nav.id)) {
        fixCoords.set(nav.id, { lat: nav.latitude, lon: nav.longitude });
      }
    }

    const results: AirwaySegmentWithCoords[] = [];

    for (const segment of this.airways) {
      if (results.length >= limit) break;

      // Try to resolve coordinates for both endpoints
      const fromKey1 = `${segment.fromFix}:${segment.fromRegion}`;
      const toKey1 = `${segment.toFix}:${segment.toRegion}`;

      const fromCoords = fixCoords.get(fromKey1) || fixCoords.get(segment.fromFix);
      const toCoords = fixCoords.get(toKey1) || fixCoords.get(segment.toFix);

      // Skip if we can't resolve both coordinates
      if (!fromCoords || !toCoords) continue;

      // Check if either endpoint is within radius (bounding box first for speed)
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
   * Used for global airway display
   */
  getAllAirwaysWithCoords(limit: number = 50000): AirwaySegmentWithCoords[] {
    // Build fix lookup map: key = "fixId:region" or just "fixId"
    const fixCoords = new Map<string, { lat: number; lon: number }>();

    // Add waypoints to lookup
    for (const wp of this.waypoints) {
      fixCoords.set(`${wp.id}:${wp.region}`, { lat: wp.latitude, lon: wp.longitude });
      if (!fixCoords.has(wp.id)) {
        fixCoords.set(wp.id, { lat: wp.latitude, lon: wp.longitude });
      }
    }

    // Add navaids to lookup (VOR, NDB, DME can be airway fixes)
    for (const nav of this.navaids) {
      fixCoords.set(`${nav.id}:${nav.region}`, { lat: nav.latitude, lon: nav.longitude });
      if (!fixCoords.has(nav.id)) {
        fixCoords.set(nav.id, { lat: nav.latitude, lon: nav.longitude });
      }
    }

    const results: AirwaySegmentWithCoords[] = [];

    for (const segment of this.airways) {
      if (results.length >= limit) break;

      // Try to resolve coordinates for both endpoints
      const fromKey1 = `${segment.fromFix}:${segment.fromRegion}`;
      const toKey1 = `${segment.toFix}:${segment.toRegion}`;

      const fromCoords = fixCoords.get(fromKey1) || fixCoords.get(segment.fromFix);
      const toCoords = fixCoords.get(toKey1) || fixCoords.get(segment.toFix);

      // Skip if we can't resolve both coordinates
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

  // ==================== New Data Type Query Methods ====================

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
   * Resolves fixId to lat/lon using waypoints and navaids
   */
  getAllHoldingPatternsWithCoords(): (HoldingPattern & { latitude: number; longitude: number })[] {
    const result: (HoldingPattern & { latitude: number; longitude: number })[] = [];

    // Build a lookup map for fixes
    const fixCoords = new Map<string, { lat: number; lon: number }>();

    for (const wp of this.waypoints) {
      const key = `${wp.id}:${wp.region}`;
      fixCoords.set(key, { lat: wp.latitude, lon: wp.longitude });
      if (!fixCoords.has(wp.id)) {
        fixCoords.set(wp.id, { lat: wp.latitude, lon: wp.longitude });
      }
    }

    for (const nav of this.navaids) {
      const key = `${nav.id}:${nav.region}`;
      fixCoords.set(key, { lat: nav.latitude, lon: nav.longitude });
      if (!fixCoords.has(nav.id)) {
        fixCoords.set(nav.id, { lat: nav.latitude, lon: nav.longitude });
      }
    }

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

  /**
   * Get data load status using Drizzle
   */
  getStatus(): DataLoadStatus {
    // Try to get airport count from database, default to 0 if not initialized
    let airportCount = 0;
    try {
      const db = getDb();
      const countResult = db.select({ count: airports.icao }).from(airports).all();
      airportCount = countResult.length;
    } catch {
      // Database not initialized yet, continue with 0 count
    }

    const xp = this.xplanePath;

    // Build airport source description
    let airportSource: string | null = null;
    if (xp) {
      const customCount = this.getCustomSceneryAptFiles(xp).length;
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
      // New data types
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
      // Data sources info
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
