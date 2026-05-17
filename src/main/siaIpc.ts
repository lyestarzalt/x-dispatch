import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  SIA_PRODUCT_CATALOG,
  clearCredentials,
  enrichCatalogWithDiscovery,
  getChartStore,
  getCredentialsStatus,
  loginCustomer,
  saveCredentials,
} from '@/lib/sia';
import type { AirportGeorefInput } from '@/lib/sia/georef';
import type { SiaDownloadProgress } from '@/lib/sia/types';
import logger from '@/lib/utils/logger';
import { capturePdfToPng } from './pdfCapture';

function sendProgress(win: BrowserWindow | null, progress: SiaDownloadProgress): void {
  win?.webContents.send('sia:download-progress', progress);
}

export function registerSiaIPC(getMainWindow: () => BrowserWindow | null): void {
  const store = getChartStore();
  store.init();

  ipcMain.handle('sia:listProducts', async () => {
    try {
      return await enrichCatalogWithDiscovery();
    } catch (err) {
      logger.main.warn('SIA catalog discovery failed, using static catalog', err);
      return SIA_PRODUCT_CATALOG;
    }
  });

  ipcMain.handle('sia:getCredentialsStatus', () => getCredentialsStatus());

  ipcMain.handle('sia:saveCredentials', (_, email: string, password: string) => {
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return { success: false, error: 'Invalid credentials' };
    }
    return saveCredentials({ email, password });
  });

  ipcMain.handle('sia:clearCredentials', () => {
    clearCredentials();
    return { success: true };
  });

  ipcMain.handle('sia:testLogin', async (_, email: string, password: string) => {
    if (!email || !password) return { success: false, error: 'Invalid credentials' };
    const result = await loginCustomer({ email, password });
    if ('error' in result) return { success: false, error: result.error };
    return { success: true };
  });

  ipcMain.handle('sia:getInstallStatus', () => store.getInstallStatus());

  ipcMain.handle('sia:getVacForIcao', async (_, icao: string, airport: AirportGeorefInput | null) => {
    if (!icao || typeof icao !== 'string') return null;
    const code = icao.toUpperCase();
    let info = store.getVacInfo(code, airport);
    if (!info) {
      const count = await store.reindexFromDisk();
      logger.main.info(`SIA getVacForIcao ${code}: reindexed, ${count} entries in manifest`);
      info = store.getVacInfo(code, airport);
    }
    if (!info) {
      logger.main.warn(`SIA getVacForIcao: no chart indexed for ${code}`);
    }
    return info;
  });

  ipcMain.handle('sia:reindexVac', async () => {
    try {
      const count = await store.reindexFromDisk();
      return { success: true, count };
    } catch (err) {
      logger.main.error('sia:reindexVac failed', err);
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('sia:renderVacPng', async (_, icao: string) => {
    if (!icao || typeof icao !== 'string') return null;
    const code = icao.toUpperCase();
    const cached = store.readVacPng(code);
    if (cached) return Uint8Array.from(cached);

    let pdfPath = store.getVacPdfPath(code);
    if (!pdfPath) {
      await store.reindexFromDisk();
      pdfPath = store.getVacPdfPath(code);
    }
    if (!pdfPath) return null;

    const png = await capturePdfToPng(pdfPath);
    if (!png?.length) return null;
    store.writeVacPng(code, png);
    return Uint8Array.from(png);
  });

  ipcMain.handle('sia:getVacPdfBytes', (_, icao: string) => {
    if (!icao || typeof icao !== 'string') return null;
    const buf = store.readVacPdf(icao);
    return buf ? Uint8Array.from(buf) : null;
  });

  ipcMain.handle('sia:getVacPngBytes', (_, icao: string) => {
    if (!icao || typeof icao !== 'string') return null;
    const buf = store.readVacPng(icao);
    return buf ? Uint8Array.from(buf) : null;
  });

  ipcMain.handle('sia:getPdfjsWorkerUrl', () => {
    const candidates = [
      path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        'node_modules',
        'pdfjs-dist',
        'build',
        'pdf.worker.min.mjs'
      ),
      path.join(app.getAppPath(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
      path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
    ];
    for (const workerPath of candidates) {
      if (fs.existsSync(workerPath)) return pathToFileURL(workerPath).href;
    }
    return null;
  });

  ipcMain.handle('sia:writePngCache', (_, icao: string, data: Uint8Array) => {
    if (!icao || typeof icao !== 'string') return { success: false };
    const buf = Buffer.from(data);
    const pngPath = store.writePngCache(icao.toUpperCase(), buf);
    return { success: true, path: pngPath };
  });

  ipcMain.handle('sia:clearCache', async () => {
    try {
      await store.clearCache();
      store.init();
      return { success: true };
    } catch (err) {
      logger.main.error('sia:clearCache failed', err);
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('sia:downloadProduct', async (_, productId: string) => {
    const win = getMainWindow();
    try {
      const result = await store.downloadAndInstall(productId, (p) => sendProgress(win, p));
      return result;
    } catch (err) {
      logger.main.error('sia:downloadProduct failed', err);
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('sia:installFromLocalZip', async (_, zipPath: string, productId: string) => {
    if (!zipPath || !fs.existsSync(zipPath)) {
      return { success: false, error: 'File not found' };
    }
    const resolved = path.resolve(zipPath);
    const win = getMainWindow();
    try {
      return await store.installFromLocalZip(resolved, productId, (p) => sendProgress(win, p));
    } catch (err) {
      logger.main.error('sia:installFromLocalZip failed', err);
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('sia:browseForZip', async () => {
    const win = getMainWindow();
    const opts: OpenDialogOptions = {
      title: 'Import eAIP ZIP',
      properties: ['openFile'],
      filters: [{ name: 'ZIP archives', extensions: ['zip', '7z'] }],
    };
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts);
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('sia:getOaciAirspaces', () => store.loadOaciAirspaces());

  ipcMain.handle('sia:openVacPdf', (_, icao: string) => {
    const pdfPath = store.getVacPdfPath(icao?.toUpperCase() ?? '');
    if (!pdfPath) return { success: false };
    void shell.openPath(pdfPath);
    return { success: true };
  });

  logger.main.info('SIA IPC handlers registered');
}
