import type { BrowserWindow } from 'electron';
import { registerVacPdfHandler, unregisterVacPdfHandler } from '@/modules/sia-france/lib/vacPdfProtocol';
import logger from '@/lib/utils/logger';
import { registerSiaIPC, unregisterSiaIPC } from './siaIpc';

const SIA_MODULE_ID = 'sia-france';

let siaRuntimeEnabled = false;

export function isSiaFranceRuntimeEnabled(): boolean {
  return siaRuntimeEnabled;
}

export async function enableSiaFranceModule(
  getMainWindow: () => BrowserWindow | null
): Promise<void> {
  if (siaRuntimeEnabled) return;
  registerVacPdfHandler();
  registerSiaIPC(getMainWindow);
  siaRuntimeEnabled = true;
  logger.main.info(`${SIA_MODULE_ID} runtime enabled`);
}

export async function disableSiaFranceModule(): Promise<void> {
  if (!siaRuntimeEnabled) return;
  unregisterSiaIPC();
  unregisterVacPdfHandler();
  siaRuntimeEnabled = false;
  logger.main.info(`${SIA_MODULE_ID} runtime disabled`);
}

export async function syncSiaFranceModule(
  getMainWindow: () => BrowserWindow | null,
  enabled: boolean
): Promise<void> {
  if (enabled) {
    await enableSiaFranceModule(getMainWindow);
  } else {
    await disableSiaFranceModule();
  }
}
