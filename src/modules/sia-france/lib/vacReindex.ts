import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import { getCatalogProduct, getLatestCatalogCycle } from './catalog';
import { indexEaipExtract, indexGenericVacPdfs, indexVacAmendmentPdfs } from './eaipIndexer';
import type { SiaProductKind } from './types';
import type { SiaInstallManifest, VacChartEntry } from './types';
import { mergeVacEntry } from './vacIndex';

export interface ReindexResult {
  vacIndex: Record<string, VacChartEntry>;
  aipIndex: Record<string, VacChartEntry>;
}

function inferProductKind(productId: string): SiaProductKind {
  const known = getCatalogProduct(productId);
  if (known) return known.kind;
  const id = productId.toLowerCase();
  if (id.includes('heli')) return 'vac-amdt-heli';
  if (id.includes('vac') || id.includes('amdt')) return 'vac-amdt-metro';
  if (id.includes('eaip')) return 'eaip-full';
  if (id.includes('vac-import') || id.includes('vac_import')) return 'vac-import';
  return 'eaip-full';
}

/** Rebuild vac + aip indexes by scanning installed extract folders. */
export async function reindexVacFromManifest(
  manifest: SiaInstallManifest,
  extractDir: string,
  defaultCycle: string,
  defaultValidFrom: string,
  defaultValidTo: string
): Promise<ReindexResult> {
  let vacIndex: Record<string, VacChartEntry> = {};
  const aipIndex: Record<string, VacChartEntry> = {};
  const roots: Array<{ extractPath: string; productId: string; cycle: string }> = [];

  for (const installed of Object.values(manifest.installedProducts)) {
    if (installed.extractPath && fs.existsSync(installed.extractPath)) {
      roots.push({
        extractPath: installed.extractPath,
        productId: installed.productId,
        cycle: installed.cycle || defaultCycle,
      });
    }
  }

  if (roots.length === 0 && fs.existsSync(extractDir)) {
    for (const name of fs.readdirSync(extractDir)) {
      const extractPath = path.join(extractDir, name);
      if (!fs.statSync(extractPath).isDirectory()) continue;
      roots.push({ extractPath, productId: name, cycle: defaultCycle });
    }
  }

  for (const { extractPath, productId, cycle } of roots) {
    const product = getCatalogProduct(productId);
    const kind = product?.kind ?? inferProductKind(productId);
    const validFrom = product?.validFrom ?? defaultValidFrom;
    const validTo = product?.validTo ?? defaultValidTo;

    if (kind === 'eaip-full') {
      const indexed = await indexEaipExtract(extractPath, cycle, validFrom, validTo);
      for (const [icao, entry] of Object.entries(indexed.vacIndex)) {
        vacIndex[icao] = mergeVacEntry(vacIndex[icao], entry);
      }
      for (const [icao, entry] of Object.entries(indexed.aipIndex)) {
        aipIndex[icao] = mergeVacEntry(aipIndex[icao], entry);
      }
    } else if (kind === 'vac-import') {
      vacIndex = indexGenericVacPdfs(extractPath, cycle, validFrom, validTo, vacIndex);
    } else {
      vacIndex = indexVacAmendmentPdfs(extractPath, cycle, validFrom, validTo, vacIndex);
    }
  }

  logger.data.info(
    `SIA reindex complete: ${Object.keys(vacIndex).length} VAC plates, ${Object.keys(aipIndex).length} AIP charts`
  );
  return { vacIndex, aipIndex };
}

export function recoverInstalledProductsFromExtractDir(
  manifest: SiaInstallManifest,
  extractDir: string
): boolean {
  if (Object.keys(manifest.installedProducts).length > 0) return false;
  if (!fs.existsSync(extractDir)) return false;

  for (const name of fs.readdirSync(extractDir)) {
    const extractPath = path.join(extractDir, name);
    if (!fs.statSync(extractPath).isDirectory()) continue;
    manifest.installedProducts[name] = {
      productId: name,
      cycle: manifest.cycle ?? getLatestCatalogCycle(),
      installedAt: manifest.installedAt ?? Date.now(),
      extractPath,
    };
  }
  return Object.keys(manifest.installedProducts).length > 0;
}

/** Split legacy single-index manifests into vacIndex + aipIndex. */
export function migrateLegacyVacIndex(manifest: SiaInstallManifest): SiaInstallManifest {
  if (!manifest.aipIndex) manifest.aipIndex = {};
  const nextVac: Record<string, VacChartEntry> = {};
  for (const [key, entry] of Object.entries(manifest.vacIndex)) {
    if (entry.chartType === 'iac') {
      manifest.aipIndex[entry.icao] = mergeVacEntry(manifest.aipIndex[entry.icao], entry);
    } else {
      nextVac[key] = entry;
    }
  }
  manifest.vacIndex = nextVac;
  return manifest;
}
