import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import logger from '@/lib/utils/logger';

let captureWindow: BrowserWindow | null = null;

function getCaptureWindow(): BrowserWindow {
  if (captureWindow && !captureWindow.isDestroyed()) return captureWindow;
  captureWindow = new BrowserWindow({
    show: false,
    width: 1400,
    height: 1800,
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
      plugins: true,
    },
  });
  captureWindow.on('closed', () => {
    captureWindow = null;
  });
  return captureWindow;
}

function waitForLoad(win: BrowserWindow, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('PDF load timeout'));
    }, timeoutMs);

    const onFinish = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      clearTimeout(timer);
      win.webContents.removeListener('did-finish-load', onFinish);
      win.webContents.removeListener('did-fail-load', onFail);
    };

    const onFail = (_: unknown, code: number, desc: string) => {
      cleanup();
      reject(new Error(`PDF load failed (${code}): ${desc}`));
    };

    win.webContents.once('did-finish-load', onFinish);
    win.webContents.once('did-fail-load', onFail);
  });
}

/** Rasterize a local PDF via Chromium hidden window. */
export async function capturePdfToPng(pdfPath: string): Promise<Buffer | null> {
  if (!fs.existsSync(pdfPath)) return null;

  const win = getCaptureWindow();
  const url = pathToFileURL(pdfPath).href;

  try {
    await win.loadURL(url);
    await waitForLoad(win);
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
    const image = await win.webContents.capturePage();
    return image.toPNG();
  } catch (err) {
    logger.main.error('PDF capture failed', err);
    return null;
  }
}

/** Rasterize via vac-pdf:// protocol (same stream as in-app viewer). */
export async function captureVacPdfToPng(icao: string): Promise<Buffer | null> {
  const code = icao.toUpperCase();
  if (!code) return null;

  const win = getCaptureWindow();
  const url = `vac-pdf://${code}/chart.pdf`;

  try {
    await win.loadURL(url);
    await waitForLoad(win);
    await new Promise<void>((resolve) => setTimeout(resolve, 900));
    const image = await win.webContents.capturePage();
    return image.toPNG();
  } catch (err) {
    logger.main.warn(`VAC protocol capture failed for ${code}, falling back to file URL`, err);
    return null;
  }
}
