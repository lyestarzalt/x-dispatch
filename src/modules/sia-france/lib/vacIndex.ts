import * as path from 'path';
import type { VacChartEntry } from './types';

const ICAO_IN_PATH_RE = /(?:^|[/\\_])([A-Z][A-Z0-9]{3})(?:[_\-.]|$)/i;
const ICAO_FILENAME_RE = /^([A-Z][A-Z0-9]{3})(?:[_\-.].*)?$/i;
/** SIA / Eurocontrol-style plate: AD-2.LFPA.pdf, AD-2.EGLL.pdf, … */
const SIA_VAC_PLATE_FILENAME_RE = /^AD-\d+\.([A-Z][A-Z0-9]{3})$/i;
const ICAO_FOUR_LETTER_RE = /^[A-Z][A-Z0-9]{3}$/;

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').toUpperCase();
}

export function isSiaVacPlateFilename(filePath: string): boolean {
  const base = path.basename(filePath, path.extname(filePath));
  return SIA_VAC_PLATE_FILENAME_RE.test(base);
}

/**
 * SIA Atlas-VAC plates: Atlas-VAC/PDF_AIPparSSection/VAC/AD/LFXX/AD-N.LFXX.pdf
 */
export function isAtlasVacPdfPath(relativePath: string): boolean {
  if (!relativePath.toLowerCase().endsWith('.pdf')) return false;
  const upper = normalizePath(relativePath);

  const inAtlasTree =
    upper.includes('ATLAS-VAC') ||
    upper.includes('ATLAS_VAC') ||
    (upper.includes('PDF_AIPPARSECTION') && upper.includes('/VAC/'));

  if (!inAtlasTree) return false;

  if (upper.includes('/VAC/AD/') || /\/VAC\/AD\/[A-Z][A-Z0-9]{3}/.test(upper)) return true;
  if (isSiaVacPlateFilename(relativePath)) return true;
  if (upper.includes('/VAC/') && ICAO_IN_PATH_RE.test(upper)) return true;
  return false;
}

/** eAIP aerodrome section (ADC/IAC) in html/eAIP/AD — stored separately from Atlas-VAC. */
export function isEaipAdPdfPath(relativePath: string): boolean {
  if (!relativePath.toLowerCase().endsWith('.pdf')) return false;
  if (isAtlasVacPdfPath(relativePath)) return false;

  const upper = normalizePath(relativePath);
  const base = path.basename(relativePath).toUpperCase();

  if (upper.includes('/HTML/EAIP/AD/') || upper.includes('/EAIP/AD/')) return true;
  if (upper.includes('PDF_AIP') && upper.includes('/AD/') && !upper.includes('/VAC/')) return true;
  if (/ADC|IAC|APDC/i.test(base) && upper.includes('/AD/')) return true;
  return false;
}

/**
 * Extract ICAO from SIA PDF path or filename (incl. AD-2.LFPA.pdf).
 */
export function extractIcaoFromVacPath(filePath: string): string | null {
  const base = path.basename(filePath, path.extname(filePath));

  const siaPlate = base.match(SIA_VAC_PLATE_FILENAME_RE);
  if (siaPlate?.[1]) return siaPlate[1].toUpperCase();

  const dotIcao = base.match(/\.([A-Z][A-Z0-9]{3})$/i);
  if (dotIcao?.[1] && ICAO_FOUR_LETTER_RE.test(dotIcao[1])) return dotIcao[1].toUpperCase();

  const fromName = base.match(ICAO_FILENAME_RE);
  if (fromName?.[1]) return fromName[1].toUpperCase();

  const embedded = base.match(/\b([A-Z][A-Z0-9]{3})\b/);
  if (embedded?.[1] && ICAO_FOUR_LETTER_RE.test(embedded[1])) return embedded[1].toUpperCase();

  const normalized = filePath.replace(/\\/g, '/');
  const adFolder = normalized.match(/\/AD\/([A-Z][A-Z0-9]{3})(?:\/|[_\-.]|$)/i);
  if (adFolder?.[1] && ICAO_FOUR_LETTER_RE.test(adFolder[1])) return adFolder[1].toUpperCase();

  const parts = normalized.split('/');
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i] ?? '';
    const m = part.match(ICAO_IN_PATH_RE);
    if (m?.[1] && ICAO_FOUR_LETTER_RE.test(m[1])) return m[1].toUpperCase();
    if (ICAO_FOUR_LETTER_RE.test(part)) return part.toUpperCase();
  }
  return null;
}

