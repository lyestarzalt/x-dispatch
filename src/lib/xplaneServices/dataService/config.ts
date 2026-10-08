import { app } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import { validateXPlanePath } from './paths';
import type { XPlaneVersionInfo } from './versionDetector';

export interface XPlaneInstallation {
  id: string;
  name: string;
  path: string;
}

interface XPlaneConfig {
  xplanePath: string;
  version: number;
  lastUpdated: string;
  /** Whether to send crash reports to Sentry (opt-in, default false) */
  sendCrashReports?: boolean;
  /** Detected X-Plane version string, e.g. "12.4.0-r2-9b69b91a" */
  xplaneVersion?: string;
  /** Whether the X-Plane install is from Steam */
  xplaneIsSteam?: boolean;
  /** Named X-Plane installations */
  installations?: XPlaneInstallation[];
  /** ID of the currently active installation */
  activeInstallationId?: string;
  /** Usage analytics consent; absent until the user answers the first-launch prompt */
  analyticsConsent?: 'granted' | 'denied';
  /** Random anonymous install ID, only present while analytics consent is granted */
  analyticsInstallId?: string;
  /** Session that ended at the last quit, sent as `session_ended` on the next launch */
  analyticsPendingSession?: {
    durationSeconds: number;
    endedAt: string;
    appVersion: string;
    tabletClientsPeak?: number;
  };
  /** Tablet access: the LAN server that serves the UI to other devices */
  remoteAccess?: RemoteAccessConfig;
}

export interface RemoteAccessConfig {
  enabled: boolean;
  port: number;
  token: string;
}

export const DEFAULT_REMOTE_PORT = 8480;

const CONFIG_VERSION = 1;
const CONFIG_FILENAME = 'config.json';
const OLD_CONFIG_FILENAME = 'xplane-config.json';

function getConfigPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, CONFIG_FILENAME);
}

function getOldConfigPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, OLD_CONFIG_FILENAME);
}

/**
 * Migrate old config file to new name
 */
function migrateOldConfig(): void {
  try {
    const oldPath = getOldConfigPath();
    const newPath = getConfigPath();

    if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
      fs.renameSync(oldPath, newPath);
    }
  } catch {
    // Ignore migration errors
  }
}

/**
 * Write to a sibling temp file, then rename over the target. A reader (or a
 * second app instance) never sees a half-written file, which would parse as
 * garbage and be replaced by defaults.
 */
