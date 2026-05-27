import { app } from 'electron';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import { MbtilesReader } from './MbtilesReader';

const CONFIG_NAME = 'oaci-mbtiles.json';

export interface OaciMbtilesConfig {
  path: string;
  name: string;
  installedAt: number;
}

let reader: MbtilesReader | null = null;
let config: OaciMbtilesConfig | null = null;

function configPath(): string {
  return path.join(app.getPath('userData'), 'sia-data', CONFIG_NAME);
}

export function loadOaciMbtilesConfig(): OaciMbtilesConfig | null {
  const p = configPath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as OaciMbtilesConfig;
  } catch {
    return null;
  }
}

async function saveConfig(cfg: OaciMbtilesConfig): Promise<void> {
  await fsp.mkdir(path.dirname(configPath()), { recursive: true });
  await fsp.writeFile(configPath(), JSON.stringify(cfg, null, 2), 'utf-8');
  config = cfg;
}

export async function setOaciMbtilesFile(
  sourcePath: string,
  displayName?: string
): Promise<{ success: boolean; error?: string }> {
  if (!fs.existsSync(sourcePath)) {
    return { success: false, error: 'File not found' };
  }
  const destDir = path.join(app.getPath('userData'), 'sia-data', 'mbtiles');
  await fsp.mkdir(destDir, { recursive: true });
  const dest = path.join(destDir, 'oaci.mbtiles');
  await fsp.copyFile(sourcePath, dest);

  if (reader) {
    reader.close();
    reader = null;
  }

  const next: OaciMbtilesConfig = {
    path: dest,
    name: displayName ?? path.basename(sourcePath, '.mbtiles'),
    installedAt: Date.now(),
  };
  await saveConfig(next);

  try {
    reader = new MbtilesReader(dest);
    await reader.open();
    return { success: true };
  } catch (err) {
    logger.main.error('Failed to open MBTiles', err);
    return { success: false, error: (err as Error).message };
  }
}

export async function initMbtilesStore(): Promise<void> {
  config = loadOaciMbtilesConfig();
  if (!config?.path || !fs.existsSync(config.path)) return;
  try {
    reader = new MbtilesReader(config.path);
    await reader.open();
  } catch (err) {
    logger.main.warn('OACI MBTiles not loaded', err);
    reader = null;
  }
}

export function getOaciMbtilesConfig(): OaciMbtilesConfig | null {
  return config ?? loadOaciMbtilesConfig();
}

export function getMbtilesReader(): MbtilesReader | null {
  return reader;
}

export async function clearOaciMbtiles(): Promise<void> {
  if (reader) {
    reader.close();
    reader = null;
  }
  config = null;
  const p = configPath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
  const dest = path.join(app.getPath('userData'), 'sia-data', 'mbtiles', 'oaci.mbtiles');
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
}
