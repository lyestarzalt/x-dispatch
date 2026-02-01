import * as fs from 'fs';
import * as path from 'path';
import logger from '../logger';
import { parseAirspaces } from './airspaceParser';
import { parseAirways } from './airwayParser';
import { parseNavaids } from './navaidParser';
import { Airspace, AirwaySegment, Navaid, NavaidType, Waypoint } from './types';
import { parseWaypoints } from './waypointParser';

function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isInBoundingBox(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  radiusNm: number
): boolean {
  // Approximate degrees per nautical mile
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

export class NavDB {
  private navaids: Navaid[] = [];
  private waypoints: Waypoint[] = [];
  private airspaces: Airspace[] = [];
  private airways: AirwaySegment[] = [];

  private loaded = {
    navaids: false,
    waypoints: false,
    airspaces: false,
    airways: false,
  };

  async loadNavaids(filePath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      this.navaids = parseNavaids(content);
      this.loaded.navaids = true;
    } catch (error) {
      logger.data.error('Failed to load navaids', error);
      throw error;
    }
  }

  async loadWaypoints(filePath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      this.waypoints = parseWaypoints(content);
      this.loaded.waypoints = true;
    } catch (error) {
      logger.data.error('Failed to load waypoints', error);
      throw error;
    }
  }

  async loadAirspaces(filePath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      this.airspaces = parseAirspaces(content);
      this.loaded.airspaces = true;
    } catch (error) {
      logger.data.error('Failed to load airspaces', error);
      throw error;
    }
  }

  async loadAirways(filePath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      this.airways = parseAirways(content);
      this.loaded.airways = true;
    } catch (error) {
      logger.data.error('Failed to load airways', error);
      throw error;
    }
  }

  async loadAll(xplanePath: string): Promise<void> {
    const defaultDataPath = path.join(xplanePath, 'Resources', 'default data');

    const navPath = path.join(defaultDataPath, 'earth_nav.dat');
    const fixPath = path.join(defaultDataPath, 'earth_fix.dat');
    const awyPath = path.join(defaultDataPath, 'earth_awy.dat');
    const airspacePath = path.join(defaultDataPath, 'airspaces', 'airspace.txt');

    // Load files in parallel
    await Promise.all([
      this.loadNavaids(navPath).catch(() => {}),
      this.loadWaypoints(fixPath).catch(() => {}),
      this.loadAirspaces(airspacePath).catch(() => {}),
      this.loadAirways(awyPath).catch(() => {}),
    ]);
  }

  getNavaidsInRadius(lat: number, lon: number, radiusNm: number, types?: NavaidType[]): Navaid[] {
    let filtered = this.navaids;

    // Filter by type if specified
    if (types && types.length > 0) {
      filtered = filtered.filter((n) => types.includes(n.type));
    }

    // Filter by distance
    return filtered.filter((n) => {
      // Quick bounding box check first
      if (!isInBoundingBox(n.latitude, n.longitude, lat, lon, radiusNm)) {
        return false;
      }
      // Precise distance check
      return distanceNm(lat, lon, n.latitude, n.longitude) <= radiusNm;
    });
  }

  getVORsInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['VOR', 'VORTAC', 'VOR-DME']);
  }

  getNDBsInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['NDB']);
  }

  getDMEsInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['DME', 'TACAN']);
  }

  getILSInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['ILS', 'LOC']);
  }

  getGlideSlopesInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['GS']);
  }

  getMarkersInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['OM', 'MM', 'IM']);
  }

  getILSComponentsInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['ILS', 'LOC', 'GS', 'OM', 'MM', 'IM']);
  }

  getApproachAidsInRadius(lat: number, lon: number, radiusNm: number): Navaid[] {
    return this.getNavaidsInRadius(lat, lon, radiusNm, ['FPAP', 'GLS', 'LTP', 'FTP']);
  }

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

  getWaypointsInRadius(lat: number, lon: number, radiusNm: number): Waypoint[] {
    return this.waypoints.filter((w) => {
      if (!isInBoundingBox(w.latitude, w.longitude, lat, lon, radiusNm)) {
        return false;
      }
      return distanceNm(lat, lon, w.latitude, w.longitude) <= radiusNm;
    });
  }

  getAllAirspaces(): Airspace[] {
    return this.airspaces;
  }

  getAirspacesByClass(classes: string[]): Airspace[] {
    return this.airspaces.filter((a) => classes.includes(a.class));
  }

  getAirspacesNearPoint(lat: number, lon: number, radiusNm = 50): Airspace[] {
    const degRange = radiusNm / 60;

    return this.airspaces.filter((a) => {
      // Check if any coordinate is within range
      return a.coordinates.some(([aLon, aLat]) => {
        return Math.abs(aLat - lat) <= degRange && Math.abs(aLon - lon) <= degRange;
      });
    });
  }

  getAllAirways(): AirwaySegment[] {
    return this.airways;
  }

  findNavaidById(id: string): Navaid | undefined {
    return this.navaids.find((n) => n.id.toUpperCase() === id.toUpperCase());
  }

  findWaypointById(id: string): Waypoint | undefined {
    return this.waypoints.find((w) => w.id.toUpperCase() === id.toUpperCase());
  }

  getStatus(): typeof this.loaded {
    return { ...this.loaded };
  }

  getCounts(): { navaids: number; waypoints: number; airspaces: number; airways: number } {
    return {
      navaids: this.navaids.length,
      waypoints: this.waypoints.length,
      airspaces: this.airspaces.length,
      airways: this.airways.length,
    };
  }

  getNavaidCountsByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const navaid of this.navaids) {
      counts[navaid.type] = (counts[navaid.type] || 0) + 1;
    }
    return counts;
  }

  clear(): void {
    this.navaids = [];
    this.waypoints = [];
    this.airspaces = [];
    this.airways = [];
    this.loaded = {
      navaids: false,
      waypoints: false,
      airspaces: false,
      airways: false,
    };
  }
}

let navDBInstance: NavDB | null = null;

export function getNavDB(): NavDB {
  if (!navDBInstance) {
    navDBInstance = new NavDB();
  }
  return navDBInstance;
}
