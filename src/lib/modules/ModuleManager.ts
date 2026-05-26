import { app } from 'electron';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import path from 'path';
import { extractArchive } from '@/lib/addonManager/installer/extraction';
import logger from '@/lib/utils/logger';
import { compareSemverLike, isModuleManifest, parseGithubRepo } from './manifest';
import type {
  InstalledModuleState,
  ModuleCatalogEntry,
  ModuleCatalogFile,
  ModuleRuntimeInfo,
  XDispatchModuleManifest,
} from './types';

interface ModulesStateFile {
  modules: InstalledModuleState[];
}

const MANIFEST_NAME = 'x-dispatch-module.json';
const STATE_FILE_NAME = 'modules-state.json';
const CATALOG_PATH = path.join(app.getAppPath(), 'registry', 'modules.json');
const APP_VERSION = app.getVersion();

export class ModuleManager {
  private readonly modulesRoot = path.join(app.getPath('userData'), 'community-modules');

  private readonly statePath = path.join(this.modulesRoot, STATE_FILE_NAME);

  private state: InstalledModuleState[] = [];

  private bundledManifests = new Map<string, XDispatchModuleManifest>();

  async init(bundled: XDispatchModuleManifest[] = []): Promise<void> {
    await fsp.mkdir(this.modulesRoot, { recursive: true });
    this.bundledManifests = new Map(bundled.map((m) => [m.id, m]));
    await this.loadState();
    let changed = false;
    for (const manifest of bundled) {
      if (manifest.minAppVersion && !compareSemverLike(APP_VERSION, manifest.minAppVersion)) {
        logger.main.warn(`Bundled module ${manifest.id} disabled by minAppVersion`);
      }
      const existing = this.state.find((m) => m.id === manifest.id);
      if (!existing) {
        const defaultEnabled =
          manifest.kind === 'bundled' ? (manifest.defaultEnabled ?? false) : true;
        this.state.push({
          id: manifest.id,
          enabled: defaultEnabled,
          source: 'bundled',
          installedAt: new Date().toISOString(),
          trusted: true,
        });
        changed = true;
      }
    }
    if (changed) await this.saveState();
  }

  async getCatalog(): Promise<ModuleCatalogEntry[]> {
    try {
      const raw = await fsp.readFile(CATALOG_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as ModuleCatalogFile;
      return Array.isArray(parsed.modules) ? parsed.modules : [];
    } catch (err) {
      logger.main.warn('Cannot load module catalog', err);
      return [];
    }
  }

  async listModules(): Promise<ModuleRuntimeInfo[]> {
    const out: ModuleRuntimeInfo[] = [];
    for (const item of this.state) {
      const manifest = await this.getManifestForState(item);
      if (!manifest) continue;
      out.push({ manifest, state: item });
    }
    return out.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
  }

  async installFromZip(zipPath: string, source: 'zip' | 'github', repository?: string): Promise<{
    success: boolean;
    error?: string;
    moduleId?: string;
  }> {
    try {
      const tempDir = await fsp.mkdtemp(path.join(this.modulesRoot, '.tmp-module-'));
      const extractResult = await extractArchive({ archivePath: zipPath, targetDir: tempDir });
      if (!extractResult.ok) {
        return { success: false, error: `Extraction failed: ${extractResult.error.code}` };
      }

      const manifestPath = await this.findManifestPath(tempDir);
      if (!manifestPath) return { success: false, error: `Missing ${MANIFEST_NAME}` };
      const raw = await fsp.readFile(manifestPath, 'utf-8');
      const manifestUnknown = JSON.parse(raw);
      if (!isModuleManifest(manifestUnknown)) {
        return { success: false, error: 'Invalid module manifest schema' };
      }
      const manifest = manifestUnknown as XDispatchModuleManifest;
      if (manifest.kind !== 'external') {
        return { success: false, error: 'Only external modules can be installed from ZIP' };
      }
      if (manifest.minAppVersion && !compareSemverLike(APP_VERSION, manifest.minAppVersion)) {
        return {
          success: false,
          error: `Module requires app >= ${manifest.minAppVersion}, current ${APP_VERSION}`,
        };
      }

      const finalDir = path.join(this.modulesRoot, manifest.id, manifest.version);
      await fsp.mkdir(path.dirname(finalDir), { recursive: true });
      if (fs.existsSync(finalDir)) await fsp.rm(finalDir, { recursive: true, force: true });
      await fsp.rename(path.dirname(manifestPath), finalDir);
      await fsp.rm(tempDir, { recursive: true, force: true });

      const trusted = await this.isTrustedRepository(repository ?? '');
      const now = new Date().toISOString();
      this.state = this.state.filter((m) => m.id !== manifest.id || m.source === 'bundled');
      this.state.push({
        id: manifest.id,
        enabled: true,
        source,
        installPath: finalDir,
        repository,
        installedAt: now,
        trusted,
      });
      await this.saveState();
      return { success: true, moduleId: manifest.id };
    } catch (err) {
      logger.main.error('Module install from ZIP failed', err);
      return { success: false, error: (err as Error).message };
    }
  }

  async installFromGithub(input: string): Promise<{ success: boolean; error?: string; moduleId?: string }> {
    const repo = parseGithubRepo(input);
    if (!repo) return { success: false, error: 'Invalid GitHub repository URL' };

    const apiHeaders: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'x-dispatch-module-manager',
    };
    const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
    try {
      const relRes = await fetch(apiUrl, { headers: apiHeaders });
      if (!relRes.ok) return { success: false, error: `GitHub API error: ${relRes.status}` };
      const release = (await relRes.json()) as {
        assets?: Array<{ name: string; browser_download_url: string }>;
        zipball_url?: string;
      };
      const asset =
        release.assets?.find((a) => a.name.toLowerCase().endsWith('.zip'))?.browser_download_url ??
        release.zipball_url;
      if (!asset) return { success: false, error: 'No downloadable ZIP found for this release' };

      const tmpZip = path.join(this.modulesRoot, `.download-${Date.now()}.zip`);
      const dlRes = await fetch(asset, { headers: apiHeaders });
      if (!dlRes.ok) return { success: false, error: `Download failed: ${dlRes.status}` };
      const arr = new Uint8Array(await dlRes.arrayBuffer());
      await fsp.writeFile(tmpZip, arr);
      const installed = await this.installFromZip(tmpZip, 'github', repo);
      await fsp.rm(tmpZip, { force: true });
      return installed;
    } catch (err) {
      logger.main.error('Module install from GitHub failed', err);
      return { success: false, error: (err as Error).message };
    }
  }

