import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import { getCatalogProduct, getLatestCatalogCycle } from './catalog';
import { indexEaipExtract, indexVacAmendmentPdfs } from './eaipIndexer';
import type { SiaProductKind } from './types';
import { mergeVacEntry } from './vacIndex';
import type { SiaInstallManifest, VacChartEntry } from './types';

function inferProductKind(productId: string): SiaProductKind {
  const known = getCatalogProduct(productId);
  if (known) return known.kind;
  const id = productId.toLowerCase();
  if (id.includes('heli')) return 'vac-amdt-heli';
  if (id.includes('vac') || id.includes('amdt')) return 'vac-amdt-metro';
  if (id.includes('eaip')) return 'eaip-full';
  return 'eaip-full';
}

/** Rebuild vacIndex by scanning installed extract folders (fixes stale absolute paths). */
export async function reindexVacFromManifest(
  manifest: SiaInstallManifest,
  extractDir: string,
  defaultCycle: string,
  defaultValidFrom: string,
  defaultValidTo: string
): Promise<Record<string, VacChartEntry>> {
  let vacIndex: Record<string, VacChartEntry> = {};
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
    } else {
      vacIndex = indexVacAmendmentPdfs(extractPath, cycle, validFrom, validTo, vacIndex);
    }
  }

  logger.data.info(`SIA reindex complete: ${Object.keys(vacIndex).length} VAC entries`);
  return vacIndex;
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
