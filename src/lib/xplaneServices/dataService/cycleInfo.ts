/**
 * Nav data source and AIRAC cycle detection.
 *
 * Sources, in priority order (mirrors how X-Plane itself layers data):
 *  - 'navigraph':      Custom Data/ whose earth_nav.dat header names Navigraph
 *  - 'custom':         any other Custom Data/ (XPNavData, convert424toxplane
 *                      output, ...), with the provider name from the header
 *                      when it is a known one
 *  - 'xplane-default': Resources/default data/ only
 *
 * The provider is identified from the nav file header's free text, not from
 * cycle.json: XPNavData ships a cycle.json with the exact same shape as
 * Navigraph's, so that file only tells us the cycle and revision. Cycle
 * validity dates are computed from the AIRAC calendar rather than read from
 * provider files: cycle.json carries no dates, and Navigraph's cycle_info.txt
 * states it must not be parsed by third-party tools.
 */
import * as fs from 'fs';
import * as path from 'path';
import { XPLANE_PATHS, getNavDataPath } from './paths';

export type DataSourceType = 'navigraph' | 'custom' | 'xplane-default' | 'unknown';

export interface DataSourceInfo {
  source: DataSourceType;
  /** Display name from the nav header ("Navigraph", "XPNavData"), null if unknown */
  provider: string | null;
  cycle: string | null; // "2609"
  revision: string | null; // "1"
  effectiveDate: Date | null;
  expirationDate: Date | null;
  isExpired: boolean;
  isCustomData: boolean; // true if loaded from Custom Data/
}

export interface NavDataSources {
  global: DataSourceInfo; // Overall source (Navigraph, custom or default)
  navaids: DataSourceInfo;
  waypoints: DataSourceInfo;
  airways: DataSourceInfo;
  procedures: DataSourceInfo;
  airspaces: DataSourceInfo;
  atc: DataSourceInfo | null;
  holds: DataSourceInfo | null;
  aptMeta: DataSourceInfo | null;
}

// ============================================================================
// AIRAC calendar
// ============================================================================

/** AIRAC 2501 effective date. Cycles run exactly 28 days from this anchor. */
const AIRAC_EPOCH_UTC = Date.UTC(2025, 0, 23);
const CYCLE_MS = 28 * 24 * 60 * 60 * 1000;

export interface AiracCycleDates {
  effectiveDate: Date;
  expirationDate: Date;
}

/**
 * Compute the effective/expiration dates of an AIRAC cycle ("2609") from the
 * 28-day AIRAC calendar. Returns null for malformed cycle identifiers or
 * ordinals that don't exist in the given year (most years have 13 cycles,
 * some 14).
 */
export function getAiracCycleDates(cycle: string | null): AiracCycleDates | null {
  if (!cycle || !/^\d{4}$/.test(cycle)) return null;

  const year = 2000 + parseInt(cycle.slice(0, 2), 10);
  const ordinal = parseInt(cycle.slice(2, 4), 10);
  if (ordinal < 1 || ordinal > 14) return null;

  // Find the first cycle whose effective date falls in the target year,
  // starting from a step count guaranteed to be at or before it.
  let step = Math.floor((Date.UTC(year, 0, 1) - AIRAC_EPOCH_UTC) / CYCLE_MS) - 1;
  while (new Date(AIRAC_EPOCH_UTC + step * CYCLE_MS).getUTCFullYear() < year) {
    step++;
  }

  const effectiveMs = AIRAC_EPOCH_UTC + (step + ordinal - 1) * CYCLE_MS;
  const effectiveDate = new Date(effectiveMs);
  if (effectiveDate.getUTCFullYear() !== year) return null;

  return { effectiveDate, expirationDate: new Date(effectiveMs + CYCLE_MS) };
}

function buildCycleValidity(cycle: string | null): {
  effectiveDate: Date | null;
  expirationDate: Date | null;
  isExpired: boolean;
} {
  const dates = getAiracCycleDates(cycle);
  if (!dates) {
    return { effectiveDate: null, expirationDate: null, isExpired: false };
  }
  return {
    effectiveDate: dates.effectiveDate,
    expirationDate: dates.expirationDate,
    isExpired: new Date() > dates.expirationDate,
  };
}

// ============================================================================
// Provider detection
// ============================================================================

/**
 * cycle.json, shipped by Navigraph and XPNavData alike:
 * {"cycle":"2610","revision":"1","name":"X-Plane 12"}
 */
interface CycleJson {
  cycle?: unknown;
  revision?: unknown;
}

function parseCycleJson(xplanePath: string): { cycle: string; revision: string | null } | null {
  const cycleJsonPath = path.join(xplanePath, XPLANE_PATHS.cycleJson);

  let data: CycleJson;
  try {
    data = JSON.parse(fs.readFileSync(cycleJsonPath, 'utf-8'));
  } catch {
    return null;
  }

  const cycle = typeof data.cycle === 'string' && /^\d{4}$/.test(data.cycle) ? data.cycle : null;
  if (!cycle) return null;

  return { cycle, revision: typeof data.revision === 'string' ? data.revision : null };
}

/** Cycle from a nav data header such as "1200 Version - data cycle 2406, build ...". */
export function parseDataCycleHeader(header: string): string | null {
  const match = /data cycle\s+(\d{4})/i.exec(header);
  return match?.[1] ?? null;
}

/**
 * Providers we can name from the header's free text. Verified samples:
 *   Navigraph: "... metadata NavXP1200. Copyright (c) 2025 Navigraph, Datasource Jeppesen"
 *   XPNavData: "... metadata NavXP1200. KEYVAN HAVACILIK / APPEED XPNavData - 2610"
 */