export function classifyChartType(relativePath: string): 'vac' | 'iac' | 'other' {
  if (isAtlasVacPdfPath(relativePath)) return 'vac';
  if (isEaipAdPdfPath(relativePath)) return 'iac';
  const upper = normalizePath(relativePath);
  if (upper.includes('ADC') || upper.includes('IAC')) return 'iac';
  return 'other';
}

export function isVacPdfPath(relativePath: string): boolean {
  return isAtlasVacPdfPath(relativePath) || isEaipAdPdfPath(relativePath);
}

export function isLfAirportPdfPath(relativePath: string): boolean {
  return isVacPdfPath(relativePath);
}

/** Any PDF whose path or filename contains a valid 4-character ICAO. */
export function isGenericVacPdfPath(relativePath: string): boolean {
  if (!relativePath.toLowerCase().endsWith('.pdf')) return false;
  const icao = extractIcaoFromVacPath(relativePath);
  return icao !== null && ICAO_FOUR_LETTER_RE.test(icao);
}

export function mergeVacEntry(
  existing: VacChartEntry | undefined,
  next: VacChartEntry
): VacChartEntry {
  if (!existing) return next;
  return rankVacEntry(next) > rankVacEntry(existing) ? next : existing;
}

function pathMatchesIcao(pdfPath: string, icao: string): boolean {
  const code = icao.toUpperCase();
  const upper = pdfPath.replace(/\\/g, '/').toUpperCase();
  const base = path.basename(pdfPath).toUpperCase();
  if (base.startsWith(`${code}_`) || base.startsWith(`${code}-`)) return true;
  if (base === `${code}.PDF` || base.startsWith(`${code}.`)) return true;
  if (new RegExp(`^AD-\\d+\\.${code}$`, 'i').test(path.basename(pdfPath, '.pdf'))) return true;
  if (upper.includes(`/AD/${code}/`) || upper.includes(`/AD/${code}_`)) return true;
  if (upper.includes(`/VAC/AD/${code}/`) || upper.includes(`/VAC/AD/${code}.`)) return true;
  if (upper.includes(`ATLAS-VAC`) && (base.includes(code) || upper.includes(`/${code}/`))) return true;
  return extractIcaoFromVacPath(pdfPath) === code;
}

function entryMatchesIcao(entry: VacChartEntry, icao: string): boolean {
  const code = icao.toUpperCase();
  if (entry.icao.toUpperCase() === code) return true;
  if (entry.chartId.toUpperCase().startsWith(code)) return true;
  if (entry.pdfRelPath && pathMatchesIcao(entry.pdfRelPath, code)) return true;
  return pathMatchesIcao(entry.pdfPath, code);
}

export function rankVacEntry(entry: VacChartEntry): number {
  const rel = entry.pdfRelPath ?? entry.pdfPath;
  const upper = rel.replace(/\\/g, '/').toUpperCase();
  let score = 0;
  if (isAtlasVacPdfPath(rel)) score += 100;
  if (isSiaVacPlateFilename(rel)) score += 50;
  if (entry.chartType === 'vac') score += 10;
  if (upper.includes('ATLAS-VAC') || upper.includes('ATLAS_VAC')) score += 8;
  if (upper.includes('PDF_AIPPARSECTION') && upper.includes('/VAC/')) score += 15;
  if (isEaipAdPdfPath(rel)) score += 1;
  return score;
}

/** Atlas-VAC plate for an aerodrome (preferred for VAC tab). */
export function findVacPlateForIcao(
  vacIndex: Record<string, VacChartEntry>,
  icao: string
): VacChartEntry | null {
  const code = icao.toUpperCase();
  const direct = vacIndex[code];
  if (direct?.chartType === 'vac') return direct;

  const matches = Object.values(vacIndex).filter(
    (e) => e.chartType === 'vac' && entryMatchesIcao(e, code)
  );
  if (matches.length === 0) return direct ?? null;
  return matches.sort((a, b) => rankVacEntry(b) - rankVacEntry(a))[0] ?? null;
}

/** eAIP AD chart for an aerodrome. */
export function findAipEntryForIcao(
  aipIndex: Record<string, VacChartEntry>,
  icao: string
): VacChartEntry | null {
  const code = icao.toUpperCase();
  const direct = aipIndex[code];
  if (direct) return direct;
  return (
    Object.values(aipIndex).find((e) => entryMatchesIcao(e, code) && e.chartType === 'iac') ??
    null
  );
}

/** VAC plate first, then eAIP AD fallback (VAC tab display). */
export function findVacEntryForIcao(
  vacIndex: Record<string, VacChartEntry>,
  icao: string,
  aipIndex: Record<string, VacChartEntry> = {}
): VacChartEntry | null {
  return findVacPlateForIcao(vacIndex, icao) ?? findAipEntryForIcao(aipIndex, icao);
}
