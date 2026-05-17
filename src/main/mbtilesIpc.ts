import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron';
import {
  clearOaciMbtiles,
  getOaciMbtilesConfig,
  initMbtilesStore,
  setOaciMbtilesFile,
} from '@/lib/mbtiles/MbtilesStore';

export async function registerMbtilesIPC(getMainWindow: () => BrowserWindow | null): Promise<void> {
  await initMbtilesStore();

  ipcMain.handle('mbtiles:getConfig', () => getOaciMbtilesConfig());

  ipcMain.handle('mbtiles:browseAndImport', async () => {
    const win = getMainWindow();
    const opts: OpenDialogOptions = {
      title: 'Import OACI MBTiles',
      properties: ['openFile'],
      filters: [{ name: 'MBTiles', extensions: ['mbtiles'] }],
    };
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts);
    if (result.canceled || !result.filePaths[0]) return { success: false, error: 'cancelled' };
    return setOaciMbtilesFile(result.filePaths[0]);
  });

  ipcMain.handle('mbtiles:importPath', (_, filePath: string, name?: string) =>
    setOaciMbtilesFile(filePath, name)
  );

  ipcMain.handle('mbtiles:clear', async () => {
    await clearOaciMbtiles();
    return { success: true };
  });
}
