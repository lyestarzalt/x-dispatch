// src/lib/addonManager/ipc.ts
// IPC handlers for Addon Manager features
import { ipcMain } from 'electron';
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
    if (typeof folderName !== 'string' || folderName.length === 0 || folderName.length > 500) {
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
    if (typeof folderName !== 'string' || folderName.length === 0 || folderName.length > 500) {
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
    if (typeof backupPath !== 'string' || backupPath.includes('..')) {
      return {
        ok: false,
        error: { code: 'WRITE_FAILED', path: String(backupPath), reason: 'Invalid path' },
      };
    }

    const manager = new SceneryManager(xplanePath);
    return manager.restore(backupPath);
  });
}
