import { describe, expect, it } from 'vitest';
import { fmsFileStem } from '@/lib/flightplan/builder/fmsWriter';
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
    ).toBe('EGLLKJFK.fms');
    expect(fmsExportFilename('tfd', plan, 'EGLLKJFK_TFD_1.txt')).toBe('EGLLKJFK.txt');
  });

  it('keeps the extension when SimBrief adds a --TAG to a reused file', () => {
    expect(fmsExportFilename('ixg', plan, 'files/xml/EGLLKJFK_XML_9.xml--IXG')).toBe(
      'EGLLKJFK.xml'
    );
  });

  it('ignores query strings and fragments on the link', () => {
    expect(fmsExportFilename('xpn', plan, 'plan.fms?token=abc#x')).toBe('EGLLKJFK.fms');
  });

  it('drops characters that are not letters or digits from the ICAO codes', () => {
    expect(fmsExportFilename('xpn', ofp('LF-PG', 'ED/DF'), 'a.fms')).toBe('LFPGEDDF.fms');
  });

  it('leaves the extension off when the link has none', () => {
    expect(fmsExportFilename('xpn', plan, 'files/noextension')).toBe('EGLLKJFK');
    expect(fmsExportFilename('xpn', plan, 'files/.hidden')).toBe('EGLLKJFK');
  });

  // Aircraft FMCs list the files and the pilot types the name on the CDU; the A330's
  // keyboard has no underscore, so the name is letters and digits only.
  it('uses only characters an FMC keyboard can type', () => {
    expect(fmsExportFilename('xpn', ofp('LOWS', 'LOWW'), 'a.fms')).toMatch(/^[A-Z0-9]+\.fms$/);
  });

  it('names a route the same as the planner does', () => {
    expect(fmsExportFilename('xpn', ofp('LOWS', 'LOWW'), 'a.fms')).toBe(
      `${fmsFileStem('LOWS', 'LOWW')}.fms`
    );
  });

  it('uses the exact name an add-on requires', () => {
    expect(fmsExportFilename('zbo', plan, 'files/xml/EGLLKJFK_XML_9.xml--ZBO')).toBe('b738x.xml');
  });
});
