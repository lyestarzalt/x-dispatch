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
    },
  });
  captureWindow.on('closed', () => {
    captureWindow = null;
  });
  return captureWindow;
}

/** Rasterize a local PDF via Chromium (works when <embed> in renderer does not). */
export async function capturePdfToPng(pdfPath: string): Promise<Buffer | null> {
  if (!fs.existsSync(pdfPath)) return null;

  const win = getCaptureWindow();
  const url = pathToFileURL(pdfPath).href;

  try {
    await win.loadURL(url);
    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    const image = await win.webContents.capturePage();
    return image.toPNG();
  } catch (err) {
    logger.main.error('PDF capture failed', err);
    return null;
  }
}