  async setEnabled(moduleId: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
    const target = this.state.find((m) => m.id === moduleId);
    if (!target) return { success: false, error: 'Unknown module' };
    target.enabled = enabled;
    await this.saveState();
    return { success: true };
  }

  async uninstall(moduleId: string): Promise<{ success: boolean; error?: string }> {
    const target = this.state.find((m) => m.id === moduleId && m.source !== 'bundled');
    if (!target) return { success: false, error: 'Only external modules can be removed' };
    if (target.installPath && fs.existsSync(target.installPath)) {
      await fsp.rm(target.installPath, { recursive: true, force: true });
    }
    this.state = this.state.filter((m) => !(m.id === moduleId && m.source !== 'bundled'));
    await this.saveState();
    return { success: true };
  }

  async browseForZip(_win?: Electron.BrowserWindow | null): Promise<string | null> {
    return null;
  }

  async getEnabledModuleIds(): Promise<Set<string>> {
    await this.loadState();
    return new Set(this.state.filter((m) => m.enabled).map((m) => m.id));
  }

  isModuleEnabled(moduleId: string): boolean {
    return this.state.some((m) => m.id === moduleId && m.enabled);
  }

  private async isTrustedRepository(repository: string): Promise<boolean> {
    if (!repository) return false;
    const trusted = await this.getCatalog();
    return trusted.some((m) => m.repository.toLowerCase() === repository.toLowerCase() && m.trusted);
  }

  private async getManifestForState(state: InstalledModuleState): Promise<XDispatchModuleManifest | null> {
    if (state.source === 'bundled') {
      return this.bundledManifests.get(state.id) ?? null;
    }
    if (!state.installPath) return null;
    const manifestPath = path.join(state.installPath, MANIFEST_NAME);
    try {
      const raw = await fsp.readFile(manifestPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return isModuleManifest(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private async findManifestPath(rootDir: string): Promise<string | null> {
    const queue: string[] = [rootDir];
    while (queue.length > 0) {
      const current = queue.shift()!;
      let entries: fs.Dirent[];
      try {
        entries = await fsp.readdir(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.isFile() && entry.name === MANIFEST_NAME) {
          return path.join(current, entry.name);
        }
      }
      for (const entry of entries) {
        if (entry.isDirectory()) queue.push(path.join(current, entry.name));
      }
    }
    return null;
  }

  private async loadState(): Promise<void> {
    try {
      const raw = await fsp.readFile(this.statePath, 'utf-8');
      const parsed = JSON.parse(raw) as ModulesStateFile;
      this.state = Array.isArray(parsed.modules) ? parsed.modules : [];
    } catch {
      this.state = [];
    }
  }

  private async saveState(): Promise<void> {
    const payload: ModulesStateFile = { modules: this.state };
    await fsp.mkdir(path.dirname(this.statePath), { recursive: true });
    await fsp.writeFile(this.statePath, JSON.stringify(payload, null, 2), 'utf-8');
  }
}
