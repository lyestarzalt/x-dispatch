import { BrowserWindow, type OpenDialogOptions, dialog, ipcMain } from 'electron';
import {
  clearOaciMbtiles,
  getOaciMbtilesConfig,
  initMbtilesStore,
  setOaciMbtilesFile,
} from '@/lib/mbtiles/MbtilesStore';

const MBTILES_IPC_CHANNELS = [
  'mbtiles:getConfig',
  'mbtiles:browseAndImport',
  'mbtiles:importPath',
  'mbtiles:clear',
] as const;

let mbtilesIpcRegistered = false;

export async function registerMbtilesIPC(getMainWindow: () => BrowserWindow | null): Promise<void> {
  if (mbtilesIpcRegistered) return;
  await initMbtilesStore();

  ipcMain.handle('mbtiles:getConfig', () => getOaciMbtilesConfig());

  ipcMain.handle('mbtiles:browseAndImport', async () => {
    const win = getMainWindow();
    const opts: OpenDialogOptions = {
      title: 'Import OACI MBTiles',
      properties: ['openFile'],
      filters: [{ name: 'MBTiles', extensions: ['mbtiles'] }],
    };
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
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

  mbtilesIpcRegistered = true;
}

export function unregisterMbtilesIPC(): void {
  if (!mbtilesIpcRegistered) return;
  for (const channel of MBTILES_IPC_CHANNELS) {
    ipcMain.removeHandler(channel);
  }
  mbtilesIpcRegistered = false;
}
