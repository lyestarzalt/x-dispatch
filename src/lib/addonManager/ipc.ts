// src/lib/addonManager/ipc.ts
// IPC handlers for Addon Manager features
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { BrowserManager } from './browser';
import type { BrowserError } from './core/types';
import { err } from './core/types';
import { SceneryManager } from './scenery/SceneryManager';

// TODO: Refactor main.ts - move other IPC handlers to separate files based on module:
// - xplane/* handlers -> lib/xplaneData/ipc.ts
// - nav/* handlers -> lib/navData/ipc.ts
// - launcher/* handlers -> lib/launcher/ipc.ts
// - flightplan/* handlers -> lib/flightPlan/ipc.ts

/**
 * Register all Addon Manager IPC handlers.
 * Call this from main.ts during app initialization.
 *
 * @param getXPlanePath - Function to get the current X-Plane path
 */
export function registerAddonManagerIPC(getXPlanePath: () => string | null): void {
  // ===== SCENERY MANAGER =====

  ipcMain.handle('addon:scenery:analyze', async () => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return { ok: false, error: { code: 'INI_NOT_FOUND', path: 'X-Plane path not configured' } };
    }

    const manager = new SceneryManager(xplanePath);
    return manager.analyze();
  });

  ipcMain.handle('addon:scenery:sort', async () => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return { ok: false, error: { code: 'INI_NOT_FOUND', path: 'X-Plane path not configured' } };
    }

    const manager = new SceneryManager(xplanePath);

    const analyzeResult = await manager.analyze();
    if (!analyzeResult.ok) {
      return analyzeResult;
    }

    return manager.save(analyzeResult.value);
  });

  ipcMain.handle('addon:scenery:saveOrder', async (_event, folderNames: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return { ok: false, error: { code: 'INI_NOT_FOUND', path: 'X-Plane path not configured' } };
    }

    // Validate input
    if (!Array.isArray(folderNames) || !folderNames.every((n) => typeof n === 'string')) {
      return {
        ok: false,
        error: { code: 'WRITE_FAILED', path: '', reason: 'Invalid folder names' },
      };
    }

    // Security: validate no path traversal in any folder name
    if (folderNames.some((n) => n.includes('..') || n.length > 500)) {
      return {
        ok: false,
        error: { code: 'WRITE_FAILED', path: '', reason: 'Invalid folder name' },
      };
    }

    const manager = new SceneryManager(xplanePath);

    // Get current entries
    const analyzeResult = await manager.analyze();
    if (!analyzeResult.ok) {
      return analyzeResult;
    }

    // Reorder entries based on provided folderNames order
    const entryMap = new Map(analyzeResult.value.map((e) => [e.folderName, e]));
    const reorderedEntries = (folderNames as string[])
      .map((name) => entryMap.get(name))
      .filter((e): e is NonNullable<typeof e> => e !== undefined);

    // Update originalIndex to match new order
    reorderedEntries.forEach((entry, index) => {
      entry.originalIndex = index;
    });

    // Save with preserveOrder=true to keep user's custom ordering
    return manager.save(reorderedEntries, true);
  });

  ipcMain.handle('addon:scenery:toggle', async (_event, folderName: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return { ok: false, error: { code: 'INI_NOT_FOUND', path: 'X-Plane path not configured' } };
    }

    // Validate input
    if (
      typeof folderName !== 'string' ||
      folderName.length === 0 ||
      folderName.length > 500 ||
      folderName.includes('..')
    ) {
      return { ok: false, error: { code: 'FOLDER_NOT_FOUND', folderName: String(folderName) } };
    }

    const manager = new SceneryManager(xplanePath);
    return manager.toggle(folderName);
  });

  ipcMain.handle('addon:scenery:move', async (_event, folderName: unknown, direction: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return { ok: false, error: { code: 'INI_NOT_FOUND', path: 'X-Plane path not configured' } };
    }

    // Validate input
    if (
      typeof folderName !== 'string' ||
      folderName.length === 0 ||
      folderName.length > 500 ||
      folderName.includes('..')
    ) {
      return { ok: false, error: { code: 'FOLDER_NOT_FOUND', folderName: String(folderName) } };
    }
    if (direction !== 'up' && direction !== 'down') {
      return { ok: false, error: { code: 'WRITE_FAILED', path: '', reason: 'Invalid direction' } };
    }

    const manager = new SceneryManager(xplanePath);
    return manager.move(folderName, direction);
  });

  ipcMain.handle('addon:scenery:backup', async () => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return { ok: false, error: { code: 'INI_NOT_FOUND', path: 'X-Plane path not configured' } };
    }

    const manager = new SceneryManager(xplanePath);
    return manager.backup();
  });

  ipcMain.handle('addon:scenery:listBackups', async () => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return [];
    }

    const manager = new SceneryManager(xplanePath);
    return manager.listBackups();
  });

  ipcMain.handle('addon:scenery:restore', async (_event, backupPath: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return { ok: false, error: { code: 'INI_NOT_FOUND', path: 'X-Plane path not configured' } };
    }

    // Validate input
    if (
      typeof backupPath !== 'string' ||
      backupPath.length === 0 ||
      backupPath.length > 1000 ||
      backupPath.includes('..')
    ) {
      return {
        ok: false,
        error: { code: 'WRITE_FAILED', path: String(backupPath), reason: 'Invalid path' },
      };
    }

    const manager = new SceneryManager(xplanePath);
    return manager.restore(backupPath);
  });

  // ===== BROWSER: AIRCRAFT =====

  ipcMain.handle('addon:browser:scanAircraft', async () => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', path: 'X-Plane path not configured' } as BrowserError,
      };
    }
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    return { ok: true, value: manager.scanAircraft() };
  });

  ipcMain.handle('addon:browser:toggleAircraft', async (_event, folderName: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return err({ code: 'NOT_FOUND', path: 'X-Plane path not configured' } as BrowserError);
    }
    if (typeof folderName !== 'string' || folderName.length === 0 || folderName.length > 500) {
      return err({ code: 'INVALID_INPUT', field: 'folderName' } as BrowserError);
    }
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    return manager.toggleAircraft(folderName);
  });

  ipcMain.handle('addon:browser:deleteAircraft', async (_event, folderName: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return err({ code: 'NOT_FOUND', path: 'X-Plane path not configured' } as BrowserError);
    }
    if (typeof folderName !== 'string' || folderName.length === 0 || folderName.length > 500) {
      return err({ code: 'INVALID_INPUT', field: 'folderName' } as BrowserError);
    }
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    return manager.deleteAircraft(folderName);
  });

  ipcMain.handle('addon:browser:lockAircraft', async (_event, folderName: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', path: 'X-Plane path not configured' } as BrowserError,
      };
    }
    if (typeof folderName !== 'string' || folderName.length === 0 || folderName.length > 500) {
      return { ok: false, error: { code: 'INVALID_INPUT', field: 'folderName' } as BrowserError };
    }
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    return { ok: true, value: manager.lockAircraft(folderName) };
  });

  // ===== BROWSER: PLUGINS =====

  ipcMain.handle('addon:browser:scanPlugins', async () => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', path: 'X-Plane path not configured' } as BrowserError,
      };
    }
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    return { ok: true, value: manager.scanPlugins() };
  });

  ipcMain.handle('addon:browser:togglePlugin', async (_event, folderName: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return err({ code: 'NOT_FOUND', path: 'X-Plane path not configured' } as BrowserError);
    }
    if (typeof folderName !== 'string' || folderName.length === 0 || folderName.length > 500) {
      return err({ code: 'INVALID_INPUT', field: 'folderName' } as BrowserError);
    }
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    return manager.togglePlugin(folderName);
  });

  ipcMain.handle('addon:browser:deletePlugin', async (_event, folderName: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return err({ code: 'NOT_FOUND', path: 'X-Plane path not configured' } as BrowserError);
    }
    if (typeof folderName !== 'string' || folderName.length === 0 || folderName.length > 500) {
      return err({ code: 'INVALID_INPUT', field: 'folderName' } as BrowserError);
    }
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    return manager.deletePlugin(folderName);
  });

  ipcMain.handle('addon:browser:lockPlugin', async (_event, folderName: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', path: 'X-Plane path not configured' } as BrowserError,
      };
    }
    if (typeof folderName !== 'string' || folderName.length === 0 || folderName.length > 500) {
      return { ok: false, error: { code: 'INVALID_INPUT', field: 'folderName' } as BrowserError };
    }
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    return { ok: true, value: manager.lockPlugin(folderName) };
  });

  // ===== BROWSER: LIVERIES =====

  ipcMain.handle('addon:browser:scanLiveries', async (_event, aircraftFolder: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', path: 'X-Plane path not configured' } as BrowserError,
      };
    }
    if (
      typeof aircraftFolder !== 'string' ||
      aircraftFolder.length === 0 ||
      aircraftFolder.length > 500
    ) {
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', field: 'aircraftFolder' } as BrowserError,
      };
    }
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    return manager.scanLiveries(aircraftFolder);
  });

  ipcMain.handle(
    'addon:browser:deleteLivery',
    async (_event, aircraftFolder: unknown, liveryFolder: unknown) => {
      const xplanePath = getXPlanePath();
      if (!xplanePath) {
        return err({ code: 'NOT_FOUND', path: 'X-Plane path not configured' } as BrowserError);
      }
      if (
        typeof aircraftFolder !== 'string' ||
        typeof liveryFolder !== 'string' ||
        aircraftFolder.length === 0 ||
        aircraftFolder.length > 500 ||
        liveryFolder.length === 0 ||
        liveryFolder.length > 255
      ) {
        return err({ code: 'INVALID_INPUT', field: 'folder' } as BrowserError);
      }
      const appDataPath = app.getPath('userData');
      const manager = new BrowserManager(xplanePath, appDataPath);
      return manager.deleteLivery(aircraftFolder, liveryFolder);
    }
  );

  // ===== BROWSER: LUA SCRIPTS =====

  ipcMain.handle('addon:browser:scanLuaScripts', async () => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return { ok: true, value: [] };
    }
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    return { ok: true, value: manager.scanLuaScripts() };
  });

  ipcMain.handle('addon:browser:toggleLuaScript', async (_event, fileName: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return err({ code: 'NOT_FOUND', path: 'X-Plane path not configured' } as BrowserError);
    }
    if (typeof fileName !== 'string' || fileName.length === 0 || fileName.length > 255) {
      return err({ code: 'INVALID_INPUT', field: 'fileName' } as BrowserError);
    }
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    return manager.toggleLuaScript(fileName);
  });

  ipcMain.handle('addon:browser:deleteLuaScript', async (_event, fileName: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return err({ code: 'NOT_FOUND', path: 'X-Plane path not configured' } as BrowserError);
    }
    if (typeof fileName !== 'string' || fileName.length === 0 || fileName.length > 255) {
      return err({ code: 'INVALID_INPUT', field: 'fileName' } as BrowserError);
    }
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    return manager.deleteLuaScript(fileName);
  });

  // ===== BROWSER: UPDATES =====

  ipcMain.handle('addon:browser:checkAircraftUpdates', async (_event, aircraft: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return { ok: true, value: [] };
    }
    if (!Array.isArray(aircraft)) {
      return { ok: false, error: { code: 'INVALID_INPUT', field: 'aircraft' } as BrowserError };
    }
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    await manager.checkAircraftUpdates(aircraft);
    return { ok: true, value: aircraft };
  });

  ipcMain.handle('addon:browser:checkPluginUpdates', async (_event, plugins: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return { ok: true, value: [] };
    }
    if (!Array.isArray(plugins)) {
      return { ok: false, error: { code: 'INVALID_INPUT', field: 'plugins' } as BrowserError };
    }
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    await manager.checkPluginUpdates(plugins);
    return { ok: true, value: plugins };
  });

  // ===== BROWSER: ICONS =====

  ipcMain.handle('addon:browser:getAircraftIcon', async (_event, iconPath: unknown) => {
    if (typeof iconPath !== 'string' || !iconPath || iconPath.length > 1000) {
      return null;
    }

    // Security: only allow paths within X-Plane Aircraft folder
    const xplanePath = getXPlanePath();
    if (!xplanePath) return null;

    const aircraftDir = path.join(xplanePath, 'Aircraft');
    const resolvedPath = path.resolve(iconPath);
    if (!resolvedPath.startsWith(aircraftDir)) {
      return null; // Path traversal attempt
    }

    try {
      if (!fs.existsSync(resolvedPath)) return null;
      const buffer = fs.readFileSync(resolvedPath);
      const base64 = buffer.toString('base64');
      return `data:image/png;base64,${base64}`;
    } catch {
      return null;
    }
  });
}
