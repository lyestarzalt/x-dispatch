import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import { getXPlaneExecutable } from '../launch/freeflightGenerator';

export interface XPlaneVersionInfo {
  /** Full version string, e.g. "12.4.0-r2-9b69b91a" */
  raw: string;
  major: number;
  minor: number;
  patch: number;
  /** r = release, b = beta, ec = early access */
  channel: 'release' | 'beta' | 'ec' | 'unknown';
  /** Number after channel prefix, e.g. 2 from "r2" */
  channelBuild: number;
  /** Git commit hash */
  commit: string;
  isSteam: boolean;
}

const VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)(?:-(r|b|ec)(\d+))?(?:-([a-f0-9]+))?$/;

const CHANNEL_MAP: Record<string, XPlaneVersionInfo['channel']> = {
  r: 'release',
  b: 'beta',
  ec: 'ec',
};

/**
 * Parse a version string like "12.4.0-r2-9b69b91a" into structured info
 */
export function parseVersionString(raw: string): Omit<XPlaneVersionInfo, 'isSteam'> | null {
  const match = raw.trim().match(VERSION_REGEX);
  if (!match) return null;

  const majorStr = match[1];
  const minorStr = match[2];
  const patchStr = match[3];
  if (!majorStr || !minorStr || !patchStr) return null;

  const channelKey = match[4];
  const channelBuildStr = match[5];

  return {
    raw: raw.trim(),
    major: parseInt(majorStr, 10),
    minor: parseInt(minorStr, 10),
    patch: parseInt(patchStr, 10),
    channel: channelKey ? (CHANNEL_MAP[channelKey] ?? 'unknown') : 'unknown',
    channelBuild: channelBuildStr ? parseInt(channelBuildStr, 10) : 0,
    commit: match[6] ?? '',
  };
}

/** Returns true if version >= major.minor.patch */
export function isVersionAtLeast(
  v: XPlaneVersionInfo,
  major: number,
  minor: number,
  patch: number
): boolean {
  if (v.major !== major) return v.major > major;
  if (v.minor !== minor) return v.minor > minor;
  return v.patch >= patch;
}

/**
 * Check if the X-Plane installation is from Steam
 */
function isSteamInstallation(xplanePath: string): boolean {
  if (xplanePath.toLowerCase().includes('steamapps')) return true;
  return fs.existsSync(path.join(xplanePath, 'steam_appid.txt'));
}

/**
 * Run the executable with --version flag and parse stdout
 */
function runVersionCommand(xplanePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const executable = getXPlaneExecutable(xplanePath);
    if (!executable) {
      resolve(null);
      return;
    }

    const env: NodeJS.ProcessEnv = { ...process.env };

    // macOS: binary is inside .app bundle but Steam libs are in xplanePath root
    if (process.platform === 'darwin') {
      env.DYLD_LIBRARY_PATH = xplanePath;
    }

    execFile(
      executable,
      ['--version'],
      { cwd: xplanePath, env, timeout: 5000 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        // stdout is like "X-Plane 12.4.0-r2-9b69b91a\n"
        const output = stdout.trim();
        resolve(output || null);
      }
    );
  });
}

/**
 * Fallback: parse version from Log.txt first line
 * Format: "Log.txt for X-Plane 12.4.0-r2-9b69b91a ..."
 */
function parseLogTxt(xplanePath: string): string | null {
  try {
    const logPath = path.join(xplanePath, 'Log.txt');
    if (!fs.existsSync(logPath)) return null;

    const fd = fs.openSync(logPath, 'r');
    const buf = Buffer.alloc(512);
    fs.readSync(fd, buf, 0, 512, 0);
    fs.closeSync(fd);

    const firstLine = buf.toString('utf-8').split('\n')[0];
    if (!firstLine) return null;
    // "Log.txt for X-Plane 12.4.0-r2-9b69b91a (build ...)"
    const match = firstLine.match(/X-Plane\s+(\d+\.\d+\.\d+(?:-[^\s(]+)?)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * macOS fallback: read Info.plist CFBundleShortVersionString
 */
function readInfoPlist(xplanePath: string): Promise<string | null> {
  if (process.platform !== 'darwin') return Promise.resolve(null);

  return new Promise((resolve) => {
    const plistPath = path.join(xplanePath, 'X-Plane.app', 'Contents', 'Info.plist');
    if (!fs.existsSync(plistPath)) {
      resolve(null);
      return;
    }

    execFile(
      'defaults',
      ['read', plistPath, 'CFBundleShortVersionString'],
      { timeout: 3000 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        resolve(stdout.trim() || null);
      }
    );
  });
}

/**
 * Detect the installed X-Plane version using multiple strategies:
 * 1. Run executable with --version flag
 * 2. Parse Log.txt first line
 * 3. (macOS) Read Info.plist
 */
export async function detectXPlaneVersion(xplanePath: string): Promise<XPlaneVersionInfo | null> {
  const isSteam = isSteamInstallation(xplanePath);

  // Strategy 1: --version flag
  // Skip on Windows Steam installs — running the exe triggers Steam's launch dialog
  if (!(process.platform === 'win32' && isSteam)) {
    let versionStr = await runVersionCommand(xplanePath);
    if (versionStr) {
      // Strip "X-Plane " prefix if present
      versionStr = versionStr.replace(/^X-Plane\s+/i, '');
      const parsed = parseVersionString(versionStr);
      if (parsed) {
        logger.data.info(`X-Plane version detected via --version: ${parsed.raw}`);
        return { ...parsed, isSteam };
      }
    }
  }

  // Strategy 2: Log.txt
  const logVersion = parseLogTxt(xplanePath);
  if (logVersion) {
    const parsed = parseVersionString(logVersion);
    if (parsed) {
      logger.data.info(`X-Plane version detected via Log.txt: ${parsed.raw}`);
      return { ...parsed, isSteam };
    }
  }

  // Strategy 3: Info.plist (macOS)
  const plistVersion = await readInfoPlist(xplanePath);
  if (plistVersion) {
    const parsed = parseVersionString(plistVersion);
    if (parsed) {
      logger.data.info(`X-Plane version detected via Info.plist: ${parsed.raw}`);
      return { ...parsed, isSteam };
    }
  }

  logger.data.warn('Could not detect X-Plane version from any source');
  return null;
}
