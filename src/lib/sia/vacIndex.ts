import * as path from 'path';
import type { VacChartEntry } from './types';

const ICAO_IN_PATH_RE = /(?:^|[/\\_])(LF[A-Z0-9]{2,4})(?:[_\-.]|$)/i;
const ICAO_FILENAME_RE = /^(LF[A-Z0-9]{2,4})(?:[_\-.].*)?$/i;

/**
 * Extract ICAO from SIA VAC PDF path or filename.
 */
export function extractIcaoFromVacPath(filePath: string): string | null {
  const base = path.basename(filePath, path.extname(filePath));
  const fromName = base.match(ICAO_FILENAME_RE);
  if (fromName?.[1]) return fromName[1].toUpperCase();

  const normalized = filePath.replace(/\\/g, '/');
  const adFolder = normalized.match(/\/AD\/(LF[A-Z0-9]{2,3})(?:\/|[_\-.])/i);
  if (adFolder?.[1]) return adFolder[1].toUpperCase();

  const parts = normalized.split('/');
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i] ?? '';
    const m = part.match(ICAO_IN_PATH_RE);
    if (m?.[1] && m[1].length >= 4) return m[1].toUpperCase();
  }
  return null;
}

export function classifyChartType(relativePath: string): 'vac' | 'iac' | 'other' {
  const upper = relativePath.toUpperCase();
  if (upper.includes('VAC') || upper.includes('ATLAS-VAC')) return 'vac';
  if (upper.includes('IAC') || upper.includes('ADC')) return 'iac';
  return 'other';
}

export function isVacPdfPath(relativePath: string): boolean {
  if (!relativePath.toLowerCase().endsWith('.pdf')) return false;
  const upper = relativePath.replace(/\\/g, '/').toUpperCase();
  const base = path.basename(relativePath).toUpperCase();

  if (upper.includes('ATLAS-VAC') || upper.includes('ATLAS_VAC')) return true;
  if (upper.includes('/AD/') && /LF[A-Z0-9]{2,3}/.test(upper)) return true;
  if (upper.includes('PDF_AIP') && /LF[A-Z0-9]{2,3}/.test(upper)) return true;
  if (upper.includes('PDF_AIPPARSECTION') && upper.includes('/AD/')) return true;
  if (/VAC/i.test(base)) return true;
  if (/ADC/i.test(base) && upper.includes('/AD/')) return true;
  return false;
}

export function mergeVacEntry(
  existing: VacChartEntry | undefined,
  next: VacChartEntry
): VacChartEntry {
  if (!existing) return next;
  // Prefer explicit VAC atlas over AD section duplicates
  if (existing.chartType === 'vac' && next.chartType !== 'vac') return existing;
  if (next.chartType === 'vac' && existing.chartType !== 'vac') return next;
  return next;
}

function pathMatchesIcao(pdfPath: string, icao: string): boolean {
  const code = icao.toUpperCase();
  const upper = pdfPath.replace(/\\/g, '/').toUpperCase();
  const base = path.basename(pdfPath).toUpperCase();
  if (base.startsWith(`${code}_`) || base.startsWith(`${code}-`)) return true;
  if (base === `${code}.PDF` || base.startsWith(`${code}.`)) return true;
  if (upper.includes(`/AD/${code}/`) || upper.includes(`/AD/${code}_`)) return true;
  if (upper.includes(`ATLAS-VAC`) && (base.includes(code) || upper.includes(`/${code}`))) return true;
  return extractIcaoFromVacPath(pdfPath) === code;
}

function rankVacEntry(entry: VacChartEntry): number {
  const upper = entry.pdfPath.replace(/\\/g, '/').toUpperCase();
  let score = 0;
  if (entry.chartType === 'vac') score += 10;
  if (upper.includes('ATLAS-VAC')) score += 8;
  if (upper.includes('_VAC')) score += 4;
  if (upper.includes('/AD/')) score += 1;
  return score;
}

/** Resolve best VAC PDF for an aerodrome (handles AD vs Atlas-VAC duplicates). */
export function findVacEntryForIcao(
  vacIndex: Record<string, VacChartEntry>,
  icao: string
): VacChartEntry | null {
  const code = icao.toUpperCase();
  const direct = vacIndex[code];
  if (direct) return direct;

  const matches = Object.values(vacIndex).filter((e) => pathMatchesIcao(e.pdfPath, code));
  if (matches.length === 0) return null;

  return matches.sort((a, b) => rankVacEntry(b) - rankVacEntry(a))[0] ?? null;
}
