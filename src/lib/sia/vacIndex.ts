import * as path from 'path';
import type { VacChartEntry } from './types';

const ICAO_IN_PATH_RE = /(?:^|[/\\_])(LF[A-Z0-9]{2,3})(?:[_\-.]|$)/i;
const ICAO_FILENAME_RE = /^(LF[A-Z0-9]{2,3})[_\-.]/i;

/**
 * Extract ICAO from SIA VAC PDF path or filename.
 */
export function extractIcaoFromVacPath(filePath: string): string | null {
  const base = path.basename(filePath, path.extname(filePath));
  const fromName = base.match(ICAO_FILENAME_RE);
  if (fromName?.[1]) return fromName[1].toUpperCase();

  const normalized = filePath.replace(/\\/g, '/');
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
  if (upper.includes('ATLAS-VAC')) return true;
  if (upper.includes('/AD/') && (upper.includes('VAC') || upper.includes('ADC'))) return true;
  if (upper.includes('PDF_AIPPARSECTION') && upper.includes('/AD/')) return true;
  return /VAC/i.test(path.basename(relativePath));
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
