// src/lib/addonManager/ipc.ts
// IPC handlers for Addon Manager features
import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import { BrowserManager } from './browser';
import type { BrowserError } from './core/types';
import { err } from './core/types';
import { InstallerManager } from './installer';
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

    return manager.save(analyzeResult.value, false); // Explicit sort requested by user
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
    logger.addon.info(`Deleting aircraft: ${folderName}`);
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    const result = manager.deleteAircraft(folderName);
    if (!result.ok) {
      logger.addon.error(`Failed to delete aircraft ${folderName}: ${result.error.code}`);
    }
    return result;
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
    logger.addon.info(`Deleting plugin: ${folderName}`);
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    const result = manager.deletePlugin(folderName);
    if (!result.ok) {
      logger.addon.error(`Failed to delete plugin ${folderName}: ${result.error.code}`);
    }
    return result;
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
      logger.addon.info(`Deleting livery: ${liveryFolder} from ${aircraftFolder}`);
      const appDataPath = app.getPath('userData');
      const manager = new BrowserManager(xplanePath, appDataPath);
      const result = manager.deleteLivery(aircraftFolder, liveryFolder);
      if (!result.ok) {
        logger.addon.error(`Failed to delete livery: ${result.error.code}`);
      }
      return result;
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
    logger.addon.info(`Deleting Lua script: ${fileName}`);
    const appDataPath = app.getPath('userData');
    const manager = new BrowserManager(xplanePath, appDataPath);
    const result = manager.deleteLuaScript(fileName);
    if (!result.ok) {
      logger.addon.error(`Failed to delete Lua script ${fileName}: ${result.error.code}`);
    }
    return result;
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
      logger.security.warn(`Icon path traversal blocked: ${iconPath}`);
      return null;
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

  // ===== INSTALLER =====

  ipcMain.handle('addon:installer:browse', async () => {
    const { dialog, BrowserWindow } = await import('electron');
    const mainWindow = BrowserWindow.getFocusedWindow();

    const dialogOptions: Electron.OpenDialogOptions = {
      title: 'Select Addon Archives',
      filters: [
        { name: 'Archive Files', extensions: ['zip', '7z', 'rar'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    };

    try {
      const result = mainWindow
        ? await dialog.showOpenDialog(mainWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: true, value: [] };
      }

      return { ok: true, value: result.filePaths };
    } catch (e) {
      return { ok: false, error: { code: 'BROWSE_FAILED', reason: String(e) } };
    }
  });

  ipcMain.handle('addon:installer:analyze', async (_event, filePaths: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return { ok: false, error: { code: 'NOT_FOUND', path: 'X-Plane path not configured' } };
    }

    // Validate input
    if (!Array.isArray(filePaths) || !filePaths.every((p) => typeof p === 'string')) {
      return { ok: false, error: { code: 'INVALID_INPUT', field: 'filePaths' } };
    }

    // Security: validate paths
    for (const filePath of filePaths) {
      if (filePath.includes('..') || filePath.length > 1000) {
        logger.security.warn(`Path traversal attempt in installer analyze: ${filePath}`);
        return { ok: false, error: { code: 'PATH_TRAVERSAL', path: filePath } };
      }
    }

    try {
      logger.addon.debug(`Analyzing ${filePaths.length} archive(s)`);
      const manager = new InstallerManager(xplanePath);
      return manager.analyze(filePaths as string[]);
    } catch (e) {
      logger.addon.error(`Analyze failed: ${e}`);
      return { ok: false, error: { code: 'EXTRACTION_FAILED', path: '', reason: String(e) } };
    }
  });

  ipcMain.handle('addon:installer:prepareInstall', async (_event, items: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return { ok: false, error: { code: 'NOT_FOUND', path: 'X-Plane path not configured' } };
    }

    // Validate input
    if (!Array.isArray(items)) {
      return { ok: false, error: { code: 'INVALID_INPUT', field: 'items' } };
    }

    try {
      const manager = new InstallerManager(xplanePath);
      const tasks = manager.prepareInstallTasks(items);
      return { ok: true, value: tasks };
    } catch (e) {
      return { ok: false, error: { code: 'INSTALL_FAILED', path: '', reason: String(e) } };
    }
  });

  ipcMain.handle('addon:installer:install', async (_event, tasks: unknown) => {
    const xplanePath = getXPlanePath();
    if (!xplanePath) {
      return { ok: false, error: { code: 'NOT_FOUND', path: 'X-Plane path not configured' } };
    }

    // Validate input
    if (!Array.isArray(tasks)) {
      return { ok: false, error: { code: 'INVALID_INPUT', field: 'tasks' } };
    }

    // Security: validate task paths
    for (const task of tasks) {
      if (typeof task !== 'object' || task === null) {
        return { ok: false, error: { code: 'INVALID_INPUT', field: 'task' } };
      }
      const t = task as Record<string, unknown>;
      if (
        typeof t.sourcePath !== 'string' ||
        t.sourcePath.includes('..') ||
        typeof t.targetPath !== 'string' ||
        t.targetPath.includes('..')
      ) {
        logger.security.warn(`Path traversal attempt in install task: ${t.sourcePath}`);
        return { ok: false, error: { code: 'PATH_TRAVERSAL', path: String(t.sourcePath) } };
      }
    }

    try {
      logger.addon.info(`Installing ${tasks.length} addon(s)`);
      const manager = new InstallerManager(xplanePath);
      const { BrowserWindow } = await import('electron');

      const result = await manager.install(tasks as never[], {
        onProgress: (progress) => {
          // Send progress to all windows
          BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send('addon:installer:progress', progress);
          });
        },
      });

      if (result.ok) {
        const succeeded = result.value.filter((r) => r.success).length;
        const failed = result.value.filter((r) => !r.success).length;
        logger.addon.info(`Installation complete: ${succeeded} succeeded, ${failed} failed`);
      }

      return result;
    } catch (e) {
      logger.addon.error(`Installation failed: ${e}`);
      return { ok: false, error: { code: 'INSTALL_FAILED', path: '', reason: String(e) } };
    }
  });
}
