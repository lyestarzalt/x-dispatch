import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { validateXPlanePath } from './paths';

export interface XPlaneConfig {
  xplanePath: string;
  version: number;
  lastUpdated: string;
}

const CONFIG_VERSION = 1;
const CONFIG_FILENAME = 'xplane-config.json';

function getConfigPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, CONFIG_FILENAME);
}

export function loadConfig(): XPlaneConfig | null {
  try {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
      return null;
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as XPlaneConfig;

    if (config.xplanePath && !fs.existsSync(config.xplanePath)) {
      return null;
    }

    return config;
  } catch {
    return null;
  }
}

export function saveConfig(config: Partial<XPlaneConfig>): boolean {
  try {
    const configPath = getConfigPath();
    const existing = loadConfig();

    const newConfig: XPlaneConfig = {
      xplanePath: config.xplanePath || existing?.xplanePath || '',
      version: CONFIG_VERSION,
      lastUpdated: new Date().toISOString(),
    };

    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export function getXPlanePath(): string | null {
  const config = loadConfig();
  if (config?.xplanePath) {
    const validation = validateXPlanePath(config.xplanePath);
    if (validation.valid) {
      return config.xplanePath;
    }
  }
  return null;
}

export function isSetupComplete(): boolean {
  const config = loadConfig();
  if (!config?.xplanePath) return false;
  return validateXPlanePath(config.xplanePath).valid;
}

export function setXPlanePath(xplanePath: string): { success: boolean; errors: string[] } {
  const validation = validateXPlanePath(xplanePath);

  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const saved = saveConfig({ xplanePath });
  if (!saved) {
    return { success: false, errors: ['Failed to save configuration'] };
  }

  return { success: true, errors: [] };
}
