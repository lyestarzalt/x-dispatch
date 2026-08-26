import { describe, expect, it } from 'vitest';
import type { SimBriefOFP } from '@/types/simbrief';
import { buildFmsFilename } from './fmsFilename';

const ofp = {
  origin: { icao_code: 'CYUL' },
  destination: { icao_code: 'KIAD' },
} as SimBriefOFP;

describe('buildFmsFilename', () => {
  it('takes the extension from a plain link', () => {
    expect(buildFmsFilename(ofp, 'CYULKIAD_XPE_1787737979.fms')).toBe('CYUL_KIAD.fms');
  });

  it('ignores CDN path segments', () => {
    expect(buildFmsFilename(ofp, 'xml/CYULKIAD_XML_1787737979.xml')).toBe('CYUL_KIAD.xml');
  });

  // Regression: SimBrief tags reused files with `--TAG`, which pushed the
  // extension off the end of the string and produced `CYUL_KIAD` with none.
  it.each([
    ['zbo', 'xml/CYULKIAD_XML_1787737979.xml--ZBO', 'CYUL_KIAD.xml'],
    ['sbr', 'xml/CYULKIAD_XML_1787737979.xml--sbr', 'CYUL_KIAD.xml'],
    ['a3e', 'CYULKIAD_PDF_1787737979.pdf--A3E', 'CYUL_KIAD.pdf'],
    ['vm5', 'CYULKIAD_VMX_1787737979.flp--VM5', 'CYUL_KIAD.flp'],
    ['ifw', 'CYULKIAD_PMW_1787737979.wx--IFW', 'CYUL_KIAD.wx'],
    ['jfb', 'CYULKIAD_QTY_1787737979.RTE--JFB', 'CYUL_KIAD.RTE'],
    ['pgt', 'CYULKIAD_MFS_1787737979.pln--PGT', 'CYUL_KIAD.pln'],
    ['rmd', 'CYULKIAD_JAR_1787737979.txt--RMD', 'CYUL_KIAD.txt'],
    ['tdg', 'CYULKIAD_GTN_1787737979.gfp--TDG', 'CYUL_KIAD.gfp'],
  ])('keeps the extension for %s links carrying a --TAG suffix', (_key, link, expected) => {
    expect(buildFmsFilename(ofp, link)).toBe(expected);
  });

  it('sanitizes non-alphanumeric characters out of the ICAO codes', () => {
    const odd = {
      origin: { icao_code: 'CY-UL' },
      destination: { icao_code: 'K IAD' },
    } as SimBriefOFP;
    expect(buildFmsFilename(odd, 'CYULKIAD_XPE_1787737979.fms')).toBe('CYUL_KIAD.fms');
  });

  it('returns no extension when the link genuinely has none', () => {
    expect(buildFmsFilename(ofp, 'CYULKIAD_NOEXT_1787737979')).toBe('CYUL_KIAD');
  });
});
