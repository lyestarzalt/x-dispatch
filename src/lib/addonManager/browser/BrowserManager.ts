import type {
  AircraftInfo,
  BrowserError,
  LiveryInfo,
  LuaScriptInfo,
  PluginInfo,
  Result,
} from '../core/types';
import { deleteAircraft, deleteLivery, deleteLuaScript, deletePlugin } from './actions/delete';
import { applyLockState, isLocked, toggleLock } from './actions/lock';
import { toggleAircraft, toggleLuaScript, togglePlugin } from './actions/toggle';
import { scanAircraft } from './scanners/aircraftScanner';
import { scanLiveries } from './scanners/liveryScanner';
import { scanLuaScripts } from './scanners/luaScriptScanner';
import { scanPlugins } from './scanners/pluginScanner';
import { setCfgDisabled } from './version/cfgSync';
import { checkUpdates } from './version/updateChecker';

export class BrowserManager {
  private readonly xplanePath: string;
  private readonly appDataPath: string;

  constructor(xplanePath: string, appDataPath: string) {
    this.xplanePath = xplanePath;
    this.appDataPath = appDataPath;
  }

  // ===== AIRCRAFT =====

  scanAircraft(): AircraftInfo[] {
    const aircraft = scanAircraft(this.xplanePath);
    return applyLockState(this.appDataPath, 'aircraft', aircraft);
  }

  toggleAircraft(folderName: string): Result<boolean, BrowserError> {
    if (isLocked(this.appDataPath, 'aircraft', folderName)) {
      return {
        ok: false,
        error: { code: 'TOGGLE_FAILED', path: folderName, reason: 'Item is locked' },
      };
    }
    const result = toggleAircraft(this.xplanePath, folderName);
    if (result.ok) {
      // Sync disabled state to skunkcrafts_updater.cfg
      setCfgDisabled(this.xplanePath, 'aircraft', folderName, !result.value);
    }
    return result;
  }

  deleteAircraft(folderName: string): Result<void, BrowserError> {
    if (isLocked(this.appDataPath, 'aircraft', folderName)) {
      return {
        ok: false,
        error: { code: 'DELETE_FAILED', path: folderName, reason: 'Item is locked' },
      };
    }
    return deleteAircraft(this.xplanePath, folderName);
  }

  lockAircraft(folderName: string): boolean {
    return toggleLock(this.appDataPath, 'aircraft', folderName);
  }

  // ===== PLUGINS =====

  scanPlugins(): PluginInfo[] {
    const plugins = scanPlugins(this.xplanePath);
    return applyLockState(this.appDataPath, 'plugins', plugins);
  }

  togglePlugin(folderName: string): Result<boolean, BrowserError> {
    if (isLocked(this.appDataPath, 'plugins', folderName)) {
      return {
        ok: false,
        error: { code: 'TOGGLE_FAILED', path: folderName, reason: 'Item is locked' },
      };
    }
    const result = togglePlugin(this.xplanePath, folderName);
    if (result.ok) {
      // Sync disabled state to skunkcrafts_updater.cfg
      setCfgDisabled(this.xplanePath, 'plugins', folderName, !result.value);
    }
    return result;
  }

  deletePlugin(folderName: string): Result<void, BrowserError> {
    if (isLocked(this.appDataPath, 'plugins', folderName)) {
      return {
        ok: false,
        error: { code: 'DELETE_FAILED', path: folderName, reason: 'Item is locked' },
      };
    }
    return deletePlugin(this.xplanePath, folderName);
  }

  lockPlugin(folderName: string): boolean {
    return toggleLock(this.appDataPath, 'plugins', folderName);
  }

  // ===== LIVERIES =====

  scanLiveries(aircraftFolder: string): Result<LiveryInfo[], BrowserError> {
    return scanLiveries(this.xplanePath, aircraftFolder);
  }

  deleteLivery(aircraftFolder: string, liveryFolder: string): Result<void, BrowserError> {
    return deleteLivery(this.xplanePath, aircraftFolder, liveryFolder);
  }

  // ===== LUA SCRIPTS =====

  scanLuaScripts(): LuaScriptInfo[] {
    return scanLuaScripts(this.xplanePath);
  }

  toggleLuaScript(fileName: string): Result<boolean, BrowserError> {
    return toggleLuaScript(this.xplanePath, fileName);
  }

  deleteLuaScript(fileName: string): Result<void, BrowserError> {
    return deleteLuaScript(this.xplanePath, fileName);
  }

  // ===== UPDATES =====

  async checkAircraftUpdates(aircraft: AircraftInfo[]): Promise<void> {
    await checkUpdates(aircraft);
  }

  async checkPluginUpdates(plugins: PluginInfo[]): Promise<void> {
    await checkUpdates(plugins);
  }
}
