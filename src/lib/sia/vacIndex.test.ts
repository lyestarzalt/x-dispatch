import { describe, expect, it } from 'vitest';
import {
  extractIcaoFromVacPath,
  findVacEntryForIcao,
  isLfAirportPdfPath,
  isVacPdfPath,
} from './vacIndex';
import type { VacChartEntry } from './types';

describe('vacIndex', () => {
  it('extracts ICAO from VAC filename', () => {
    expect(extractIcaoFromVacPath('Atlas-VAC/PDF/LFPO_VAC.pdf')).toBe('LFPO');
    expect(extractIcaoFromVacPath('LFML-ADC-01.pdf')).toBe('LFML');
  });

  it('detects VAC pdf paths', () => {
    expect(isVacPdfPath('eAIP/Atlas-VAC/LFXX/foo.pdf')).toBe(true);
    expect(isVacPdfPath('FRANCE/html/eAIP/AD/LFPG/LFPG_ADC.pdf')).toBe(true);
    expect(isVacPdfPath('FRANCE/AIRAC-2026/html/eAIP/AD/LFPO/LFPO-AD-2.pdf')).toBe(true);
    expect(isVacPdfPath('Atlas-VAC/FR/LFPO.pdf')).toBe(true);
    expect(isVacPdfPath('GEN/GEN_1.pdf')).toBe(false);
  });

  it('extracts ICAO from AD folder path', () => {
    expect(extractIcaoFromVacPath('FRANCE/AIRAC-2026/html/eAIP/AD/LFPO/LFPO_ADC.pdf')).toBe(
      'LFPO'
    );
  });

  it('indexes any LF aerodrome pdf path', () => {
    expect(isLfAirportPdfPath('FRANCE/html/eAIP/AD/LFPG/LFPG_ADC.pdf')).toBe(true);
    expect(isLfAirportPdfPath('GEN/GEN_1.pdf')).toBe(false);
  });

  it('finds VAC by entry.icao when manifest key differs', () => {
    const index: Record<string, VacChartEntry> = {
      wrong_key: {
        icao: 'LFPO',
        pdfPath: 'FRANCE/html/eAIP/AD/LFPO/LFPO_ADC.pdf',
        chartId: 'LFPO_ADC',
        chartType: 'iac',
        cycle: '05/26',
        validFrom: '2026-01-01',
        validTo: '2026-02-01',
      },
    };
    expect(findVacEntryForIcao(index, 'LFPO')?.icao).toBe('LFPO');
  });

  it('finds VAC by path when index key differs', () => {
    const index: Record<string, VacChartEntry> = {
      LFPG_ADC: {
        icao: 'LFPG',
        pdfPath: 'FRANCE/html/eAIP/AD/LFPG/LFPG_ADC.pdf',
        chartId: 'LFPG_ADC',
        chartType: 'iac',
        cycle: '05/26',
        validFrom: '2026-01-01',
        validTo: '2026-02-01',
      },
    };
    const found = findVacEntryForIcao(index, 'LFPG');
    expect(found?.pdfPath).toContain('LFPG');
  });
});
