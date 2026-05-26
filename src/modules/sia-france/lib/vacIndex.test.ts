import { describe, expect, it } from 'vitest';
import {
  classifyChartType,
  extractIcaoFromVacPath,
  findAipEntryForIcao,
  findVacEntryForIcao,
  findVacPlateForIcao,
  isAtlasVacPdfPath,
  isEaipAdPdfPath,
  isSiaVacPlateFilename,
  mergeVacEntry,
  rankVacEntry,
} from './vacIndex';
import type { VacChartEntry } from './types';

const ATLAS_LFPA =
  'Atlas-VAC/PDF_AIPparSSection/VAC/AD/LFPA/AD-2.LFPA.pdf';
const EAIP_LFPA_ADC = 'FRANCE/html/eAIP/AD/LFPA/LFPA_ADC.pdf';

describe('vacIndex', () => {
  it('recognises SIA VAC plate filename AD-N.LFXX.pdf', () => {
    expect(isSiaVacPlateFilename('AD-2.LFPA.pdf')).toBe(true);
    expect(extractIcaoFromVacPath(ATLAS_LFPA)).toBe('LFPA');
    expect(isAtlasVacPdfPath(ATLAS_LFPA)).toBe(true);
    expect(isEaipAdPdfPath(ATLAS_LFPA)).toBe(false);
  });

  it('classifies atlas as vac and eAIP AD as iac', () => {
    expect(classifyChartType(ATLAS_LFPA)).toBe('vac');
    expect(classifyChartType(EAIP_LFPA_ADC)).toBe('iac');
  });

  it('keeps VAC and AIP in separate lookup indexes', () => {
    const vacIndex: Record<string, VacChartEntry> = {
      LFPA: {
        icao: 'LFPA',
        pdfPath: ATLAS_LFPA,
        pdfRelPath: ATLAS_LFPA,
        chartId: 'AD-2.LFPA',
        chartType: 'vac',
        cycle: '05/26',
        validFrom: '',
        validTo: '',
      },
    };
    const aipIndex: Record<string, VacChartEntry> = {
      LFPA: {
        icao: 'LFPA',
        pdfPath: EAIP_LFPA_ADC,
        pdfRelPath: EAIP_LFPA_ADC,
        chartId: 'LFPA_ADC',
        chartType: 'iac',
        cycle: '05/26',
        validFrom: '',
        validTo: '',
      },
    };
    expect(findVacPlateForIcao(vacIndex, 'LFPA')?.chartType).toBe('vac');
    expect(findAipEntryForIcao(aipIndex, 'LFPA')?.chartType).toBe('iac');
    expect(findVacEntryForIcao(vacIndex, 'LFPA', aipIndex)?.pdfRelPath).toBe(ATLAS_LFPA);
  });

  it('extracts ICAO from international VAC filenames', () => {
    expect(extractIcaoFromVacPath('EGLL.pdf')).toBe('EGLL');
    expect(extractIcaoFromVacPath('charts/LSGG_VAC.pdf')).toBe('LSGG');
    expect(extractIcaoFromVacPath('AD-2.EGLL.pdf')).toBe('EGLL');
  });

  it('mergeVacEntry prefers Atlas-VAC plate over eAIP AD', () => {
    const atlas: VacChartEntry = {
      icao: 'LFPA',
      pdfPath: ATLAS_LFPA,
      pdfRelPath: ATLAS_LFPA,
      chartId: 'AD-2.LFPA',
      chartType: 'vac',
      cycle: '05/26',
      validFrom: '',
      validTo: '',
    };
    const aip: VacChartEntry = {
      icao: 'LFPA',
      pdfPath: EAIP_LFPA_ADC,
      pdfRelPath: EAIP_LFPA_ADC,
      chartId: 'LFPA_ADC',
      chartType: 'iac',
      cycle: '05/26',
      validFrom: '',
      validTo: '',
    };
    expect(rankVacEntry(atlas)).toBeGreaterThan(rankVacEntry(aip));
    expect(mergeVacEntry(aip, atlas).pdfRelPath).toBe(ATLAS_LFPA);
  });
});
