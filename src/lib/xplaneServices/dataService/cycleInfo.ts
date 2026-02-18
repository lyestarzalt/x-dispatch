/**
 * Navigraph/X-Plane cycle info detection and parsing
 * Detects whether nav data comes from Navigraph or X-Plane default
 */
import * as fs from 'fs';
import * as path from 'path';
import { XPLANE_PATHS } from './paths';

export type DataSourceType = 'navigraph' | 'xplane-default' | 'unknown';

export interface DataSourceInfo {
  source: DataSourceType;
  cycle: string | null; // "2601"
  revision: string | null; // "1"
  effectiveDate: Date | null;
  expirationDate: Date | null;
  isExpired: boolean;
  isCustomData: boolean; // true if loaded from Custom Data/
}

export interface NavDataSources {
  global: DataSourceInfo; // Overall source (Navigraph or default)
  navaids: DataSourceInfo;
  waypoints: DataSourceInfo;
  airways: DataSourceInfo;
  procedures: DataSourceInfo;
  airspaces: DataSourceInfo;
  atc: DataSourceInfo | null;
  holds: DataSourceInfo | null;
  aptMeta: DataSourceInfo | null;
}

/**
 * Navigraph cycle.json structure
 */
interface NavigraphCycleJson {
  cycle: string;
  revision: string;
  validFrom: string;
  validTo: string;
}

/**
 * Parse Navigraph cycle.json file
 */
