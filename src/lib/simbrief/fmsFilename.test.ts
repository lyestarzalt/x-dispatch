import { describe, expect, it } from 'vitest';
import type { SimBriefOFP } from '@/types/simbrief';
import { buildFmsFilename } from './fmsFilename';

const ofp = {
  origin: { icao_code: 'CYUL' },
  destination: { icao_code: 'KIAD' },
} as SimBriefOFP;

describe('buildFmsFilename', () => {
  it('takes the extension from a plain link', () => {
    expect(buildFmsFilename(ofp, 'xpe/CYULKIAD_XP_123.fms')).toBe('CYUL_KIAD.fms');
  });

  it('ignores CDN path segments when reading the extension', () => {
    expect(buildFmsFilename(ofp, 'https://cdn.example/a.b/c/CYULKIAD.xml')).toBe('CYUL_KIAD.xml');
  });

  it('sanitizes non-alphanumerics out of the ICAO codes', () => {
    const odd = { origin: { icao_code: 'CY-UL' }, destination: { icao_code: 'K IAD' } };
    expect(buildFmsFilename(odd as SimBriefOFP, 'a.fms')).toBe('CYUL_KIAD.fms');
  });

  it('returns a bare stem when the link genuinely has no extension', () => {
    expect(buildFmsFilename(ofp, 'xpe/CYULKIAD_XP_123')).toBe('CYUL_KIAD');
  });

  // SimBrief appends `--TAG` to any link that reuses another format's generated file,
  // which moves the extension away from the end of the string. Regression fixtures are
  // the nine tagged entries from a live OFP.
  it.each([
    ['zbo', 'xml/CYULKIAD_XML_1787737979.xml--ZBO', 'CYUL_KIAD.xml'],
    ['sbr', 'xml/CYULKIAD_XML_1787737979.xml--sbr', 'CYUL_KIAD.xml'],
    ['a3e', 'pdf/CYULKIAD_PDF_1787737979.pdf--A3E', 'CYUL_KIAD.pdf'],
    ['vm5', 'vmx/CYULKIAD_VMX_1787737979.flp--VM5', 'CYUL_KIAD.flp'],
    ['ifw', 'pmw/CYULKIAD_PMW_1787737979.wx--IFW', 'CYUL_KIAD.wx'],
    ['jfb', 'qty/CYULKIAD_QTY_1787737979.RTE--JFB', 'CYUL_KIAD.RTE'],
    ['pgt', 'pgt/CYULKIAD_PGT_1787737979.pgt--PGT', 'CYUL_KIAD.pgt'],
    ['rmd', 'jar/CYULKIAD_JAR_1787737979.txt--RMD', 'CYUL_KIAD.txt'],
    ['tdg', 'gtn/CYULKIAD_GTN_1787737979.gfp--TDG', 'CYUL_KIAD.gfp'],
  ])('keeps the extension for %s, whose link carries a --TAG suffix', (_key, link, expected) => {
    expect(buildFmsFilename(ofp, link)).toBe(expected);
  });

  it('does not strip a double dash that is not a trailing tag', () => {
    expect(buildFmsFilename(ofp, 'xpe/CYUL--KIAD_XP.fms')).toBe('CYUL_KIAD.fms');
  });
});
