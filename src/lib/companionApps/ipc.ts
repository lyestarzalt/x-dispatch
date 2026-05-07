import { type BrowserWindow, dialog, ipcMain } from 'electron';
import logger from '@/lib/utils/logger';
import { type SpawnInput, type SpawnResult, spawnDetached } from './spawn';

export function registerCompanionAppsIPC(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('companion-apps:launch', async (_, input: SpawnInput): Promise<SpawnResult> => {
    logger.main.info(`companion-apps:launch ${input.exePath}`);
    return spawnDetached(input);
  });

  ipcMain.handle('companion-apps:browseForExe', async (): Promise<string | null> => {
    const win = getMainWindow();
    const opts: Electron.OpenDialogOptions = {
      title: 'Select companion app executable',
      properties: ['openFile'],
    };
    try {
      let result: Electron.OpenDialogReturnValue;
      if (win && !win.isDestroyed()) {
        // macOS: focus first so the dialog comes to the front (matches xplane:browseForPath / flightplan:openFile).
        if (!win.isFocused()) win.focus();
        result = await dialog.showOpenDialog(win, opts);
      } else {
        result = await dialog.showOpenDialog(opts);
      }
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0] ?? null;
    } catch (err) {
      logger.main.warn(`companion-apps:browseForExe failed: ${(err as Error).message}`);
      return null;
    }
  });
}
