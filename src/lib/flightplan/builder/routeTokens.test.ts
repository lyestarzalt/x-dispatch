import { describe, expect, it } from 'vitest';
import {
  isProcedureName,
  lexRoute,
  parseLatLon,
  routeForClipboard,
  stripEndpoints,
  tokenizeRoute,
} from './routeTokens';

describe('routeTokens', () => {
  it('splits on whitespace and separators and upper-cases', () => {
    expect(tokenizeRoute(' sugol ul620,kekix;t180  osn ')).toEqual([
      'SUGOL',
      'UL620',
      'KEKIX',
      'T180',
      'OSN',
    ]);
  });

  it('classifies airways, idents, directs and coordinates', () => {
    const kinds = lexRoute('SUGOL UL620 KEKIX DCT 5230N01000E OSN').map((t) => t.kind);
    expect(kinds).toEqual(['ident', 'airway', 'ident', 'direct', 'latlon', 'ident']);
  });

  it('treats a second airway in a row as an ident', () => {
    const kinds = lexRoute('UL620 T180').map((t) => t.kind);
    expect(kinds).toEqual(['airway', 'ident']);
  });

  it('parses both coordinate spellings', () => {
    expect(parseLatLon('5230N01000W')).toEqual({ latitude: 52.5, longitude: -10 });
    expect(parseLatLon('52N010E')).toEqual({ latitude: 52, longitude: 10 });
    expect(parseLatLon('-33.9/151.2')).toEqual({ latitude: -33.9, longitude: 151.2 });
    expect(parseLatLon('9999N')).toBeNull();
  });

  it('drops a speed and level note and keeps what was typed', () => {
    const tokens = lexRoute('VALKU/N0475F350 DCT 43N040W/M082F380 SUGOL/N0120VFR 52.5/10.25');
    expect(tokens.map((t) => [t.text, t.kind, t.original ?? null])).toEqual([
      ['VALKU', 'ident', 'VALKU/N0475F350'],
      ['DCT', 'direct', null],
      ['43N040W', 'latlon', '43N040W/M082F380'],
      ['SUGOL', 'ident', 'SUGOL/N0120VFR'],
      ['52.5/10.25', 'latlon', null],
    ]);
  });

  it('tells a procedure name from fixes and airways', () => {
    expect(isProcedureName('VIICE2')).toBe(true);
    expect(isProcedureName('MODRU2T')).toBe(true);
    expect(isProcedureName('ROCKT3')).toBe(true);
    expect(isProcedureName('M330')).toBe(false);
    expect(isProcedureName('UN872')).toBe(false);
    expect(isProcedureName('SUGOL')).toBe(false);
    expect(isProcedureName('N268A')).toBe(false);
  });

  it('strips airports typed at either end', () => {
    const tokens = lexRoute('EHAM SUGOL EDDF');
    expect(stripEndpoints(tokens, 'eham', 'EDDF').map((t) => t.text)).toEqual(['SUGOL']);
  });
});

describe('lexRoute NAT tracks', () => {
  it('treats a NAT designator as an airway between its entry and exit fixes', () => {
    const kinds = lexRoute('MIMKU DCT GOMUP NATC CUDDY').map((t) => t.kind);
    expect(kinds).toEqual(['ident', 'direct', 'ident', 'airway', 'ident']);
  });
});

describe('routeForClipboard', () => {
  it('gives one upper-case line, the way SimBrief copies it', () => {
    expect(routeForClipboard('  acora um576 milok\n dct obike/m083f370  ')).toBe(
      'ACORA UM576 MILOK DCT OBIKE/M083F370'
    );
  });

  it('keeps a decimal coordinate in one piece', () => {
    expect(routeForClipboard('VALKU 52.5,-10.25 DCT')).toBe('VALKU 52.5,-10.25 DCT');
  });

  it('is empty for a blank route with no airports', () => {
    expect(routeForClipboard(' \n ')).toBe('');
  });

  it('puts the airports and runways around it, as SimBrief copies for charts', () => {
    expect(
      routeForClipboard(
        'DCT BOBKI DCT MELTI DCT TORNI RAGID6',
        { icao: 'CYUL', runway: '24L' },
        { icao: 'CYYZ', runway: '23' }
      )
    ).toBe('CYUL/24L DCT BOBKI DCT MELTI DCT TORNI RAGID6 CYYZ/23');
  });

  it('adds the chosen SID and STAR, once', () => {
    expect(
      routeForClipboard(
        'bobki dct melti',
        { icao: 'CYUL', procedure: 'CYUL5' },
        { icao: 'CYYZ', procedure: 'RAGID6' }
      )
    ).toBe('CYUL CYUL5 BOBKI DCT MELTI RAGID6 CYYZ');
    expect(
      routeForClipboard(
        'CYUL5 BOBKI RAGID6',
        { icao: 'CYUL', procedure: 'CYUL5' },
        { icao: 'CYYZ', procedure: 'RAGID6' }
      )
    ).toBe('CYUL CYUL5 BOBKI RAGID6 CYYZ');
  });

  it('does not repeat airports already typed into the route', () => {
    expect(
      routeForClipboard('cyul/24l bobki cyyz', { icao: 'CYUL', runway: '24L' }, { icao: 'CYYZ' })
    ).toBe('CYUL/24L BOBKI CYYZ');
  });

  it('gives a direct flight as the two airports', () => {
    expect(
      routeForClipboard('', { icao: 'DAAG', runway: '05' }, { icao: 'OTHH', runway: '34R' })
    ).toBe('DAAG/05 OTHH/34R');
  });
});
