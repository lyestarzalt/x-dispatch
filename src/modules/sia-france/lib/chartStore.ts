import { app } from 'electron';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { eq } from 'drizzle-orm';
import { extractArchive } from '@/lib/addonManager/installer/extraction';
import { getDb, saveDb } from '@/lib/db';
import { metadata, siaCharts } from '@/lib/db/schema';
import logger from '@/lib/utils/logger';
import { getCatalogProduct, getLatestCatalogCycle, VAC_IMPORT_PRODUCT } from './catalog';
import { resolveMagentoProduct } from './catalogDiscovery';
import { downloadToFile, getDirSizeBytes, type DownloadProgressCallback } from './downloader';
import { loadCredentials } from './siaCredentials';
import { purchaseAndGetDownloadUrl } from './siaGraphqlClient';
import { indexEaipExtract, indexGenericVacPdfs, indexVacAmendmentPdfs } from './eaipIndexer';
import { extractNestedArchives } from './nestedArchive';
import type {
  SiaInstallManifest,
  SiaInstallStatus,
  VacChartEntry,
  VacChartInfo,
} from './types';
import { resolveVacGeoref, type AirportGeorefInput } from './georef';
import { loadOaciAirspacesFromIndex } from './xml/airspaceParser';
import { extractEaipRelativeSuffix, findPdfByBasename } from './pdfPathResolve';
import { migrateLegacyVacIndex, recoverInstalledProductsFromExtractDir, reindexVacFromManifest } from './vacReindex';
import { findAipEntryForIcao, findVacEntryForIcao, findVacPlateForIcao } from './vacIndex';

const MANIFEST_VERSION = 1 as const;
const METADATA_CYCLE_KEY = 'sia_eaip_cycle';
const METADATA_INSTALLED_KEY = 'sia_installed_at';
/** eAIP full ZIP can exceed 1 GB — allow long extraction on slow disks. */
const EXTRACT_TIMEOUT_MS = 2 * 60 * 60 * 1000;