function writeConfigFile(config: XPlaneConfig): void {
  const configPath = getConfigPath();
  const tmpPath = `${configPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(tmpPath, configPath);
  } catch (error) {
    // Windows can refuse the rename while something (antivirus) holds the target.
    fs.rmSync(tmpPath, { force: true });
    throw error;
  }
}

/** An unreadable config is kept aside, never overwritten in place: it holds the user's setup. */
function backUpCorruptConfig(configPath: string, error: unknown): void {
  const backupPath = `${configPath}.corrupt-${Date.now()}`;
  try {
    fs.renameSync(configPath, backupPath);
    logger.main.warn(`Config file unreadable, moved to ${backupPath}`, error);
  } catch (renameError) {
    logger.main.error('Config file unreadable and could not be backed up', renameError);
  }
}

/**
 * The stored config, or null when there is none. A saved X-Plane path that no
 * longer exists (unplugged drive) is still returned: the path is validated where
 * it is used, and hiding the file here made the next save wipe every setting.
 */
function loadConfig(): XPlaneConfig | null {
  // Migrate old config file if needed
  migrateOldConfig();

  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return null;
  }

  let config: XPlaneConfig;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as XPlaneConfig;
  } catch (error) {
    backUpCorruptConfig(configPath, error);
    return null;
  }

  // Migrate: create installations array from existing xplanePath
  if (!config.installations && config.xplanePath) {
    const id = crypto.randomUUID();
    config.installations = [{ id, name: 'Main', path: config.xplanePath }];
    config.activeInstallationId = id;
    try {
      writeConfigFile(config);
    } catch {
      // Non-fatal: migration will retry next load
    }
  }

  return config;
}

function saveConfig(config: Partial<XPlaneConfig>): boolean {
  try {
    const existing = loadConfig();

    const newConfig: XPlaneConfig = {
      xplanePath: config.xplanePath ?? existing?.xplanePath ?? '',
      version: CONFIG_VERSION,
      lastUpdated: new Date().toISOString(),
      sendCrashReports: config.sendCrashReports ?? existing?.sendCrashReports ?? true,
      // `in` check so switching installs can clear the old install's version.
      xplaneVersion: 'xplaneVersion' in config ? config.xplaneVersion : existing?.xplaneVersion,
      xplaneIsSteam: 'xplaneIsSteam' in config ? config.xplaneIsSteam : existing?.xplaneIsSteam,
      installations: config.installations ?? existing?.installations,
      activeInstallationId: config.activeInstallationId ?? existing?.activeInstallationId,
      analyticsConsent: config.analyticsConsent ?? existing?.analyticsConsent,
      // `in` check so withdrawing consent can delete the ID (undefined drops it from JSON).
      analyticsInstallId:
        'analyticsInstallId' in config ? config.analyticsInstallId : existing?.analyticsInstallId,
      analyticsPendingSession:
        'analyticsPendingSession' in config
          ? config.analyticsPendingSession
          : existing?.analyticsPendingSession,
      remoteAccess: config.remoteAccess ?? existing?.remoteAccess,
    };

    writeConfigFile(newConfig);
    return true;
  } catch (error) {
    logger.main.error('Failed to save config', error);
    return false;
  }
}

export function getXPlanePath(): string | null {
  const config = loadConfig();
  if (config?.xplanePath) {
    const validation = validateXPlanePath(config.xplanePath);
    if (validation.valid) {
      return config.xplanePath;
    }
  }
  return null;
}

export function isSetupComplete(): boolean {
  const config = loadConfig();
  if (!config?.xplanePath) return false;
  return validateXPlanePath(config.xplanePath).valid;
}

export function setXPlanePath(xplanePath: string): { success: boolean; errors: string[] } {
  const validation = validateXPlanePath(xplanePath);

  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const saved = saveConfig({ xplanePath });
  if (!saved) {
    return { success: false, errors: ['Failed to save configuration'] };
  }

  return { success: true, errors: [] };
}

/**
 * Get crash reports setting (opt-out, default true)
 */
export function getSendCrashReports(): boolean {
  const config = loadConfig();
  return config?.sendCrashReports ?? true;
}

/**
 * Set crash reports setting
 */
export function setSendCrashReports(enabled: boolean): boolean {
  return saveConfig({ sendCrashReports: enabled });
}

export function getAnalyticsConsent(): 'granted' | 'denied' | null {
  return loadConfig()?.analyticsConsent ?? null;
}

/**
 * Stores the user's analytics choice. Granting creates the anonymous install ID
 * if missing; denying deletes it so a later opt-in starts as a new install.
 */
export function setAnalyticsConsent(granted: boolean): boolean {
  if (!granted) {
    return saveConfig({
      analyticsConsent: 'denied',
      analyticsInstallId: undefined,
      analyticsPendingSession: undefined,
    });
  }
  const installId = loadConfig()?.analyticsInstallId ?? crypto.randomUUID();
  return saveConfig({ analyticsConsent: 'granted', analyticsInstallId: installId });
}

export type AnalyticsPendingSession = NonNullable<XPlaneConfig['analyticsPendingSession']>;

/** Returns and clears the session saved at the last quit. */
export function takeAnalyticsPendingSession(): AnalyticsPendingSession | null {
  const pending = loadConfig()?.analyticsPendingSession ?? null;
  if (pending) saveConfig({ analyticsPendingSession: undefined });
  return pending;
}

/** Synchronous write, so it is safe during `before-quit`. */
export function saveAnalyticsPendingSession(session: AnalyticsPendingSession): void {
  saveConfig({ analyticsPendingSession: session });
}

/** The anonymous install ID, or null unless consent is granted. */
export function getAnalyticsInstallId(): string | null {
  const config = loadConfig();
  if (config?.analyticsConsent !== 'granted') return null;
  return config.analyticsInstallId ?? null;
}

/**
 * Get stored X-Plane version info
 */
export function getStoredXPlaneVersion(): { version: string; isSteam: boolean } | null {
  const config = loadConfig();
  if (!config?.xplaneVersion) return null;
  return { version: config.xplaneVersion, isSteam: config.xplaneIsSteam ?? false };
}

/**
 * Store X-Plane version info
 */
export function setStoredXPlaneVersion(info: XPlaneVersionInfo): boolean {
  return saveConfig({ xplaneVersion: info.raw, xplaneIsSteam: info.isSteam });
}

// --- Multi-installation management ---

export function getInstallations(): XPlaneInstallation[] {
  const config = loadConfig();
  return config?.installations ?? [];
}

export function getActiveInstallation(): XPlaneInstallation | null {
  const config = loadConfig();
  if (!config?.installations || !config.activeInstallationId) return null;
  return config.installations.find((i) => i.id === config.activeInstallationId) ?? null;
}

export function getActiveInstallationName(): string {
  return getActiveInstallation()?.name ?? 'Main';
}

export function addInstallation(name: string, installPath: string): XPlaneInstallation {
  const id = crypto.randomUUID();
  const installation: XPlaneInstallation = { id, name, path: installPath };
  const config = loadConfig();
  const installations = config?.installations ?? [];
  installations.push(installation);
  saveConfig({ installations });
  return installation;
}

export function removeInstallation(id: string): boolean {
  const config = loadConfig();
  if (!config?.installations) return false;
  if (config.activeInstallationId === id) return false;
  const filtered = config.installations.filter((i) => i.id !== id);
  if (filtered.length === config.installations.length) return false;
  saveConfig({ installations: filtered });
  return true;
}

export function renameInstallation(id: string, name: string): boolean {
  const config = loadConfig();
  if (!config?.installations) return false;
  const installation = config.installations.find((i) => i.id === id);
  if (!installation) return false;
  installation.name = name;
  saveConfig({ installations: config.installations });
  return true;
}

export function setActiveInstallation(id: string): boolean {
  const config = loadConfig();
  if (!config?.installations) return false;
  const installation = config.installations.find((i) => i.id === id);
  if (!installation) return false;
  // Update activeInstallationId and sync xplanePath
  saveConfig({
    activeInstallationId: id,
    xplanePath: installation.path,
    // Clear version info since we're switching installs
    xplaneVersion: undefined,
    xplaneIsSteam: undefined,
  });
  return true;
}

export function newRemoteToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function getRemoteAccessConfig(): RemoteAccessConfig {
  const stored = loadConfig()?.remoteAccess;
  return {
    enabled: stored?.enabled ?? false,
    port: stored?.port ?? DEFAULT_REMOTE_PORT,
    token: stored?.token ?? '',
  };
}

export function setRemoteAccessConfig(patch: Partial<RemoteAccessConfig>): RemoteAccessConfig {
  const next = { ...getRemoteAccessConfig(), ...patch };
  if (!next.token) next.token = newRemoteToken();
  saveConfig({ remoteAccess: next });
  return next;
}