function parseNavigraphCycle(xplanePath: string): DataSourceInfo | null {
  const cycleJsonPath = path.join(xplanePath, 'Custom Data', 'cycle.json');

  if (!fs.existsSync(cycleJsonPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(cycleJsonPath, 'utf-8');
    const data: NavigraphCycleJson = JSON.parse(content);

    const effectiveDate = new Date(data.validFrom);
    const expirationDate = new Date(data.validTo);
    const now = new Date();

    return {
      source: 'navigraph',
      cycle: data.cycle,
      revision: data.revision,
      effectiveDate,
      expirationDate,
      isExpired: now > expirationDate,
      isCustomData: true,
    };
  } catch {
    return null;
  }
}

/**
 * Parse cycle_info.txt file (fallback for older formats)
 * Format example:
 * AIRAC cycle    : 2601
 * Revision       : 1
 * Valid (from/to): 22JAN26 - 19FEB26
 */
function parseCycleInfoTxt(xplanePath: string): Partial<DataSourceInfo> | null {
  const cycleInfoPath = path.join(xplanePath, 'Custom Data', 'cycle_info.txt');

  if (!fs.existsSync(cycleInfoPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(cycleInfoPath, 'utf-8');
    const result: Partial<DataSourceInfo> = {
      source: 'navigraph',
      isCustomData: true,
    };

    const lines = content.split('\n');
    for (const line of lines) {
      const cycleMatch = line.match(/AIRAC cycle\s*:\s*(\d+)/i);
      if (cycleMatch) {
        result.cycle = cycleMatch[1];
      }

      const revisionMatch = line.match(/Revision\s*:\s*(\d+)/i);
      if (revisionMatch) {
        result.revision = revisionMatch[1];
      }

      const dateMatch = line.match(
        /Valid.*?:\s*(\d{1,2}[A-Z]{3}\d{2})\s*-\s*(\d{1,2}[A-Z]{3}\d{2})/i
      );
      if (dateMatch) {
        result.effectiveDate = parseAiracDate(dateMatch[1]);
        result.expirationDate = parseAiracDate(dateMatch[2]);
        if (result.expirationDate) {
          result.isExpired = new Date() > result.expirationDate;
        }
      }
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Parse AIRAC date format (e.g., "22JAN26")
 */
function parseAiracDate(dateStr: string): Date | null {
  const months: Record<string, number> = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11,
  };

  const match = dateStr.match(/(\d{1,2})([A-Z]{3})(\d{2})/i);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = months[match[2].toUpperCase()];
  const year = 2000 + parseInt(match[3], 10);

  if (month === undefined || isNaN(day) || isNaN(year)) return null;

  return new Date(year, month, day);
}

/**
 * Create default X-Plane data source info
 */
function createDefaultSource(isCustom: boolean): DataSourceInfo {
  return {
    source: isCustom ? 'unknown' : 'xplane-default',
    cycle: null,
    revision: null,
    effectiveDate: null,
    expirationDate: null,
    isExpired: false,
    isCustomData: isCustom,
  };
}

/**
 * Check if a specific file exists in Custom Data
 */
function checkCustomDataExists(xplanePath: string, relativePath: string): boolean {
  const customPath = relativePath.replace('Resources/default data', 'Custom Data');
  return fs.existsSync(path.join(xplanePath, customPath));
}

/**
 * Detect the data source for a specific file type
 */
function detectFileSource(
  xplanePath: string,
  relativePath: string,
  navigraphInfo: DataSourceInfo | null
): DataSourceInfo {
  const isCustom = checkCustomDataExists(xplanePath, relativePath);

  if (isCustom && navigraphInfo) {
    return { ...navigraphInfo };
  }

  return createDefaultSource(isCustom);
}

/**
 * Detect all data sources in the X-Plane installation
 */
export function detectAllDataSources(xplanePath: string): NavDataSources {
  // First, try to parse Navigraph cycle info
  let navigraphInfo = parseNavigraphCycle(xplanePath);

  // Fallback to cycle_info.txt
  if (!navigraphInfo) {
    const txtInfo = parseCycleInfoTxt(xplanePath);
    if (txtInfo && txtInfo.source === 'navigraph') {
      navigraphInfo = {
        source: 'navigraph',
        cycle: txtInfo.cycle || null,
        revision: txtInfo.revision || null,
        effectiveDate: txtInfo.effectiveDate || null,
        expirationDate: txtInfo.expirationDate || null,
        isExpired: txtInfo.isExpired || false,
        isCustomData: true,
      };
    }
  }

  // Detect each data source
  const navaids = detectFileSource(xplanePath, XPLANE_PATHS.earthNav, navigraphInfo);
  const waypoints = detectFileSource(xplanePath, XPLANE_PATHS.earthFix, navigraphInfo);
  const airways = detectFileSource(xplanePath, XPLANE_PATHS.earthAwy, navigraphInfo);
  const airspaces = detectFileSource(xplanePath, XPLANE_PATHS.airspaces, navigraphInfo);

  // Check for CIFP custom data
  const cifpCustomExists = fs.existsSync(path.join(xplanePath, 'Custom Data', 'CIFP'));
  const procedures =
    cifpCustomExists && navigraphInfo
      ? { ...navigraphInfo }
      : createDefaultSource(cifpCustomExists);

  // Check for optional Navigraph-only files
  const atcPath = path.join(
    xplanePath,
    'Custom Data',
    '1200 atc data',
    'Earth nav data',
    'atc.dat'
  );
  const atc = fs.existsSync(atcPath) && navigraphInfo ? { ...navigraphInfo } : null;

  const holdPath = path.join(xplanePath, 'Custom Data', 'earth_hold.dat');
  const defaultHoldPath = path.join(xplanePath, 'Resources', 'default data', 'earth_hold.dat');
  const holdsExist = fs.existsSync(holdPath) || fs.existsSync(defaultHoldPath);
  const holds = holdsExist
    ? detectFileSource(xplanePath, 'Resources/default data/earth_hold.dat', navigraphInfo)
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
    ? detectFileSource(xplanePath, 'Resources/default data/earth_aptmeta.dat', navigraphInfo)
    : null;

  // Determine global source
  const hasNavigraph = navigraphInfo !== null && (navaids.isCustomData || waypoints.isCustomData);
  const global: DataSourceInfo = hasNavigraph
    ? {
        source: 'navigraph',
        cycle: navigraphInfo?.cycle || null,
        revision: navigraphInfo?.revision || null,
        effectiveDate: navigraphInfo?.effectiveDate || null,
        expirationDate: navigraphInfo?.expirationDate || null,
        isExpired: navigraphInfo?.isExpired || false,
        isCustomData: true,
      }
    : createDefaultSource(false);

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

/**
 * Format cycle info for display
 */
function formatCycleDisplay(info: DataSourceInfo): string {
  if (info.source === 'navigraph' && info.cycle) {
    let display = `AIRAC ${info.cycle}`;
    if (info.revision) {
      display += ` (rev ${info.revision})`;
    }
    return display;
  }

  if (info.source === 'xplane-default') {
    return 'X-Plane Default';
  }

  return 'Unknown';
}
