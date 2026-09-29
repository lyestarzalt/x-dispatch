import { describe, expect, it } from 'vitest';
import type { SimBriefOFP } from '@/types/simbrief';
import { fmsExportFilename } from './fmsFilename';

const ofp = (origin: string, destination: string) =>
  ({
    origin: { icao_code: origin },
    destination: { icao_code: destination },
  }) as unknown as SimBriefOFP;

describe('fmsExportFilename', () => {
  const plan = ofp('EGLL', 'KJFK');

  it('names the file after the route with the link extension', () => {
    expect(
      fmsExportFilename('xpn', plan, 'https://cdn.simbrief.com/files/EGLLKJFK_XP12_1.fms')
    ).toBe('EGLL_KJFK.fms');
    expect(fmsExportFilename('tfd', plan, 'EGLLKJFK_TFD_1.txt')).toBe('EGLL_KJFK.txt');
  });

  it('keeps the extension when SimBrief adds a --TAG to a reused file', () => {
    expect(fmsExportFilename('ixg', plan, 'files/xml/EGLLKJFK_XML_9.xml--IXG')).toBe(
      'EGLL_KJFK.xml'
    );
  });

  it('ignores query strings and fragments on the link', () => {
    expect(fmsExportFilename('xpn', plan, 'plan.fms?token=abc#x')).toBe('EGLL_KJFK.fms');
  });

  it('drops characters that are not letters or digits from the ICAO codes', () => {
    expect(fmsExportFilename('xpn', ofp('LF-PG', 'ED/DF'), 'a.fms')).toBe('LFPG_EDDF.fms');
  });

  it('leaves the extension off when the link has none', () => {
    expect(fmsExportFilename('xpn', plan, 'files/noextension')).toBe('EGLL_KJFK');
    expect(fmsExportFilename('xpn', plan, 'files/.hidden')).toBe('EGLL_KJFK');
  });

  it('uses the exact name an add-on requires', () => {
    expect(fmsExportFilename('zbo', plan, 'files/xml/EGLLKJFK_XML_9.xml--ZBO')).toBe('b738x.xml');
  });
});
