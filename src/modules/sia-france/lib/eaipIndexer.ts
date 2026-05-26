import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import {
  classifyChartType,
  extractIcaoFromVacPath,
  isAtlasVacPdfPath,
  isEaipAdPdfPath,
  isGenericVacPdfPath,
  mergeVacEntry,
} from './vacIndex';
import type { VacChartEntry } from './types';

const XML_AIRSPACE_GLOB = ['.xml'];

async function walkDir(
  root: string,
  onFile: (absPath: string, relativePath: string) => void | Promise<void>
): Promise<void> {
  const stack: Array<{ abs: string; rel: string }> = [{ abs: root, rel: '' }];
  while (stack.length > 0) {
    const item = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(item.abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const abs = path.join(item.abs, ent.name);
      const rel = item.rel ? `${item.rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        stack.push({ abs, rel });
      } else if (ent.isFile()) {
        await onFile(abs, rel.replace(/\\/g, '/'));
      }
    }
  }
}

export interface EaipIndexResult {
  vacIndex: Record<string, VacChartEntry>;
  aipIndex: Record<string, VacChartEntry>;
  xmlPaths: string[];
  pdfCount: number;
  atlasVacCount: number;
  eaipAdCount: number;
}

function buildEntry(
  absPath: string,
  relativePath: string,
  cycle: string,
  validFrom: string,
  validTo: string
): VacChartEntry | null {
  const icao = extractIcaoFromVacPath(relativePath);
  if (!icao) return null;
  return {
    icao,
    pdfPath: absPath,
    pdfRelPath: relativePath,
    chartId: path.basename(relativePath, '.pdf'),
    chartType: classifyChartType(relativePath),
    cycle,
    validFrom,
    validTo,
  };
}

export async function indexEaipExtract(
  extractRoot: string,
  cycle: string,
  validFrom: string,
  validTo: string
): Promise<EaipIndexResult> {
  const vacIndex: Record<string, VacChartEntry> = {};
  const aipIndex: Record<string, VacChartEntry> = {};
  const xmlPaths: string[] = [];
  let pdfCount = 0;
  let atlasVacCount = 0;
  let eaipAdCount = 0;

  await walkDir(extractRoot, (absPath, relativePath) => {
    const lower = relativePath.toLowerCase();
    if (XML_AIRSPACE_GLOB.some((ext) => lower.endsWith(ext))) {
      if (
        lower.includes('espace') ||
        lower.includes('airspace') ||
        lower.includes('aim') ||
        lower.includes('oaci')
      ) {
        xmlPaths.push(absPath);
      }
      return;
    }

    if (!isAtlasVacPdfPath(relativePath)) return;
    const entry = buildEntry(absPath, relativePath, cycle, validFrom, validTo);
    if (!entry) return;
    pdfCount++;
    vacIndex[entry.icao] = mergeVacEntry(vacIndex[entry.icao], entry);
    atlasVacCount++;
  });

  await walkDir(extractRoot, (absPath, relativePath) => {
    if (!isEaipAdPdfPath(relativePath)) return;
    const entry = buildEntry(absPath, relativePath, cycle, validFrom, validTo);
    if (!entry) return;
    pdfCount++;
    aipIndex[entry.icao] = mergeVacEntry(aipIndex[entry.icao], entry);
    eaipAdCount++;
  });

  logger.data.info(
    `SIA eAIP indexed: ${Object.keys(vacIndex).length} Atlas-VAC, ${Object.keys(aipIndex).length} eAIP AD, ${atlasVacCount} vac PDFs, ${eaipAdCount} aip PDFs`
  );
  return { vacIndex, aipIndex, xmlPaths, pdfCount, atlasVacCount, eaipAdCount };
}

export function indexVacAmendmentPdfs(
  extractRoot: string,
  cycle: string,
  validFrom: string,
  validTo: string,
  existingVac: Record<string, VacChartEntry>
): Record<string, VacChartEntry> {
  const next = { ...existingVac };
  const files: string[] = [];

  function collect(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) collect(full);
      else if (name.toLowerCase().endsWith('.pdf')) files.push(full);
    }
  }
  collect(extractRoot);

  for (const absPath of files) {
    const rel = path.relative(extractRoot, absPath).replace(/\\/g, '/');
    if (!isAtlasVacPdfPath(rel) && !/VAC/i.test(path.basename(rel)) && !isGenericVacPdfPath(rel)) {
      continue;
    }
    const entry = buildEntry(absPath, rel, cycle, validFrom, validTo);
    if (!entry) continue;
    next[entry.icao] = mergeVacEntry(next[entry.icao], { ...entry, chartType: 'vac' });
  }

  return next;
}

/** Index a flat folder or archive of VAC PDFs (any country, ICAO in filename or path). */
export function indexGenericVacPdfs(
  extractRoot: string,
  cycle: string,
  validFrom: string,
  validTo: string,
  existingVac: Record<string, VacChartEntry> = {}
): Record<string, VacChartEntry> {
  const next = { ...existingVac };
  const files: string[] = [];

  function collect(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) collect(full);
      else if (name.toLowerCase().endsWith('.pdf')) files.push(full);
    }
  }
  collect(extractRoot);

  for (const absPath of files) {
    const rel = path.relative(extractRoot, absPath).replace(/\\/g, '/');
    if (!isGenericVacPdfPath(rel)) continue;
    const entry = buildEntry(absPath, rel, cycle, validFrom, validTo);
    if (!entry) continue;
    next[entry.icao] = mergeVacEntry(next[entry.icao], { ...entry, chartType: 'vac' });
  }

  return next;
}
