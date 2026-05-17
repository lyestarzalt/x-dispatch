import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import {
  classifyChartType,
  extractIcaoFromVacPath,
  isVacPdfPath,
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
  xmlPaths: string[];
  pdfCount: number;
}

export async function indexEaipExtract(
  extractRoot: string,
  cycle: string,
  validFrom: string,
  validTo: string
): Promise<EaipIndexResult> {
  const vacIndex: Record<string, VacChartEntry> = {};
  const xmlPaths: string[] = [];
  let pdfCount = 0;

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

    if (!isVacPdfPath(relativePath)) return;
    pdfCount++;

    const icao = extractIcaoFromVacPath(relativePath);
    if (!icao || !icao.startsWith('LF')) return;

    const entry: VacChartEntry = {
      icao,
      pdfPath: absPath,
      pdfRelPath: relativePath,
      chartId: path.basename(relativePath, '.pdf'),
      chartType: classifyChartType(relativePath),
      cycle,
      validFrom,
      validTo,
    };

    vacIndex[icao] = mergeVacEntry(vacIndex[icao], entry);
  });

  logger.data.info(`SIA eAIP indexed: ${Object.keys(vacIndex).length} VAC charts, ${pdfCount} PDFs`);
  return { vacIndex, xmlPaths, pdfCount };
}

export function indexVacAmendmentPdfs(
  extractRoot: string,
  cycle: string,
  validFrom: string,
  validTo: string,
  existing: Record<string, VacChartEntry>
): Record<string, VacChartEntry> {
  const next = { ...existing };
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
    if (!isVacPdfPath(rel) && !/VAC/i.test(path.basename(rel))) continue;
    const icao = extractIcaoFromVacPath(rel);
    if (!icao?.startsWith('LF')) continue;
    const entry: VacChartEntry = {
      icao,
      pdfPath: absPath,
      pdfRelPath: rel,
      chartId: path.basename(rel, '.pdf'),
      chartType: 'vac',
      cycle,
      validFrom,
      validTo,
    };
    next[icao] = mergeVacEntry(next[icao], entry);
  }

  return next;
}