function emitInstallError(
  productId: string,
  error: string,
  onProgress?: DownloadProgressCallback
): { success: false; error: string } {
  onProgress?.({
    productId,
    phase: 'error',
    percent: 0,
    message: error,
  });
  return { success: false, error };
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

let storeInstance: ChartStore | null = null;

export function getChartStore(): ChartStore {
  if (!storeInstance) storeInstance = new ChartStore();
  return storeInstance;
}

export class ChartStore {
  readonly rootDir: string;
  readonly downloadsDir: string;
  readonly extractDir: string;
  readonly georefDir: string;
  readonly pngCacheDir: string;
  private manifest: SiaInstallManifest;

  constructor() {
    this.rootDir = path.join(app.getPath('userData'), 'sia-data');
    this.downloadsDir = path.join(this.rootDir, 'downloads');
    this.extractDir = path.join(this.rootDir, 'extracted');
    this.georefDir = path.join(this.rootDir, 'georef');
    this.pngCacheDir = path.join(this.rootDir, 'png-cache');
    this.manifest = this.loadManifest();
  }

  init(): void {
    for (const dir of [
      this.rootDir,
      this.downloadsDir,
      this.extractDir,
      this.georefDir,
      this.pngCacheDir,
    ]) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private manifestPath(): string {
    return path.join(this.rootDir, 'manifest.json');
  }

  private emptyManifest(): SiaInstallManifest {
    return {
      version: MANIFEST_VERSION,
      installedProducts: {},
      vacIndex: {},
      aipIndex: {},
      cycle: null,
      installedAt: null,
    };
  }

  private loadManifest(): SiaInstallManifest {
    const p = this.manifestPath();
    if (!fs.existsSync(p)) return this.emptyManifest();
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as SiaInstallManifest;
      if (!raw.aipIndex) raw.aipIndex = {};
      return migrateLegacyVacIndex(raw);
    } catch {
      return this.emptyManifest();
    }
  }

  private saveManifest(): void {
    fs.writeFileSync(this.manifestPath(), JSON.stringify(this.manifest, null, 2), 'utf-8');
  }

  async getInstallStatus(): Promise<SiaInstallStatus> {
    this.manifest = this.loadManifest();
    const diskUsageBytes = await getDirSizeBytes(this.rootDir);
    const latestCatalogCycle = getLatestCatalogCycle();
    return {
      hasData:
        Object.keys(this.manifest.vacIndex).length > 0 ||
        Object.keys(this.manifest.aipIndex).length > 0,
      cycle: this.manifest.cycle,
      installedAt: this.manifest.installedAt,
      vacCount: Object.keys(this.manifest.vacIndex).length,
      aipCount: Object.keys(this.manifest.aipIndex).length,
      diskUsageBytes,
      products: Object.values(this.manifest.installedProducts).map((p) => ({
        productId: p.productId,
        cycle: p.cycle,
        installedAt: p.installedAt,
      })),
      updateAvailable:
        !!this.manifest.cycle && latestCatalogCycle !== '' && this.manifest.cycle !== latestCatalogCycle,
      latestCatalogCycle,
    };
  }

  private refreshManifest(): void {
    this.manifest = this.loadManifest();
  }

  private resolveEntryPdfPath(entry: VacChartEntry): string | null {
    const basename = path.basename(entry.pdfPath);
    const relSuffix =
      entry.pdfRelPath ?? extractEaipRelativeSuffix(entry.pdfPath) ?? basename;
    const candidates = new Set<string>();

    candidates.add(path.normalize(entry.pdfPath));
    if (!path.isAbsolute(entry.pdfPath)) {
      candidates.add(path.join(this.extractDir, entry.pdfPath));
    }
    if (entry.pdfRelPath) {
      candidates.add(path.join(this.extractDir, entry.pdfRelPath));
    }
    candidates.add(path.join(this.extractDir, relSuffix));

    for (const product of Object.values(this.manifest.installedProducts)) {
      if (!product.extractPath) continue;
      const root = product.extractPath;
      candidates.add(path.join(root, basename));
      candidates.add(path.join(root, relSuffix));
      if (entry.pdfRelPath) candidates.add(path.join(root, entry.pdfRelPath));
      candidates.add(path.join(root, `${entry.chartId}.pdf`));
    }

    for (const candidate of candidates) {
      const normalized = path.normalize(candidate);
      if (fs.existsSync(normalized)) return normalized;
    }

    const searchRoots = [
      this.extractDir,
      ...Object.values(this.manifest.installedProducts)
        .map((p) => p.extractPath)
        .filter((r): r is string => !!r),
    ];
    for (const root of searchRoots) {
      const found = findPdfByBasename(root, basename);
      if (found) return found;
    }

    return null;
  }

  hasVacIndex(): boolean {
    return (
      Object.keys(this.manifest.vacIndex).length > 0 ||
      Object.keys(this.manifest.aipIndex).length > 0
    );
  }

  getVacPlateEntry(icao: string): VacChartEntry | null {
    this.refreshManifest();
    return findVacPlateForIcao(this.manifest.vacIndex, icao.toUpperCase());
  }

  getAipEntry(icao: string): VacChartEntry | null {
    this.refreshManifest();
    return findAipEntryForIcao(this.manifest.aipIndex, icao.toUpperCase());
  }

  getVacEntry(icao: string): VacChartEntry | null {
    this.refreshManifest();
    return findVacEntryForIcao(
      this.manifest.vacIndex,
      icao.toUpperCase(),
      this.manifest.aipIndex
    );
  }

  async reindexFromDisk(): Promise<number> {
    this.refreshManifest();
    if (recoverInstalledProductsFromExtractDir(this.manifest, this.extractDir)) {
      this.saveManifest();
    }

    const installed = Object.values(this.manifest.installedProducts)[0];
    const catalog = installed ? getCatalogProduct(installed.productId) : undefined;
    const cycle =
      this.manifest.cycle ?? installed?.cycle ?? catalog?.airacCycle ?? '05/26';
    const validFrom = catalog?.validFrom ?? '';
    const validTo = catalog?.validTo ?? '';
    const previousVac = Object.keys(this.manifest.vacIndex).length;
    const previousAip = Object.keys(this.manifest.aipIndex).length;
    const { vacIndex, aipIndex } = await reindexVacFromManifest(
      this.manifest,
      this.extractDir,
      cycle,
      validFrom,
      validTo
    );
    const newVac = Object.keys(vacIndex).length;
    const newAip = Object.keys(aipIndex).length;
    if (newVac > 0 || previousVac === 0) this.manifest.vacIndex = vacIndex;
    else logger.main.warn(`SIA reindex: keeping ${previousVac} VAC entries (reindex found 0)`);
    if (newAip > 0 || previousAip === 0) this.manifest.aipIndex = aipIndex;
    else logger.main.warn(`SIA reindex: keeping ${previousAip} AIP entries (reindex found 0)`);
    if (!this.manifest.cycle && cycle) this.manifest.cycle = cycle;
    this.saveManifest();
    return Object.keys(this.manifest.vacIndex).length + Object.keys(this.manifest.aipIndex).length;
  }

  getVacInfo(icao: string, airport: AirportGeorefInput | null): VacChartInfo | null {
    const entry = this.getVacEntry(icao);
    if (!entry) return null;
    const code = entry.icao.toUpperCase();
    const pngPath = path.normalize(path.join(this.pngCacheDir, `${code}.png`));
    return {
      ...entry,
      georef: resolveVacGeoref(this.georefDir, code, airport),
      pngCachePath: fs.existsSync(pngPath) ? pngPath : null,
    };
  }

  getVacPdfPath(icao: string): string | null {
    const entry = this.getVacEntry(icao);
    if (!entry) return null;
    return this.resolveEntryPdfPath(entry);
  }

  readVacPdf(icao: string): Buffer | null {
    const entry = this.getVacEntry(icao);
    if (!entry) return null;
    const pdfPath = this.resolveEntryPdfPath(entry);
    if (!pdfPath) {
      logger.main.warn(`VAC PDF not found on disk: ${entry.pdfPath}`);
      return null;
    }
    return fs.readFileSync(pdfPath);
  }

  readVacPng(icao: string): Buffer | null {
    const entry = this.getVacEntry(icao);
    if (!entry) return null;
    const pngPath = path.normalize(path.join(this.pngCacheDir, `${entry.icao.toUpperCase()}.png`));
    if (!fs.existsSync(pngPath)) return null;
    return fs.readFileSync(pngPath);
  }

  writeVacPng(icao: string, buffer: Buffer): string {
    return this.writePngCache(icao.toUpperCase(), buffer);
  }

  async installFromLocalZip(
    zipPath: string,
    productId: string,
    onProgress?: DownloadProgressCallback
  ): Promise<{ success: boolean; error?: string }> {
    const product = getCatalogProduct(productId);
    if (!product) return { success: false, error: 'Unknown product' };

    const destZip = path.join(this.downloadsDir, `${productId}.zip`);
    if (path.resolve(zipPath) !== path.resolve(destZip)) {
      await fsp.copyFile(zipPath, destZip);
    }

    return this.installFromZip(destZip, productId, product.airacCycle, product.validFrom, product.validTo, onProgress);
  }

  /** Import VAC PDFs from a ZIP archive or a folder (international / ad-hoc). */
  async installVacImport(
    sourcePath: string,
    onProgress?: DownloadProgressCallback
  ): Promise<{ success: boolean; error?: string }> {
    const product = VAC_IMPORT_PRODUCT;
    const productId = product.id;
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'File not found' };
    }

    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
      return this.installFromDirectory(
        path.resolve(sourcePath),
        productId,
        product.airacCycle,
        product.validFrom,
        product.validTo,
        onProgress
      );
    }

    return this.installFromLocalZip(sourcePath, productId, onProgress);
  }

  private async installFromDirectory(
    sourceDir: string,
    productId: string,
    cycle: string,
    validFrom: string,
    validTo: string,
    onProgress?: DownloadProgressCallback
  ): Promise<{ success: boolean; error?: string }> {
    const extractPath = path.join(this.extractDir, `${productId}-${Date.now()}`);
    await fsp.mkdir(extractPath, { recursive: true });

    onProgress?.({
      productId,
      phase: 'indexing',
      percent: 40,
      message: 'Copying charts…',
    });

    await this.copyDirectoryRecursive(sourceDir, extractPath);

    onProgress?.({
      productId,
      phase: 'indexing',
      percent: 80,
      message: 'Indexing charts…',
    });

    let vacIndex = { ...this.manifest.vacIndex };
    vacIndex = indexGenericVacPdfs(extractPath, cycle, validFrom, validTo, vacIndex);
    if (Object.keys(vacIndex).length === 0) {
      return emitInstallError(productId, 'sia.errors.noVacMatched', onProgress);
    }

    this.manifest.installedProducts[productId] = {
      productId,
      cycle,
      installedAt: Date.now(),
      extractPath,
    };
    this.manifest.vacIndex = vacIndex;
    this.manifest.cycle = cycle;
    this.manifest.installedAt = Date.now();
    this.saveManifest();
    await this.syncVacIndexToDb(vacIndex, this.manifest.aipIndex, cycle, validFrom, validTo);

    onProgress?.({
      productId,
      phase: 'done',
      percent: 100,
      message: 'Installation complete',
    });
    return { success: true };
  }

  private async copyDirectoryRecursive(src: string, dest: string): Promise<void> {
    await fsp.mkdir(dest, { recursive: true });
    for (const name of await fsp.readdir(src)) {
      const from = path.join(src, name);
      const to = path.join(dest, name);
      const stat = await fsp.stat(from);
      if (stat.isDirectory()) {
        await this.copyDirectoryRecursive(from, to);
      } else {
        await fsp.copyFile(from, to);
      }
    }
  }

  async downloadAndInstall(
    productId: string,
    onProgress?: DownloadProgressCallback
  ): Promise<{ success: boolean; error?: string }> {
    const product = getCatalogProduct(productId);
    if (!product) return { success: false, error: 'Unknown product' };

    const destZip = path.join(this.downloadsDir, `${productId}.zip`);
    let downloadUrl = product.downloadUrl;

    if (!downloadUrl) {
      const credentials = loadCredentials();
      if (!credentials) {
        return {
          success: false,
          error: 'sia.errors.noCredentials',
        };
      }

      onProgress?.({
        productId,
        phase: 'downloading',
        percent: 0,
        message: 'Connecting to SIA…',
      });

      const resolved = await resolveMagentoProduct(productId);
      if (!resolved?.magento) {
        return {
          success: false,
          error: 'sia.errors.productNotFound',
        };
      }

      const purchase = await purchaseAndGetDownloadUrl(credentials, resolved.magento);
      if ('error' in purchase) {
        return { success: false, error: purchase.error };
      }
      downloadUrl = purchase.downloadUrl;
    }

    const dl = await downloadToFile(downloadUrl, destZip, productId, onProgress);
    if (!dl.success) return dl;

    return this.installFromZip(
      destZip,
      productId,
      product.airacCycle,
      product.validFrom,
      product.validTo,
      onProgress
    );
  }

  private async installFromZip(
    zipPath: string,
    productId: string,
    cycle: string,
    validFrom: string,
    validTo: string,
    onProgress?: DownloadProgressCallback
  ): Promise<{ success: boolean; error?: string }> {
    const product = getCatalogProduct(productId);
    if (!product) return { success: false, error: 'Unknown product' };

    const extractPath = path.join(this.extractDir, productId);
    if (fs.existsSync(extractPath)) {
      await fsp.rm(extractPath, { recursive: true, force: true });
    }
    await fsp.mkdir(extractPath, { recursive: true });

    onProgress?.({
      productId,
      phase: 'extracting',
      percent: 0,
      message: 'Extracting archive…',
    });

    let extractResult: Awaited<ReturnType<typeof extractArchive>>;
    try {
      extractResult = await withTimeout(
        extractArchive({
          archivePath: zipPath,
          targetDir: extractPath,
          onProgress: (_bytes, file) => {
            onProgress?.({
              productId,
              phase: 'extracting',
              percent: 50,
              message: file || 'Extracting archive…',
            });
          },
        }),
        EXTRACT_TIMEOUT_MS,
        'Extraction timed out — the archive may be too large or corrupted'
      );
    } catch (err) {
      logger.main.error('SIA archive extraction failed', err);
      return emitInstallError(
        productId,
        (err as Error).message,
        onProgress
      );
    }

    if (!extractResult.ok) {
      const extractErr = extractResult.error;
      const msg =
        typeof extractErr === 'object' && extractErr && 'reason' in extractErr
          ? String(extractErr.reason)
          : typeof extractErr === 'object' && extractErr && 'code' in extractErr
            ? String(extractErr.code)
            : String(extractErr);
      logger.main.error('SIA archive extraction failed', extractErr);
      return emitInstallError(productId, msg, onProgress);
    }

    if (product.kind === 'eaip-full') {
      onProgress?.({
        productId,
        phase: 'extracting',
        percent: 60,
        message: 'Extracting nested archives…',
      });
      const nested = await extractNestedArchives(extractPath, (name) => {
        onProgress?.({
          productId,
          phase: 'extracting',
          percent: 65,
          message: name,
        });
      });
      logger.data.info(
        `SIA nested archives: ${nested.extracted} extracted, ${nested.failed} failed`
      );
    }

    onProgress?.({
      productId,
      phase: 'indexing',
      percent: 80,
      message: 'Indexing charts…',
    });

    let vacIndex = { ...this.manifest.vacIndex };
    let aipIndex = { ...this.manifest.aipIndex };

    try {
      if (product.kind === 'eaip-full') {
        const indexed = await indexEaipExtract(extractPath, cycle, validFrom, validTo);
        vacIndex = indexed.vacIndex;
        aipIndex = { ...aipIndex, ...indexed.aipIndex };
        await this.persistXmlPaths(indexed.xmlPaths, cycle);

        if (indexed.atlasVacCount === 0 && indexed.eaipAdCount > 0) {
          logger.main.warn(
            `SIA eAIP: no Atlas-VAC plates (AD-N.LFXX.pdf) under Atlas-VAC/PDF_AIPparSSection/VAC/AD — ${indexed.eaipAdCount} eAIP AD only`
          );
        }

        if (
          Object.keys(vacIndex).length === 0 &&
          Object.keys(aipIndex).length === 0
        ) {
          const hint =
            indexed.pdfCount === 0
              ? 'sia.errors.noPdfsInArchive'
              : 'sia.errors.noVacMatched';
          return emitInstallError(productId, hint, onProgress);
        }
      } else if (product.kind === 'vac-import') {
        vacIndex = indexGenericVacPdfs(extractPath, cycle, validFrom, validTo, vacIndex);
        if (Object.keys(vacIndex).length === 0) {
          return emitInstallError(productId, 'sia.errors.noVacMatched', onProgress);
        }
      } else {
        vacIndex = indexVacAmendmentPdfs(extractPath, cycle, validFrom, validTo, vacIndex);
        if (Object.keys(vacIndex).length === 0) {
          return emitInstallError(productId, 'sia.errors.noVacMatched', onProgress);
        }
      }
    } catch (err) {
      logger.main.error('SIA chart indexing failed', err);
      return emitInstallError(productId, (err as Error).message, onProgress);
    }

    this.manifest.installedProducts[productId] = {
      productId,
      cycle,
      installedAt: Date.now(),
      extractPath,
      zipPath,
    };
    this.manifest.vacIndex = vacIndex;
    this.manifest.aipIndex = aipIndex;
    this.manifest.cycle = cycle;
    this.manifest.installedAt = Date.now();
    this.saveManifest();
    await this.syncVacIndexToDb(vacIndex, aipIndex, cycle, validFrom, validTo);
    await this.setMetadataCycle(cycle);

    onProgress?.({
      productId,
      phase: 'done',
      percent: 100,
      message: 'Installation complete',
    });

    logger.data.info(
      `SIA product installed: ${productId}, ${Object.keys(vacIndex).length} VAC + ${Object.keys(aipIndex).length} AIP`
    );
    return { success: true };
  }

  private async syncVacIndexToDb(
    vacIndex: Record<string, VacChartEntry>,
    aipIndex: Record<string, VacChartEntry>,
    cycle: string,
    validFrom: string,
    validTo: string
  ): Promise<void> {
    let db;
    try {
      db = getDb();
    } catch {
      return;
    }

    await db.delete(siaCharts);
    const now = Date.now();
    const rows = [...Object.values(vacIndex), ...Object.values(aipIndex)].map((e) => ({
      icao: e.icao,
      chartType: e.chartType,
      pdfPath: e.pdfPath,
      chartId: e.chartId,
      cycle,
      validFrom,
      validTo,
      installedAt: now,
    }));
    if (rows.length > 0) {
      await db.insert(siaCharts).values(rows);
    }
    saveDb();
  }

  private async setMetadataCycle(cycle: string): Promise<void> {
    const db = getDb();
    if (!db) return;
    const now = String(Date.now());
    await db.delete(metadata).where(eq(metadata.key, METADATA_CYCLE_KEY));
    await db.insert(metadata).values({ key: METADATA_CYCLE_KEY, value: cycle });
    await db.delete(metadata).where(eq(metadata.key, METADATA_INSTALLED_KEY));
    await db.insert(metadata).values({ key: METADATA_INSTALLED_KEY, value: now });
    saveDb();
  }

  private async persistXmlPaths(xmlPaths: string[], cycle: string): Promise<void> {
    if (xmlPaths.length === 0) return;
    const listPath = path.join(this.rootDir, `xml-sources-${cycle.replace('/', '-')}.json`);
    await fsp.writeFile(listPath, JSON.stringify(xmlPaths, null, 2), 'utf-8');
  }

  async clearCache(): Promise<void> {
    if (fs.existsSync(this.rootDir)) {
      await fsp.rm(this.rootDir, { recursive: true, force: true });
    }
    this.init();
    this.manifest = this.loadManifest();

    try {
      const db = getDb();
      await db.delete(siaCharts);
      await db.delete(metadata).where(eq(metadata.key, METADATA_CYCLE_KEY));
      await db.delete(metadata).where(eq(metadata.key, METADATA_INSTALLED_KEY));
      saveDb();
    } catch {
      /* DB may not be initialized yet */
    }
  }

  writePngCache(icao: string, buffer: Buffer): string {
    const out = path.join(this.pngCacheDir, `${icao.toUpperCase()}.png`);
    fs.writeFileSync(out, buffer);
    return out;
  }

  loadOaciAirspaces(): import('./xml/airspaceParser').OaciAirspaceFeature[] {
    if (!this.manifest.cycle) return [];
    const listPath = path.join(
      this.rootDir,
      `xml-sources-${this.manifest.cycle.replace('/', '-')}.json`
    );
    try {
      return loadOaciAirspacesFromIndex(listPath);
    } catch {
      return [];
    }
  }
}