const KNOWN_PROVIDERS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /navigraph/i, name: 'Navigraph' },
  { pattern: /xpnavdata/i, name: 'XPNavData' },
];

export function parseProviderFromHeader(header: string): string | null {
  for (const provider of KNOWN_PROVIDERS) {
    if (provider.pattern.test(header)) return provider.name;
  }
  return null;
}

function readNavHeader(navPath: string): { cycle: string | null; provider: string | null } {
  try {
    const fd = fs.openSync(navPath, 'r');
    try {
      const buffer = Buffer.alloc(512);
      const read = fs.readSync(fd, buffer, 0, buffer.length, 0);
      const header = buffer.toString('utf-8', 0, read);
      return { cycle: parseDataCycleHeader(header), provider: parseProviderFromHeader(header) };
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return { cycle: null, provider: null };
  }
}

/**
 * Identity of the Custom Data layer: provider from the earth_nav.dat header,
 * cycle and revision from cycle.json when present, else from the header.
 */
function buildCustomLayerInfo(xplanePath: string): DataSourceInfo {
  const header = readNavHeader(path.join(xplanePath, XPLANE_PATHS.customNav));
  const cycleJson = parseCycleJson(xplanePath);
  const cycle = cycleJson?.cycle ?? header.cycle;

  return {
    source: header.provider === 'Navigraph' ? 'navigraph' : 'custom',
    provider: header.provider,
    cycle,
    revision: cycleJson?.revision ?? null,
    ...buildCycleValidity(cycle),
    isCustomData: true,
  };
}

function createDefaultSource(isCustom: boolean): DataSourceInfo {
  return {
    source: isCustom ? 'custom' : 'xplane-default',
    provider: null,
    cycle: null,
    revision: null,
    effectiveDate: null,
    expirationDate: null,
    isExpired: false,
    isCustomData: isCustom,
  };
}

function checkCustomDataExists(xplanePath: string, relativePath: string): boolean {
  const customPath = relativePath.replace('Resources/default data', 'Custom Data');
  return fs.existsSync(path.join(xplanePath, customPath));
}

/**
 * Detect the data source for a specific file: files present in Custom Data
 * belong to the active custom layer (Navigraph or converted), everything else
 * is stock.
 */
function detectFileSource(
  xplanePath: string,
  relativePath: string,
  customInfo: DataSourceInfo | null
): DataSourceInfo {
  const isCustom = checkCustomDataExists(xplanePath, relativePath);

  if (isCustom && customInfo) {
    return { ...customInfo };
  }

  return createDefaultSource(isCustom);
}

// ============================================================================
// Detection entry point
// ============================================================================

/**
 * Detect all data sources in the X-Plane installation
 */
export function detectAllDataSources(xplanePath: string): NavDataSources {
  const customNavExists = checkCustomDataExists(xplanePath, XPLANE_PATHS.earthNav);
  const customFixExists = checkCustomDataExists(xplanePath, XPLANE_PATHS.earthFix);
  const hasCustomLayer = customNavExists || customFixExists;

  const customInfo: DataSourceInfo | null = hasCustomLayer
    ? buildCustomLayerInfo(xplanePath)
    : null;

  const navaids = detectFileSource(xplanePath, XPLANE_PATHS.earthNav, customInfo);
  const waypoints = detectFileSource(xplanePath, XPLANE_PATHS.earthFix, customInfo);
  const airways = detectFileSource(xplanePath, XPLANE_PATHS.earthAwy, customInfo);
  const airspaces = detectFileSource(xplanePath, XPLANE_PATHS.airspaces, customInfo);

  const cifpCustomExists = fs.existsSync(path.join(xplanePath, XPLANE_PATHS.customCifp));
  const procedures =
    cifpCustomExists && customInfo ? { ...customInfo } : createDefaultSource(cifpCustomExists);

  const atcExists = fs.existsSync(path.join(xplanePath, XPLANE_PATHS.atcData));
  const atc = atcExists && customInfo ? { ...customInfo } : null;

  const holdPath = path.join(xplanePath, 'Custom Data', 'earth_hold.dat');
  const defaultHoldPath = path.join(xplanePath, 'Resources', 'default data', 'earth_hold.dat');
  const holdsExist = fs.existsSync(holdPath) || fs.existsSync(defaultHoldPath);
  const holds = holdsExist
    ? detectFileSource(xplanePath, XPLANE_PATHS.earthHold, customInfo)
    : null;

  const aptMetaPath = path.join(xplanePath, 'Custom Data', 'earth_aptmeta.dat');
  const defaultAptMetaPath = path.join(
    xplanePath,
    'Resources',
    'default data',
    'earth_aptmeta.dat'
  );
  const aptMetaExists = fs.existsSync(aptMetaPath) || fs.existsSync(defaultAptMetaPath);
  const aptMeta = aptMetaExists
    ? detectFileSource(xplanePath, XPLANE_PATHS.earthAptMeta, customInfo)
    : null;

  // Global source: the custom layer when its core files are in play, else
  // stock data with the cycle read from the resolved nav file header (stock
  // data still has a cycle, and the .fms export needs it).
  let global: DataSourceInfo;
  if (customInfo && (navaids.isCustomData || waypoints.isCustomData)) {
    global = { ...customInfo };
  } else {
    const cycle = readNavHeader(getNavDataPath(xplanePath)).cycle;
    global = { ...createDefaultSource(false), cycle };
  }

  return {
    global,
    navaids,
    waypoints,
    airways,
    procedures,
    airspaces,
    atc,
    holds,
    aptMeta,
  };
}
