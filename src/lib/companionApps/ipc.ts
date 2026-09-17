import { type BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { isElevated } from '@/lib/utils/isElevated';
import logger from '@/lib/utils/logger';
import { type SpawnInput, type SpawnResult, launchCompanionApp } from './spawn';

export function registerCompanionAppsIPC(getMainWindow: () => BrowserWindow | null): void {
  let lastBrowsedDir: string | null = null;

  ipcMain.handle('companion-apps:launch', async (_, input: SpawnInput): Promise<SpawnResult> => {
    logger.main.info(`companion-apps:launch ${input.exePath}`);
    return launchCompanionApp(input);
  });

  ipcMain.handle('companion-apps:isElevated', async (): Promise<boolean> => {
    return isElevated();
  });

  ipcMain.handle(
    'companion-apps:browseForExe',
    async (_, currentExePath?: string): Promise<string | null> => {
      const win = getMainWindow();
      const anchor =
        typeof currentExePath === 'string' && currentExePath.length > 0
          ? currentExePath
          : lastBrowsedDir;
      const opts: Electron.OpenDialogOptions = {
        title: 'Select companion app executable',
        properties: ['openFile'],
        defaultPath: anchor ?? undefined,
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
        const picked = result.filePaths[0] ?? null;
        if (picked) lastBrowsedDir = path.dirname(picked);
        return picked;
      } catch (err) {
        logger.main.warn(`companion-apps:browseForExe failed: ${(err as Error).message}`);
        return null;
      }
    }
  );
}
