/**
 * X-Plane Launch Executor
 * Handles the actual launching of X-Plane across different platforms and installation types.
 */
import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';

// Steam App IDs
const STEAM_APP_IDS = {
  'X-Plane 12': '2014780',
  'X-Plane 11': '269950',
} as const;

// ============================================================================
// Detection Helpers
// ============================================================================

/**
 * Check if the X-Plane installation is from Steam
 */
export function isSteamInstallation(xplanePath: string): boolean {
  // Check if path contains Steam directories
  if (xplanePath.toLowerCase().includes('steamapps')) {
    return true;
  }
  // Check for steam_appid.txt file
  const steamAppIdFile = path.join(xplanePath, 'steam_appid.txt');
  return fs.existsSync(steamAppIdFile);
}

/**
 * Get Steam App ID based on X-Plane version in path
 */
export function getSteamAppId(xplanePath: string): string {
  if (xplanePath.includes('X-Plane 11')) {
    return STEAM_APP_IDS['X-Plane 11'];
  }
  return STEAM_APP_IDS['X-Plane 12'];
}

/**
 * Get X-Plane executable path for current platform
 */
export function getXPlaneExecutable(xplanePath: string): string | null {
  const platform = process.platform;

  if (platform === 'darwin') {
    const macPath = path.join(xplanePath, 'X-Plane.app', 'Contents', 'MacOS', 'X-Plane');
    if (fs.existsSync(macPath)) {
      return macPath;
    }
  } else if (platform === 'win32') {
    const winPath = path.join(xplanePath, 'X-Plane.exe');
    if (fs.existsSync(winPath)) {
      return winPath;
    }
  } else {
    const linuxPath = path.join(xplanePath, 'X-Plane-x86_64');
    if (fs.existsSync(linuxPath)) {
      return linuxPath;
    }
  }

  return null;
}

// ============================================================================
// Launch Methods
// ============================================================================

/**
 * Launch X-Plane via Steam URL protocol
 * Works on all platforms: macOS, Windows, Linux
 */
export function launchViaSteam(
  xplanePath: string,
  args: string[]
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const appId = getSteamAppId(xplanePath);
    const platform = process.platform;

    logger.launcher.info(`Launching X-Plane via Steam (platform: ${platform}, appId: ${appId})`);

    // Format: steam://rungameid/<appid>//<args>/
    const argsEncoded = args.map((arg) => encodeURIComponent(arg)).join('%20');
    const steamUrl = `steam://rungameid/${appId}//${argsEncoded}/`;

    // Platform-specific command to open Steam URL
    let openCommand: string;
    if (platform === 'darwin') {
      openCommand = `open "${steamUrl}"`;
    } else if (platform === 'win32') {
      openCommand = `start "" "${steamUrl}"`;
    } else {
      openCommand = `xdg-open "${steamUrl}"`;
    }

    logger.launcher.debug(`Steam launch command: ${openCommand}`);

    exec(openCommand, (error) => {
      if (error) {
        logger.launcher.error('Failed to launch via Steam URL', error);
        resolve({ success: false, error: `Steam launch failed: ${error.message}` });
      } else {
        resolve({ success: true });
      }
    });
  });
}

/**
 * Launch X-Plane directly by spawning the executable
 */
export function launchDirect(
  xplanePath: string,
  args: string[]
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const executable = getXPlaneExecutable(xplanePath);
    if (!executable) {
      resolve({ success: false, error: 'X-Plane executable not found' });
      return;
    }

    const platform = process.platform;
    logger.launcher.info(`Launching X-Plane directly: ${executable}`);

    // Use shell on Windows to handle paths with spaces
    const spawnOptions: Parameters<typeof spawn>[2] = {
      detached: true,
      stdio: 'ignore',
      ...(platform === 'win32' && { shell: true }),
    };

    try {
      const xplaneProcess = spawn(executable, args, spawnOptions);

      // Handle spawn errors
      xplaneProcess.on('error', (err) => {
        logger.launcher.error('Failed to spawn X-Plane process', err);
        resolve({ success: false, error: `Spawn failed: ${err.message}` });
      });

      // Unref the process so it can run independently
      xplaneProcess.unref();

      // Give it a moment to fail if it's going to
      setTimeout(() => {
        resolve({ success: true });
      }, 100);
    } catch (err) {
      logger.launcher.error('Exception spawning X-Plane', err);
      resolve({ success: false, error: (err as Error).message });
    }
  });
}

// ============================================================================
// Main Launch Function
// ============================================================================

/**
 * Launch X-Plane with the appropriate method based on installation type
 * Steam installations try Steam URL first, fall back to direct if it fails
 */
export async function executeXPlaneLaunch(
  xplanePath: string,
  args: string[]
): Promise<{ success: boolean; error?: string }> {
  const isSteam = isSteamInstallation(xplanePath);

  if (isSteam) {
    // Try Steam URL first
    logger.launcher.info('Detected Steam installation, trying Steam URL launch...');
    const steamResult = await launchViaSteam(xplanePath, args);

    if (steamResult.success) {
      return steamResult;
    }

    // Fall back to direct launch
    logger.launcher.warn('Steam URL launch failed, falling back to direct launch...');
    return launchDirect(xplanePath, args);
  } else {
    // Non-Steam: direct launch only
    logger.launcher.info('Non-Steam installation, using direct launch...');
    return launchDirect(xplanePath, args);
  }
}
